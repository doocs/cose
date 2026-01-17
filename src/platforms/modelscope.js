// ModelScope 魔搭社区平台配置
// 编辑器支持 Markdown，注入后需要点击"转为富文本"按钮

const ModelScopePlatform = {
  id: 'modelscope',
  name: 'ModelScope',
  icon: 'https://img.alicdn.com/imgextra/i4/O1CN01fvt4it25rEZU4Gjso_!!6000000007579-2-tps-128-128.png',
  url: 'https://modelscope.cn',
  publishUrl: 'https://modelscope.cn/learn/create',
  title: 'ModelScope 魔搭社区',
  type: 'modelscope',
}

// ModelScope 登录检测配置
// 使用 API 检测登录状态
const ModelScopeLoginConfig = {
  api: 'https://modelscope.cn/api/v1/users/login/info',
  method: 'GET',
  checkLogin: (response) => response?.Success && response?.Data?.Name,
  getUserInfo: (response) => ({
    username: response?.Data?.NickName || response?.Data?.Name,
    avatar: response?.Data?.Avatar,
  }),
}

// 导出
export { ModelScopePlatform, ModelScopeLoginConfig }
