// 平台配置汇总 - 统一通过导入方式引入
import { CSDNPlatform, CSDNLoginConfig } from './csdn.js'
import { JuejinPlatform, JuejinLoginConfig } from './juejin.js'
import { WechatPlatform, WechatLoginConfig } from './wechat.js'
import { ZhihuPlatform, ZhihuLoginConfig } from './zhihu.js'
import { ToutiaoPlatform, ToutiaoLoginConfig } from './toutiao.js'
import { SegmentFaultPlatform, SegmentFaultLoginConfig } from './segmentfault.js'
import { CnblogsPlatform, CnblogsLoginConfig } from './cnblogs.js'
import { OSChinaPlatform, OSChinaLoginConfig } from './oschina.js'
import { CTO51Platform, CTO51LoginConfig } from './cto51.js'
import { InfoQPlatform, InfoQLoginConfig } from './infoq.js'
import { JianshuPlatform, JianshuLoginConfig } from './jianshu.js'
import { BaijiahaoPlatform, BaijiahaoLoginConfig } from './baijiahao.js'
import { WangyihaoPlatform, WangyihaoLoginConfig } from './wangyihao.js'
import { TencentCloudPlatform, TencentCloudLoginConfig } from './tencentcloud.js'
import { MediumPlatform, MediumLoginConfig } from './medium.js'
import { SspaiPlatform, SspaiLoginConfig } from './sspai.js'
import { SohuPlatform, SohuLoginConfig } from './sohu.js'
import { BilibiliPlatform, BilibiliLoginConfig } from './bilibili.js'

// 合并平台配置
const PLATFORMS = [
  CSDNPlatform,
  JuejinPlatform,
  WechatPlatform,
  ZhihuPlatform,
  ToutiaoPlatform,
  SegmentFaultPlatform,
  CnblogsPlatform,
  OSChinaPlatform,
  CTO51Platform,
  InfoQPlatform,
  JianshuPlatform,
  BaijiahaoPlatform,
  WangyihaoPlatform,
  TencentCloudPlatform,
  MediumPlatform,
  SspaiPlatform,
  SohuPlatform,
  BilibiliPlatform,
]

// 合并登录检测配置
const LOGIN_CHECK_CONFIG = {
  [CSDNPlatform.id]: CSDNLoginConfig,
  [JuejinPlatform.id]: JuejinLoginConfig,
  [WechatPlatform.id]: WechatLoginConfig,
  [ZhihuPlatform.id]: ZhihuLoginConfig,
  [ToutiaoPlatform.id]: ToutiaoLoginConfig,
  [SegmentFaultPlatform.id]: SegmentFaultLoginConfig,
  [CnblogsPlatform.id]: CnblogsLoginConfig,
  [OSChinaPlatform.id]: OSChinaLoginConfig,
  [CTO51Platform.id]: CTO51LoginConfig,
  [InfoQPlatform.id]: InfoQLoginConfig,
  [JianshuPlatform.id]: JianshuLoginConfig,
  [BaijiahaoPlatform.id]: BaijiahaoLoginConfig,
  [WangyihaoPlatform.id]: WangyihaoLoginConfig,
  [TencentCloudPlatform.id]: TencentCloudLoginConfig,
  [MediumPlatform.id]: MediumLoginConfig,
  [SspaiPlatform.id]: SspaiLoginConfig,
  [SohuPlatform.id]: SohuLoginConfig,
  [BilibiliPlatform.id]: BilibiliLoginConfig,
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
  if (hostname.includes('mp.sohu.com')) return 'sohu'
  if (hostname.includes('member.bilibili.com')) return 'bilibili'
  return 'generic'
}

// 导出
export { PLATFORMS, LOGIN_CHECK_CONFIG, getPlatformFiller }
