// 掘金平台配置
const JuejinPlatform = {
  id: 'juejin',
  name: 'Juejin',
  icon: 'https://lf-web-assets.juejin.cn/obj/juejin-web/xitu_juejin_web/static/favicons/favicon-32x32.png',
  url: 'https://juejin.cn',
  publishUrl: 'https://juejin.cn/editor/drafts/new',
  title: '掘金',
  type: 'juejin',
}

// 掘金登录检测配置
const JuejinLoginConfig = {
  api: 'https://api.juejin.cn/user_api/v1/user/get',
  method: 'GET',
  checkLogin: (response) => response?.err_no === 0 && response?.data?.user_id,
  getUserInfo: (response) => ({
    username: response?.data?.user_name,
    avatar: response?.data?.avatar_large,
  }),
}

// 掘金内容填充函数
async function fillJuejinContent(content, waitFor, setInputValue) {
  const { title, body, markdown } = content
  const contentToFill = markdown || body || ''

  // 填充标题
  const titleInput = await waitFor('input[placeholder*="标题"]')
  if (titleInput) {
    titleInput.focus()
    titleInput.value = title
    titleInput.dispatchEvent(new Event('input', { bubbles: true }))
  }

  // 等待编辑器加载
  await new Promise(resolve => setTimeout(resolve, 1000))

  // 掘金使用 ByteMD 编辑器（基于 CodeMirror）
  const cmElement = document.querySelector('.CodeMirror')
  if (cmElement && cmElement.CodeMirror) {
    cmElement.CodeMirror.setValue(contentToFill)
    console.log('[COSE] 掘金 CodeMirror 填充成功')
  } else {
    // 降级到 textarea
    const textarea = document.querySelector('.bytemd-body textarea')
    if (textarea) {
      textarea.focus()
      textarea.value = contentToFill
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
      console.log('[COSE] 掘金 textarea 填充成功')
    } else {
      console.log('[COSE] 掘金 未找到编辑器')
    }
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { JuejinPlatform, JuejinLoginConfig, fillJuejinContent }
}
