import { marked } from 'marked'

const accountOrigin = 'https://substack.com'
const editorOrigin = 'https://md.doocs.org'
const localEditorOrigin = 'http://localhost:5173'
const connectionKey = 'substackConnection'
const publisherRoles = ['admin', 'owner', 'editor', 'contributor']

const SubstackPlatform = {
  id: 'substack',
  mcpMode: 'confirmed_draft',
  name: 'Substack',
  title: 'Substack',
  type: 'substack',
  icon: 'https://substack.com/favicon.ico',
}

function substackSite(value) {
  try {
    const url = new URL(value)
    if (
      url.protocol === 'https:' &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.substack\.com$/.test(url.hostname) &&
      !url.port &&
      !url.username &&
      !url.password
    ) {
      return url.origin
    }
  } catch {}
  return null
}

function substackPermission(site) {
  return { origins: [`${site}/*`] }
}

function httpLink(value) {
  try {
    const url = new URL(value)
    if (['https:', 'http:', 'mailto:'].includes(url.protocol)) return url.href
  } catch {}
  return null
}

function inline(tokens, marks = []) {
  return tokens.flatMap(token => {
    if (token.type === 'br') return [{ type: 'hard_break' }]
    const style = { strong: 'strong', em: 'em', del: 'strikethrough', codespan: 'code' }[token.type]
    if (style && token.tokens) return inline(token.tokens, [...marks, { type: style }])
    const href = ['link', 'image'].includes(token.type) && httpLink(token.href)
    const nextMarks = href ? [...marks, { type: 'link', attrs: { href } }] : marks
    if (token.type === 'link' && token.tokens) return inline(token.tokens, nextMarks)
    const value = token.type === 'image' ? token.text || token.href : token.text || token.raw
    if (!value) return []
    const applied = token.type === 'codespan' ? [...marks, { type: 'code' }] : nextMarks
    return [{ type: 'text', text: value, ...(applied.length && { marks: applied }) }]
  })
}

function paragraph(content) {
  return { type: 'paragraph', ...(content.length && { content }) }
}

function blocks(tokens) {
  return tokens.flatMap(token => {
    switch (token.type) {
      case 'space':
      case 'def':
        return []
      case 'heading':
        return [
          {
            type: 'heading',
            attrs: { level: Math.min(4, token.depth + 1) },
            content: inline(token.tokens),
          },
        ]
      case 'paragraph':
      case 'text':
        return [paragraph(inline(token.tokens || [token]))]
      case 'blockquote':
        return [{ type: 'blockquote', content: blocks(token.tokens) }]
      case 'list':
        return [
          {
            type: token.ordered ? 'orderedList' : 'bulletList',
            ...(token.ordered && { attrs: { start: token.start, order: token.start } }),
            content: token.items.map(item => {
              const content = blocks(item.tokens)
              if (content[0]?.type !== 'paragraph') content.unshift(paragraph([]))
              return { type: 'listItem', content }
            }),
          },
        ]
      case 'hr':
        return [{ type: 'horizontal_rule' }]
      case 'code':
        return [
          {
            type: 'code_block',
            ...(token.text && { content: [{ type: 'text', text: token.text }] }),
          },
        ]
      default:
        return [paragraph(inline([{ text: token.raw.trim() }]))]
    }
  })
}

function substackDocument(markdown) {
  return { type: 'doc', content: blocks(marked.lexer(markdown)) }
}

async function validationDetail(response) {
  try {
    const body = await response.json()
    const entries = Array.isArray(body?.errors) ? body.errors : [body]
    return entries
      .slice(0, 3)
      .map(entry => {
        const field = entry?.param ?? entry?.path
        const message = entry?.msg ?? entry?.message ?? entry?.error
        return [field, message]
          .filter(value => typeof value === 'string' && value.trim())
          .map(value => value.replace(/\s+/g, ' ').trim().slice(0, 120))
          .join(' ')
      })
      .filter(Boolean)
      .join('；')
  } catch {
    return ''
  }
}

async function request(url, method = 'GET', body) {
  const response = await fetch(url, {
    method,
    credentials: 'include',
    redirect: 'error',
    headers: {
      Accept: 'application/json',
      ...(body && { 'Content-Type': 'application/json' }),
    },
    ...(body && { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) {
    const status = response.status
    const message =
      status === 401 || status === 403
        ? `Substack 拒绝了请求（HTTP ${status}），请检查登录状态和出版物权限`
        : `Substack 请求失败（HTTP ${status}）`
    const detail = status === 400 || status === 422 ? await validationDetail(response) : ''
    throw Object.assign(new Error(detail ? `${message}：${detail}` : message), { status })
  }
  if (response.status === 204) return null
  return await response.json()
}

async function getConnection() {
  const { [connectionKey]: connection } = await chrome.storage.local.get(connectionKey)
  const site = substackSite(connection?.site)
  if (!site || !(await chrome.permissions.contains(substackPermission(site)))) return null
  return { ...connection, site }
}

function getEditorOrigin(sender) {
  if (sender?.frameId !== 0 || !sender.tab || !sender.url) return null
  const source = new URL(sender.url).origin
  return source === editorOrigin || source === localEditorOrigin ? source : null
}

async function getEditorConnection(sender) {
  const source = getEditorOrigin(sender)
  if (!source) return null
  const connection = await getConnection()
  if (source === localEditorOrigin && !connection?.allowLocalEditor) return null
  return connection
}

async function getSubstackPublications() {
  const profile = await request(`${accountOrigin}/api/v1/user/profile/self`)
  if (!profile?.id) throw new Error('Substack 未返回已登录账号')
  const publications = (profile.publicationUsers || []).flatMap(member => {
    const subdomain = member.publication?.subdomain
    const site = subdomain && substackSite(`https://${subdomain}.substack.com`)
    if (!site || !publisherRoles.includes(member.role)) return []
    return [{ site, name: member.publication.name || subdomain, member }]
  })
  return { profile, publications }
}

async function getPublisher(site) {
  const { profile, publications } = await getSubstackPublications()
  const member = publications.find(publication => publication.site === site)?.member
  if (!member) throw new Error('当前账号没有该 Substack 出版物的编辑权限')
  return { profile, member }
}

function substackIdentity(profile) {
  const username = typeof profile.handle === 'string' ? profile.handle.trim().replace(/^@/, '') : ''
  const photo = httpLink(profile.photo_url || profile.photoUrl)
  return {
    ...(username && { username }),
    ...(photo?.startsWith('https://') && { avatar: photo }),
  }
}

async function checkSubstackLogin(sender) {
  try {
    if (!getEditorOrigin(sender)) return { loggedIn: false }
    const { profile, publications } = await getSubstackPublications()
    const connection = await getEditorConnection(sender)
    return {
      loggedIn: true,
      ...substackIdentity(profile),
      ...(publications.some(item => item.site === connection?.site) && { home: connection.site }),
    }
  } catch {}
  return { loggedIn: false }
}

function isUnscheduledDraft(post, id) {
  return (
    String(post?.id) === id &&
    post.is_published === false &&
    !post.post_date &&
    !post.trigger_at &&
    !post.postSchedules?.length
  )
}

function documentText(node) {
  return node.text ?? (node.content || []).map(documentText).join('')
}

function matchesSavedBody(body, expected) {
  const saved = typeof body === 'string' ? JSON.parse(body) : body
  return saved?.type === 'doc' && documentText(saved) === documentText(expected)
}

let syncing = false

async function saveSubstackDraft(content, sender) {
  if (syncing) return { success: false, message: 'Substack 草稿同步正在进行' }
  syncing = true
  let phase = ''
  try {
    const connection = sender ? await getEditorConnection(sender) : await getConnection()
    if (!connection) throw new Error('请在 MD 发布面板连接 Substack 并选择出版物')
    const title = typeof content?.title === 'string' ? content.title.trim() : ''
    const markdown = typeof content?.markdown === 'string' ? content.markdown : ''
    if (!title || !markdown.trim()) throw new Error('同步到 Substack 需要标题和 Markdown 正文')

    const doc = substackDocument(markdown)
    if (!doc.content.length) throw new Error('Substack 草稿正文不能为空')
    const { site } = connection
    if (sender && content.substackSite !== site)
      throw new Error('Substack 出版物已变更，请重新打开发布窗口')
    const { profile } = await getPublisher(site)
    const endpoint = `${site}/api/v1/drafts`
    phase = '创建草稿'
    const created = await request(endpoint, 'POST', {
      draft_title: title,
      draft_body: JSON.stringify(doc),
      draft_subtitle: '',
      draft_bylines: [{ id: profile.id, is_guest: false }],
      type: 'newsletter',
      audience: 'everyone',
      section_chosen: false,
      draft_section_id: null,
    })
    const id = String(created?.id)
    if (!/^[1-9][0-9]*$/.test(id)) throw new Error('Substack 未返回草稿 ID')

    phase = '回读草稿'
    const saved = await request(`${endpoint}/${id}`)
    if (
      !isUnscheduledDraft(saved, id) ||
      saved.draft_title !== title ||
      !matchesSavedBody(saved.draft_body, doc)
    ) {
      throw new Error('Substack 未确认草稿状态或内容')
    }
    return {
      success: true,
      message: '已确认保存 Substack 草稿',
      draftLink: `${site}/publish/post/${id}`,
    }
  } catch (error) {
    const message = error.message || 'Substack 同步失败'
    return {
      success: false,
      message: phase
        ? `${phase}失败：${message}${phase === '创建草稿' && [400, 422].includes(error.status) ? '' : '。请在 Drafts 检查后再试'}`
        : message,
    }
  } finally {
    syncing = false
  }
}

function syncSubstackDraft(content, sender) {
  if (!sender) return { success: false, message: '缺少 MD 编辑器来源' }
  return saveSubstackDraft(content, sender)
}

function createSubstackMcpDraft(content) {
  return saveSubstackDraft(content)
}

export {
  SubstackPlatform,
  checkSubstackLogin,
  connectionKey,
  createSubstackMcpDraft,
  getSubstackPublications,
  localEditorOrigin,
  substackIdentity,
  substackPermission,
  substackSite,
  syncSubstackDraft,
}
