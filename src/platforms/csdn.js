// CSDN 平台配置
const CSDNPlatform = {
  id: 'csdn',
  name: 'CSDN',
  icon: 'https://g.csdnimg.cn/static/logo/favicon32.ico',
  url: 'https://blog.csdn.net',
  publishUrl: 'https://editor.csdn.net/md/',
  title: 'CSDN',
  type: 'csdn',
}

// CSDN 登录检测配置
const CSDNLoginConfig = {
  useCookie: true,
  cookieUrl: 'https://blog.csdn.net',
  cookieNames: ['UserName', 'UserNick'],
  getUsernameFromCookie: true,
  usernameCookie: 'UserNick',
  usernameCookieForApi: 'UserName',
  // 从用户页面抓取头像
  fetchAvatarFromPage: true,
}

// CSDN 内容填充函数
async function fillCSDNContent(content, waitFor, setInputValue) {
  const { title, body, markdown } = content
  const contentToFill = markdown || body || ''

  // 填充标题
  const titleInput = await waitFor('.article-bar__title input, input[placeholder*="标题"]')
  setInputValue(titleInput, title)

  // 等待编辑器加载
  await new Promise(resolve => setTimeout(resolve, 1000))

  // CSDN 使用 contenteditable 的 PRE 元素
  const editor = document.querySelector('.editor__inner[contenteditable="true"], [contenteditable="true"].markdown-highlighting')

  if (editor) {
    editor.focus()
    // 清空现有内容
    editor.textContent = ''
    // 直接设置文本内容
    editor.textContent = contentToFill
    // 触发 input 事件让编辑器识别变化
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    console.log('[COSE] CSDN contenteditable 填充成功')
  } else {
    // 降级尝试其他方式
    const cmElement = document.querySelector('.CodeMirror')
    if (cmElement && cmElement.CodeMirror) {
      cmElement.CodeMirror.setValue(contentToFill)
      console.log('[COSE] CSDN CodeMirror 填充成功')
    } else {
      console.log('[COSE] CSDN 未找到编辑器元素')
    }
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CSDNPlatform, CSDNLoginConfig, fillCSDNContent }
}
