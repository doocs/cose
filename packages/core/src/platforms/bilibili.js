// B站专栏平台配置（使用旧版编辑器，基于 UEditor）
// 同步方式：使用 UEditor execCommand('inserthtml') 插入 HTML
const BilibiliPlatform = {
  id: 'bilibili',
  name: 'Bilibili',
  icon: 'https://www.bilibili.com/favicon.ico',
  url: 'https://member.bilibili.com',
  publishUrl: 'https://member.bilibili.com/article-text/home?newEditor=-1',
  title: 'B站专栏',
  type: 'bilibili',
}

// B站专栏内容填充函数（由 background.js 处理）
// 使用 UEditor 的 execCommand('inserthtml') 方法插入 HTML 内容
async function fillBilibiliContent(content, waitFor, setInputValue) {
  console.log('[COSE] B站专栏填充由 background.js 处理')
}

// 导出
export { BilibiliPlatform, fillBilibiliContent }
