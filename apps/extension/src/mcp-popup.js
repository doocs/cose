import { MCP_DEFAULT_BROWSER_NAME, MCP_SETUP_TOKEN_KEY } from '@cose/core/src/mcp-protocol.js'

export async function showMcpSettings() {
  const panel = document.getElementById('mcpPanel')
  const window = await chrome.windows.getCurrent()
  if (!Number.isInteger(window.id) || window.incognito) return
  panel.hidden = false
  const send = message => chrome.runtime.sendMessage({ ...message, windowId: window.id })
  const form = document.getElementById('pair')
  const connect = document.getElementById('connect')
  const disconnect = document.getElementById('disconnect')
  const retry = document.getElementById('retryMcp')
  const setup = document.getElementById('copyMcpSetup')
  const setupText = document.getElementById('mcpSetupText')
  const toggleSetup = document.getElementById('toggleMcpSetup')
  const setupStatus = document.getElementById('mcpSetupStatus')
  const name = document.getElementById('name')
  const token = document.getElementById('token')
  const generate = document.getElementById('generateMcpToken')
  const tokenStatus = document.getElementById('mcpTokenStatus')
  const autoFill = document.getElementById('autoFill')
  const status = document.getElementById('status')
  const draft = document.getElementById('draft')
  const target = document.getElementById('target')
  const approve = document.getElementById('approve')
  const title = document.getElementById('title')
  const text = document.getElementById('text')
  let pending
  let initialized = false
  let busy = false
  let actionError

  async function refresh() {
    if (busy) return
    const state = await send({ type: 'MCP_PAIR_STATUS' })
    if (!state || busy) return
    if (!initialized) {
      name.value = state.name ?? MCP_DEFAULT_BROWSER_NAME
      autoFill.checked = state.autoFill === true
      initialized = true
      const stored = await chrome.storage.session.get(MCP_SETUP_TOKEN_KEY)
      if (!token.value && stored[MCP_SETUP_TOKEN_KEY]) {
        token.value = stored[MCP_SETUP_TOKEN_KEY]
        tokenStatus.textContent = '已填入刚生成的令牌。配对时请使用客户端里的同一份令牌。'
      }
    }
    token.required = !state.enabled
    token.placeholder = state.enabled ? '留空继续使用已保存的令牌' : ''
    connect.textContent = state.enabled ? '保存并使用此窗口' : '启用并配对'
    disconnect.hidden = !state.enabled
    retry.hidden = !state.enabled || state.connected || !state.isTargetWindow
    const connectionStatus = state.connected
      ? state.isTargetWindow
        ? `已连接 · ${state.name}`
        : `已连接 · ${state.name}（另一个窗口）`
      : !state.enabled
        ? ''
        : !state.isTargetWindow
          ? '设置已保存。请在目标窗口点击「保存并使用此窗口」。'
          : state.connecting
            ? '设置已保存，正在连接本地 MCP。'
            : '等待桌面 MCP 服务。启动已配置 COSE 的客户端后会自动连接。'
    status.textContent =
      actionError ||
      (state.pending ? '等待确认。' : [connectionStatus, state.outcome].filter(Boolean).join(' '))
    status.hidden = !status.textContent
    if (state.pending && state.pending.id !== pending?.id) panel.open = true
    pending = state.pending
    draft.hidden = !pending
    title.textContent = pending?.title ?? ''
    target.textContent = pending?.platform?.name ?? ''
    text.textContent = pending?.markdown ?? pending?.text ?? ''
    approve.textContent = pending?.platform?.mode === 'confirmed_draft' ? '保存为草稿' : '填写文章'
  }

  async function update(request) {
    if (busy) return
    busy = true
    actionError = undefined
    connect.disabled = true
    disconnect.disabled = true
    generate.disabled = true
    retry.disabled = true
    let error
    try {
      const result = await send(request)
      error = result?.error
    } catch {
      error = '无法连接 COSE 扩展后台。'
    } finally {
      busy = false
      connect.disabled = false
      disconnect.disabled = false
      generate.disabled = false
      retry.disabled = false
    }
    if (error) {
      actionError = error
      status.hidden = false
      status.textContent = error
      return false
    }
    await refresh()
    return true
  }

  function showSetupPrompt(visible) {
    setupText.hidden = !visible
    toggleSetup.setAttribute('aria-expanded', String(visible))
    toggleSetup.textContent = visible ? '收起指令' : '查看指令'
  }

  toggleSetup.addEventListener('click', () => showSetupPrompt(setupText.hidden))
  setup.addEventListener('click', async () => {
    setupStatus.hidden = false
    try {
      await navigator.clipboard.writeText(setupText.value.trim())
      setupStatus.textContent = '配置指令已复制，请粘贴给你的 AI agent。'
    } catch {
      showSetupPrompt(true)
      setupText.focus()
      setupText.select()
      setupStatus.textContent = '已选中配置指令，可以直接复制。'
    }
  })
  retry.addEventListener('click', () => update({ type: 'MCP_PAIR_RETRY' }))

  generate.addEventListener('click', async () => {
    const pairingToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte =>
      byte.toString(16).padStart(2, '0')
    ).join('')
    token.type = 'password'
    token.value = pairingToken
    const [copied, staged] = await Promise.allSettled([
      navigator.clipboard.writeText(pairingToken),
      chrome.storage.session.set({ [MCP_SETUP_TOKEN_KEY]: pairingToken }),
    ])
    if (token.value !== pairingToken) return
    if (copied.status === 'fulfilled') {
      tokenStatus.textContent = '新令牌已复制，请粘贴到 MCP 客户端配置。'
    } else {
      token.type = 'text'
      token.focus()
      token.select()
      tokenStatus.textContent = '新令牌已填入，请手动复制到 MCP 客户端配置。'
    }
    if (staged.status === 'rejected') tokenStatus.textContent += ' 关闭弹窗前请先复制。'
  })

  form.addEventListener('submit', async event => {
    event.preventDefault()
    const pairingToken = token.value
    const saved = await update({
      type: 'MCP_PAIR_SAVE',
      name: name.value,
      token: pairingToken,
      autoFill: autoFill.checked,
    })
    if (saved && token.value === pairingToken) {
      token.value = ''
      token.type = 'password'
      tokenStatus.textContent = '需要更新令牌时，请同步更新 MCP 客户端配置。'
    }
  })

  disconnect.addEventListener('click', async () => {
    if (await update({ type: 'MCP_PAIR_DISABLE' })) {
      autoFill.checked = false
      name.value = MCP_DEFAULT_BROWSER_NAME
      token.value = ''
      token.type = 'password'
      tokenStatus.textContent = ''
    }
  })
  for (const [button, approved] of [
    ['approve', true],
    ['decline', false],
  ]) {
    document.getElementById(button).addEventListener('click', () => {
      if (pending) update({ type: 'MCP_PAIR_DECIDE', id: pending.id, approved })
    })
  }
  const refreshPage = () =>
    refresh().catch(() => {
      status.hidden = false
      status.textContent = '无法读取 COSE 的 MCP 状态。'
    })
  refreshPage()
  setInterval(refreshPage, 1000)
}
