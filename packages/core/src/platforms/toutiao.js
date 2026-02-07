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

import { injectUtils } from './common.js'

// 今日头条内容填充函数（在页面主世界中执行）
function fillToutiaoContentInPage(title, body) {
  // 等待满足条件的元素出现
  function waitForElement(predicate, timeout = 10000) {
    return new Promise((resolve) => {
      const el = predicate()
      if (el) return resolve(el)

      const observer = new MutationObserver(() => {
        const el = predicate()
        if (el) {
          observer.disconnect()
          resolve(el)
        }
      })
      observer.observe(document.body, { childList: true, subtree: true })

      setTimeout(() => {
        observer.disconnect()
        resolve(predicate())
      }, timeout)
    })
  }

  async function fillContent() {
    // 填充标题 - 头条使用 textarea
    const titleInput = await waitForElement(() =>
      document.querySelector('textarea[placeholder*="标题"]')
    )
    if (titleInput && title) {
      titleInput.focus()
      // 模拟用户输入
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      nativeSetter.call(titleInput, title)
      titleInput.dispatchEvent(new InputEvent('input', { bubbles: true, data: title, inputType: 'insertText' }))
      titleInput.dispatchEvent(new Event('change', { bubbles: true }))
      titleInput.dispatchEvent(new Event('blur', { bubbles: true }))
      console.log('[COSE] 头条标题填充成功:', title)
    } else {
      console.log('[COSE] 头条未找到标题输入框')
    }

    // 等待编辑器加载
    await new Promise(resolve => setTimeout(resolve, 500))

    // 头条使用 ProseMirror 富文本编辑器
    const editor = await waitForElement(() =>
      document.querySelector('.ProseMirror')
    )

    if (editor && body) {
      editor.focus()

      // 对于 ProseMirror，我们需要更智能的方式来填充内容
      // 清空现有内容
      editor.innerHTML = ''

      // 将内容分割成段落
      const lines = body.split('\n').filter(line => line.trim() !== '')

      // 使用 document.execCommand 插入内容（ProseMirror 兼容）
      const selection = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)

      // 创建 HTML 内容
      const htmlContent = lines.map(line => `<p>${line}</p>`).join('')

      // 使用 insertHTML 命令
      document.execCommand('insertHTML', false, htmlContent)

      // 触发事件让 ProseMirror 同步
      editor.dispatchEvent(new InputEvent('input', { bubbles: true }))
      editor.dispatchEvent(new Event('change', { bubbles: true }))

      console.log('[COSE] 头条内容填充成功')
      return { success: true }
    } else {
      console.log('[COSE] 头条未找到编辑器')
      return { success: false, error: '未找到编辑器' }
    }
  }

  return fillContent()
}

/**
 * 今日头条同步处理器
 * @param {object} tab - Chrome tab 对象
 * @param {object} content - 内容对象 { title, body, markdown }
 * @param {object} helpers - 帮助函数 { chrome, waitForTab, addTabToSyncGroup }
 * @returns {Promise<{success: boolean, message?: string, tabId?: number}>}
 */
async function syncToutiaoContent(tab, content, helpers) {
  const { chrome, waitForTab } = helpers

  // 等待页面加载完成
  await waitForTab(tab.id)

  // 额外等待一下让编辑器完全加载
  await new Promise(resolve => setTimeout(resolve, 2500))

  // 先注入公共工具函数
  await injectUtils(chrome, tab.id)

  // 在页面中执行填充
  const result = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: fillToutiaoContentInPage,
    args: [content.title, content.body || content.markdown || ''],
    world: 'MAIN',
  })

  const fillResult = result?.[0]?.result
  if (fillResult?.success) {
    return { success: true, message: '已打开头条号并填充内容', tabId: tab.id }
  } else {
    return { success: false, message: fillResult?.error || '内容填充失败', tabId: tab.id }
  }
}

// 导出
export { ToutiaoPlatform, fillToutiaoContentInPage, syncToutiaoContent }
