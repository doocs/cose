import { createHash, timingSafeEqual, randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
import { mcpPlatforms, resolveMcpPlatform } from '@cose/core/mcp'

const address = '127.0.0.1'
const completed = new Set(['saved', 'filled', 'review_required'])

export async function startBridge(token, port = 17831) {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token || '')) {
    throw new Error('Set COSE_MCP_TOKEN to a random base64url token (32–128 characters).')
  }
  const expected = Buffer.from(token)
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
    return {
      request_id: request.id,
      platform: request.platform.id,
      status: request.status,
      message: request.message,
    }
  }

  http.on('upgrade', (request, socket, head) => {
    if (
      request.url !== '/cose' ||
      request.headers.host !== `${address}:${http.address().port}` ||
      !/^chrome-extension:\/\/[a-p]{32}$/.test(request.headers.origin || '') ||
      sockets.clients.size >= 20
    ) {
      socket.destroy()
      return
    }
    sockets.handleUpgrade(request, socket, head, ws => sockets.emit('connection', ws))
  })

  sockets.on('connection', socket => {
    let profile
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
      if (request?.status === 'awaiting_confirmation') {
        finish(request, 'cancelled', 'Chrome disconnected before approval.')
      } else if (request?.status === 'saving') {
        finish(
          request,
          'not_confirmed',
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
        const presented = Buffer.from(typeof message?.token === 'string' ? message.token : '')
        const name = typeof message?.name === 'string' ? message.name.trim() : ''
        if (
          message?.type !== 'pair' ||
          !name ||
          name.length > 60 ||
          presented.length !== expected.length ||
          !timingSafeEqual(presented, expected)
        ) {
          socket.close(1008, 'Invalid token or browser name')
          return
        }
        if (message.protocol !== 2) {
          socket.close(1008, 'COSE extension and MCP bridge versions are incompatible')
          return
        }
        if ([...profiles.values()].some(other => other.name.toLowerCase() === name.toLowerCase())) {
          socket.close(1008, 'Browser name already paired')
          return
        }
        clearTimeout(authTimeout)
        profile = { id: randomUUID(), name, socket }
        profiles.set(profile.id, profile)
        send({ type: 'paired', id: profile.id, name })
        return
      }

      const request = requests.get(profile.requestId)
      if (!request || message?.id !== request.id) return
      if (request.status === 'awaiting_confirmation' && message.type === 'decision') {
        if (message.approved !== true) {
          finish(request, 'declined', 'The user declined the draft.')
          return
        }
        clearTimeout(request.timer)
        profile.saving = true
        request.status = 'saving'
        request.message = 'COSE is preparing the article in the selected browser.'
        request.timer = setTimeout(() => {
          finish(
            request,
            'not_confirmed',
            'Sync timed out. Check the editor or draft list before retrying.'
          )
        }, 120000)
        send({ type: 'execute', id: request.id })
      } else if (profile.saving && message.type === 'result') {
        profile.saving = false
        finish(
          request,
          message.status === 'saved' && request.platform.mode !== 'confirmed_draft'
            ? 'review_required'
            : completed.has(message.status)
              ? message.status
              : 'not_confirmed',
          typeof message.message === 'string' ? message.message.slice(0, 500) : ''
        )
      }
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
      title,
      markdown,
      text,
    }) {
      if ((markdown === undefined) === (text === undefined)) {
        throw new Error('Provide exactly one article body: markdown or text.')
      }
      const platform = resolveMcpPlatform(platformName)
      if (!platform)
        throw new Error('Unknown or ambiguous platform. Use an ID from list_platforms.')
      if (platform.mode === 'requires_editor_connection') {
        throw new Error(
          `${platform.name} requires a connection configured in the MD editor. Use the editor to sync it.`
        )
      }
      const fingerprint = createHash('sha256')
        .update(JSON.stringify([platform.id, title, markdown, text]))
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
      if (profile.saving || requests.get(profile.requestId)?.status === 'awaiting_confirmation') {
        throw new Error('This browser already has a draft request in progress.')
      }
      if (requests.size >= 512) throw new Error('Request history is full. Restart COSE MCP.')
      const request = {
        id,
        browserId,
        platform,
        fingerprint,
        status: 'awaiting_confirmation',
        message: 'Confirm the draft in the selected Chrome window.',
      }
      requests.set(id, request)
      profile.requestId = id
      request.timer = setTimeout(() => {
        finish(request, 'cancelled', 'Approval timed out.')
        profile.socket.send(JSON.stringify({ type: 'expired', id }))
      }, 300000)
      profile.socket.send(JSON.stringify({ type: 'draft', id, platform, title, markdown, text }))
      return view(request)
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
