// 知乎平台配置
const ZhihuPlatform = {
  id: 'zhihu',
  name: 'Zhihu',
  icon: 'https://static.zhihu.com/heifetz/favicon.ico',
  url: 'https://www.zhihu.com',
  publishUrl: 'https://zhuanlan.zhihu.com/write',
  title: '知乎',
  type: 'zhihu',
}

import { injectUtils } from './common.js'

// 知乎内容填充函数（在页面主世界中执行）
// 知乎现在支持直接粘贴 Markdown，然后弹窗提示转换
// 注意：需要先调用 injectUtils 注入 window.waitFor
async function fillZhihuContent(title, markdown, body) {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
  const editorSelector = '.public-DraftEditor-content[contenteditable="true"]'
  const getEditor = () =>
    document.querySelector(editorSelector) || document.querySelector('[contenteditable="true"]')

  async function waitAndClickButton(matches, timeout = 5000) {
    const deadline = Date.now() + timeout
    do {
      const button = Array.from(document.querySelectorAll('button')).find(
        btn => !btn.disabled && btn.getClientRects().length && matches(btn.textContent.trim())
      )
      if (button) {
        button.click()
        return true
      }
      await sleep(200)
    } while (Date.now() < deadline)
    return false
  }

  // 用源文章的渲染结果识别图片，包括 Markdown 引用式图片。
  const source = document.createElement('template')
  source.innerHTML = body || ''
  const expectedImages = source.content.querySelectorAll('img[src]').length
  const hasSourceImages =
    expectedImages > 0 || (!body && /!\[[^\]]*\](?:\(|\[)|<img\b/i.test(markdown || ''))

  // 等待知乎草稿和编辑器加载，再激活标题和正文。
  await sleep(2000)
  const titleInput = await window.waitFor('textarea[placeholder*="标题"]')
  const editor = getEditor()
  if (!titleInput || !editor) {
    return { success: false, error: '未找到知乎编辑器，请确认已登录知乎' }
  }

  // COSE opens a new article. Avoid mutating the DOM behind Draft.js.
  if (editor.textContent.trim() || editor.querySelector('img, figure')) {
    return { success: false, error: '知乎编辑器已有内容，请在空白文章中重试' }
  }
  window.setInputValue(titleInput, title)
  await sleep(500)

  if (!markdown?.trim()) {
    if (source.content.textContent.trim() || hasSourceImages) {
      return { success: false, error: '缺少 Markdown 原文，无法导入知乎正文' }
    }
    return { success: true, hasImages: false }
  }

  const rect = editor.getBoundingClientRect()
  for (const type of ['mousedown', 'mouseup', 'click']) {
    editor.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        button: 0,
      })
    )
  }
  editor.focus()
  if (!editor.contains(document.activeElement)) {
    return { success: false, error: '无法激活知乎正文编辑器' }
  }

  try {
    const clipboardData = new DataTransfer()
    clipboardData.setData('text/plain', markdown)
    editor.dispatchEvent(
      new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData })
    )

    const parseClicked = await waitAndClickButton(text => text.includes('确认并解析'))
    if (parseClicked && !(await waitAndClickButton(text => text === '确认'))) {
      return { success: false, error: '知乎 Markdown 解析未完成，请在编辑器中检查' }
    }
  } catch (error) {
    console.warn('[COSE] 知乎正文导入失败:', error)
    return { success: false, error: '知乎正文粘贴失败，请在编辑器中检查' }
  }

  const deadline = Date.now() + (hasSourceImages ? 30000 : 3000)
  let hasImages = hasSourceImages
  let savedImages = 0
  do {
    const currentEditor = getEditor()
    const figures = currentEditor?.querySelectorAll('figure') ?? []
    if (
      Array.from(figures).some(
        figure => figure.textContent.trim() === '上传失败' && !figure.querySelector('img[src]')
      )
    ) {
      return {
        success: false,
        error: '知乎显示图片上传失败，请在草稿中检查失败图片及其原始链接',
      }
    }

    hasImages ||= Boolean(currentEditor?.querySelector('img'))
    if (!hasImages && currentEditor?.textContent.trim()) {
      return { success: true, hasImages: false }
    }

    // A visible preview can precede autosave; a saved draft can also precede
    // rendering. Only the saved version tells us when it is safe to reload.
    const draftId = location.pathname.match(/^\/p\/(\d+)\/edit\/?$/)?.[1]
    if (hasImages && draftId) {
      try {
        const response = await fetch(`/api/articles/${draftId}/draft`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(3000),
        })
        if (response.ok) {
          const draft = await response.json()
          if (typeof draft.content === 'string' && (!title || draft.title === title)) {
            const saved = document.createElement('template')
            saved.innerHTML = draft.content
            savedImages = Array.from(saved.content.querySelectorAll('img[src]')).filter(image => {
              const url = URL.parse(image.getAttribute('src'))
              return (
                url?.protocol === 'https:' &&
                (url.hostname.endsWith('.zhimg.com') || url.hostname === 'pic-private.zhihu.com')
              )
            }).length
            if (savedImages >= Math.max(1, expectedImages)) {
              return { success: true, hasImages: true }
            }
          }
        }
      } catch {
        // The next autosave may still finish before the deadline.
      }
    }
    await sleep(hasImages ? 1000 : 250)
  } while (Date.now() < deadline)

  return {
    success: false,
    error: hasImages
      ? `知乎图片未全部保存（已确认 ${savedImages} 张${expectedImages ? `，原文 ${expectedImages} 张` : ''}），请在草稿中检查图片或原始链接`
      : '知乎正文未导入，请在编辑器中检查',
  }
}

/**
 * 知乎同步处理器
 * 知乎现在支持直接粘贴 Markdown，然后弹窗提示转换
 * @param {object} tab - Chrome tab 对象
 * @param {object} content - 内容对象 { title, body, markdown }
 * @param {object} helpers - 帮助函数 { chrome, waitForTab, addTabToSyncGroup }
 * @returns {Promise<{success: boolean, message?: string, tabId?: number}>}
 */
async function syncZhihuContent(tab, content, helpers) {
  const { waitForTab } = helpers

  // 等待页面加载完成（waitForTab 使用 chrome.tabs.onUpdated 监听）
  await waitForTab(tab.id)

  // 激活知乎标签页（避免后台标签页限制导致填充失败）
  try {
    await chrome.tabs.update(tab.id, { active: true })
    console.log('[COSE] 已激活知乎标签页')
    // 等待标签页激活完成
    await new Promise(resolve => setTimeout(resolve, 500))
  } catch (err) {
    console.log('[COSE] 激活标签页失败:', err.message || err)
  }

  // 先注入公共工具函数（waitFor 使用 MutationObserver）
  await injectUtils(globalThis.chrome, tab.id)

  // 在页面中执行内容填充
  const result = await globalThis.chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: fillZhihuContent,
    args: [content.title, content.markdown, content.body],
    world: 'MAIN',
  })

  const fillResult = result?.[0]?.result
  if (!fillResult?.success) {
    return { success: false, message: fillResult?.error || '内容同步失败', tabId: tab.id }
  }

  // 保留刷新以激活发布按钮的行为。带图草稿只有在服务器确认保存后才刷新。
  if (!fillResult.hasImages) await new Promise(resolve => setTimeout(resolve, 2000))
  try {
    await chrome.tabs.reload(tab.id, { bypassCache: false })
  } catch (err) {
    console.log('[COSE] 刷新知乎页面失败:', err.message || err)
  }

  return { success: true, message: '已打开知乎并同步内容', tabId: tab.id }
}

export { ZhihuPlatform, fillZhihuContent, syncZhihuContent }
