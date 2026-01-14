// 百度千帆开发者社区平台配置
// 编辑器支持 Markdown 自动转换功能

const QianfanPlatform = {
  id: 'qianfan',
  name: 'Qianfan',
  icon: 'https://bce.bdstatic.com/img/favicon.ico',
  url: 'https://qianfan.cloud.baidu.com/qianfandev',
  publishUrl: 'https://qianfan.cloud.baidu.com/qianfandev/topic/create',
  title: '百度云千帆',
  type: 'qianfan',
}

// 百度千帆登录检测配置
// 使用百度云的登录 cookie
const QianfanLoginConfig = {
  useCookie: true,
  cookieUrl: 'https://qianfan.cloud.baidu.com',
  cookieNames: ['BDUSS', 'BAIDUID'],
}

// 导出
export { QianfanPlatform, QianfanLoginConfig }
