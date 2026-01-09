// 微博头条文章平台配置
const WeiboPlatform = {
  id: 'weibo',
  name: 'Weibo',
  icon: 'https://weibo.com/favicon.ico',
  url: 'https://weibo.com',
  publishUrl: 'https://card.weibo.com/article/v5/editor#/draft',
  title: '微博头条',
  type: 'weibo',
}

// 微博登录检测配置 - 使用 API 检测，不使用 cookie
const WeiboLoginConfig = {
  api: 'https://card.weibo.com/article/v5/aj/editor/draft/list?uid=0&allow_pay=1',
  method: 'GET',
  checkLogin: (data) => data?.code === 100000,
  getUserInfo: () => ({ username: '', avatar: '' }), // 用户信息在 background.js 中单独获取
}

// 导出
export { WeiboPlatform, WeiboLoginConfig }
