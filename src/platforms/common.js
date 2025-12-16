// 通用平台填充逻辑

// 通用内容填充（兜底）
async function fillGenericContent(content, waitFor, setInputValue) {
  const { title, body, markdown } = content
  const contentToFill = markdown || body || ''

  const titleSelectors = ['input[placeholder*="标题"]', 'input[name="title"]', 'textarea[placeholder*="标题"]']
  for (const sel of titleSelectors) {
    const el = document.querySelector(sel)
    if (el) {
      setInputValue(el, title)
      break
    }
  }

  const contentSelectors = ['.CodeMirror', '.ProseMirror', '.ql-editor', '[contenteditable="true"]', 'textarea']
  for (const sel of contentSelectors) {
    const el = document.querySelector(sel)
    if (el) {
      if (el.CodeMirror) {
        el.CodeMirror.setValue(contentToFill)
      } else {
        setInputValue(el, contentToFill)
      }
      break
    }
  }
}

// 等待元素出现的工具函数
function waitFor(selector, timeout = 10000) {
  return new Promise((resolve) => {
    const start = Date.now()
    const check = () => {
      const el = document.querySelector(selector)
      if (el) resolve(el)
      else if (Date.now() - start > timeout) resolve(null)
      else setTimeout(check, 200)
    }
    check()
  })
}

// 设置输入值的工具函数
function setInputValue(el, value) {
  if (!el || !value) return
  el.focus()
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    el.value = value
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  } else if (el.contentEditable === 'true') {
    el.innerHTML = value.replace(/\n/g, '<br>')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    fillGenericContent,
    waitFor,
    setInputValue,
  }
}
