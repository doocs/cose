import {
  MCP_BRIDGE_PORT,
  MCP_BRIDGE_VERSION,
  MCP_DEFAULT_BROWSER_NAME,
  MCP_SETUP_TOKEN_KEY,
  pairingProof,
} from '@cose/core/src/mcp-protocol.js'

const settingsKey = 'coseMcpPairing'
const windowKey = 'coseMcpWindow'
const reconnectAlarm = 'coseMcpReconnect'
const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
const hexPattern = /^[0-9a-f]{64}$/

export function installMcpBridge(syncArticle) {
  if (!chrome.runtime.getManifest().permissions.includes('alarms')) return

  const popupUrl = chrome.runtime.getURL('popup.html')
  let connection
  let connecting
  let batch
  let running = false
  let outcome = ''
  let generation = 0
  let updating = false

  async function settings() {
    return (await chrome.storage.local.get(settingsKey))[settingsKey]
  }

  async function targetWindow(restoreWindow) {
    const stored = (await chrome.storage.session.get(windowKey))[windowKey]
    if (stored !== undefined) {
      const window = await chrome.windows.get(stored).catch(() => null)
      return window?.type === 'normal' && !window.incognito ? window.id : undefined
    }
    if (!restoreWindow) return undefined
    const windows = (await chrome.windows.getAll({ windowTypes: ['normal'] })).filter(
      w => !w.incognito
    )
    if (windows.length !== 1) return undefined
    await chrome.storage.session.set({ [windowKey]: windows[0].id })
    return windows[0].id
  }

  function send(socket, message) {
    if (connection?.socket === socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message))
    }
  }

  function disconnect() {
    generation++
    batch = undefined
    const previous = connection
    connection = undefined
    previous?.socket.close()
  }

  async function openConnection(currentGeneration, restoreWindow) {
    const pairing = await settings()
    if (!pairing || currentGeneration !== generation) return
    if (!(await chrome.alarms.get(reconnectAlarm))) {
      await chrome.alarms.create(reconnectAlarm, { periodInMinutes: 0.5 })
    }
    const windowId = await targetWindow(restoreWindow)
    if (currentGeneration !== generation || windowId === undefined) return

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(pairing.token),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    )
    if (currentGeneration !== generation) return

    const clientNonce = hex(crypto.getRandomValues(new Uint8Array(32)))
    const origin = `chrome-extension://${chrome.runtime.id}`
    const proof = (role, serverNonce) =>
      new TextEncoder().encode(pairingProof(role, origin, clientNonce, serverNonce))
    const socket = new WebSocket(`ws://127.0.0.1:${MCP_BRIDGE_PORT}/cose`)
    const state = { socket, windowId, authenticated: false }
    connection = state
    let serverVerified = false
    const handshakeTimeout = setTimeout(() => socket.close(), 6000)
    const heartbeat = setInterval(() => {
      if (state.authenticated) send(socket, { type: 'ping' })
    }, 20000)

    socket.addEventListener('open', () => {
      send(socket, { type: 'hello', protocol: MCP_BRIDGE_VERSION, nonce: clientNonce })
    })
    socket.addEventListener('close', event => {
      clearTimeout(handshakeTimeout)
      clearInterval(heartbeat)
      if (connection !== state) return
      connection = undefined
      batch = undefined
      outcome = event.reason || ''
    })
    socket.addEventListener('message', async event => {
      if (connection !== state) return
      try {
        const message = JSON.parse(event.data)
        if (!state.authenticated) {
          if (!serverVerified && message.type === 'challenge') {
            const { nonce, proof: signature } = message
            if (
              typeof nonce !== 'string' ||
              !hexPattern.test(nonce) ||
              typeof signature !== 'string' ||
              !hexPattern.test(signature) ||
              !(await crypto.subtle.verify(
                'HMAC',
                key,
                Uint8Array.from(signature.match(/../g), byte => Number.parseInt(byte, 16)),
                proof('server', nonce)
              ))
            ) {
              disconnect()
              outcome = '无法验证本地 MCP 服务。请检查客户端和扩展的配对令牌。'
              return
            }
            const signatureBytes = await crypto.subtle.sign('HMAC', key, proof('extension', nonce))
            serverVerified = true
            send(socket, {
              type: 'pair',
              browserId: pairing.id,
              name: pairing.name,
              proof: hex(new Uint8Array(signatureBytes)),
            })
          } else if (serverVerified && message.type === 'paired' && message.id === pairing.id) {
            clearTimeout(handshakeTimeout)
            state.authenticated = true
            outcome = ''
          } else {
            socket.close(4008, 'Invalid handshake')
          }
          return
        }

        if (message.type === 'execute' && message.article && !batch && !running) {
          outcome = ''
          batch = { ...message.article, id: message.id, next: 0, outcomes: [] }
        }

        if (!batch || batch.id !== message.id) return
        if (message.type === 'expired') {
          outcome = '同步已超时，请检查编辑器或草稿列表。'
          batch = undefined
        } else if (message.type === 'execute' && !running) {
          const article = batch
          const platform = article.platforms[article.next]
          if (!platform || message.platform !== platform.id) {
            socket.close(4008, 'Unexpected platform')
            return
          }
          running = true
          let result
          try {
            const window = await chrome.windows.get(windowId).catch(() => null)
            if (!window || connection !== state) {
              result = { status: 'not_confirmed', message: '目标窗口已关闭或配对已断开。' }
            } else {
              result = await syncArticle({ ...article, platform }, windowId)
            }
          } catch (error) {
            result = { status: 'not_confirmed', message: error.message || '无法确认同步结果。' }
          } finally {
            running = false
          }
          if (batch === article) {
            article.next++
            article.outcomes.push(
              article.platforms.length === 1
                ? result.message
                : `${platform.name}：${result.message || '无法确认同步结果。'}`
            )
            outcome = article.outcomes.join(' ')
            if (article.next === article.platforms.length) batch = undefined
          }
          send(socket, {
            type: 'result',
            id: article.id,
            platform: platform.id,
            status: result.status,
            message: result.message,
          })
        }
      } catch {
        socket.close(4008, 'Invalid MCP bridge message')
      }
    })
  }

  async function connect(restoreWindow = false) {
    if (connection || connecting || running || updating) return
    connecting = openConnection(generation, restoreWindow)
    try {
      await connecting
    } finally {
      connecting = undefined
    }
  }

  const reconnect = () =>
    connect().catch(() => {
      outcome = '无法启动本地 MCP 连接。'
    })
  chrome.runtime.onStartup.addListener(reconnect)
  chrome.runtime.onInstalled.addListener(reconnect)
  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === reconnectAlarm)
      connect(true).catch(() => {
        outcome = '无法启动本地 MCP 连接。'
      })
  })
  chrome.windows.onRemoved.addListener(windowId => {
    if (connection?.windowId === windowId) disconnect()
  })

  chrome.runtime.onMessage.addListener((request, sender, respond) => {
    if (
      typeof request?.type !== 'string' ||
      !request.type.startsWith('MCP_PAIR_') ||
      sender.url !== popupUrl ||
      !Number.isInteger(request.windowId) ||
      (sender.tab && sender.tab.windowId !== request.windowId)
    ) {
      return false
    }
    const { windowId } = request
    async function handle() {
      const window = await chrome.windows.get(windowId).catch(() => null)
      if (window?.type !== 'normal' || window.incognito)
        throw new Error('请在普通 Chrome 窗口打开 COSE。')
      const pairing = await settings()
      if (request.type === 'MCP_PAIR_STATUS') {
        return {
          enabled: Boolean(pairing),
          name: pairing?.name,
          connected: Boolean(connection?.authenticated),
          isTargetWindow:
            (connection?.windowId ?? (pairing && (await targetWindow(false)))) === windowId,
          connecting: Boolean(connecting || (connection && !connection.authenticated)),
          outcome,
          running,
        }
      }
      if (request.type === 'MCP_PAIR_SAVE') {
        const requestedName = typeof request.name === 'string' ? request.name.trim() : ''
        const name = requestedName || pairing?.name || MCP_DEFAULT_BROWSER_NAME
        const token = request.token || pairing?.token
        if (name.length > 60 || !/^[A-Za-z0-9_-]{32,128}$/.test(token || '')) {
          throw new Error('请输入实例名和有效的配对令牌。')
        }
        if (updating) throw new Error('配对设置正在更新，请稍后重试。')
        updating = true
        try {
          disconnect()
          await connecting
          await chrome.storage.local.set({
            [settingsKey]: {
              id: pairing?.id ?? crypto.randomUUID(),
              name,
              token,
            },
          })
          await chrome.storage.session.set({ [windowKey]: windowId })
          await chrome.storage.session.remove(MCP_SETUP_TOKEN_KEY)
          outcome = ''
        } finally {
          updating = false
        }
        await connect()
      } else if (request.type === 'MCP_PAIR_RETRY') {
        if (!pairing || (await targetWindow(false)) !== windowId) {
          throw new Error('请先在此窗口保存配对设置。')
        }
        outcome = ''
        await connect()
      } else if (request.type === 'MCP_PAIR_DISABLE') {
        if (updating) throw new Error('配对设置正在更新，请稍后重试。')
        updating = true
        try {
          disconnect()
          await connecting
          await chrome.storage.local.remove(settingsKey)
          await chrome.storage.session.remove([windowKey, MCP_SETUP_TOKEN_KEY])
          await chrome.alarms.clear(reconnectAlarm)
          outcome = ''
        } finally {
          updating = false
        }
      }
      return { ok: true }
    }
    handle().then(respond, error => respond({ error: error.message }))
    return true
  })
  reconnect()
}
