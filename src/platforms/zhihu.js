// 知乎平台配置
const ZhihuPlatform = {
  id: 'zhihu',
  name: 'Zhihu',
  icon: 'https://static.zhihu.com/heifetz/favicon.ico',
  url: 'https://www.zhihu.com',
  publishUrl: 'https://zhuanlan.zhihu.com/write',
  title: '知乎',
  type: 'zhihu',
}

// 知乎登录检测配置
const ZhihuLoginConfig = {
  api: 'https://www.zhihu.com/api/v4/me',
  method: 'GET',
  checkLogin: (response) => response?.id,
  getUserInfo: (response) => ({
    username: response?.name,
    avatar: response?.avatar_url,
  }),
}

// 知乎内容填充函数
// 注意：知乎使用导入文档功能，此函数作为备用
async function fillZhihuContent(content, waitFor, setInputValue) {
  console.log('[COSE] 知乎由导入文档功能处理')
}

// 导出
export { ZhihuPlatform, ZhihuLoginConfig, fillZhihuContent }
