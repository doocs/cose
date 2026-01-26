// 小红书平台配置
// 同步方式：使用剪贴板 HTML 粘贴到编辑器
const XiaohongshuPlatform = {
  id: 'xiaohongshu',
  name: 'Xiaohongshu',
  icon: 'https://www.xiaohongshu.com/favicon.ico',
  url: 'https://creator.xiaohongshu.com',
  publishUrl: 'https://creator.xiaohongshu.com/publish/publish?from=menu&target=article',
  title: '小红书',
  type: 'xiaohongshu',
}

// 小红书登录检测配置 - 使用 API 检测
const XiaohongshuLoginConfig = {
  api: 'https://creator.xiaohongshu.com/api/galaxy/user/info',
  method: 'GET',
  checkLogin: (data) => data?.success === true && data?.code === 0 && data?.data?.userId,
  getUserInfo: (data) => ({
    username: data?.data?.userName || data?.data?.redId || '',
    avatar: data?.data?.userAvatar || '',
  }),
}

// 小红书内容填充函数（由 background.js 处理）
// 使用剪贴板粘贴方式填充内容
async function fillXiaohongshuContent(content, waitFor, setInputValue) {
  console.log('[COSE] 小红书填充由 background.js 处理')
}

// 导出
export { XiaohongshuPlatform, XiaohongshuLoginConfig, fillXiaohongshuContent }
