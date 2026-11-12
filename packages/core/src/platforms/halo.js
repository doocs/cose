import { editorOrigin } from './devto.js'

const HaloPlatform = { id: 'halo', name: 'Halo', title: 'Halo', type: 'halo' }
const posts = 'apis/uc.api.content.halo.run/v1alpha1/posts'

function haloConnectionKey(origin) {
  return `haloConnection:${origin}`
}

function haloSite(value) {
  const url = new URL(value.trim())
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('请输入 Halo 站点的 HTTPS 地址')
  }
  return url.href.replace(/\/+$/, '') + '/'
}

function request({ site, token }, path, body) {
  return fetch(new URL(path, site), {
    method: body ? 'POST' : 'GET',
    credentials: 'omit',
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(body && { 'Content-Type': 'application/json' }),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function connectHalo(site, token) {
  const connection = { site: haloSite(site), token: token.trim() }
  if (!/^pat_\S+$/.test(connection.token)) throw new Error('请输入 Halo 个人访问令牌')
  const [response, profile] = await Promise.all([
    request(connection, `${posts}?size=1`),
    request(connection, 'apis/uc.api.halo.run/v1alpha1/users/-'),
  ])
  if (!response.ok || !Array.isArray((await response.json()).items)) {
    throw new Error(`无法读取 Halo 文章（HTTP ${response.status}）`)
  }
  const owner = profile.ok && (await profile.json()).user?.metadata?.name
  if (typeof owner !== 'string' || !owner) throw new Error('无法读取 Halo 投稿者账号')
  return { ...connection, owner }
}

async function getConnection(sender) {
  const origin = sender.frameId === 0 && sender.tab && editorOrigin(sender.url)
  if (!origin) return null
  const key = haloConnectionKey(origin)
  const { [key]: connection } = await chrome.storage.local.get(key)
  if (!connection) return null
  const permission = { origins: [`https://${new URL(connection.site).hostname}/*`] }
  return (await chrome.permissions.contains(permission)) ? connection : null
}

async function checkHaloLogin(sender) {
  try {
    const connection = await getConnection(sender)
    if (connection) {
      await connectHalo(connection.site, connection.token)
      return { loggedIn: true, username: new URL(connection.site).host, home: connection.site }
    }
  } catch {
    // A revoked token or unavailable site cannot accept drafts.
  }
  return { loggedIn: false }
}

async function syncHaloDraft(content, sender) {
  const connection = await getConnection(sender)
  if (!connection || content?.haloSite !== connection.site) {
    return { success: false, message: '请重新选择已连接的 Halo 站点' }
  }
  const title = typeof content.title === 'string' ? content.title.trim() : ''
  const html = typeof content.body === 'string' ? content.body.trim() : ''
  if (!title || !html) return { success: false, message: '同步到 Halo 需要标题和正文' }

  // Repeated requests for the same content use one name, even after a timeout or browser restart.
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify([connection.owner, title, html]))
  )
  const name =
    'cose-' +
    Array.from(new Uint8Array(digest).slice(0, 16), byte =>
      byte.toString(16).padStart(2, '0')
    ).join('')
  const path = `${posts}/${name}`
  const draftLink = new URL('uc/posts/editor', connection.site)
  draftLink.searchParams.set('name', name)
  const article = {
    apiVersion: 'content.halo.run/v1alpha1',
    kind: 'Post',
    metadata: {
      name,
      annotations: {
        'content.halo.run/content-json': JSON.stringify({
          raw: html,
          content: html,
          rawType: 'HTML',
        }),
      },
    },
    spec: {
      title,
      slug: name,
      publish: false,
      deleted: false,
      pinned: false,
      allowComment: true,
      priority: 0,
      visible: 'PUBLIC',
      excerpt: { autoGenerate: true },
    },
  }
  const denied = { success: false, message: 'Halo 令牌无效，或缺少投稿者权限' }

  try {
    let response = await request(connection, path)
    if (response.status === 404) {
      try {
        const created = await request(connection, posts, article)
        if (created.status === 401 || created.status === 403) return denied
        if (created.status >= 400 && created.status < 500 && created.status !== 409) {
          return { success: false, message: `Halo 拒绝创建草稿（HTTP ${created.status}）` }
        }
      } catch {
        // The write may have completed before the connection was interrupted.
      }
      response = await request(connection, path)
    }
    if (response.status === 401 || response.status === 403) return denied
    if (response.ok) {
      const post = await response.json()
      if (
        post.metadata?.name === name &&
        post.spec?.owner === connection.owner &&
        post.spec?.title === title &&
        post.spec?.publish === false &&
        post.spec?.deleted === false &&
        post.status?.phase === 'DRAFT'
      ) {
        const draft = await request(connection, `${path}/draft?patched=true`)
        if (draft.ok && (await draft.json()).spec?.rawPatch === html) {
          return { success: true, message: '已确认 Halo 草稿', draftLink: draftLink.href }
        }
      }
    }
  } catch {
    // A further attempt will look up the same resource before attempting a write.
  }
  return { success: false, message: `未能确认 Halo 草稿，请在个人中心检查 ${draftLink.href}` }
}

export { HaloPlatform, checkHaloLogin, connectHalo, haloConnectionKey, haloSite, syncHaloDraft }
