// 思否平台配置
const SegmentFaultPlatform = {
  id: 'segmentfault',
  name: 'SegmentFault',
  icon: 'https://www.google.com/s2/favicons?domain=segmentfault.com&sz=32',
  url: 'https://segmentfault.com',
  publishUrl: 'https://segmentfault.com/write',
  title: '思否',
  type: 'segmentfault',
}

// 思否登录检测配置
const SegmentFaultLoginConfig = {
  useCookie: true,
  cookieUrl: 'https://segmentfault.com',
  cookieNames: ['PHPSESSID'],
  fetchUserInfoFromPage: true,
  userInfoUrl: 'https://segmentfault.com/write',
}

// 思否内容填充函数
async function fillSegmentFaultContent(content, waitFor, setInputValue) {
  const { title, body, markdown } = content
  const contentToFill = markdown || body || ''

  // 填充标题
  const titleInput = await waitFor('input#title, input[placeholder*="标题"]')
  if (titleInput) {
    titleInput.focus()
    titleInput.value = title
    titleInput.dispatchEvent(new Event('input', { bubbles: true }))
    titleInput.dispatchEvent(new Event('change', { bubbles: true }))
    console.log('[COSE] 思否标题填充成功')
  }

  // 等待编辑器加载
  await new Promise(resolve => setTimeout(resolve, 1000))

  // 思否使用 CodeMirror 编辑器
  const cmElement = document.querySelector('.CodeMirror')
  if (cmElement && cmElement.CodeMirror) {
    cmElement.CodeMirror.setValue(contentToFill)
    console.log('[COSE] 思否 CodeMirror 填充成功')
  } else {
    // 降级到 textarea
    const textarea = document.querySelector('textarea')
    if (textarea) {
      textarea.focus()
      textarea.value = contentToFill
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
      console.log('[COSE] 思否 textarea 填充成功')
    } else {
      console.log('[COSE] 思否 未找到编辑器')
    }
  }
}

// 导出
export { SegmentFaultPlatform, SegmentFaultLoginConfig, fillSegmentFaultContent }
