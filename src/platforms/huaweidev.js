// 华为开发者文章平台配置
const HuaweiDevPlatform = {
  id: 'huaweidev',
  name: 'HuaweiDev',
  icon: 'https://developer.huawei.com/favicon.ico',
  url: 'https://developer.huawei.com/consumer/cn/',
  publishUrl: 'https://developer.huawei.com/consumer/cn/blog/create',
  title: '华为开发者文章',
  type: 'huaweidev',
}

// 华为开发者文章登录检测配置
// 使用 cookie 检测登录状态
const HuaweiDevLoginConfig = {
  useCookie: true,
  cookieUrl: 'https://developer.huawei.com',
  cookieNames: ['developer_userinfo', 'developer_userdata'],
}

// 导出
export { HuaweiDevPlatform, HuaweiDevLoginConfig }
