// 博客园平台配置
const CnblogsPlatform = {
  id: 'cnblogs',
  name: 'Cnblogs',
  icon: 'https://www.cnblogs.com/favicon.ico',
  url: 'https://www.cnblogs.com',
  publishUrl: 'https://i.cnblogs.com/posts/edit',
  title: '博客园',
  type: 'cnblogs',
}

// 博客园登录检测配置
const CnblogsLoginConfig = {
  api: 'https://i.cnblogs.com/api/user',
  method: 'GET',
  checkLogin: (response) => response?.loginName,
  getUserInfo: (response) => ({
    username: response?.displayName || response?.loginName,
    avatar: response?.avatarName ? `https:${response.avatarName}` : '',
  }),
}

// 博客园内容填充函数
async function fillCnblogsContent(content, waitFor, setInputValue) {
  const { title, body, markdown } = content
  const contentToFill = markdown || body || ''

  // 填充标题
  const titleInput = await waitFor('#post-title, input[placeholder*="标题"]')
  if (titleInput) {
    titleInput.focus()
    titleInput.value = title
    titleInput.dispatchEvent(new Event('input', { bubbles: true }))
    titleInput.dispatchEvent(new Event('change', { bubbles: true }))
    console.log('[COSE] 博客园标题填充成功')
  }

  // 等待编辑器加载
  await new Promise(resolve => setTimeout(resolve, 1000))

  // 博客园使用 TinyMCE 或 Markdown 编辑器
  // 尝试 Markdown 模式
  const cmElement = document.querySelector('.CodeMirror')
  if (cmElement && cmElement.CodeMirror) {
    cmElement.CodeMirror.setValue(contentToFill)
    console.log('[COSE] 博客园 CodeMirror 填充成功')
    return
  }

  // 尝试 TinyMCE
  if (window.tinymce && window.tinymce.activeEditor) {
    window.tinymce.activeEditor.setContent(contentToFill)
    console.log('[COSE] 博客园 TinyMCE 填充成功')
    return
  }

  // 降级到 textarea
  const textarea = document.querySelector('#post-body, textarea')
  if (textarea) {
    textarea.focus()
    textarea.value = contentToFill
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    console.log('[COSE] 博客园 textarea 填充成功')
  } else {
    console.log('[COSE] 博客园 未找到编辑器')
  }
}

// 导出
export { CnblogsPlatform, CnblogsLoginConfig, fillCnblogsContent }
