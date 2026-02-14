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
    api: 'https://mp.toutiao.com/mp/agw/creator_center/user_info?app_id=1231',
    method: 'GET',
    checkLogin: (response) => response?.code === 0 && response?.name,
    getUserInfo: (response) => ({
        username: response?.name,
        avatar: response?.avatar_url,
    }),
}

// 百家号
export const BaijiahaoLoginConfig = {
    api: 'https://baijiahao.baidu.com/builder/app/appinfo',
    method: 'GET',
    checkLogin: (response) => response?.errno === 0 && response?.data?.user?.name,
    getUserInfo: (response) => ({
        username: response?.data?.user?.name,
        avatar: response?.data?.user?.avatar,
    }),
}

// 抖音
export const DouyinLoginConfig = {
    api: 'https://creator.douyin.com/web/api/media/user/info/',
    method: 'GET',
    checkLogin: (response) => response?.status_code === 0 && (response?.user?.uid || response?.user_info?.uid),
    getUserInfo: (response) => ({
        username: response?.user?.nickname || response?.user_info?.nickname,
        avatar: (response?.user?.avatar_thumb?.url_list?.[0] || response?.user_info?.avatar_thumb?.url_list?.[0]),
    }),
}

// 统一的 LOGIN_CHECK_CONFIG 对象（按平台 ID 索引）
export const LOGIN_CHECK_CONFIG = {
    juejin: JuejinLoginConfig,
    zhihu: ZhihuLoginConfig,
    toutiao: ToutiaoLoginConfig,

    baijiahao: BaijiahaoLoginConfig,
    douyin: DouyinLoginConfig,
}
