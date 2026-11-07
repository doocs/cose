const origin = 'https://dev.to'
const dashboard = `${origin}/dashboard`
const officialEditor = 'https://md.doocs.org'
const devtoPermission = { origins: [`${origin}/*`] }
const DevtoPlatform = {
  id: 'devto',
  name: 'DEV.to',
  title: 'DEV.to',
  type: 'devto',
  icon: 'https://media2.dev.to/dynamic/image/width=32,height=,fit=scale-down,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Farticles%2F8j7kvp660rqzt99zui8e.png',
  url: `${origin}/settings/extensions`,
  publishUrl: dashboard,
}

function editorOrigin(value) {
  try {
    const url = new URL(value)
    if (
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    ) {
      return url.origin
    }
  } catch {}
  return null
}

async function getDevtoConnection(sender) {
  const source = sender.frameId === 0 && sender.tab && editorOrigin(sender.url)
  if (!source) return null

  const { devtoConnection } = await chrome.storage.local.get('devtoConnection')
  if (source !== officialEditor && source !== devtoConnection?.editorOrigin) return null
  return devtoConnection?.apiKey ? devtoConnection : null
}

async function requestDevto(path, apiKey, article) {
  return await fetch(`${origin}/api/${path}`, {
    method: article ? 'POST' : 'GET',
    headers: {
      Accept: 'application/vnd.forem.api-v1+json',
      'api-key': apiKey,
      ...(article && { 'Content-Type': 'application/json' }),
    },
    body: article ? JSON.stringify({ article }) : undefined,
    credentials: 'omit',
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  })
}

async function getDevtoUsername(apiKey) {
  const response = await requestDevto('users/me', apiKey)
  if (response.status === 401 || response.status === 403) {
    throw new Error('DEV.to API Key 无效或已撤销')
  }
  if (!response.ok) throw new Error(`DEV.to 账号验证失败（HTTP ${response.status}）`)
  const { username } = await response.json()
  if (typeof username !== 'string' || !username) throw new Error('DEV.to 未返回账号信息')
  return username
}

async function checkDevtoLogin(sender) {
  try {
    const connection = await getDevtoConnection(sender)
    if (connection) return { loggedIn: true, username: await getDevtoUsername(connection.apiKey) }
  } catch {
    // A revoked key or unreachable API must not appear as a connected account.
  }
  return { loggedIn: false }
}

async function syncDevtoDraft(content, sender) {
  const connection = await getDevtoConnection(sender)
  if (!connection) {
    return { success: false, message: '请在 MD 编辑器的发布窗口连接 DEV.to' }
  }

  const title = typeof content?.title === 'string' ? content.title.trim() : ''
  const markdown = typeof content?.markdown === 'string' ? content.markdown : ''
  // Forem front matter can override the API's published flag. Replace the
  // source metadata with explicit draft metadata and preserve the body.
  const body = markdown.replace(
    /^(?:\uFEFF)?(?:[ \t]*\r?\n)*---[ \t]*\r?\n(?:[\s\S]*?\n)?---[ \t]*(?:\r?\n|$)/,
    ''
  )
  if (!title || !body.trim()) {
    return { success: false, message: '同步到 DEV.to 需要标题和 Markdown 正文' }
  }

  try {
    const response = await requestDevto('articles', connection.apiKey, {
      title,
      body_markdown: `---\npublished: false\n---\n\n${body}`,
      published: false,
    })
    if (!response.ok) {
      const message =
        response.status === 401 || response.status === 403
          ? 'DEV.to API Key 无效或已撤销，请重新连接'
          : response.status === 422
            ? 'DEV.to 拒绝了草稿内容，请检查标题和 Markdown（HTTP 422）'
            : `DEV.to 创建草稿失败（HTTP ${response.status}）`
      return { success: false, message }
    }

    const draft = await response.json()
    if (
      response.status !== 201 ||
      !Number.isSafeInteger(draft.id) ||
      draft.id <= 0 ||
      draft.published === true ||
      draft.published_at != null
    ) {
      return { success: false, message: 'DEV.to 未确认草稿状态，请先在 Dashboard 检查' }
    }

    // Build the edit URL locally instead of following a URL from the response.
    const { path } = draft
    const draftLink =
      typeof path === 'string' && /^\/[\w-]+\/[\w-]+$/.test(path)
        ? `${origin}${path}/edit`
        : dashboard
    return { success: true, message: '已创建 DEV.to 草稿', draftLink }
  } catch {
    // Do not retry a POST automatically. The draft may have been created.
    return { success: false, message: '未能确认 DEV.to 草稿，请在 Dashboard 检查后再试' }
  }
}

export {
  DevtoPlatform,
  devtoPermission,
  editorOrigin,
  getDevtoUsername,
  checkDevtoLogin,
  syncDevtoDraft,
}
