import { convertAvatarToBase64, detectByApi } from '../utils.js'

const HUAWEICLOUD_API = 'https://devdata.huaweicloud.com/rest/developer/fwdu/rest/developer/user/hdcommunityservice/v1/member/get-personal-info'

/**
 * Huawei Cloud platform detection logic
 * 直接通过 API + 手动附加 cookie 检测，无需打开华为云页面
 */
export async function detectHuaweiCloudUser() {
    try {
        const result = await detectByApi('huaweicloud', {
            api: HUAWEICLOUD_API,
            method: 'GET',
            checkLogin: (data) => data && data.memName,
            getUserInfo: (data) => ({
                username: data.memAlias || data.memName || '',
                avatar: data.memPhoto || '',
            }),
        })

        if (result.loggedIn) {
            let avatar = result.avatar || ''
            if (avatar && avatar.startsWith('http')) {
                avatar = await convertAvatarToBase64(avatar, 'https://bbs.huaweicloud.com/')
            }
            // 更新缓存（仅用于头像 base64 缓存，不用于登录判断）
            await chrome.storage.local.set({
                huaweicloud_user: {
                    loggedIn: true,
                    username: result.username,
                    avatar,
                    cachedAt: Date.now(),
                }
            })
            return { loggedIn: true, username: result.username, avatar }
        }

        // 未登录，清除可能过期的缓存
        await chrome.storage.local.remove('huaweicloud_user')
        return { loggedIn: false }
    } catch (e) {
        console.error('[COSE] HuaweiCloud Detection Error:', e)
        return { loggedIn: false, error: e.message }
    }
}
