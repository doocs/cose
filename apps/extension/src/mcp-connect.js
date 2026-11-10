const form = document.getElementById('pair')
const connect = document.getElementById('connect')
const disconnect = document.getElementById('disconnect')
const name = document.getElementById('name')
const token = document.getElementById('token')
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
  const state = await chrome.runtime.sendMessage({ type: 'MCP_PAIR_STATUS' })
  if (!state || busy) return
  if (!initialized) {
    name.value = state.name || ''
    autoFill.checked = state.autoFill === true
    initialized = true
  }
  token.required = !state.enabled
  token.placeholder = state.enabled ? '留空继续使用已保存的令牌' : ''
  connect.textContent = state.enabled ? '保存并使用此窗口' : '启用并配对'
  disconnect.hidden = !state.enabled
  status.textContent =
    actionError ||
    state.outcome ||
    (state.connected
      ? `已连接 · ${state.name}`
      : state.enabled
        ? '等待连接。若此配置文件有多个窗口，请在目标窗口点击「保存并使用此窗口」。'
        : 'MCP 未启用。')
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
  let error
  try {
    const result = await chrome.runtime.sendMessage(request)
    error = result?.error
  } catch {
    error = '无法连接 COSE 扩展后台。'
  } finally {
    busy = false
    connect.disabled = false
    disconnect.disabled = false
  }
  if (error) {
    actionError = error
    status.textContent = error
    return
  }
  await refresh()
}

form.addEventListener('submit', event => {
  event.preventDefault()
  const pairingToken = token.value
  token.value = ''
  update({
    type: 'MCP_PAIR_SAVE',
    name: name.value,
    token: pairingToken,
    autoFill: autoFill.checked,
  })
})

disconnect.addEventListener('click', () => {
  autoFill.checked = false
  update({ type: 'MCP_PAIR_DISABLE' })
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
    status.textContent = '无法读取 COSE 的 MCP 状态。'
  })
refreshPage()
setInterval(refreshPage, 1000)
