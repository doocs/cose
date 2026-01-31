// 通用平台工具函数

/**
 * 注入通用工具函数到页面主世界
 * 此函数会在页面中定义 window.waitFor 和 window.setInputValue
 */
function injectCommonUtils() {
  // 等待元素出现的工具函数（使用 MutationObserver）
  window.waitFor = (selector, timeout = 10000) => {
    return new Promise((resolve) => {
      const el = document.querySelector(selector)
      if (el) return resolve(el)

      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector)
        if (el) {
          observer.disconnect()
          resolve(el)
        }
      })
      observer.observe(document.body, { childList: true, subtree: true })

      setTimeout(() => {
        observer.disconnect()
        resolve(document.querySelector(selector))
      }, timeout)
    })
  }

  // 设置输入值的工具函数
  window.setInputValue = (el, value) => {
    if (!el || !value) return
    el.focus()
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      // 使用 native setter 确保 React/Vue 等框架能检测到变化
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      )?.set || Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      )?.set
      if (nativeSetter) {
        nativeSetter.call(el, value)
      } else {
        el.value = value
      }
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    } else if (el.contentEditable === 'true') {
      el.innerHTML = value.replace(/\n/g, '<br>')
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }

  return true
}

/**
 * 在页面中注入通用工具函数
 * @param {object} chrome - Chrome API 对象
 * @param {number} tabId - 目标 tab ID
 * @returns {Promise<void>}
 */
async function injectUtils(chrome, tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: injectCommonUtils,
    world: 'MAIN',
  })
}

// 导出
export { injectCommonUtils, injectUtils }
