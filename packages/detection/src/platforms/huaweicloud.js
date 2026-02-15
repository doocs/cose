import { convertAvatarToBase64 } from '../utils.js'

/**
 * Huawei Cloud platform detection logic
 * Strategy:
 * 1. Check chrome.storage.local cache (7 days TTL)
 * 2. Try executeScript on open bbs.huaweicloud.com tab to call API with credentials
 * 3. Content script auto-caches user info when visiting huaweicloud pages
 */
export async function detectHuaweiCloudUser() {
    try {
        // 1. 先检查缓存
        const stored = await chrome.storage.local.get('huaweicloud_user')
        const cachedUser = stored.huaweicloud_user

        if (cachedUser && cachedUser.loggedIn) {
            const cacheAge = Date.now() - (cachedUser.cachedAt || 0)
            const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days
            if (cacheAge < maxAge) {
                console.log('[COSE] HuaweiCloud: using cached user info:', cachedUser.username)
                return { loggedIn: true, username: cachedUser.username || '', avatar: cachedUser.avatar || '' }
            } else {
                await chrome.storage.local.remove('huaweicloud_user')
            }
        }

        // 2. 尝试在已打开的华为云页面中检测
        const tabs = await chrome.tabs.query({ url: 'https://bbs.huaweicloud.com/*' })
        if (tabs.length > 0) {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: async () => {
                    try {
                        const resp = await fetch('https://devdata.huaweicloud.com/rest/developer/fwdu/rest/developer/user/hdcommunityservice/v1/member/get-personal-info', {
                            method: 'GET',
                            credentials: 'include',
                            headers: { 'Accept': 'application/json' },
                        })
                        if (!resp.ok) return null
                        const data = await resp.json()
                        if (data && data.memName) {
                            return {
                                loggedIn: true,
                                username: data.memAlias || data.memName || '',
                                avatar: data.memPhoto || '',
                            }
                        }
                        return null
                    } catch (e) { return null }
                },
            })

            const result = results?.[0]?.result
            if (result && result.loggedIn) {
                let avatar = result.avatar || ''
                if (avatar && avatar.includes('huaweicloud.com')) {
                    avatar = await convertAvatarToBase64(avatar, 'https://bbs.huaweicloud.com/')
                }
                const userInfo = { ...result, avatar, cachedAt: Date.now() }
                await chrome.storage.local.set({ huaweicloud_user: userInfo })
                return { loggedIn: true, username: userInfo.username, avatar }
            }
        }

        // 3. 没有打开的华为云页面，检查 ua cookie 作为基本登录判断
        const uaCookie = await chrome.cookies.get({ url: 'https://bbs.huaweicloud.com', name: 'ua' })
        if (uaCookie && uaCookie.value) {
            console.log('[COSE] HuaweiCloud: ua cookie found but no open tab for full detection')
            return { loggedIn: true, username: '', avatar: '' }
        }

        return { loggedIn: false }
    } catch (e) {
        console.error('[COSE] HuaweiCloud Detection Error:', e)
        return { loggedIn: false, error: e.message }
    }
}
