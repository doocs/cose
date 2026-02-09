import { LOGIN_CHECK_CONFIG } from './configs.js'
import { checkLoginByCookie, detectByApi } from './utils.js'
import { detectCSDNUser } from './platforms/csdn.js'
import { detectOSChinaUser } from './platforms/oschina.js'
import { detectAlipayUser } from './platforms/alipay.js'
import { detectWeiboUser } from './platforms/weibo.js'
import { detectWechatUser } from './platforms/wechat.js'
import { detectXiaohongshuUser } from './platforms/xiaohongshu.js'
import { detectElecfansUser } from './platforms/elecfans.js'
import { detectHuaweiCloudUser } from './platforms/huaweicloud.js'
import { detectHuaweiDevUser } from './platforms/huaweidev.js'
import { detectSspaiUser } from './platforms/sspai.js'
import { detectAliyunUser } from './platforms/aliyun.js'
import { detectSohuUser } from './platforms/sohu.js'
import { detectMediumUser } from './platforms/medium.js'
import { detectTencentCloudUser } from './platforms/tencentcloud.js'
import { detectQianfanUser } from './platforms/qianfan.js'
import { detectTwitterUser } from './platforms/twitter.js'
import { detectBilibiliUser } from './platforms/bilibili.js'
import { detectCTO51User } from './platforms/cto51.js'
import { detectJianshuUser } from './platforms/jianshu.js'
import { detectSegmentFaultUser } from './platforms/segmentfault.js'
import { detectInfoQUser } from './platforms/infoq.js'

// Platform-specific detectors map
const PLATFORM_DETECTORS = {
    'csdn': detectCSDNUser,
    'oschina': detectOSChinaUser,
    'alipayopen': detectAlipayUser,
    'weibo': detectWeiboUser,
    'wechat': detectWechatUser,
    'xiaohongshu': detectXiaohongshuUser,
    'elecfans': detectElecfansUser,
    'huaweicloud': detectHuaweiCloudUser,
    'huaweidev': detectHuaweiDevUser,
    'sspai': detectSspaiUser,
    'aliyun': detectAliyunUser,
    'sohu': detectSohuUser,
    'medium': detectMediumUser,
    'tencentcloud': detectTencentCloudUser,
    'qianfan': detectQianfanUser,
    'twitter': detectTwitterUser,
    'bilibili': detectBilibiliUser,
    'cto51': detectCTO51User,
    'jianshu': detectJianshuUser,
    'segmentfault': detectSegmentFaultUser,
    'infoq': detectInfoQUser,
}

export async function detectUser(platformId) {
    console.log(`[COSE] Detection: Checking ${platformId}`)

    // 1. Platform-specific Detectors
    if (PLATFORM_DETECTORS[platformId]) {
        return PLATFORM_DETECTORS[platformId]()
    }

    // 2. Generic Config-based Detection
    const config = LOGIN_CHECK_CONFIG[platformId]
    if (config) {
        if (config.useCookie || (config.cookieNames && config.cookieNames.length > 0)) {
            return checkLoginByCookie(platformId, config)
        }

        // Default to API check if API is defined
        if (config.api) {
            return detectByApi(platformId, config)
        }
    }

    return { loggedIn: false, error: 'No detection available' }
}
