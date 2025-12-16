// 微信公众号平台配置
const WechatPlatform = {
  id: 'wechat',
  name: 'WeChat',
  icon: 'https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico',
  url: 'https://mp.weixin.qq.com',
  // 先打开草稿箱，再自动点击新建
  publishUrl: 'https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit_v2&action=edit&isNew=1&type=10',
  title: '微信公众号',
  type: 'wechat',
}

// 微信公众号登录检测配置
const WechatLoginConfig = {
  useCookie: true,
  cookieUrl: 'https://mp.weixin.qq.com',
  cookieNames: ['slave_user', 'slave_sid'],
  // 获取用户信息需要从页面抓取
  fetchUserInfoFromPage: true,
  userInfoUrl: 'https://mp.weixin.qq.com/',
}

// 微信公众号内容填充函数
// 注意：微信公众号使用特殊处理，此函数作为备用
async function fillWechatContent(content, waitFor, setInputValue) {
  console.log('[COSE] 微信公众号由特殊流程处理')
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WechatPlatform, WechatLoginConfig, fillWechatContent }
}
