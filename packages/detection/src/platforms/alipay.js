/**
 * Alipay Open platform detection logic
 * Strategy:
 * 1. Check chrome.storage.local cache (1 hour TTL)
 * 2. If cache miss, inject script into open Alipay tab to call API
 */
export async function detectAlipayUser() {
    const platformId = 'alipayopen'
    try {
        // 从 storage 读取缓存的用户信息
        const stored = await chrome.storage.local.get('alipayopen_user')
        const cachedUser = stored.alipayopen_user

        if (cachedUser && cachedUser.loggedIn) {
            // 检查缓存是否过期（1小时）
            const cacheAge = Date.now() - (cachedUser.cachedAt || 0)
            const maxAge = 1 * 60 * 60 * 1000 // 1 hour

            if (cacheAge < maxAge) {
                console.log(`[COSE] alipayopen 从缓存读取用户信息:`, cachedUser.username)
                return {
                    loggedIn: true,
                    username: cachedUser.username || '',
                    avatar: cachedUser.avatar || ''
                }
            } else {
                console.log(`[COSE] alipayopen 缓存已过期`)
                // 清除过期缓存
                await chrome.storage.local.remove('alipayopen_user')
            }
        }

        // 尝试从已打开的支付宝页面获取用户信息并缓存
        let tabs = await chrome.tabs.query({ url: 'https://open.alipay.com/*' })
        if (tabs.length === 0) {
            tabs = await chrome.tabs.query({ url: 'https://*.alipay.com/*' })
        }

        if (tabs.length > 0) {
            try {
                // 在已打开的页面上下文中调用 API
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    func: async () => {
                        try {
                            const response = await fetch('https://developerportal.alipay.com/octopus/service.do', {
                                method: 'POST',
                                credentials: 'include',
                                headers: {
                                    'Accept': 'application/json',
                                    'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
                                },
                                body: 'data=%5B%7B%7D%5D&serviceName=alipay.open.developerops.forum.user.query',
                            })
                            if (!response.ok) return null
                            return await response.json()
                        } catch (e) {
                            return null
                        }
                    }
                })

                const data = results?.[0]?.result
                console.log(`[COSE] alipayopen API 数据:`, data)

                if (data?.stat === 'ok' && data?.data?.isLoginUser === 1) {
                    const username = data.data.nickname || ''
                    const avatar = data.data.avatar || ''

                    // 缓存用户信息
                    await chrome.storage.local.set({
                        alipayopen_user: {
                            loggedIn: true,
                            username,
                            avatar,
                            cachedAt: Date.now()
                        }
                    })

                    console.log(`[COSE] alipayopen 用户信息:`, username, avatar ? '有头像' : '无头像')
                    return { loggedIn: true, username, avatar }
                }
            } catch (e) {
                console.log(`[COSE] alipayopen 从页面获取用户信息失败:`, e.message)
            }
        }

        console.log(`[COSE] alipayopen 未检测到登录状态`)
        return { loggedIn: false }
    } catch (e) {
        console.log(`[COSE] alipayopen 检测失败:`, e.message)
        return { loggedIn: false, error: e.message }
    }
}
