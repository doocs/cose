import { devtoPermission, editorOrigin, getDevtoUsername } from '@cose/core/src/platforms/devto.js'

// Popup script for COSE extension
document.getElementById('openOfficial').addEventListener('click', e => {
  e.preventDefault()
  chrome.tabs.create({ url: 'https://md.doocs.org' })
  window.close()
})

const devtoForm = document.getElementById('devtoForm')
const keyInput = document.getElementById('devtoKey')
const editorInput = document.getElementById('devtoEditor')
const status = document.getElementById('devtoStatus')
const nextStep = document.getElementById('devtoNext')
const connect = document.getElementById('devtoConnect')
const disconnect = document.getElementById('devtoDisconnect')

function showConnection(connection) {
  editorInput.value = connection?.editorOrigin ?? ''
  disconnect.hidden = !connection
  nextStep.hidden = !connection
  status.textContent = connection ? `已连接 @${connection.username}` : '尚未连接 DEV.to'
}

connect.disabled = true
chrome.storage.local.get('devtoConnection').then(
  ({ devtoConnection }) => {
    showConnection(devtoConnection)
    connect.disabled = false
  },
  () => {
    status.textContent = '无法读取 DEV.to 连接配置'
  }
)

devtoForm.addEventListener('submit', async event => {
  event.preventDefault()
  const apiKey = keyInput.value.trim()
  const editorUrl = editorInput.value.trim()
  const customOrigin = editorUrl ? editorOrigin(editorUrl) : null
  if (editorUrl && !customOrigin) {
    status.textContent = '请输入 HTTPS 编辑器地址，或本机开发地址'
    return
  }
  if (!apiKey) {
    status.textContent = '请输入 DEV.to API Key'
    return
  }

  connect.disabled = true
  disconnect.disabled = true
  status.textContent = '正在验证 DEV.to 账号…'
  try {
    if (!(await chrome.permissions.request(devtoPermission))) {
      status.textContent = '需要允许 COSE 访问 dev.to'
      return
    }
    const username = await getDevtoUsername(apiKey)
    const devtoConnection = { apiKey, username, editorOrigin: customOrigin }
    await chrome.storage.local.set({ devtoConnection })
    keyInput.value = ''
    showConnection(devtoConnection)
  } catch (error) {
    status.textContent = error.message.startsWith('DEV.to ')
      ? error.message
      : '无法连接 DEV.to，请检查网络和 API Key'
  } finally {
    connect.disabled = false
    disconnect.disabled = false
  }
})

disconnect.addEventListener('click', async () => {
  try {
    await chrome.storage.local.remove('devtoConnection')
    keyInput.value = ''
    showConnection(null)
  } catch {
    status.textContent = '无法移除 DEV.to 连接，请重试'
  }
})
