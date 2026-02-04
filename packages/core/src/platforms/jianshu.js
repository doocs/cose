// 简书平台配置
const JianshuPlatform = {
  id: 'jianshu',
  name: 'Jianshu',
  icon: 'https://www.jianshu.com/favicon.ico',
  url: 'https://www.jianshu.com',
  publishUrl: 'https://www.jianshu.com/writer',
  title: '简书',
  type: 'jianshu',
}

// 简书内容填充函数
async function fillJianshuContent(content, waitFor, setInputValue) {
  const { title, body, markdown } = content
  const contentToFill = markdown || body || ''

  // 填充标题 - 简书使用 input._24i7u，需要使用 native setter
  const titleInput = await waitFor('input._24i7u, input[class*="title"]')
  if (titleInput) {
    titleInput.focus()
    const inputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    inputSetter.call(titleInput, title)
    titleInput.dispatchEvent(new InputEvent('input', { bubbles: true, data: title, inputType: 'insertText' }))
    titleInput.dispatchEvent(new Event('change', { bubbles: true }))
    titleInput.dispatchEvent(new Event('blur', { bubbles: true }))
    console.log('[COSE] 简书标题填充成功')
  } else {
    console.log('[COSE] 简书未找到标题输入框')
  }

  // 等待编辑器加载
  await new Promise(resolve => setTimeout(resolve, 500))

  // 简书使用 textarea#arthur-editor 作为 Markdown 编辑器
  const editor = document.querySelector('#arthur-editor') || document.querySelector('textarea._3swFR')
  if (editor) {
    editor.focus()
    const textareaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    textareaSetter.call(editor, contentToFill)
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, data: contentToFill, inputType: 'insertText' }))
    editor.dispatchEvent(new Event('change', { bubbles: true }))
    console.log('[COSE] 简书内容填充成功')
  } else {
    console.log('[COSE] 简书未找到编辑器')
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { JianshuPlatform, fillJianshuContent }
}

export { JianshuPlatform, fillJianshuContent }
