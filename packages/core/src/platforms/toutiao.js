// 今日头条平台配置
const ToutiaoPlatform = {
  id: 'toutiao',
  name: 'Toutiao',
  icon: 'https://sf3-cdn-tos.toutiaostatic.com/obj/eden-cn/uhbfnupkbps/toutiao_favicon.ico',
  url: 'https://mp.toutiao.com',
  publishUrl: 'https://mp.toutiao.com/profile_v4/graphic/publish',
  title: '今日头条',
  type: 'toutiao',
}

import { prepareToutiaoArticle } from './toutiao-article.js'

// Serialized by chrome.scripting: helpers used in this function must live inside it.
async function fillToutiaoContentInPage(title, html, images = []) {
  async function waitFor(read, timeout = 10000) {
    const deadline = Date.now() + timeout
    let result
    while (!(result = read()) && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    return result
  }

  const editor = await waitFor(() => document.querySelector('.ProseMirror[contenteditable="true"]'))
  if (!editor || !html) return { success: false, error: '未找到头条正文编辑器或文章为空' }

  function select(range) {
    editor.focus()
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
  }

  function markerRange(marker) {
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode
      const offset = node.data.indexOf(marker)
      if (offset < 0) continue
      const range = document.createRange()
      range.setStart(node, offset)
      range.setEnd(node, offset + marker.length)
      return range
    }
    return null
  }

  async function imageFile(image, index) {
    if (image.dataUrl) {
      const bytes = Uint8Array.from(atob(image.dataUrl.split(',')[1]), ch => ch.charCodeAt(0))
      return new File([bytes], `formula-${index + 1}.png`, { type: 'image/png' })
    }

    if (!/^(https?:\/\/|data:image\/)/i.test(image.src)) {
      throw new Error('图片地址不可读取，请手动上传')
    }
    const response = await fetch(image.src, {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) throw new Error(`图源返回 HTTP ${response.status}`)

    const type = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()
    const extension = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
    }[type]
    if (!extension || !response.body) throw new Error('图源未返回支持的图片格式')

    const limit = 20 * 1024 * 1024
    const reader = response.body.getReader()
    const chunks = []
    let size = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) {
        await reader.cancel()
        throw new Error('图片超过头条的 20 MB 限制')
      }
      chunks.push(value)
    }
    if (!size) throw new Error('图片内容为空')
    return new File(chunks, `image-${index + 1}.${extension}`, { type })
  }

  async function uploadImage(image, file) {
    const position = markerRange(image.marker)
    if (!position) throw new Error('未找到正文中的图片位置')
    position.collapse(false)
    select(position)

    const files = new DataTransfer()
    files.items.add(file)
    // Count native cards at the insertion point, including existing article images.
    const cards = () => Array.from(editor.querySelectorAll('.pgc-image'))
    const previous = cards()
    const imageIndex = previous.filter(
      card =>
        card.compareDocumentPosition(position.startContainer) & Node.DOCUMENT_POSITION_FOLLOWING
    ).length
    // Toutiao's paste handler asks ProseMirror for its current model selection.
    document.dispatchEvent(new Event('selectionchange'))
    await new Promise(resolve => setTimeout(resolve, 100))
    editor.dispatchEvent(
      new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: files })
    )

    const uploaded = await waitFor(() => {
      const current = cards()
      if (current.length <= previous.length) return false
      const card = current[imageIndex]
      if (card?.querySelector('.image-error')) throw new Error('头条未能上传此图片')
      const sources = []
      editor.pmViewDesc?.node?.descendants(node => {
        if (node.type.name === 'image') sources.push(node.attrs.data)
      })
      const data = sources[imageIndex]
      // An inline data/blob preview disappears after reopening. Wait for the
      // URL written by Toutiao's own upload handler in the document model.
      return data && /^(https?:)?\/\//i.test(data.url) && data.needCheck !== true
    }, 30000)
    if (!uploaded) throw new Error('未收到头条上传后的图片地址')
    const placeholder = markerRange(image.marker)
    if (placeholder) {
      select(placeholder)
      if (!document.execCommand('delete')) throw new Error('未能移除图片占位文字')
    }
  }

  const titleInput = await waitFor(() => document.querySelector('textarea[placeholder*="标题"]'))
  if (title && titleInput) {
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    ).set
    setValue.call(titleInput, title)
    titleInput.dispatchEvent(
      new InputEvent('input', { bubbles: true, data: title, inputType: 'insertText' })
    )
    titleInput.dispatchEvent(new Event('change', { bubbles: true }))
    titleInput.dispatchEvent(new Event('blur', { bubbles: true }))
  }

  const entireBody = document.createRange()
  entireBody.selectNodeContents(editor)
  select(entireBody)
  if (!document.execCommand('insertHTML', false, html)) {
    return { success: false, error: '头条未接受文章正文' }
  }
  editor.dispatchEvent(new InputEvent('input', { bubbles: true }))
  editor.dispatchEvent(new Event('change', { bubbles: true }))

  const failures = []
  for (const [index, image] of images.entries()) {
    try {
      let file
      try {
        file = await imageFile(image, index)
      } catch (error) {
        if (error.name === 'TypeError' || error.name === 'TimeoutError') {
          throw new Error('无法读取图源，可能不可访问或禁止跨域，请手动上传')
        }
        throw error
      }
      await uploadImage(image, file)
    } catch (error) {
      const label = image.dataUrl ? '公式图片' : '图片'
      const placeholder = markerRange(image.marker)
      if (placeholder) {
        select(placeholder)
        document.execCommand('insertText', false, `〔第 ${index + 1} 张${label}未上传〕`)
      }
      failures.push(`第 ${index + 1} 张${label}同步失败：${error.message}`)
    }
  }
  if (failures.length) return { success: false, error: failures.join('；') }
  return { success: true }
}

async function syncToutiaoContent(tab, content, { chrome, waitForTab }) {
  await waitForTab(tab.id)
  const target = { tabId: tab.id }
  const body = content.body || ''
  const markdown = content.markdown || ''
  try {
    let html
    let images = []
    if (/<[a-z][\w:-]*(?:\s[^>]*|\s*\/?)>/i.test(body)) {
      const [prepared] = await chrome.scripting.executeScript({
        target,
        func: prepareToutiaoArticle,
        args: [body, markdown],
      })
      if (typeof prepared?.result?.html !== 'string' || !Array.isArray(prepared.result.images)) {
        throw new Error('未能准备头条正文和图片')
      }
      ;({ html, images } = prepared.result)
    } else {
      html = (body || markdown)
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const text = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          return `<p>${text}</p>`
        })
        .join('')
    }
    const [filled] = await chrome.scripting.executeScript({
      target,
      func: fillToutiaoContentInPage,
      args: [content.title || '', html, images],
      world: 'MAIN',
    })
    if (!filled?.result?.success) throw new Error(filled?.result?.error || '内容填充失败')
    return { success: true, message: '已打开头条号并填充内容', tabId: tab.id }
  } catch (error) {
    return { success: false, message: error.message }
  }
}

export { ToutiaoPlatform, fillToutiaoContentInPage, syncToutiaoContent }
