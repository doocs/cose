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
// 知乎使用导入文档功能上传 md 文件
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

  async function uploadMarkdown() {
    // 先填充标题（使用注入的 window.waitFor，基于 MutationObserver）
    const titleInput = await window.waitFor('textarea[placeholder*="标题"]')
    if (titleInput && title) {
      titleInput.focus()
      titleInput.value = title
      titleInput.dispatchEvent(new Event('input', { bubbles: true }))
      console.log('[COSE] 知乎标题填充成功')
    }

    // 第一步：点击工具栏的"导入"按钮，打开子菜单
    // 注意：按钮文本可能包含零宽字符，使用 includes 匹配
    const importBtn = Array.from(document.querySelectorAll('button'))
      .find(el => el.innerText.includes('导入') && !el.innerText.includes('导入文档') && !el.innerText.includes('导入链接'))

    if (importBtn) {
      importBtn.click()
      console.log('[COSE] 已点击导入按钮')

      // 等待子菜单中的"导入文档"按钮出现（使用 MutationObserver）
      const importDocBtn = await waitForElement(() => 
        Array.from(document.querySelectorAll('button'))
          .find(el => el.innerText.includes('导入文档'))
      )

      if (importDocBtn) {
        importDocBtn.click()
        console.log('[COSE] 已点击导入文档按钮')

        // 等待文件输入框出现（使用 MutationObserver）
        const fileInput = await window.waitFor('input[type="file"][accept*=".md"]')
        if (fileInput) {
          // 创建 md 文件（使用 text/plain 类型，更通用）
          const mdContent = markdown || ''
          const fileName = (title || 'article').replace(/[\\/：:*?"<>|]/g, '_') + '.md'
          const file = new File([mdContent], fileName, { type: 'text/plain' })

          // 创建 DataTransfer 并设置文件
          const dt = new DataTransfer()
          dt.items.add(file)
          fileInput.files = dt.files

          // 触发 input 和 change 事件
          fileInput.dispatchEvent(new Event('input', { bubbles: true }))
          fileInput.dispatchEvent(new Event('change', { bubbles: true }))
          console.log('[COSE] 已上传 md 文件:', fileName)

          // 同时触发拖放事件作为备用方案
          const dropZone = document.querySelector('[class*="Modal"]') || document.body
          const dropEvent = new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            dataTransfer: dt
          })
          dropZone.dispatchEvent(dropEvent)
          console.log('[COSE] 已触发拖放事件')
          return { success: true, method: 'import-document' }
        } else {
          console.log('[COSE] 未找到文件输入框')
          return { success: false, error: 'File input not found' }
        }
      } else {
        console.log('[COSE] 未找到导入文档按钮')
        return { success: false, error: 'Import document button not found' }
      }
    } else {
      console.log('[COSE] 未找到导入按钮')
      return { success: false, error: 'Import button not found' }
    }
  }

  return uploadMarkdown()
}

/**
 * 知乎同步处理器
 * 知乎使用导入文档功能上传 md 文件
 * @param {object} tab - Chrome tab 对象
 * @param {object} content - 内容对象 { title, body, markdown }
 * @param {object} helpers - 帮助函数 { chrome, waitForTab, addTabToSyncGroup }
 * @returns {Promise<{success: boolean, message?: string, tabId?: number}>}
 */
async function syncZhihuContent(tab, content, helpers) {
  const { chrome, waitForTab } = helpers

  // 等待页面加载完成（waitForTab 使用 chrome.tabs.onUpdated 监听）
  await waitForTab(tab.id)

  // 先注入公共工具函数（waitFor 使用 MutationObserver）
  await injectUtils(chrome, tab.id)

  // 在页面中执行：点击导入文档并上传 md 文件
  const result = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: fillZhihuContent,
    args: [content.title, content.markdown],
    world: 'MAIN',
  })

  const fillResult = result?.[0]?.result
  if (fillResult?.success) {
    return { success: true, message: '已打开知乎并导入文档', tabId: tab.id }
  } else {
    return { success: false, message: fillResult?.error || '导入文档失败', tabId: tab.id }
  }
}

// 导出
export { ZhihuPlatform, fillZhihuContent, syncZhihuContent }
