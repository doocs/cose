import { editorOrigin } from '@cose/core/src/platforms/devto.js'
import {
  connectWordPress,
  wordPressConnectionKey,
  wordPressPermission,
  wordPressSite,
} from '@cose/core/src/platforms/wordpress.js'

const params = new URLSearchParams(location.search)
const origin = editorOrigin(params.get('editor'))
const storageKey = wordPressConnectionKey(origin)
const locale = params.get('lang') || 'en'
const t = (en, zh, tw, ja) => {
  if (locale === 'zh-TW') return tw
  if (locale.startsWith('zh')) return zh
  if (locale.startsWith('ja')) return ja
  return en
}
const element = id => document.getElementById(id)
const site = element('site')
const username = element('username')
const password = element('password')
const connect = element('connect')
const disconnect = element('disconnect')
const status = element('status')

document.documentElement.lang = locale
element('heading').textContent = t(
  'Connect WordPress',
  '连接 WordPress',
  '連接 WordPress',
  'WordPress に接続'
)
element('help').textContent = t(
  "Create an application password in your self-hosted site's WordPress user profile. COSE stores it in this browser.",
  '请在自建 WordPress 站点的用户资料页生成应用程序密码。COSE 将凭据保存在此浏览器。',
  '請在自架 WordPress 網站的使用者個人資料頁面產生應用程式密碼。COSE 會將憑證儲存在此瀏覽器。',
  '自分でホストする WordPress のプロフィールでアプリケーションパスワードを作成してください。認証情報はこのブラウザーに保存されます。'
)
element('editor').textContent = origin
element('site-label').textContent = t(
  'WordPress installation URL',
  'WordPress 安装地址',
  'WordPress 安裝網址',
  'WordPress のインストール先 URL'
)
element('username-label').textContent = t(
  'WordPress username',
  'WordPress 用户名',
  'WordPress 使用者名稱',
  'WordPress ユーザー名'
)
element('password-label').textContent = t(
  'Application password',
  '应用程序密码',
  '應用程式密碼',
  'アプリケーションパスワード'
)
connect.textContent = t('Connect', '连接', '連接', '接続')
disconnect.textContent = t('Disconnect', '断开连接', '中斷連線', '接続を解除')

function showConnection(connection) {
  site.value = connection?.site || ''
  username.value = connection?.username || ''
  disconnect.hidden = !connection
  status.textContent = connection
    ? t(
        'Connected. Return to the editor to sync.',
        '已连接，请返回编辑器同步。',
        '已連接，請返回編輯器同步。',
        '接続しました。エディターに戻って同期してください。'
      )
    : ''
}

function setBusy(busy) {
  connect.disabled = busy
  disconnect.disabled = busy
}

element('connection').addEventListener('submit', async event => {
  event.preventDefault()
  if (!origin || connect.disabled || !username.value.trim() || !password.value.trim()) return
  let address
  try {
    address = wordPressSite(site.value)
  } catch {
    status.textContent = t(
      'Enter the HTTPS installation URL.',
      '请输入 HTTPS 安装地址。',
      '請輸入 HTTPS 安裝網址。',
      'HTTPS のインストール先 URL を入力してください。'
    )
    return
  }
  const user = username.value
  const secret = password.value
  password.value = ''
  setBusy(true)
  status.textContent = ''
  try {
    if (!(await chrome.permissions.request(wordPressPermission(address)))) {
      status.textContent = t(
        'Allow access to this site to connect.',
        '请允许访问此站点。',
        '請允許存取此網站。',
        'このサイトへのアクセスを許可してください。'
      )
      return
    }
    const connection = await connectWordPress(address, user, secret)
    await chrome.storage.local.set({ [storageKey]: connection })
    showConnection(connection)
  } catch {
    status.textContent = t(
      'Connection failed. Check the installation URL, username, application password and REST API access.',
      '连接失败，请检查安装地址、用户名、应用程序密码及 REST API 是否可用。',
      '連接失敗，請檢查安裝網址、使用者名稱、應用程式密碼和 REST API 是否可用。',
      '接続できませんでした。URL、ユーザー名、アプリケーションパスワード、REST API の設定を確認してください。'
    )
  } finally {
    setBusy(false)
  }
})

disconnect.addEventListener('click', async () => {
  if (!origin || disconnect.disabled) return
  setBusy(true)
  try {
    await chrome.storage.local.remove(storageKey)
    password.value = ''
    showConnection(null)
  } catch {
    status.textContent = t(
      'Could not disconnect.',
      '断开连接失败。',
      '中斷連線失敗。',
      '接続を解除できませんでした。'
    )
  } finally {
    setBusy(false)
  }
})

if (origin) {
  chrome.storage.local.get(storageKey).then(
    ({ [storageKey]: connection }) => {
      showConnection(connection)
      setBusy(false)
    },
    () => {
      status.textContent = t(
        'Could not load the connection.',
        '无法读取连接。',
        '無法讀取連線。',
        '接続設定を読み込めませんでした。'
      )
    }
  )
}
