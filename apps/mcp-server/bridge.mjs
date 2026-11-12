import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
import { mcpPlatforms, resolveMcpPlatform } from '@cose/core/mcp'
import { MCP_BRIDGE_PORT, MCP_BRIDGE_VERSION, pairingProof } from '@cose/core/mcp-protocol'

const address = '127.0.0.1'
const chromeStoreId = 'ilhikcdphhpjofhlnbojifbihhfmmhfk'
const extensionIdPattern = /^[a-p]{32}$/
const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const proofPattern = /^[0-9a-f]{64}$/
const completed = new Set(['saved', 'filled', 'review_required'])

export async function startBridge(token, port = MCP_BRIDGE_PORT, extensionId = chromeStoreId) {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token || '')) {
    throw new Error('Set COSE_MCP_TOKEN to a random base64url token (32–128 characters).')
  }
  if (!extensionIdPattern.test(extensionId)) throw new Error('Invalid COSE_MCP_EXTENSION_ID.')
  const origin = `chrome-extension://${extensionId}`
  const sign = (role, clientNonce, serverNonce) =>
    createHmac('sha256', token)
      .update(pairingProof(role, origin, clientNonce, serverNonce))
      .digest()
  const profiles = new Map()
  const requests = new Map()
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 8192 })
  const http = createServer((_, response) => response.writeHead(404).end())

  function finish(request, status, message) {
    clearTimeout(request.timer)
    request.status = status
    request.message = message
  }

  function view(request) {
    const view = {
      request_id: request.id,
      status: request.status,
      message: request.message,
    }
    if (!request.batch) return { ...view, platform: request.results[0].platform.id }
    return {
      ...view,
      results: request.results.map(({ platform, status, message }) => ({
        platform: platform.id,
        status,
        message,
      })),
    }
  }

  function finishResults(request, message) {
    if (request.results.length === 1) {
      const [result] = request.results
      finish(request, result.status, result.message)
      return
    }
    const successes = request.results.filter(result => completed.has(result.status)).length
    const status =
      successes === request.results.length
        ? 'completed'
        : successes
          ? 'partial_success'
          : 'not_confirmed'
    finish(request, status, message)
  }

  function interruptSync(request, message) {
    const current = request.results[request.next++]
    current.status = 'not_confirmed'
    current.message = message
    for (const result of request.results.slice(request.next)) {
      result.status = 'cancelled'
      result.message = 'COSE stopped before starting this platform.'
    }
    finishResults(request, message)
  }

  function executeNext(profile, request, article) {
    const current = request.results[request.next]
    profile.executingPlatform = current.platform.id
    request.status = current.status = 'saving'
    request.message = current.message = 'COSE is preparing the article in the selected browser.'
    request.timer = setTimeout(() => {
      // Keep the browser reserved until the in-flight editor operation reports back or disconnects.
      interruptSync(request, 'Sync timed out. Check the editor or draft list before retrying.')
      profile.socket.send(JSON.stringify({ type: 'expired', id: request.id }))
    }, 120000)
    profile.socket.send(
      JSON.stringify({ type: 'execute', id: request.id, platform: current.platform.id, article })
    )
  }

  http.on('upgrade', (request, socket, head) => {
    if (
      request.url !== '/cose' ||
      request.headers.host !== `${address}:${http.address().port}` ||
      request.headers.origin !== origin ||
      sockets.clients.size >= 20
    ) {
      socket.destroy()
      return
    }
    sockets.handleUpgrade(request, socket, head, ws => sockets.emit('connection', ws))
  })

  sockets.on('connection', socket => {
    let profile
    let challenge
    let alive = true
    const send = message => socket.send(JSON.stringify(message))
    const authTimeout = setTimeout(() => socket.close(1008, 'Pairing required'), 5000)
    const heartbeat = setInterval(() => {
      if (!alive) return socket.terminate()
      alive = false
      socket.ping()
    }, 20000)
    socket.on('pong', () => {
      alive = true
    })
    socket.on('error', () => socket.terminate())
    socket.on('close', () => {
      clearTimeout(authTimeout)
      clearInterval(heartbeat)
      if (!profile) return
      profiles.delete(profile.id)
      const request = requests.get(profile.requestId)
      if (request?.status === 'saving') {
        interruptSync(
          request,
          'Chrome disconnected during sync. Check the editor or draft list before retrying.'
        )
      }
    })

    socket.on('message', data => {
      let message
      try {
        message = JSON.parse(data.toString())
      } catch {
        socket.close(1008, 'Invalid message')
        return
      }
      if (!profile) {
        if (!challenge && message?.type === 'hello') {
          if (message.protocol !== MCP_BRIDGE_VERSION) {
            socket.close(1008, 'COSE extension and MCP bridge versions are incompatible')
            return
          }
          if (typeof message.nonce !== 'string' || !proofPattern.test(message.nonce)) {
            socket.close(1008, 'Invalid pairing challenge')
            return
          }
          const clientNonce = message.nonce
          const serverNonce = randomBytes(32).toString('hex')
          challenge = { clientNonce, serverNonce }
          send({
            type: 'challenge',
            nonce: serverNonce,
            proof: sign('server', clientNonce, serverNonce).toString('hex'),
          })
          return
        }
        const name = typeof message?.name === 'string' ? message.name.trim() : ''
        const id = message?.browserId
        if (
          !challenge ||
          message?.type !== 'pair' ||
          !name ||
          name.length > 60 ||
          typeof id !== 'string' ||
          !uuidPattern.test(id) ||
          typeof message.proof !== 'string' ||
          !proofPattern.test(message.proof) ||
          !timingSafeEqual(
            Buffer.from(message.proof, 'hex'),
            sign('extension', challenge.clientNonce, challenge.serverNonce)
          )
        ) {
          socket.close(1008, 'Invalid pairing proof or browser name')
          return
        }
        if (
          profiles.has(id) ||
          [...profiles.values()].some(other => other.name.toLowerCase() === name.toLowerCase())
        ) {
          socket.close(1008, 'Browser identity or name already paired')
          return
        }
        clearTimeout(authTimeout)
        profile = { id, name, socket }
        profiles.set(id, profile)
        send({ type: 'paired', id, name })
        return
      }

      if (message?.type === 'ping') {
        send({ type: 'pong' })
        return
      }

      const request = requests.get(profile.requestId)
      if (
        !request ||
        message?.id !== request.id ||
        message.type !== 'result' ||
        !profile.executingPlatform ||
        message.platform !== profile.executingPlatform
      ) {
        return
      }
      profile.executingPlatform = undefined
      if (request.status !== 'saving') return
      clearTimeout(request.timer)
      const current = request.results[request.next++]
      current.status =
        message.status === 'saved' && current.platform.mode !== 'confirmed_draft'
          ? 'review_required'
          : completed.has(message.status)
            ? message.status
            : 'not_confirmed'
      current.message = typeof message.message === 'string' ? message.message.slice(0, 500) : ''
      if (request.next < request.results.length) executeNext(profile, request)
      else finishResults(request, 'See the result for each platform.')
    })
  })

  await new Promise((resolve, reject) => {
    http.once('error', reject)
    http.listen(port, address, resolve)
  })

  return {
    port: http.address().port,
    listPlatforms() {
      return {
        platforms: mcpPlatforms,
        browsers: [...profiles.values()]
          .filter(profile => profile.socket.readyState === WebSocket.OPEN)
          .map(({ id, name }) => ({ id, name })),
      }
    },
    createDraft({
      request_id: id,
      browser_id: browserId,
      platform: platformName,
      platforms: platformNames,
      title,
      markdown,
      text,
    }) {
      if ((markdown === undefined) === (text === undefined)) {
        throw new Error('Provide exactly one article body: markdown or text.')
      }
      const batch = platformNames !== undefined
      if ((platformNames === undefined) === (platformName === undefined)) {
        throw new Error('Provide exactly one of platform or platforms.')
      }
      const names = batch ? platformNames : [platformName]
      if (!Array.isArray(names) || !names.length) throw new Error('Choose at least one platform.')
      const targets = new Map()
      for (const name of names) {
        const platform = typeof name === 'string' && resolveMcpPlatform(name)
        if (!platform)
          throw new Error(
            `Unknown or ambiguous platform: ${String(name)}. Use an ID from list_platforms.`
          )
        if (platform.mode === 'requires_editor_connection') {
          throw new Error(
            `${platform.name} requires a connection configured in the MD editor. Use the editor to sync it.`
          )
        }
        targets.set(platform.id, platform)
      }
      const platforms = [...targets.values()]
      const fingerprint = createHash('sha256')
        .update(JSON.stringify([[...targets.keys()].sort(), title, markdown, text]))
        .digest('hex')
      const previous = requests.get(id)
      if (previous) {
        if (previous.browserId !== browserId)
          throw new Error('This request ID belongs to another browser.')
        if (previous.fingerprint !== fingerprint) {
          throw new Error('This request ID was already used with different article content.')
        }
        return view(previous)
      }
      const profile = profiles.get(browserId)
      if (profile?.socket.readyState !== WebSocket.OPEN) {
        throw new Error(
          'That Chrome instance is disconnected. Pair it in COSE and call list_platforms again.'
        )
      }
      if (profile.executingPlatform) {
        throw new Error('This browser already has a draft request in progress.')
      }
      if (requests.size >= 512) throw new Error('Request history is full. Restart COSE MCP.')
      const request = {
        id,
        browserId,
        batch,
        next: 0,
        results: platforms.map(platform => ({ platform, status: 'queued' })),
        fingerprint,
        status: 'queued',
        message: 'COSE is preparing the article in the selected browser.',
      }
      requests.set(id, request)
      profile.requestId = id
      const accepted = view(request)
      executeNext(profile, request, { platforms, title, markdown, text })
      return accepted
    },
    getDraft(id) {
      const request = requests.get(id)
      if (!request) throw new Error('Unknown draft request ID.')
      return view(request)
    },
    close() {
      for (const request of requests.values()) clearTimeout(request.timer)
      for (const socket of sockets.clients) socket.terminate()
      sockets.close()
      http.close()
    },
  }
}
