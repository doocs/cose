import { connectHalo, haloConnectionKey, haloSite } from '@cose/core/src/platforms/halo.js'
import { editorOrigin } from '@cose/core/src/platforms/devto.js'
import { wordPressPermission } from '@cose/core/src/platforms/wordpress.js'

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
const password = element('password')
const connect = element('connect')
const disconnect = element('disconnect')
const status = element('status')

document.documentElement.lang = locale
element('help').textContent = t(
  'In Halo 2.27 or later, create a personal access token with the Contributor role. COSE stores it in this browser.',
  '请在 Halo 2.27 或更新版本的个人中心创建具有「投稿者」权限的个人令牌。COSE 将令牌保存在此浏览器。',
  '請在 Halo 2.27 或更新版本的個人中心建立具有「投稿者」權限的個人權杖。COSE 會將權杖儲存在此瀏覽器。',
  'Halo 2.27 以降のユーザーセンターで投稿者権限の個人アクセストークンを作成してください。トークンはこのブラウザーに保存されます。'
)
element('site-label').textContent = t(
  'Halo installation URL',
  'Halo 安装地址',
  'Halo 安裝網址',
  'Halo のインストール先 URL'
)
element('password-label').textContent = t(
  'Personal access token',
  '个人访问令牌',
  '個人存取權杖',
  '個人アクセストークン'
)
connect.textContent = t('Connect', '连接', '連接', '接続')
disconnect.textContent = t('Disconnect', '断开连接', '中斷連線', '接続を解除')

function showConnection(connection) {
  site.value = connection?.site || ''
  connect.hidden = Boolean(connection)
  disconnect.hidden = !connection
  status.textContent = connection ? t('Connected.', '已连接。', '已連接。', '接続しました。') : ''
}

function setBusy(busy) {
  connect.disabled = busy
  disconnect.disabled = busy
}

const form = element('connection')

function notifyParent() {
  window.parent.postMessage({ type: 'cose-halo-connection-changed' }, origin)
}

form.addEventListener('submit', async event => {
  event.preventDefault()
  if (!origin || connect.disabled || !password.value.trim()) return
  let address
  try {
    address = haloSite(site.value)
  } catch {
    status.textContent = t(
      'Enter the HTTPS installation URL.',
      '请输入 HTTPS 安装地址。',
      '請輸入 HTTPS 安裝網址。',
      'HTTPS のインストール先 URL を入力してください。'
    )
    return
  }
  const secret = password.value
  setBusy(true)
  status.textContent = ''
  try {
    const permission = wordPressPermission(address)
    const granted = chrome.permissions
      ? await chrome.permissions.request(permission)
      : (await chrome.runtime.sendMessage({ type: 'CHECK_HALO_HOST', site: address }))?.granted
    if (!granted) {
      status.textContent = chrome.permissions
        ? t(
            'Allow access to this site to connect.',
            '请允许访问此站点。',
            '請允許存取此網站。',
            'このサイトへのアクセスを許可してください。'
          )
        : t(
            'In the Firefox toolbar, open COSE and allow the Halo site. Then click Connect again.',
            '请在 Firefox 工具栏打开 COSE，授权此 Halo 站点，然后再次点击「连接」。',
            '請在 Firefox 工具列開啟 COSE，授權此 Halo 網站，然後再點擊「連接」。',
            'Firefox のツールバーで COSE を開いてサイトへのアクセスを許可し、もう一度「接続」を押してください。'
          )
      return
    }
    password.value = ''
    const connection = await connectHalo(address, secret)
    await chrome.storage.local.set({ [storageKey]: connection })
    showConnection(connection)
    notifyParent()
  } catch {
    status.textContent = t(
      'Connection failed. Check the installation URL, personal access token and Contributor permissions.',
      '连接失败，请检查安装地址、个人令牌及投稿者权限。',
      '連接失敗，請檢查安裝網址、個人權杖及投稿者權限。',
      '接続できませんでした。URL、個人アクセストークン、投稿者権限を確認してください。'
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
    event.data?.type !== 'cose-halo-initialize'
  )
    return
  const parentOrigin = editorOrigin(event.origin)
  if (!parentOrigin) return
  window.removeEventListener('message', initialize)
  origin = parentOrigin
  storageKey = haloConnectionKey(origin)
  new ResizeObserver(() => {
    const height = Math.ceil(form.getBoundingClientRect().height)
    window.parent.postMessage({ type: 'cose-halo-form-height', height }, origin)
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
