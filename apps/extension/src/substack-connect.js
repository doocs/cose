import {
  connectionKey,
  getSubstackPublications,
  localEditorOrigin,
  substackIdentity,
  substackPermission,
} from '@cose/core/src/platforms/substack.js'

let source
const form = document.querySelector('form')
const detect = document.getElementById('detect')
const settings = document.getElementById('settings')
const publication = document.getElementById('publication')
const save = document.getElementById('save')
const status = document.getElementById('status')
const login = document.getElementById('login')
const identity = document.getElementById('identity')
const avatarImage = document.getElementById('avatar')
const usernameLabel = document.getElementById('username')
const locale = new URLSearchParams(location.search).get('lang') || 'en'
const text = (en, zh) => (locale.startsWith('zh') ? zh : en)
document.documentElement.lang = locale
detect.textContent = text('Find my publications', '检测我的出版物')
save.textContent = text('Save and connect', '保存并连接')
login.textContent = text('Sign in to Substack', '登录 Substack')
document.getElementById('publicationLabel').textContent = text('Publication', '出版物')
status.textContent = text('Opening the Substack connection form…', '正在打开 Substack 连接表单…')

let connection

async function loadPublications() {
  settings.hidden = true
  const { profile, publications } = await getSubstackPublications()
  const { username, avatar } = substackIdentity(profile)
  usernameLabel.textContent = username ? `@${username}` : text('Signed in', '已登录')
  avatarImage.hidden = !avatar
  if (avatar) avatarImage.src = avatar
  else avatarImage.removeAttribute('src')
  identity.hidden = false
  if (!publications.length) {
    status.textContent = text(
      'Signed in, but this account has no editable publications. Create one or switch accounts, then retry.',
      '已登录，但当前账号没有可编辑的出版物。创建出版物或切换账号后再试。'
    )
    return
  }
  publication.replaceChildren()
  if (publications.length > 1) {
    publication.add(new Option(text('Select a publication', '请选择出版物'), ''))
  }
  for (const { site, name } of publications) {
    publication.add(new Option(`${name} · ${new URL(site).hostname}`, site))
  }
  if (publications.some(item => item.site === connection?.site)) {
    publication.value = connection.site
  }
  settings.hidden = false
  status.textContent = text(
    'Choose a publication, then click Save and connect.',
    '选择出版物，然后点击「保存并连接」。'
  )
}

async function discover() {
  detect.disabled = true
  save.disabled = true
  login.hidden = true
  identity.hidden = true
  status.textContent = text('Finding your publications…', '正在检测你的出版物…')
  try {
    await loadPublications()
  } catch (error) {
    const code = error?.status
    if (code === 401) {
      login.hidden = false
      status.textContent = text(
        'Sign in to Substack in this browser, then return here to continue.',
        '请在当前浏览器登录 Substack，再返回这里继续。'
      )
      return
    }
    const httpStatus = code ? ` (HTTP ${code})` : ''
    status.textContent =
      text(
        'Could not verify your Substack session. Click Find my publications to retry.',
        '暂时无法确认 Substack 登录状态。请点击「检测我的出版物」重试。'
      ) + httpStatus
  } finally {
    detect.disabled = false
    save.disabled = false
  }
}

avatarImage.addEventListener('error', () => {
  avatarImage.hidden = true
})
detect.addEventListener('click', discover)
document.addEventListener('visibilitychange', () => {
  if (source && !document.hidden && !detect.disabled && settings.hidden) void discover()
})
form.addEventListener('submit', async event => {
  event.preventDefault()
  if (!source || save.disabled || !publication.value) return
  const site = publication.value
  save.disabled = true
  detect.disabled = true
  try {
    if (!chrome.permissions) {
      status.textContent = text(
        'This browser cannot grant publication access from the publish panel.',
        '此浏览器无法从发布面板授权访问出版物。'
      )
      return
    }
    if (!(await chrome.permissions.request(substackPermission(site)))) {
      status.textContent = text(
        'Allow access to the selected publication.',
        '请授权访问所选出版物。'
      )
      return
    }
    const saved = {
      site,
      allowLocalEditor: source === localEditorOrigin || connection?.allowLocalEditor === true,
    }
    await chrome.storage.local.set({ [connectionKey]: saved })
    connection = saved
    status.textContent = text('Publication connected.', '出版物已连接。')
    window.parent.postMessage({ type: 'cose-substack-connection-changed' }, source)
  } catch {
    status.textContent = text('Could not save the connection.', '无法保存连接设置。')
  } finally {
    save.disabled = false
    detect.disabled = false
  }
})

async function initialize() {
  new ResizeObserver(() => {
    window.parent.postMessage(
      {
        type: 'cose-substack-form-height',
        height: Math.ceil(form.getBoundingClientRect().height),
      },
      source
    )
  }).observe(form)
  ;({ [connectionKey]: connection } = await chrome.storage.local.get(connectionKey))
  await discover()
}

window.addEventListener('message', event => {
  if (
    source ||
    event.source !== window.parent ||
    window.parent === window ||
    event.data?.type !== 'cose-substack-initialize' ||
    !['https://md.doocs.org', localEditorOrigin].includes(event.origin)
  )
    return
  source = event.origin
  initialize().catch(() => {
    status.textContent = text('Could not load the connection settings.', '无法读取连接设置。')
  })
})
