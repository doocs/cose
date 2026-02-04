// 掘金平台配置
const JuejinPlatform = {
  id: 'juejin',
  name: 'Juejin',
  icon: 'https://lf-web-assets.juejin.cn/obj/juejin-web/xitu_juejin_web/static/favicons/favicon-32x32.png',
  url: 'https://juejin.cn',
  publishUrl: 'https://juejin.cn/editor/drafts/new',
  title: '掘金',
  type: 'juejin',
}

import { injectUtils } from './common.js'

// 掘金内容填充函数（在页面主世界中执行）
// 注意：需要先调用 injectUtils 注入 window.waitFor
function fillJuejinContent(title, markdown, body) {
  const contentToFill = markdown || body || ''

  async function fill() {
    // 填充标题（使用注入的 window.waitFor）
    const titleInput = await window.waitFor('input[placeholder*="标题"]')
    if (titleInput && title) {
      titleInput.focus()
      titleInput.value = title
      titleInput.dispatchEvent(new Event('input', { bubbles: true }))
    }

    // 等待编辑器加载
    await new Promise(resolve => setTimeout(resolve, 1000))

    // 掘金使用 ByteMD 编辑器（基于 CodeMirror）
    const cmElement = document.querySelector('.CodeMirror')
    if (cmElement && cmElement.CodeMirror) {
      cmElement.CodeMirror.setValue(contentToFill)
      console.log('[COSE] 掘金 CodeMirror 填充成功')
      return { success: true, method: 'CodeMirror' }
    } else {
      // 降级到 textarea
      const textarea = document.querySelector('.bytemd-body textarea')
      if (textarea) {
        textarea.focus()
        textarea.value = contentToFill
        textarea.dispatchEvent(new Event('input', { bubbles: true }))
        console.log('[COSE] 掘金 textarea 填充成功')
        return { success: true, method: 'textarea' }
      } else {
        console.log('[COSE] 掘金 未找到编辑器')
        return { success: false, error: 'Editor not found' }
      }
    }
  }

  return fill()
}

/**
 * 掘金同步处理器
 * @param {object} tab - Chrome tab 对象
 * @param {object} content - 内容对象 { title, body, markdown }
 * @param {object} helpers - 帮助函数 { chrome, waitForTab, addTabToSyncGroup }
 * @returns {Promise<{success: boolean, message?: string, tabId?: number}>}
 */
async function syncJuejinContent(tab, content, helpers) {
  const { chrome } = helpers

  // 等待页面加载
  await new Promise(resolve => setTimeout(resolve, 2000))

  // 先注入公共工具函数（waitFor, setInputValue）
  await injectUtils(chrome, tab.id)

  // 在页面中执行填充脚本
  const result = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: fillJuejinContent,
    args: [content.title, content.markdown, content.body],
    world: 'MAIN',
  })

  const fillResult = result?.[0]?.result
  if (fillResult?.success) {
    return { success: true, message: '已同步到掘金', tabId: tab.id }
  } else {
    return { success: false, message: fillResult?.error || '内容填充失败', tabId: tab.id }
  }
}

// 导出
export { JuejinPlatform, fillJuejinContent, syncJuejinContent }

