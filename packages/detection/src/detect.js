import { LOGIN_CHECK_CONFIG } from './configs.js'
import { checkLoginByCookie, detectByApi } from './utils.js'
import { detectCSDNUser } from './platforms/csdn.js'
import { detectOSChinaUser } from './platforms/oschina.js'
import * as specialDetectors from './detectors.js'

export async function detectUser(platformId) {
    console.log(`[COSE] Detection: Checking ${platformId}`)

    // 1. Specialized Detectors
    if (platformId === 'csdn') return detectCSDNUser()
    if (platformId === 'oschina') return detectOSChinaUser()

    // Detectors from bundled file
    // Convention: detect{CapitalizedPlatformId}User
    // Map platformId to function name
    const specialMap = {
        'alipayopen': specialDetectors.detectAlipayUser,
        'weibo': specialDetectors.detectWeiboUser,
        'wechat': specialDetectors.detectWechatUser,
        'xiaohongshu': specialDetectors.detectXiaohongshuUser,
        'elecfans': specialDetectors.detectElecfansUser,
        'huaweicloud': specialDetectors.detectHuaweiCloudUser,
        'huaweidev': specialDetectors.detectHuaweiDevUser,
        'sspai': specialDetectors.detectSspaiUser,
        'aliyun': specialDetectors.detectAliyunUser,
        'sohu': specialDetectors.detectSohuUser,
        'medium': specialDetectors.detectMediumUser,
        'tencentcloud': specialDetectors.detectTencentCloudUser,
        'qianfan': specialDetectors.detectQianfanUser,
        'twitter': specialDetectors.detectTwitterUser,
    }

    if (specialMap[platformId]) {
        return specialMap[platformId]()
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
