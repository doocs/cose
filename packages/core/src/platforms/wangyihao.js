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

// 网易号内容填充函数（备用，主要使用剪贴板方式）
async function fillWangyihaoContent(content, waitFor, setInputValue) {
  const { title, body, markdown } = content
  const contentToFill = markdown || body || ''

  // 1. 填充标题 - 网易号使用 textarea.netease-textarea
  // 需要使用 native setter 来绕过 React 的受控组件
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  const titleInput = document.querySelector('textarea.netease-textarea') ||
    document.querySelector('textarea[placeholder*="标题"]')

  if (titleInput) {
    titleInput.focus()
    // 使用 native setter 来绕过 React 的受控组件
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    nativeSetter.call(titleInput, title)
    // 触发 React 能识别的事件
    titleInput.dispatchEvent(new InputEvent('input', { bubbles: true, data: title, inputType: 'insertText' }))
    titleInput.dispatchEvent(new Event('change', { bubbles: true }))
    titleInput.dispatchEvent(new Event('blur', { bubbles: true }))
    console.log('[COSE] 网易号标题填充成功')
  } else {
    console.log('[COSE] 网易号未找到标题输入框')
  }

  // 2. 等待编辑器加载
  await new Promise(resolve => setTimeout(resolve, 1500))

  // 3. 填充正文内容
  // 网易号使用 Draft.js 编辑器
  const editor = document.querySelector('.public-DraftEditor-content') ||
    document.querySelector('[contenteditable="true"]')

  if (editor) {
    editor.focus()
    editor.innerHTML = contentToFill.replace(/\n/g, '<br>')
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    console.log('[COSE] 网易号编辑器填充成功')
  } else {
    console.log('[COSE] 网易号未找到编辑器元素')
  }
}

// 导出
export { WangyihaoPlatform, fillWangyihaoContent }
