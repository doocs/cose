// 百家号平台配置
const BaijiahaoPlat = {
  id: 'baijiahao',
  name: 'Baijiahao',
  icon: 'https://pic.rmb.bdstatic.com/10e1e2b43c35577e1315f0f6aad6ba24.vnd.microsoft.icon',
  url: 'https://baijiahao.baidu.com',
  publishUrl: 'https://baijiahao.baidu.com/builder/rc/edit?type=news',
  title: '百家号',
  type: 'baijiahao',
}

// 百家号登录检测配置
const BaijiahaoLoginConfig = {
  useCookie: true,
  cookieUrl: 'https://baijiahao.baidu.com',
  cookieNames: ['BDUSS'],
  // 百家号需要特殊处理，在 background.js 中单独实现
}

// 百家号内容填充函数
async function fillBaijiahaoContent(content, waitFor, setInputValue) {
  const { title, body, markdown } = content
  const contentToFill = markdown || body || ''

  // 1. 填充标题
  // 百家号标题输入框在 .client_components_titleInput 内的 contenteditable div
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  const titleEditor = document.querySelector('.client_components_titleInput [contenteditable="true"]') ||
    document.querySelector('.client_pages_edit_components_titleInput [contenteditable="true"]') ||
    document.querySelector('[class*="titleInput"] [contenteditable="true"]')

  if (titleEditor) {
    titleEditor.focus()
    // 清空现有内容
    titleEditor.innerHTML = ''
    // 使用 document.execCommand 插入文本
    document.execCommand('insertText', false, title)
    // 如果 execCommand 不生效，使用备用方案
    if (!titleEditor.textContent) {
      titleEditor.innerHTML = `<p dir="auto">${title}</p>`
    }
    titleEditor.dispatchEvent(new Event('input', { bubbles: true }))
    titleEditor.dispatchEvent(new Event('change', { bubbles: true }))
    console.log('[COSE] 百家号标题填充成功')
  } else {
    console.log('[COSE] 百家号未找到标题输入框')
  }

  // 2. 等待编辑器加载
  await new Promise(resolve => setTimeout(resolve, 1500))

  // 3. 填充正文内容
  // 百家号使用 UEditor，内容在 iframe 中
  const iframe = document.querySelector('iframe')
  if (iframe && iframe.contentDocument) {
    const iframeBody = iframe.contentDocument.body
    if (iframeBody && iframeBody.contentEditable === 'true') {
      iframeBody.focus()
      // 将 markdown 转换为简单的 HTML 段落
      const htmlContent = contentToFill
        .split('\n\n')
        .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
        .join('')
      iframeBody.innerHTML = htmlContent
      iframeBody.dispatchEvent(new Event('input', { bubbles: true }))
      console.log('[COSE] 百家号 iframe 编辑器填充成功')
      return
    }
  }

  // 尝试通过 UEditor API 填充
  if (window.UE_V2 && window.UE_V2.instants && window.UE_V2.instants.ueditorInstant0) {
    try {
      const editor = window.UE_V2.instants.ueditorInstant0
      const htmlContent = contentToFill
        .split('\n\n')
        .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
        .join('')
      editor.setContent(htmlContent)
      console.log('[COSE] 百家号通过 UEditor API 填充成功')
      return
    } catch (e) {
      console.log('[COSE] 百家号 UEditor API 调用失败', e)
    }
  }

  // 降级：尝试直接操作 contenteditable
  const contentEditor = document.querySelector('[contenteditable="true"]:not([class*="title"])')
  if (contentEditor) {
    contentEditor.focus()
    contentEditor.innerHTML = contentToFill.replace(/\n/g, '<br>')
    contentEditor.dispatchEvent(new Event('input', { bubbles: true }))
    console.log('[COSE] 百家号 contenteditable 降级填充成功')
  } else {
    console.log('[COSE] 百家号未找到编辑器元素')
  }
}

// 导出
export { BaijiahaoPlat as BaijiahaoPlatform, BaijiahaoLoginConfig, fillBaijiahaoContent }
