/**
 * Xiaohongshu (Little Red Book) platform detection logic
 * Strategy:
 * 1. Check chrome.storage.local cache (7 days TTL)
 * 2. Inject script into open creator.xiaohongshu.com tab to call API
 */
export async function detectXiaohongshuUser() {
    const platformId = 'xiaohongshu'
    try {
        // 先检查缓存
        const stored = await chrome.storage.local.get('xiaohongshu_user')
        const cachedUser = stored.xiaohongshu_user

        if (cachedUser && cachedUser.loggedIn) {
            const cacheAge = Date.now() - (cachedUser.cachedAt || 0)
            const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days
            if (cacheAge < maxAge) {
                console.log(`[COSE] xiaohongshu 从缓存读取:`, cachedUser.username)
                return { loggedIn: true, username: cachedUser.username || '', avatar: cachedUser.avatar || '' }
            } else {
                await chrome.storage.local.remove('xiaohongshu_user')
            }
        }

        // 缓存无效，尝试在已打开的小红书页面中检测
        const tabs = await chrome.tabs.query({ url: 'https://creator.xiaohongshu.com/*' })
        if (tabs.length > 0) {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: async () => {
                    try {
                        const response = await fetch('https://creator.xiaohongshu.com/api/galaxy/user/info', {
                            method: 'GET',
                            credentials: 'include',
                            headers: { 'Accept': 'application/json' }
                        })
                        if (!response.ok) return null
                        const data = await response.json()
                        if (data?.success === true && data?.code === 0 && data?.data?.userId) {
                            return {
                                loggedIn: true,
                                username: data.data.userName || data.data.redId || '',
                                avatar: data.data.userAvatar || '',
                                userId: data.data.userId
                            }
                        }
                        return null
                    } catch (e) { return null }
                }
            })

            const result = results?.[0]?.result
            if (result && result.loggedIn) {
                const userInfo = { ...result, cachedAt: Date.now() }
                await chrome.storage.local.set({ xiaohongshu_user: userInfo })
                return { loggedIn: true, username: userInfo.username || '', avatar: userInfo.avatar || '' }
            }
        }
        return { loggedIn: false }
    } catch (e) {
        console.log(`[COSE] xiaohongshu 检测失败:`, e.message)
        return { loggedIn: false }
    }
}
