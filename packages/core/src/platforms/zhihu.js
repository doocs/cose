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
function fillZhihuContent(title, markdown) {
  // 等待满足条件的元素出现（使用 MutationObserver）
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

  // 等待按钮出现并点击
  async function waitAndClickButton(textMatcher, timeout = 5000) {
    const startTime = Date.now()
    while (Date.now() - startTime < timeout) {
      const buttons = document.querySelectorAll('button')
      for (const btn of buttons) {
        if (textMatcher(btn.textContent)) {
          btn.click()
          console.log('[COSE] 已点击按钮:', btn.textContent)
          return true
        }
      }
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    return false
  }

  async function fillContent() {
    // 第一步：填充标题
    async function fillTitle() {
      const titleInput = await window.waitFor('textarea[placeholder*="标题"]')
      if (titleInput && title) {
        titleInput.focus()
        // 使用 nativeInputValueSetter 确保 React 识别变更
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value'
        )?.set
        if (nativeSetter) {
          nativeSetter.call(titleInput, title)
        } else {
          titleInput.value = title
        }
        titleInput.dispatchEvent(new Event('input', { bubbles: true }))
        titleInput.dispatchEvent(new Event('change', { bubbles: true }))
        console.log('[COSE] 知乎标题填充成功')
      }
    }

    // 第二步：找到并激活知乎编辑器
    const editorSelectors = [
      '.public-DraftEditor-content',
      '[contenteditable="true"]',
      '.DraftEditor-root'
    ]
    
    let editor = null
    for (const selector of editorSelectors) {
      editor = document.querySelector(selector)
      if (editor) break
    }
    
    if (!editor) {
      console.log('[COSE] 未找到知乎编辑器')
      return { success: false, error: 'Editor not found' }
    }

    // 激活编辑器：模拟真实点击序列
    const rect = editor.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    
    // 触发鼠标事件序列激活编辑器
    for (const eventType of ['mousedown', 'mouseup', 'click']) {
      const event = new MouseEvent(eventType, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: centerX,
        clientY: centerY,
        button: 0
      })
      editor.dispatchEvent(event)
    }
    
    // 聚焦编辑器
    editor.focus()
    
    // 清空现有内容
    document.execCommand('selectAll', false)
    document.execCommand('delete', false)
    
    // 等待编辑器状态更新
    await new Promise(resolve => setTimeout(resolve, 100))

    // 第三步：通过剪贴板 + 键盘事件模拟真实粘贴
    // 这是触发知乎 Markdown 检测弹窗的关键方法
    const contentToFill = markdown || ''
    
    if (!contentToFill) {
      console.log('[COSE] 没有 Markdown 内容需要填充')
      await fillTitle()
      return { success: true, method: 'empty' }
    }

    try {
      // 使用 ClipboardEvent 模拟粘贴 - 这是触发 Markdown 检测弹窗的关键
      // execCommand('insertText') 不会触发弹窗
      
      // 检查浏览器兼容性
      if (typeof DataTransfer === 'undefined' || typeof ClipboardEvent === 'undefined') {
        throw new Error('浏览器不支持 DataTransfer 或 ClipboardEvent')
      }
      
      const dt = new DataTransfer()
      dt.setData('text/plain', contentToFill)
      
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dt
      })
      
      editor.focus()
      const dispatched = editor.dispatchEvent(pasteEvent)
      console.log('[COSE] 已触发 ClipboardEvent，dispatched:', dispatched)
      
      // 等待 Markdown 检测弹窗出现并点击"确认并解析"
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const parseClicked = await waitAndClickButton(
        text => text.includes('确认并解析'),
        5000
      )
      
      if (parseClicked) {
        console.log('[COSE] 已点击"确认并解析"')
        
        // 等待解析完成并点击"确认"
        await new Promise(resolve => setTimeout(resolve, 500))
        
        const confirmClicked = await waitAndClickButton(
          text => text === '确认',
          5000
        )
        
        if (confirmClicked) {
          console.log('[COSE] 已点击"确认"，Markdown 解析完成')
        }
      } else {
        console.log('[COSE] 未检测到 Markdown 弹窗')
      }
    } catch (err) {
      console.log('[COSE] 内容插入失败:', err.message || err)
    }

    // 等待内容渲染
    await new Promise(resolve => setTimeout(resolve, 300))

    // 填充标题
    await fillTitle()

    return { success: true, method: 'paste-markdown' }
  }

  return fillContent()
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

  // 先注入公共工具函数（waitFor 使用 MutationObserver）
  await injectUtils(globalThis.chrome, tab.id)

  // 在页面中执行内容填充
  const result = await globalThis.chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: fillZhihuContent,
    args: [content.title, content.markdown],
    world: 'MAIN',
  })

  const fillResult = result?.[0]?.result
  if (fillResult?.success) {
    // 等待 2 秒确保内容已保存
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // 模拟用户刷新页面
    try {
      if (chrome?.tabs && tab?.id) {
        await chrome.tabs.reload(tab.id, { bypassCache: false })
        console.log('[COSE] 已模拟用户刷新知乎页面')
      } else {
        console.log('[COSE] chrome.tabs 或 tab.id 不可用，跳过刷新')
      }
    } catch (err) {
      console.log('[COSE] 刷新页面失败:', err.message || err)
    }
    
    return { success: true, message: '已打开知乎并同步内容', tabId: tab.id }
  } else {
    return { success: false, message: fillResult?.error || '内容同步失败', tabId: tab.id }
  }
}

// 导出
export { ZhihuPlatform, fillZhihuContent, syncZhihuContent }
