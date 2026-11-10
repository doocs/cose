const form = document.getElementById('pair')
const connect = document.getElementById('connect')
const disconnect = document.getElementById('disconnect')
const tokenInput = document.getElementById('token')
const status = document.getElementById('status')
const draft = document.getElementById('draft')
const target = document.getElementById('target')
const approve = document.getElementById('approve')
const title = document.getElementById('title')
const text = document.getElementById('text')
let socket
let pending

function clearDraft() {
  draft.hidden = true
  title.textContent = ''
  text.textContent = ''
  pending = undefined
}

async function focusReview() {
  const tab = await chrome.tabs.getCurrent()
  if (tab?.id === undefined) return
  await chrome.tabs.update(tab.id, { active: true })
  await chrome.windows.update(tab.windowId, { focused: true })
}

form.addEventListener('submit', event => {
  event.preventDefault()
  const name = document.getElementById('name').value.trim()
  if (!name || socket) return
  const token = tokenInput.value
  tokenInput.value = ''
  connect.disabled = true
  status.textContent = '正在连接…'
  const connection = new WebSocket('ws://127.0.0.1:17831/cose')
  socket = connection
  let paired = false
  connection.addEventListener('open', () => {
    connection.send(JSON.stringify({ type: 'pair', protocol: 2, name, token }))
  })
  connection.addEventListener('close', event => {
    socket = undefined
    connect.disabled = false
    form.hidden = false
    disconnect.hidden = true
    clearDraft()
    status.textContent = paired
      ? '已断开。若刚确认保存，请先检查编辑器或草稿。'
      : `无法配对。请确认本地 MCP 已启动、令牌正确且实例名未被占用。${event.reason ? ` (${event.reason})` : ''}`
  })
  connection.addEventListener('message', async event => {
    let message
    try {
      message = JSON.parse(event.data)
    } catch {
      connection.close(1008, 'Invalid bridge message')
      return
    }
    if (!message || typeof message !== 'object') return
    if (message.type === 'paired') {
      paired = true
      form.hidden = true
      disconnect.hidden = false
      status.textContent = `已连接 · ${message.name}`
      return
    }
    if (message.type === 'draft') {
      pending = message
      title.textContent = message.title
      target.textContent = message.platform.name
      text.textContent = message.markdown ?? message.text
      approve.textContent = message.platform.mode === 'confirmed_draft' ? '保存为草稿' : '填写文章'
      draft.hidden = false
      status.textContent = '等待确认'
      focusReview().catch(() => {})
      return
    }
    if (message.id !== pending?.id) return
    if (message.type === 'expired') {
      status.textContent = '请求已超时。若刚确认保存，请先检查编辑器或草稿。'
      clearDraft()
      return
    }
    if (message.type !== 'execute' || pending.approved !== true) return
    const { id, platform, title: articleTitle, markdown, text: articleText } = pending
    clearDraft()
    status.textContent = `正在同步到${platform.name}…`
    let result
    try {
      result = await chrome.runtime.sendMessage({
        type: 'MCP_ARTICLE_DRAFT',
        platformId: platform.id,
        markdown,
        title: articleTitle,
        text: articleText,
      })
    } catch {
      result = { status: 'not_confirmed', message: '未收到扩展的结果，请检查编辑器或草稿。' }
    }
    const outcome = result?.message || result?.error || '无法确认同步，请先检查编辑器或草稿。'
    if (connection.readyState === WebSocket.OPEN) {
      status.textContent = outcome
      connection.send(
        JSON.stringify({ type: 'result', id, status: result?.status, message: outcome })
      )
    }
  })
})

disconnect.addEventListener('click', () => socket?.close())
for (const [button, approved] of [
  ['approve', true],
  ['decline', false],
]) {
  document.getElementById(button).addEventListener('click', () => {
    if (!pending || pending.approved || socket?.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify({ type: 'decision', id: pending.id, approved }))
    if (approved) {
      pending.approved = true
      draft.hidden = true
      status.textContent = '等待本地 MCP 确认…'
    } else {
      clearDraft()
      status.textContent = '已拒绝'
    }
  })
}
