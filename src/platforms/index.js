// 平台配置汇总

// 所有平台配置
const PLATFORMS = [
  {
    id: 'csdn',
    name: 'CSDN',
    icon: 'https://g.csdnimg.cn/static/logo/favicon32.ico',
    url: 'https://blog.csdn.net',
    publishUrl: 'https://editor.csdn.net/md/',
    title: 'CSDN',
    type: 'csdn',
  },
  {
    id: 'juejin',
    name: 'Juejin',
    icon: 'https://lf-web-assets.juejin.cn/obj/juejin-web/xitu_juejin_web/static/favicons/favicon-32x32.png',
    url: 'https://juejin.cn',
    publishUrl: 'https://juejin.cn/editor/drafts/new',
    title: '掘金',
    type: 'juejin',
  },
  {
    id: 'wechat',
    name: 'WeChat',
    icon: 'https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico',
    url: 'https://mp.weixin.qq.com',
    publishUrl: 'https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit_v2&action=edit&isNew=1&type=10',
    title: '微信公众号',
    type: 'wechat',
  },
  {
    id: 'zhihu',
    name: 'Zhihu',
    icon: 'https://static.zhihu.com/heifetz/favicon.ico',
    url: 'https://www.zhihu.com',
    publishUrl: 'https://zhuanlan.zhihu.com/write',
    title: '知乎',
    type: 'zhihu',
  },
]

// 登录检测配置
const LOGIN_CHECK_CONFIG = {
  csdn: {
    useCookie: true,
    cookieUrl: 'https://blog.csdn.net',
    cookieNames: ['UserName', 'UserNick'],
    getUsernameFromCookie: true,
    usernameCookie: 'UserNick',
    usernameCookieForApi: 'UserName',
    fetchAvatarFromPage: true,
  },
  juejin: {
    api: 'https://api.juejin.cn/user_api/v1/user/get',
    method: 'GET',
    checkLogin: (response) => response?.err_no === 0 && response?.data?.user_id,
    getUserInfo: (response) => ({
      username: response?.data?.user_name,
      avatar: response?.data?.avatar_large,
    }),
  },
  wechat: {
    useCookie: true,
    cookieUrl: 'https://mp.weixin.qq.com',
    cookieNames: ['slave_user', 'slave_sid'],
    fetchUserInfoFromPage: true,
    userInfoUrl: 'https://mp.weixin.qq.com/',
  },
  zhihu: {
    api: 'https://www.zhihu.com/api/v4/me',
    method: 'GET',
    checkLogin: (response) => response?.id,
    getUserInfo: (response) => ({
      username: response?.name,
      avatar: response?.avatar_url,
    }),
  },
}

// 根据 hostname 获取平台填充函数
function getPlatformFiller(hostname) {
  if (hostname.includes('csdn.net')) return 'csdn'
  if (hostname.includes('juejin.cn')) return 'juejin'
  if (hostname.includes('mp.weixin.qq.com')) return 'wechat'
  if (hostname.includes('zhihu.com')) return 'zhihu'
  return 'generic'
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PLATFORMS, LOGIN_CHECK_CONFIG, getPlatformFiller }
}
