// 网易号平台配置
const WangyihaoPlatform = {
  id: 'wangyihao',
  name: 'Wangyihao',
  icon: 'https://static.ws.126.net/163/f2e/news/yxybd_pc/resource/static/share-icon.png',
  url: 'https://mp.163.com',
  publishUrl: 'https://mp.163.com/#/article-publish',
  title: '网易号',
  type: 'wangyihao',
}

import { injectUtils } from './common.js'

// 网易号内容填充函数（在页面主世界中执行）
// 网易号使用剪贴板 HTML 粘贴到 Draft.js 编辑器
function fillWangyihaoContent(title, htmlBody) {
  async function fill() {
    // 1. 等待并填充标题 - 网易号使用 textarea.netease-textarea
    const titleInput = await window.waitFor('textarea.netease-textarea', 10000) ||
      await window.waitFor('textarea[placeholder*="标题"]', 3000)

    if (titleInput && title) {
      titleInput.focus()
      // 使用 native setter 来绕过 React 的受控组件
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      nativeSetter.call(titleInput, title)
      // 触发 React 能识别的事件
      titleInput.dispatchEvent(new InputEvent('input', { bubbles: true, data: title, inputType: 'insertText' }))
      titleInput.dispatchEvent(new Event('change', { bubbles: true }))
      titleInput.dispatchEvent(new Event('blur', { bubbles: true }))
      console.log('[COSE] 网易号标题已填充')
    } else {
      console.log('[COSE] 网易号未找到标题输入框')
    }

    // 2. 等待 Draft.js 编辑器出现
    const editor = await window.waitFor('.public-DraftEditor-content', 10000) ||
      await window.waitFor('[contenteditable="true"]', 3000)

    if (editor && htmlBody) {
      editor.focus()

      // 清空 Draft.js 占位符
      const placeholder = editor.querySelector('[data-text="true"]')
      if (placeholder && placeholder.textContent.includes('请输入正文')) {
        editor.innerHTML = ''
      }

      // 通过 paste 事件注入 HTML 内容
      const dt = new DataTransfer()
      dt.setData('text/html', htmlBody)
      dt.setData('text/plain', htmlBody.replace(/<[^>]*>/g, ''))

      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dt
      })

      editor.dispatchEvent(pasteEvent)
      console.log('[COSE] 网易号内容已通过 paste 事件注入')
      return { success: true }
    } else {
      console.log('[COSE] 网易号未找到编辑器元素')
      return { success: false, error: 'Editor not found' }
    }
  }

  return fill()
}

/**
 * 网易号同步处理器
 * 网易号使用剪贴板 HTML 粘贴到 Draft.js 编辑器
 * @param {object} tab - Chrome tab 对象
 * @param {object} content - 内容对象 { title, body, markdown, wechatHtml }
 * @param {object} helpers - 帮助函数 { chrome, waitForTab, addTabToSyncGroup }
 * @returns {Promise<{success: boolean, message?: string, tabId?: number}>}
 */
async function syncWangyihaoContent(tab, content, helpers) {
  const { chrome, waitForTab } = helpers

  // 等待页面加载完成（waitForTab 使用 chrome.tabs.onUpdated 监听）
  await waitForTab(tab.id)

  // 先注入公共工具函数（waitFor 使用 MutationObserver）
  await injectUtils(chrome, tab.id)

  // 使用剪贴板 HTML（带完整样式）或降级到 body
  const htmlContent = content.wechatHtml || content.body
  console.log('[COSE] 网易号 HTML 内容长度:', htmlContent?.length || 0)

  // 在页面中执行：填充标题和粘贴 HTML 内容
  const result = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: fillWangyihaoContent,
    args: [content.title, htmlContent],
    world: 'MAIN',
  })

  const fillResult = result?.[0]?.result
  if (fillResult?.success) {
    return { success: true, message: '已同步到网易号', tabId: tab.id }
  } else {
    return { success: false, message: fillResult?.error || '网易号内容填充失败', tabId: tab.id }
  }
}

// 导出
export { WangyihaoPlatform, fillWangyihaoContent, syncWangyihaoContent }
