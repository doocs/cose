// 平台配置汇总
import { OSChinaPlatform, OSChinaLoginConfig } from './oschina.js'
import { CTO51Platform, CTO51LoginConfig } from './cto51.js'
import { InfoQPlatform, InfoQLoginConfig } from './infoq.js'
import { JianshuPlatform, JianshuLoginConfig } from './jianshu.js'
import { BaijiahaoPlatform, BaijiahaoLoginConfig } from './baijiahao.js'
import { WangyihaoPlatform, WangyihaoLoginConfig } from './wangyihao.js'
import { TencentCloudPlatform, TencentCloudLoginConfig } from './tencentcloud.js'
import { MediumPlatform, MediumLoginConfig } from './medium.js'
import { SspaiPlatform, SspaiLoginConfig } from './sspai.js'
// 这里可以继续导入其他平台的配置
// import { CSDNPlatform, CSDNLoginConfig } from './csdn.js'

// 基础平台配置（未来可以逐步拆分到各独立文件）
const BASE_PLATFORMS = [
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
  {
    id: 'toutiao',
    name: 'Toutiao',
    icon: 'https://sf3-cdn-tos.toutiaostatic.com/obj/eden-cn/uhbfnupkbps/toutiao_favicon.ico',
    url: 'https://mp.toutiao.com',
    publishUrl: 'https://mp.toutiao.com/profile_v4/graphic/publish',
    title: '今日头条',
    type: 'toutiao',
  },
  {
    id: 'segmentfault',
    name: 'SegmentFault',
    icon: 'https://www.google.com/s2/favicons?domain=segmentfault.com&sz=32',
    url: 'https://segmentfault.com',
    publishUrl: 'https://segmentfault.com/write',
    title: '思否',
    type: 'segmentfault',
  },
  {
    id: 'cnblogs',
    name: 'Cnblogs',
    icon: 'https://www.cnblogs.com/favicon.ico',
    url: 'https://www.cnblogs.com',
    publishUrl: 'https://i.cnblogs.com/posts/edit',
    title: '博客园',
    type: 'cnblogs',
  },
]

// 基础登录检测配置
const BASE_LOGIN_CONFIG = {
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
  toutiao: {
    api: 'https://mp.toutiao.com/mp/agw/media/get_media_info',
    method: 'GET',
    checkLogin: (response) => response?.err_no === 0 && response?.data?.media?.display_name,
    getUserInfo: (response) => ({
      username: response?.data?.media?.display_name,
      avatar: response?.data?.media?.https_avatar_url,
    }),
  },
  segmentfault: {
    useCookie: true,
    cookieUrl: 'https://segmentfault.com',
    cookieNames: ['PHPSESSID'],
    fetchUserInfoFromPage: true,
    userInfoUrl: 'https://segmentfault.com/write',
  },
  cnblogs: {
    api: 'https://i.cnblogs.com/api/user',
    method: 'GET',
    checkLogin: (response) => response?.loginName,
    getUserInfo: (response) => ({
      username: response?.displayName || response?.loginName,
      avatar: response?.avatarName ? `https:${response.avatarName}` : '',
    }),
  },
}


// 合并平台配置
const PLATFORMS = [
  ...BASE_PLATFORMS,
  OSChinaPlatform,
  CTO51Platform,
  InfoQPlatform,
  JianshuPlatform,
  BaijiahaoPlatform,
  WangyihaoPlatform,
  TencentCloudPlatform,
  MediumPlatform,
  SspaiPlatform,
]

// 合并登录检测配置
const LOGIN_CHECK_CONFIG = {
  ...BASE_LOGIN_CONFIG,
  [OSChinaPlatform.id]: OSChinaLoginConfig,
  [CTO51Platform.id]: CTO51LoginConfig,
  [InfoQPlatform.id]: InfoQLoginConfig,
  [JianshuPlatform.id]: JianshuLoginConfig,
  [BaijiahaoPlatform.id]: BaijiahaoLoginConfig,
  [WangyihaoPlatform.id]: WangyihaoLoginConfig,
  [TencentCloudPlatform.id]: TencentCloudLoginConfig,
  [MediumPlatform.id]: MediumLoginConfig,
  [SspaiPlatform.id]: SspaiLoginConfig,
}

// 根据 hostname 获取平台填充函数
function getPlatformFiller(hostname) {
  if (hostname.includes('csdn.net')) return 'csdn'
  if (hostname.includes('juejin.cn')) return 'juejin'
  if (hostname.includes('mp.weixin.qq.com')) return 'wechat'
  if (hostname.includes('zhihu.com')) return 'zhihu'
  if (hostname.includes('toutiao.com')) return 'toutiao'
  if (hostname.includes('segmentfault.com')) return 'segmentfault'
  if (hostname.includes('cnblogs.com')) return 'cnblogs'
  if (hostname.includes('oschina.net')) return 'oschina'
  if (hostname.includes('51cto.com')) return 'cto51'
  if (hostname.includes('infoq.cn')) return 'infoq'
  if (hostname.includes('jianshu.com')) return 'jianshu'
  if (hostname.includes('baijiahao.baidu.com')) return 'baijiahao'
  if (hostname.includes('mp.163.com')) return 'wangyihao'
  if (hostname.includes('cloud.tencent.com')) return 'tencentcloud'
  if (hostname.includes('medium.com')) return 'medium'
  if (hostname.includes('sspai.com')) return 'sspai'
  return 'generic'
}

// 导出
export { PLATFORMS, LOGIN_CHECK_CONFIG, getPlatformFiller }
