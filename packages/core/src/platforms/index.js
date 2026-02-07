// 平台配置汇总
// 从 @cose/detection 导入登录检测配置
import { LOGIN_CHECK_CONFIG } from '@cose/detection'

// 平台元数据和同步函数从各平台文件导入
import { CSDNPlatform, syncCSDNContent } from './csdn.js'
import { JuejinPlatform, syncJuejinContent } from './juejin.js'
import { WechatPlatform, syncWechatContent } from './wechat.js'
import { ZhihuPlatform, syncZhihuContent } from './zhihu.js'
import { ToutiaoPlatform, syncToutiaoContent } from './toutiao.js'
import { SegmentFaultPlatform } from './segmentfault.js'
import { CnblogsPlatform } from './cnblogs.js'
import { OSChinaPlatform } from './oschina.js'
import { CTO51Platform } from './cto51.js'
import { InfoQPlatform } from './infoq.js'
import { JianshuPlatform } from './jianshu.js'
import { BaijiahaoPlatform } from './baijiahao.js'
import { WangyihaoPlatform } from './wangyihao.js'
import { TencentCloudPlatform } from './tencentcloud.js'
import { MediumPlatform } from './medium.js'
import { SspaiPlatform } from './sspai.js'
import { SohuPlatform } from './sohu.js'
import { BilibiliPlatform } from './bilibili.js'
import { WeiboPlatform } from './weibo.js'
import { AliyunPlatform } from './aliyun.js'
import { HuaweiDevPlatform } from './huaweidev.js'
import { TwitterPlatform } from './twitter.js'
import { QianfanPlatform } from './qianfan.js'
import { AlipayOpenPlatform } from './alipayopen.js'
import { ModelScopePlatform } from './modelscope.js'
import { VolcenginePlatform } from './volcengine.js'
import { DouyinPlatform } from './douyin.js'
import { XiaohongshuPlatform } from './xiaohongshu.js'
import { ElecfansPlatform } from './elecfans.js'

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
    WeiboPlatform,
    AliyunPlatform,
    HuaweiDevPlatform,
    TwitterPlatform,
    QianfanPlatform,
    AlipayOpenPlatform,
    ModelScopePlatform,
    VolcenginePlatform,
    DouyinPlatform,
    XiaohongshuPlatform,
    ElecfansPlatform,
]

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
    if (hostname.includes('card.weibo.com')) return 'weibo'
    if (hostname.includes('developer.aliyun.com')) return 'aliyun'
    if (hostname.includes('developer.huawei.com')) return 'huaweidev'
    if (hostname.includes('x.com') || hostname.includes('twitter.com')) return 'twitter'
    if (hostname.includes('qianfan.cloud.baidu.com')) return 'qianfan'
    if (hostname.includes('open.alipay.com')) return 'alipayopen'
    if (hostname.includes('modelscope.cn')) return 'modelscope'
    if (hostname.includes('developer.volcengine.com')) return 'volcengine'
    if (hostname.includes('creator.douyin.com')) return 'douyin'
    if (hostname.includes('creator.xiaohongshu.com')) return 'xiaohongshu'
    if (hostname.includes('elecfans.com')) return 'elecfans'
    return 'generic'
}

// 同步处理器映射
// 如果平台有自定义同步逻辑，在此注册处理器
// 未注册的平台将使用 background.js 中的通用填充逻辑
const SYNC_HANDLERS = {
    csdn: syncCSDNContent,
    juejin: syncJuejinContent,
    wechat: syncWechatContent,
    zhihu: syncZhihuContent,
    toutiao: syncToutiaoContent,
}

// 导出
export { PLATFORMS, LOGIN_CHECK_CONFIG, SYNC_HANDLERS, getPlatformFiller }
