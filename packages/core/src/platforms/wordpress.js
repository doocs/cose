import { editorOrigin } from './devto.js'

const WordPressPlatform = {
  id: 'wordpress',
  mcpMode: 'requires_editor_connection',
  name: 'WordPress',
  title: 'WordPress',
  type: 'wordpress',
  icon: 'https://s.w.org/style/images/about/WordPress-logotype-wmark.png',
}

function wordPressEditor(sender) {
  return sender.frameId === 0 && sender.tab && editorOrigin(sender.url)
}

function wordPressConnectionKey(origin) {
  return `wordpressConnection:${origin}`
}

function wordPressPendingKey(tabId) {
  return `wordpressPendingHost:${tabId}`
}

function wordPressSite(value) {
  const url = new URL(value.trim())
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Enter the HTTPS address of your WordPress installation.')
  }
  return url.href.replace(/\/+$/, '') + '/'
}

function wordPressPermission(site) {
  return { origins: [`https://${new URL(site).hostname}/*`] }
}

function route(apiRoot, path) {
  const url = new URL(apiRoot)
  if (url.searchParams.has('rest_route')) {
    url.searchParams.set('rest_route', path)
    return url
  }
  return new URL(path.slice(1), url)
}

function request(url, options) {
  return fetch(url, {
    ...options,
    credentials: 'omit',
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
  })
}

async function findApiRoot(site) {
  for (const path of ['wp-json/', '?rest_route=/']) {
    const url = new URL(path, site)
    try {
      const response = await request(url)
      if (!response.ok) continue
      const index = await response.json()
      if (index?.namespaces?.includes('wp/v2')) return url.href
    } catch {
      // Try WordPress's query-based route when pretty permalinks are unavailable.
    }
  }
  throw new Error('WordPress REST API was not found. Check the installation URL and API access.')
}

function authenticatedRequest(connection, path, article) {
  const userpass = `${connection.username}:${connection.password}`
  const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(userpass)))
  return request(route(connection.apiRoot, path), {
    method: article ? 'POST' : 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${encoded}`,
      ...(article && { 'Content-Type': 'application/json' }),
    },
    body: article ? JSON.stringify(article) : undefined,
  })
}

async function verifyAccount(connection) {
  const response = await authenticatedRequest(connection, '/wp/v2/users/me')
  if (!response.ok) {
    throw new Error(
      `WordPress could not verify this username and application password (HTTP ${response.status}).`
    )
  }
  const user = await response.json()
  if (!Number.isSafeInteger(user?.id) || user.id <= 0) {
    throw new Error('WordPress did not return an authenticated account.')
  }
}

async function connectWordPress(site, username, password) {
  const connection = {
    site,
    apiRoot: await findApiRoot(site),
    username: username.trim(),
    password: password.replace(/\s/g, ''),
  }
  await verifyAccount(connection)
  return connection
}

async function getConnection(sender) {
  const origin = wordPressEditor(sender)
  if (!origin) return null
  const key = wordPressConnectionKey(origin)
  const { [key]: connection } = await chrome.storage.local.get(key)
  if (!connection || !(await chrome.permissions.contains(wordPressPermission(connection.site)))) {
    return null
  }
  return connection
}

async function checkWordPressLogin(sender) {
  try {
    const connection = await getConnection(sender)
    if (connection) {
      await verifyAccount(connection)
      return {
        loggedIn: true,
        username: connection.site.slice('https://'.length, -1),
        home: connection.site,
      }
    }
  } catch {
    // A revoked password or unavailable site cannot accept drafts.
  }
  return { loggedIn: false }
}

async function syncWordPressDraft(content, sender) {
  const connection = await getConnection(sender)
  if (!connection || content?.wordpressSite !== connection.site) {
    return { success: false, message: '请重新选择已连接的 WordPress 站点' }
  }
  const title = typeof content.title === 'string' ? content.title.trim() : ''
  const body = typeof content.body === 'string' ? content.body.trim() : ''
  if (!title || !body) return { success: false, message: '同步到 WordPress 需要标题和正文' }

  const draftList = new URL('wp-admin/edit.php?post_status=draft', connection.site).href
  try {
    const response = await authenticatedRequest(connection, '/wp/v2/posts', {
      title,
      content: body,
      status: 'draft',
    })
    if (response.status === 401 || response.status === 403) {
      return { success: false, message: 'WordPress 凭据无效，或该账号没有创建文章的权限' }
    }
    if (response.status >= 400 && response.status < 500) {
      return { success: false, message: `WordPress 拒绝创建草稿（HTTP ${response.status}）` }
    }
    if (response.status === 201) {
      const draft = await response.json()
      if (draft?.status === 'draft' && Number.isSafeInteger(draft.id) && draft.id > 0) {
        return {
          success: true,
          message: '已创建 WordPress 草稿',
          draftLink: new URL(`wp-admin/post.php?post=${draft.id}&action=edit`, connection.site)
            .href,
        }
      }
    }
  } catch {
    // A timed-out request may have created a draft. Leave any retry to the user.
  }
  return { success: false, message: `未能确认 WordPress 草稿，请先检查草稿列表 ${draftList}` }
}

export {
  WordPressPlatform,
  checkWordPressLogin,
  connectWordPress,
  syncWordPressDraft,
  wordPressConnectionKey,
  wordPressPendingKey,
  wordPressPermission,
  wordPressSite,
}
