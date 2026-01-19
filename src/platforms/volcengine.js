// 火山引擎开发者社区平台配置
const VolcenginePlatform = {
  id: 'volcengine',
  name: 'Volcengine',
  icon: 'https://lf1-cdn-tos.bytegoofy.com/goofy/tech-fe/fav.png',
  url: 'https://developer.volcengine.com/',
  publishUrl: 'https://developer.volcengine.com/articles/draft',
  title: '火山引擎开发者社区',
  type: 'volcengine',
}

// 火山引擎登录检测配置
// 使用 API 检测登录状态
const VolcengineLoginConfig = {
  api: 'https://developer.volcengine.com/api/fe/v1/user',
  method: 'GET',
  checkLogin: (response) => response?.err_no === 0 && response?.data?.user_id,
  getUserInfo: (response) => ({
    username: response?.data?.name,
    avatar: response?.data?.avatar?.url,
  }),
}

// 导出
export { VolcenginePlatform, VolcengineLoginConfig }
