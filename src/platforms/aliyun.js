// 阿里云开发者社区平台配置
const AliyunPlatform = {
  id: 'aliyun',
  name: 'Aliyun',
  icon: 'https://img.alicdn.com/tfs/TB1_ZXuNcfpK1RjSZFOXXa6nFXa-32-32.ico',
  url: 'https://developer.aliyun.com/',
  publishUrl: 'https://developer.aliyun.com/article/new#/',
  title: '阿里云开发者社区',
  type: 'aliyun',
}

// 阿里云开发者社区登录检测配置
const AliyunLoginConfig = {
  useCookie: true,
  cookieUrl: 'https://developer.aliyun.com',
  cookieNames: ['login_aliyunid_ticket', 'login_aliyunid_csrf'],
  // 通过 API 获取用户信息
}

// 阿里云开发者社区内容填充函数
async function fillAliyunContent(content) {
  const { title, markdown } = content
  
  console.log('[COSE] 阿里云开发者社区：开始填充内容')
  
  // 等待页面加载
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  // 填充标题
  const titleInput = document.querySelector('input[placeholder*="标题"]')
  if (titleInput && title) {
    titleInput.focus()
    titleInput.value = title
    titleInput.dispatchEvent(new Event('input', { bubbles: true }))
    titleInput.dispatchEvent(new Event('change', { bubbles: true }))
    console.log('[COSE] 阿里云开发者社区：标题已填充')
  }
  
  // 等待一下再填充正文
  await new Promise(resolve => setTimeout(resolve, 500))
  
  // 填充正文（markdown 编辑器）
  // 阿里云开发者社区使用的是 markdown 编辑器，textarea 是主要输入区域
  const contentTextarea = document.querySelector('textarea[class*="editor"]') ||
    document.querySelector('.markdown-editor textarea') ||
    document.querySelector('textarea')
  
  if (contentTextarea && markdown) {
    contentTextarea.focus()
    contentTextarea.value = markdown
    contentTextarea.dispatchEvent(new Event('input', { bubbles: true }))
    contentTextarea.dispatchEvent(new Event('change', { bubbles: true }))
    console.log('[COSE] 阿里云开发者社区：正文已填充')
  }
  
  console.log('[COSE] 阿里云开发者社区：内容填充完成')
}

// 导出
export { AliyunPlatform, AliyunLoginConfig, fillAliyunContent }
