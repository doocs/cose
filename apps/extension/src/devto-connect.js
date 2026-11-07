import { devtoPermission, editorOrigin, getDevtoUsername } from '@cose/core/src/platforms/devto.js'

const form = document.getElementById('devtoForm')
const key = document.getElementById('devtoKey')
const status = document.getElementById('devtoStatus')
const connect = document.getElementById('devtoConnect')
const disconnect = document.getElementById('devtoDisconnect')
const locale = new URLSearchParams(location.search).get('lang')
const chinese = locale?.startsWith('zh')
const japanese = locale === 'ja-JP'
const text = (en, zh, ja) => (chinese ? zh : japanese ? ja : en)
document.documentElement.lang = locale || 'en'
connect.textContent = text('Connect', '连接', '接続')
disconnect.textContent = text('Disconnect', '断开连接', '接続を解除')
document.getElementById('devtoHelp').textContent = text(
  'COSE saves the key in this browser. Enter a new key here to replace it.',
  '密钥保存在此浏览器的 COSE 扩展中。需要更换时，直接输入新密钥。',
  'キーはこのブラウザーの COSE に保存されます。更新するには新しいキーを入力してください。'
)

const source = window.parent !== window && editorOrigin(document.referrer)
let connection

function notifyParent() {
  window.parent.postMessage({ type: 'cose-devto-connection-changed' }, source)
}

function showConnection() {
  const connected = connection?.editorOrigin === source || source === 'https://md.doocs.org'
  disconnect.hidden = !(connected && connection?.apiKey)
  status.textContent = disconnect.hidden
    ? ''
    : text('Connected as', '已连接', '接続済み') + ' @' + connection.username
}

async function initialize() {
  if (!source) {
    status.textContent = text(
      'Open this form from the MD editor.',
      '请从 MD 编辑器打开此表单。',
      'MD エディターからこのフォームを開いてください。'
    )
    return
  }
  ;({ devtoConnection: connection } = await chrome.storage.local.get('devtoConnection'))
  showConnection()
  connect.disabled = false
}

form.addEventListener('submit', async event => {
  event.preventDefault()
  if (!source || connect.disabled || !key.value.trim()) return
  const apiKey = key.value.trim()
  key.value = ''
  connect.disabled = true
  disconnect.disabled = true
  status.textContent = text(
    'Checking your DEV.to key…',
    '正在验证 DEV.to 密钥…',
    'DEV.to のキーを確認しています…'
  )
  try {
    if (!(await chrome.permissions.request(devtoPermission))) {
      status.textContent = text(
        'Allow access to dev.to to connect.',
        '请允许 COSE 访问 dev.to。',
        '接続するには dev.to へのアクセスを許可してください。'
      )
      return
    }
    const username = await getDevtoUsername(apiKey)
    const editor = source === 'https://md.doocs.org' ? (connection?.editorOrigin ?? null) : source
    const saved = { apiKey, username, editorOrigin: editor }
    await chrome.storage.local.set({ devtoConnection: saved })
    connection = saved
    showConnection()
    notifyParent()
  } catch {
    status.textContent = text(
      'Could not connect. Check the API key and try again.',
      '连接失败，请检查 API Key 后重试。',
      '接続できませんでした。API キーを確認して再試行してください。'
    )
  } finally {
    connect.disabled = false
    disconnect.disabled = false
  }
})

disconnect.addEventListener('click', async () => {
  if (!source || disconnect.hidden || disconnect.disabled) return
  connect.disabled = true
  disconnect.disabled = true
  try {
    await chrome.storage.local.remove('devtoConnection')
    connection = null
    key.value = ''
    showConnection()
    notifyParent()
  } catch {
    status.textContent = text(
      'Could not disconnect.',
      '断开连接失败。',
      '接続を解除できませんでした。'
    )
  } finally {
    connect.disabled = false
    disconnect.disabled = false
  }
})

initialize().catch(() => {
  status.textContent = text(
    'Could not load the DEV.to connection.',
    '无法读取 DEV.to 连接。',
    'DEV.to の接続設定を読み込めませんでした。'
  )
})
