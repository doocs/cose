// 今日头条平台配置
const ToutiaoPlatform = {
  id: 'toutiao',
  name: 'Toutiao',
  icon: 'https://sf3-cdn-tos.toutiaostatic.com/obj/eden-cn/uhbfnupkbps/toutiao_favicon.ico',
  url: 'https://mp.toutiao.com',
  publishUrl: 'https://mp.toutiao.com/profile_v4/graphic/publish',
  title: '今日头条',
  type: 'toutiao',
}

// 今日头条登录检测配置
const ToutiaoLoginConfig = {
  api: 'https://mp.toutiao.com/mp/agw/media/get_media_info',
  method: 'GET',
  checkLogin: (response) => response?.err_no === 0 && response?.data?.media?.display_name,
  getUserInfo: (response) => ({
    username: response?.data?.media?.display_name,
    avatar: response?.data?.media?.https_avatar_url,
  }),
}

// 今日头条内容填充函数
async function fillToutiaoContent(content, waitFor, setInputValue) {
  const { title, body, markdown } = content
  const contentToFill = body || markdown || ''

  // 填充标题 - 头条使用 textarea 作为标题输入
  const titleInput = await waitFor('textarea[placeholder*="标题"], input[placeholder*="标题"], .editor-title textarea, .title-input textarea')
  if (titleInput) {
    titleInput.focus()
    // 使用 nativeInputValueSetter 触发 React 状态更新
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set 
      || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(titleInput, title)
    } else {
      titleInput.value = title
    }
    titleInput.dispatchEvent(new Event('input', { bubbles: true }))
    titleInput.dispatchEvent(new Event('change', { bubbles: true }))
    console.log('[COSE] 头条标题填充成功')
  } else {
    console.log('[COSE] 头条未找到标题输入框')
  }

  // 等待编辑器加载
  await new Promise(resolve => setTimeout(resolve, 1000))

  // 头条使用富文本编辑器
  const editor = document.querySelector('.ProseMirror, [contenteditable="true"], .editor-content')
  if (editor) {
    editor.focus()
    editor.innerHTML = contentToFill.replace(/\n/g, '<br>')
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    console.log('[COSE] 头条内容填充成功')
  } else {
    console.log('[COSE] 头条未找到编辑器')
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ToutiaoPlatform, ToutiaoLoginConfig, fillToutiaoContent }
}
