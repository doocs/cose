// 华为云开发者博客平台配置
const HuaweiCloudPlatform = {
  id: 'huaweicloud',
  name: 'HuaweiCloud',
  icon: 'https://www.huaweicloud.com/favicon.ico',
  url: 'https://bbs.huaweicloud.com/',
  publishUrl: 'https://bbs.huaweicloud.com/blogs/article',
  title: '华为云开发者博客',
  type: 'huaweicloud',
}

// 华为云开发者博客登录检测配置
// 使用 cookie 检测登录状态
const HuaweiCloudLoginConfig = {
  useCookie: true,
  cookieUrl: 'https://bbs.huaweicloud.com',
  cookieNames: ['ua', 'SessionID'],
}

// 导出
export { HuaweiCloudPlatform, HuaweiCloudLoginConfig }
