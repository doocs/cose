import { convertAvatarToBase64 } from '../utils.js'

/**
 * Huawei Developer platform detection logic
 * Strategy (cache detection pattern):
 * 1. Check chrome.storage.local cache (7 days TTL) + cookie validation
 * 2. Try executeScript on open developer.huawei.com tab to call API with credentials
 * 3. Content script auto-caches user info when visiting huawei developer pages
 * 4. Fallback: check developer_userdata cookie existence for basic login status
 */
export async function detectHuaweiDevUser() {
    try {
        // 1. 先检查缓存
        const stored = await chrome.storage.local.get('huaweidev_user')
        const cachedUser = stored.huaweidev_user

        if (cachedUser && cachedUser.loggedIn) {
            const cacheAge = Date.now() - (cachedUser.cachedAt || 0)
            const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days
            if (cacheAge < maxAge && cachedUser.username) {
                // 验证 cookie 是否仍然存在，防止用户已登出但缓存未过期的误判
                const userCookie = await chrome.cookies.get({ url: 'https://developer.huawei.com', name: 'developer_userdata' })
                if (userCookie && userCookie.value) {
                    console.log('[COSE] HuaweiDev: using cached user info:', cachedUser.username)
                    let avatar = cachedUser.avatar || ''
                    // 如果缓存中的头像还是原始 URL（旧缓存），转换为 base64 并更新缓存
                    if (avatar && avatar.startsWith('http')) {
                        avatar = await convertAvatarToBase64(avatar, 'https://developer.huawei.com/')
                        await chrome.storage.local.set({ huaweidev_user: { ...cachedUser, avatar } })
                    }
                    return { loggedIn: true, username: cachedUser.username, avatar }
                }
                // cookie 已失效，清除缓存
                console.log('[COSE] HuaweiDev: cache exists but cookie gone, clearing cache')
                await chrome.storage.local.remove('huaweidev_user')
            } else {
                await chrome.storage.local.remove('huaweidev_user')
            }
        }

        // 2. 尝试在已打开的华为开发者页面中检测
        const tabs = await chrome.tabs.query({ url: 'https://developer.huawei.com/*' })
        if (tabs.length > 0) {
            try {
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    func: async () => {
                        try {
                            // 1. 从 DOM 获取社区用户名（真实昵称，非脱敏手机号）
                            const userNameEl = document.querySelector('.user_name')
                            const domUsername = userNameEl ? userNameEl.textContent.trim() : ''

                            // 2. 从 API 获取头像
                            const cookies = document.cookie.split(';').map(c => c.trim())
                            const udCookie = cookies.find(c => c.startsWith('developer_userdata='))
                            if (!udCookie) {
                                return domUsername ? { loggedIn: true, username: domUsername, avatar: '' } : null
                            }

                            const udValue = decodeURIComponent(udCookie.split('=').slice(1).join('='))
                            let csrfToken = ''
                            try {
                                const udJson = JSON.parse(udValue)
                                csrfToken = udJson.csrf || udJson.csrftoken || ''
                            } catch (e) {
                                return domUsername ? { loggedIn: true, username: domUsername, avatar: '' } : null
                            }
                            if (!csrfToken) {
                                return domUsername ? { loggedIn: true, username: domUsername, avatar: '' } : null
                            }

                            const now = new Date()
                            const hdDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

                            let avatar = ''
                            try {
                                const resp = await fetch('https://svc-drcn.developer.huawei.com/codeserver/Common/v1/delegate', {
                                    method: 'POST',
                                    credentials: 'include',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Accept': 'application/json',
                                        'x-hd-csrf': csrfToken,
                                        'x-hd-date': hdDate,
                                    },
                                    body: JSON.stringify({
                                        svc: 'GOpen.User.getInfo',
                                        reqType: 0,
                                        reqJson: JSON.stringify({ queryRangeFlag: '00000000000001' }),
                                    }),
                                })
                                if (resp.ok) {
                                    const data = await resp.json()
                                    if (data && data.returnCode === '0' && data.resJson) {
                                        const userInfo = JSON.parse(data.resJson)
                                        avatar = userInfo.headPictureURL || ''
                                    }
                                }
                            } catch (e) { /* avatar fetch failed, continue with DOM username */ }

                            // 优先使用 DOM 中的社区昵称
                            return {
                                loggedIn: true,
                                username: domUsername || '',
                                avatar,
                            }
                        } catch (e) { return null }
                    },
                })

                const result = results?.[0]?.result
                if (result && result.loggedIn) {
                    let avatar = result.avatar || ''
                    if (avatar && avatar.startsWith('http')) {
                        avatar = await convertAvatarToBase64(avatar, 'https://developer.huawei.com/')
                    }
                    const userInfo = { ...result, avatar, cachedAt: Date.now() }
                    await chrome.storage.local.set({ huaweidev_user: userInfo })
                    return { loggedIn: true, username: userInfo.username, avatar }
                }
            } catch (e) {
                console.log('[COSE] HuaweiDev: executeScript failed:', e.message)
            }
        }

        // 3. 没有打开的华为开发者页面，检查 developer_userdata cookie 作为基本登录判断
        const userCookie = await chrome.cookies.get({ url: 'https://developer.huawei.com', name: 'developer_userdata' })
        if (userCookie && userCookie.value) {
            console.log('[COSE] HuaweiDev: developer_userdata cookie found but no open tab for full detection')
            return { loggedIn: true, username: '', avatar: '' }
        }

        return { loggedIn: false }
    } catch (e) {
        console.error('[COSE] HuaweiDev Detection Error:', e)
        return { loggedIn: false, error: e.message }
    }
}
