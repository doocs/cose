// 少数派平台配置
const SspaiPlatform = {
  id: 'sspai',
  name: 'Sspai',
  icon: 'https://cdn-static.sspai.com/favicon/sspai.ico',
  url: 'https://sspai.com',
  publishUrl: 'https://sspai.com/write',
  title: '少数派',
  type: 'sspai',
}

// 少数派登录检测配置
const SspaiLoginConfig = {
  useCookie: true,
  cookieUrl: 'https://sspai.com',
  cookieNames: ['sspai_jwt_token'],
  // 少数派需要特殊处理，在 background.js 中单独实现
  // 使用 /api/v1/user/info/get API 获取用户信息
}

// 少数派内容填充函数（备用，主要使用剪贴板方式）
async function fillSspaiContent(content, waitFor, setInputValue) {
  const { title, body, markdown } = content
  const contentToFill = markdown || body || ''

  // 1. 填充标题 - 少数派使用 textbox
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  const titleInput = document.querySelector('textarea[placeholder*="标题"]') ||
    document.querySelector('input[placeholder*="标题"]')

  if (titleInput) {
    titleInput.focus()
    // 使用 native setter 来绕过 React/Vue 的受控组件
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set ||
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    nativeSetter.call(titleInput, title)
    // 触发事件
    titleInput.dispatchEvent(new InputEvent('input', { bubbles: true, data: title, inputType: 'insertText' }))
    titleInput.dispatchEvent(new Event('change', { bubbles: true }))
    titleInput.dispatchEvent(new Event('blur', { bubbles: true }))
    console.log('[COSE] 少数派标题填充成功')
  } else {
    console.log('[COSE] 少数派未找到标题输入框')
  }

  // 2. 等待编辑器加载
  await new Promise(resolve => setTimeout(resolve, 1500))

  // 3. 填充正文内容
  // 少数派使用 ProseMirror 富文本编辑器
  const editor = document.querySelector('.ProseMirror') ||
    document.querySelector('[contenteditable="true"]')

  if (editor) {
    editor.focus()
    editor.innerHTML = contentToFill.replace(/\n/g, '<br>')
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    console.log('[COSE] 少数派编辑器填充成功')
  } else {
    console.log('[COSE] 少数派未找到编辑器元素')
  }
}

// 导出
export { SspaiPlatform, SspaiLoginConfig, fillSspaiContent }
