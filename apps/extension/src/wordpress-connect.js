import { editorOrigin } from '@cose/core/src/platforms/devto.js'
import {
  connectWordPress,
  wordPressConnectionKey,
  wordPressPermission,
  wordPressSite,
} from '@cose/core/src/platforms/wordpress.js'

const params = new URLSearchParams(location.search)
let origin
let storageKey
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
element('help').textContent = t(
  "Create an application password in your self-hosted site's WordPress user profile. COSE stores it in this browser.",
  '请在自建 WordPress 站点的用户资料页生成应用程序密码。COSE 将凭据保存在此浏览器。',
  '請在自架 WordPress 網站的使用者個人資料頁面產生應用程式密碼。COSE 會將憑證儲存在此瀏覽器。',
  '自分でホストする WordPress のプロフィールでアプリケーションパスワードを作成してください。認証情報はこのブラウザーに保存されます。'
)
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
  status.textContent = connection ? t('Connected.', '已连接。', '已連接。', '接続しました。') : ''
}

function setBusy(busy) {
  connect.disabled = busy
  disconnect.disabled = busy
}

const form = element('connection')

function notifyParent() {
  window.parent.postMessage({ type: 'cose-wordpress-connection-changed' }, origin)
}

form.addEventListener('submit', async event => {
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
  setBusy(true)
  status.textContent = ''
  try {
    const permission = wordPressPermission(address)
    const granted = chrome.permissions
      ? await chrome.permissions.request(permission)
      : (await chrome.runtime.sendMessage({ type: 'CHECK_WORDPRESS_HOST', site: address }))?.granted
    if (!granted) {
      status.textContent = chrome.permissions
        ? t(
            'Allow access to this site to connect.',
            '请允许访问此站点。',
            '請允許存取此網站。',
            'このサイトへのアクセスを許可してください。'
          )
        : t(
            'In the Firefox toolbar, open COSE and allow the WordPress site. Then click Connect again.',
            '请在 Firefox 工具栏打开 COSE，授权此 WordPress 站点，然后再次点击「连接」。',
            '請在 Firefox 工具列開啟 COSE，授權此 WordPress 網站，然後再點擊「連接」。',
            'Firefox のツールバーで COSE を開いてサイトへのアクセスを許可し、もう一度「接続」を押してください。'
          )
      return
    }
    password.value = ''
    const connection = await connectWordPress(address, user, secret)
    await chrome.storage.local.set({ [storageKey]: connection })
    showConnection(connection)
    notifyParent()
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
    notifyParent()
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

function initialize(event) {
  if (
    window.parent === window ||
    window.parent !== window.top ||
    event.source !== window.parent ||
    event.data?.type !== 'cose-wordpress-initialize'
  )
    return
  const parentOrigin = editorOrigin(event.origin)
  if (!parentOrigin) return
  window.removeEventListener('message', initialize)
  origin = parentOrigin
  storageKey = wordPressConnectionKey(origin)
  new ResizeObserver(() => {
    const height = Math.ceil(form.getBoundingClientRect().height)
    window.parent.postMessage({ type: 'cose-wordpress-form-height', height }, origin)
  }).observe(form)
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

window.addEventListener('message', initialize)
