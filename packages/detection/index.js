/**
 * @cose/detection - Platform login detection module
 * 
 * This package provides login detection configurations for all supported platforms.
 * Each config includes:
 * - api: The API endpoint to check login status
 * - method: HTTP method (GET/POST)
 * - checkLogin: Function to determine if user is logged in from response
 * - getUserInfo: Function to extract username and avatar from response
 */

// CSDN
export const CSDNLoginConfig = {
    api: 'https://passport.csdn.net/v1/api/info',
    method: 'GET',
    checkLogin: (response) => response?.data?.userId,
    getUserInfo: (response) => ({
        username: response?.data?.nickName,
        avatar: response?.data?.avatarUrl,
    }),
}

// 掘金
export const JuejinLoginConfig = {
    api: 'https://api.juejin.cn/user_api/v1/user/get',
    method: 'GET',
    checkLogin: (response) => response?.err_no === 0 && response?.data?.user_id,
    getUserInfo: (response) => ({
        username: response?.data?.user_name,
        avatar: response?.data?.avatar_large,
    }),
}

// 微信公众号
export const WechatLoginConfig = {
    api: 'https://mp.weixin.qq.com/',
    method: 'GET',
    isHtml: true,
    checkLogin: (html) => !html.includes('请使用微信扫描'),
    getUserInfo: (html) => {
        const nickMatch = html.match(/nick_name\s*:\s*["']([^"']+)["']/)
        const avatarMatch = html.match(/head_img\s*:\s*["']([^"']+)["']/)
        return {
            username: nickMatch?.[1]?.replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))),
            avatar: avatarMatch?.[1],
        }
    },
}

// 知乎
export const ZhihuLoginConfig = {
    api: 'https://www.zhihu.com/api/v4/me',
    method: 'GET',
    checkLogin: (response) => response?.id,
    getUserInfo: (response) => ({
        username: response?.name,
        avatar: response?.avatar_url,
    }),
}

// 头条号
export const ToutiaoLoginConfig = {
    api: 'https://mp.toutiao.com/auth/article/is_login/',
    method: 'GET',
    checkLogin: (response) => response?.data?.is_login,
    getUserInfo: (response) => ({
        username: response?.data?.name,
        avatar: response?.data?.avatar,
    }),
}

// SegmentFault
export const SegmentFaultLoginConfig = {
    api: 'https://segmentfault.com/gateway/user/me',
    method: 'GET',
    checkLogin: (response) => response?.status === 0 && response?.data?.id,
    getUserInfo: (response) => ({
        username: response?.data?.name,
        avatar: response?.data?.avatar_url,
    }),
}

// 博客园
export const CnblogsLoginConfig = {
    api: 'https://www.cnblogs.com/api/users/current',
    method: 'GET',
    checkLogin: (response) => response?.UserId,
    getUserInfo: (response) => ({
        username: response?.DisplayName,
        avatar: response?.Avatar,
    }),
}

// 开源中国
export const OSChinaLoginConfig = {
    api: 'https://www.oschina.net/action/user/detail?format=json',
    method: 'GET',
    checkLogin: (response) => response?.id,
    getUserInfo: (response) => ({
        username: response?.name,
        avatar: response?.portrait,
    }),
}

// 51CTO
export const CTO51LoginConfig = {
    api: 'https://home.51cto.com/api/user/info/getUserBasicInfo',
    method: 'GET',
    checkLogin: (response) => response?.code === 200 && response?.data?.id,
    getUserInfo: (response) => ({
        username: response?.data?.nickname,
        avatar: response?.data?.headpic,
    }),
}

// InfoQ
export const InfoQLoginConfig = {
    api: 'https://www.infoq.cn/public/v1/my/menu',
    method: 'POST',
    body: JSON.stringify({}),
    headers: { 'Content-Type': 'application/json' },
    checkLogin: (response) => response?.code === 0 && response?.data?.username,
    getUserInfo: (response) => ({
        username: response?.data?.nickname,
        avatar: response?.data?.avatar,
    }),
}

// 简书
export const JianshuLoginConfig = {
    api: 'https://www.jianshu.com/settings/basic',
    method: 'GET',
    isHtml: true,
    checkLogin: (html) => !html.includes('登录'),
    getUserInfo: () => ({ username: null, avatar: null }),
}

// 百家号
export const BaijiahaoLoginConfig = {
    api: 'https://baijiahao.baidu.com/pcui/profile/headerinfo',
    method: 'GET',
    checkLogin: (response) => response?.errno === 0 && response?.data?.name,
    getUserInfo: (response) => ({
        username: response?.data?.name,
        avatar: response?.data?.avatar,
    }),
}

// 网易号
export const WangyihaoLoginConfig = {
    api: 'https://mp.163.com/api/account/info',
    method: 'GET',
    checkLogin: (response) => response?.code === 1000 && response?.data?.nickname,
    getUserInfo: (response) => ({
        username: response?.data?.nickname,
        avatar: response?.data?.headImg,
    }),
}

// 腾讯云开发者社区
export const TencentCloudLoginConfig = {
    api: 'https://cloud.tencent.com/developer/api/user/session',
    method: 'GET',
    checkLogin: (response) => response?.code === 0 && response?.data?.uin,
    getUserInfo: (response) => ({
        username: response?.data?.nickname,
        avatar: response?.data?.avatar,
    }),
}

// Medium
export const MediumLoginConfig = {
    api: 'https://medium.com/me/stats?format=json',
    method: 'GET',
    checkLogin: (response) => response?.success,
    getUserInfo: (response) => ({
        username: response?.payload?.user?.name,
        avatar: response?.payload?.user?.imageId ? `https://miro.medium.com/v2/resize:fill:64:64/${response.payload.user.imageId}` : null,
    }),
}

// 少数派
export const SspaiLoginConfig = {
    api: 'https://sspai.com/api/v1/user/info',
    method: 'GET',
    checkLogin: (response) => response?.error === 0 && response?.data?.id,
    getUserInfo: (response) => ({
        username: response?.data?.nickname,
        avatar: response?.data?.avatar,
    }),
}

// 搜狐号
export const SohuLoginConfig = {
    api: 'https://mp.sohu.com/main/home/mp/getLoginUserInfo',
    method: 'GET',
    checkLogin: (response) => response?.code === 0 && response?.data?.nick,
    getUserInfo: (response) => ({
        username: response?.data?.nick,
        avatar: response?.data?.logoUrl,
    }),
}

// B站
export const BilibiliLoginConfig = {
    api: 'https://member.bilibili.com/x/web/kv/list?type=5',
    method: 'GET',
    checkLogin: (response) => response?.code === 0,
    getUserInfo: () => ({ username: null, avatar: null }),
}

// 微博
export const WeiboLoginConfig = {
    api: 'https://card.weibo.com/article/v3/aj/editor/draft/list?page=1&pagesize=1',
    method: 'GET',
    checkLogin: (response) => response?.code === 100000,
    getUserInfo: () => ({ username: null, avatar: null }),
}

// 阿里云开发者社区
export const AliyunLoginConfig = {
    api: 'https://developer.aliyun.com/developer/api/my/user/getUser',
    method: 'GET',
    checkLogin: (response) => response?.success && response?.data?.accountId,
    getUserInfo: (response) => ({
        username: response?.data?.nick,
        avatar: response?.data?.avatar,
    }),
}

// 华为云开发者博客
export const HuaweiCloudLoginConfig = {
    api: 'https://bbs.huaweicloud.com/uucenter/user/getUserInfoByUserNos',
    method: 'GET',
    checkLogin: (response) => response?.result === 'success',
    getUserInfo: () => ({ username: null, avatar: null }),
}

// 华为开发者联盟
export const HuaweiDevLoginConfig = {
    api: 'https://developer.huawei.com/consumer/cn/doc/distribution/dev-web/overview-web-0000001049579028',
    method: 'GET',
    isHtml: true,
    checkLogin: (html) => html.includes('logout'),
    getUserInfo: () => ({ username: null, avatar: null }),
}

// Twitter/X
export const TwitterLoginConfig = {
    api: 'https://api.x.com/1.1/account/settings.json',
    method: 'GET',
    checkLogin: (response) => response?.screen_name,
    getUserInfo: (response) => ({
        username: response?.screen_name,
        avatar: null,
    }),
}

// 百度千帆
export const QianfanLoginConfig = {
    api: 'https://qianfan.cloud.baidu.com/api/developer/common/userInfo',
    method: 'GET',
    checkLogin: (response) => response?.code === 200 && response?.data?.userName,
    getUserInfo: (response) => ({
        username: response?.data?.userName,
        avatar: null,
    }),
}

// 支付宝开放平台
export const AlipayOpenLoginConfig = {
    api: 'https://open.alipay.com/api/user/getUserInfo',
    method: 'GET',
    checkLogin: (response) => response?.data?.loginId,
    getUserInfo: (response) => ({
        username: response?.data?.loginId,
        avatar: response?.data?.avatar,
    }),
}

// ModelScope
export const ModelScopeLoginConfig = {
    api: 'https://modelscope.cn/api/v1/user/current',
    method: 'GET',
    checkLogin: (response) => response?.Success && response?.Data?.Name,
    getUserInfo: (response) => ({
        username: response?.Data?.Name,
        avatar: response?.Data?.Avatar,
    }),
}

// 火山引擎
export const VolcengineLoginConfig = {
    api: 'https://developer.volcengine.com/api/console/user/info',
    method: 'GET',
    checkLogin: (response) => response?.code === 0 && response?.data?.display_name,
    getUserInfo: (response) => ({
        username: response?.data?.display_name,
        avatar: null,
    }),
}

// 抖音
export const DouyinLoginConfig = {
    api: 'https://creator.douyin.com/web/api/media/user/info/',
    method: 'GET',
    checkLogin: (response) => response?.status_code === 0 && response?.user_info?.uid,
    getUserInfo: (response) => ({
        username: response?.user_info?.nickname,
        avatar: response?.user_info?.avatar_url,
    }),
}

// 小红书
export const XiaohongshuLoginConfig = {
    api: 'https://creator.xiaohongshu.com/api/galaxy/user/index',
    method: 'GET',
    checkLogin: (response) => response?.success && response?.data?.id,
    getUserInfo: (response) => ({
        username: response?.data?.nickname,
        avatar: response?.data?.portrait,
    }),
}

// 电子发烧友
export const ElecfansLoginConfig = {
    api: 'https://bbs.elecfans.com/api/login/check',
    method: 'GET',
    checkLogin: (response) => response?.status === 1,
    getUserInfo: (response) => ({
        username: response?.data?.username,
        avatar: response?.data?.avatar,
    }),
}

// 统一的 LOGIN_CHECK_CONFIG 对象（按平台 ID 索引）
export const LOGIN_CHECK_CONFIG = {
    csdn: CSDNLoginConfig,
    juejin: JuejinLoginConfig,
    wechat: WechatLoginConfig,
    zhihu: ZhihuLoginConfig,
    toutiao: ToutiaoLoginConfig,
    segmentfault: SegmentFaultLoginConfig,
    cnblogs: CnblogsLoginConfig,
    oschina: OSChinaLoginConfig,
    cto51: CTO51LoginConfig,
    infoq: InfoQLoginConfig,
    jianshu: JianshuLoginConfig,
    baijiahao: BaijiahaoLoginConfig,
    wangyihao: WangyihaoLoginConfig,
    tencentcloud: TencentCloudLoginConfig,
    medium: MediumLoginConfig,
    sspai: SspaiLoginConfig,
    sohu: SohuLoginConfig,
    bilibili: BilibiliLoginConfig,
    weibo: WeiboLoginConfig,
    aliyun: AliyunLoginConfig,
    huaweicloud: HuaweiCloudLoginConfig,
    huaweidev: HuaweiDevLoginConfig,
    twitter: TwitterLoginConfig,
    qianfan: QianfanLoginConfig,
    alipayopen: AlipayOpenLoginConfig,
    modelscope: ModelScopeLoginConfig,
    volcengine: VolcengineLoginConfig,
    douyin: DouyinLoginConfig,
    xiaohongshu: XiaohongshuLoginConfig,
    elecfans: ElecfansLoginConfig,
}
