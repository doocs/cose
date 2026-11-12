import { marked } from 'marked'

const accountOrigin = 'https://substack.com'
const editorOrigin = 'https://md.doocs.org'
const connectionKey = 'substackConnection'
const publisherRoles = ['admin', 'owner', 'editor', 'contributor']

const SubstackPlatform = {
  id: 'substack',
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
  return { origins: [`${accountOrigin}/*`, `${site}/*`] }
}

function substackDraftId(value, site) {
  try {
    const url = new URL(value)
    if (url.origin === site && !url.username && !url.password) {
      return /^\/publish\/post\/([1-9][0-9]*)\/?$/.exec(url.pathname)?.[1] || null
    }
  } catch {}
  return null
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
  if (response.status === 401 || response.status === 403) {
    throw new Error(`Substack 拒绝了请求（HTTP ${response.status}），请检查登录状态和出版物权限`)
  }
  if (!response.ok) throw new Error(`Substack 请求失败（HTTP ${response.status}）`)
  if (response.status === 204) return null
  return await response.json()
}

async function getConnection(sender) {
  if (sender.frameId !== 0 || !sender.tab || new URL(sender.url).origin !== editorOrigin) {
    return null
  }
  const { [connectionKey]: connection } = await chrome.storage.local.get(connectionKey)
  const site = substackSite(connection?.site)
  if (!site || !(await chrome.permissions.contains(substackPermission(site)))) return null
  return { site, draftId: connection.draftId }
}

async function getPublisher(site) {
  const profile = await request(`${accountOrigin}/api/v1/user/profile/self`)
  const member = profile.publicationUsers?.find(
    row =>
      `https://${row.publication?.subdomain}.substack.com` === site &&
      publisherRoles.includes(row.role)
  )
  if (!member || !profile.id) throw new Error('当前账号没有该 Substack 出版物的编辑权限')
  return { profile, member }
}

async function checkSubstackLogin(sender) {
  try {
    const connection = await getConnection(sender)
    if (connection) {
      const { member } = await getPublisher(connection.site)
      return {
        loggedIn: true,
        username: member.publication.name || 'Substack',
        home: connection.site,
      }
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

async function syncSubstackDraft(content, sender) {
  if (syncing) return { success: false, message: 'Substack 草稿同步正在进行' }
  syncing = true
  let writeAttempted = false
  try {
    const connection = await getConnection(sender)
    if (!connection)
      throw new Error('请在 COSE 扩展菜单中配置 Substack 测试出版物，并使用 Doocs MD 官网')
    const title = typeof content?.title === 'string' ? content.title.trim() : ''
    const markdown = typeof content?.markdown === 'string' ? content.markdown : ''
    if (!title || !markdown.trim()) throw new Error('同步到 Substack 需要标题和 Markdown 正文')

    const doc = substackDocument(markdown)
    if (!doc.content.length) throw new Error('Substack 草稿正文不能为空')
    const { site, draftId } = connection
    if (content.substackSite !== site) throw new Error('Substack 出版物已变更，请重新打开发布窗口')
    const { profile, member } = await getPublisher(site)
    const endpoint = `${site}/api/v1/drafts`
    const body = { draft_title: title, draft_body: JSON.stringify(doc) }
    let id = draftId
    if (id) {
      if (!/^[1-9][0-9]*$/.test(id)) throw new Error('Substack 草稿链接无效')
      const existing = await request(`${endpoint}/${id}`)
      if (!isUnscheduledDraft(existing, id))
        throw new Error('只能更新未发布且未排期的 Substack 草稿')
      const current = await getConnection(sender)
      if (current?.site !== site || current.draftId !== id) {
        throw new Error('Substack 草稿设置已变更，请重新开始同步')
      }
      // Consume the explicit update target before writing so future articles cannot overwrite it.
      await chrome.storage.local.set({ [connectionKey]: { site } })
      writeAttempted = true
      await request(`${endpoint}/${id}`, 'PUT', {
        ...body,
        draft_subtitle: existing.draft_subtitle,
        draft_bylines: existing.draft_bylines,
        audience: existing.audience,
        last_updated_at: existing.draft_updated_at,
      })
    } else {
      writeAttempted = true
      const created = await request(endpoint, 'POST', {
        ...body,
        draft_subtitle: typeof content.desc === 'string' ? content.desc : '',
        draft_bylines: [{ id: profile.id, ...(member.id && { publicationUserId: member.id }) }],
        type: 'newsletter',
      })
      id = String(created?.id)
      if (!/^[1-9][0-9]*$/.test(id)) throw new Error('Substack 未返回草稿 ID')
    }

    const saved = await request(`${endpoint}/${id}`)
    if (
      !isUnscheduledDraft(saved, id) ||
      saved.draft_title !== title ||
      !matchesSavedBody(saved.draft_body, doc)
    ) {
      throw new Error('Substack 未确认草稿状态或内容')
    }
    return { success: true, draftLink: `${site}/publish/post/${id}` }
  } catch (error) {
    const message = error.message || 'Substack 同步失败'
    return {
      success: false,
      message: writeAttempted ? `${message}。请在 Drafts 检查后再试` : message,
    }
  } finally {
    syncing = false
  }
}

export {
  SubstackPlatform,
  checkSubstackLogin,
  connectionKey,
  substackDraftId,
  substackPermission,
  substackSite,
  syncSubstackDraft,
}
