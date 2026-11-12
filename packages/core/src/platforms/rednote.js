const creatorUrl = 'https://creator.rednote.com'

const RednotePlatform = {
  id: 'rednote',
  mcpMode: 'confirmed_draft',
  name: 'RedNote',
  title: '小红书（海外）',
  type: 'rednote',
  icon: 'https://www.rednote.com/favicon.ico',
  url: creatorUrl,
  publishUrl: `${creatorUrl}/publish/publish?from=menu&target=article`,
}

// Executed inside RedNote's creator tab.
async function saveRednoteDraft(title, html, previousDraftIds = []) {
  if (
    location.origin !== 'https://creator.rednote.com' ||
    location.pathname !== '/publish/publish'
  ) {
    return { success: false, message: '请登录 RedNote 创作者中心后重试' }
  }

  const normalizedTitle = typeof title === 'string' ? title.trim() : ''
  const source = new DOMParser().parseFromString(typeof html === 'string' ? html : '', 'text/html')
  source.querySelectorAll('script, style').forEach(element => element.remove())
  const body = source.body.textContent.trim()
  if (!normalizedTitle || !body) {
    return { success: false, message: '同步到 RedNote 需要标题和正文' }
  }
  if (normalizedTitle.length > 64) {
    return { success: false, message: 'RedNote 长文标题最多支持 64 个字符' }
  }

  const profile = await fetch('/api/galaxy/user/info', {
    credentials: 'include',
    signal: AbortSignal.timeout(5000),
  })
    .then(response => response.json())
    .catch(() => null)
  const uid = profile?.data?.userId
  if (profile?.success !== true || !uid) {
    return { success: false, message: '无法确认 RedNote 登录账号，请重新登录后再试' }
  }

  // RedNote owns this database. Only read it to confirm which drafts exist.
  const readDrafts = read =>
    new Promise((resolve, reject) => {
      const open = indexedDB.open('draft-database-v1')
      open.onupgradeneeded = () => {
        open.transaction.abort()
        resolve([])
      }
      open.onerror = () => reject(open.error)
      open.onsuccess = () => {
        const db = open.result
        if (!db.objectStoreNames.contains('article-draft')) {
          db.close()
          resolve([])
          return
        }
        try {
          const store = db.transaction('article-draft', 'readonly').objectStore('article-draft')
          const request = read(store)
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        } catch (error) {
          reject(error)
        }
        db.close()
      }
    })
  const existingIds = new Set(await readDrafts(store => store.index('uid').getAllKeys(uid)))
  const existingDraft = previousDraftIds.find(id => existingIds.has(id))
  if (existingDraft) {
    return { success: true, message: '这篇文章已有 RedNote 草稿', draftId: existingDraft }
  }

  const waitFor = async (read, timeout = 18000) => {
    const deadline = Date.now() + timeout
    do {
      const result = await read()
      if (result) return result
      await new Promise(resolve => setTimeout(resolve, 150))
    } while (Date.now() < deadline)
    return null
  }
  const visible = element => Boolean(element?.getClientRects().length)
  const findButton = (selector, label) =>
    Array.from(document.querySelectorAll(selector)).find(
      button =>
        visible(button) &&
        !button.matches(':disabled, [aria-disabled="true"]') &&
        button.textContent.trim() === label
    )
  const findEditor = () => document.querySelector('.tiptap.ProseMirror[contenteditable="true"]')
  const create = await waitFor(() => findButton('button.new-btn', '新的创作'))
  if (!create) return { success: false, message: '找不到 RedNote 的「新的创作」按钮' }

  create.click()
  const fields = await waitFor(() => {
    const input = document.querySelector('textarea[placeholder="输入标题"]')
    const editor = findEditor()
    return visible(input) && visible(editor) ? { input, editor } : null
  })
  if (!fields) return { success: false, message: 'RedNote 长文编辑器未加载，请检查创作权限' }

  const { input, editor } = fields
  const previousText = editor.textContent
  const setTitle = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
  setTitle.call(input, normalizedTitle)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  editor.focus()
  const clipboardData = new DataTransfer()
  clipboardData.setData('text/html', source.body.innerHTML)
  clipboardData.setData('text/plain', body)
  editor.dispatchEvent(
    new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true })
  )

  const populated = await waitFor(
    () =>
      input.value === normalizedTitle &&
      editor.textContent.trim() &&
      editor.textContent !== previousText,
    5000
  )
  if (!populated) return { success: false, message: 'RedNote 编辑器没有接收标题或正文' }

  const save = await waitFor(() => findButton('button.save-btn', '暂存离开'), 5000)
  if (!save) return { success: false, message: '找不到 RedNote 的「暂存离开」按钮' }
  save.click()

  const saved = await waitFor(
    () => !visible(findEditor()) && document.body.innerText.split('\n').includes('保存成功'),
    8000
  )
  if (!saved) {
    return { success: false, message: '未能确认 RedNote 草稿已保存，请检查草稿箱后再重试' }
  }
  const draftId = await waitFor(async () => {
    const ids = await readDrafts(store => store.index('uid').getAllKeys(uid))
    for (const id of ids) {
      if (existingIds.has(id)) continue
      const draft = await readDrafts(store => store.get(id))
      if (draft?.content?.articleStore?.articleTitle === normalizedTitle) return id
    }
    return null
  }, 3000)
  if (!draftId) {
    return { success: false, message: '未能确认 RedNote 草稿编号，请先检查草稿箱' }
  }
  return { success: true, message: '已保存到当前浏览器的 RedNote 草稿箱', draftId }
}

export { RednotePlatform, saveRednoteDraft }
