/**
 * Xiaohongshu (Little Red Book) platform detection logic
 * Strategy:
 * 1. Check `a1` cookie on creator.xiaohongshu.com as login indicator
 * 2. Best-effort: fetch user info via offscreen document or open tab
 * 3. Fall back to chrome.storage.local cache for user details
 */
export async function detectXiaohongshuUser() {
    try {
        // 1. Check a1 cookie as login indicator (MV3 service worker compatible)
        const a1Cookie = await chrome.cookies.get({ url: 'https://creator.xiaohongshu.com', name: 'a1' })
        if (!a1Cookie || !a1Cookie.value) {
            return { loggedIn: false }
        }

        // Logged in — now try to get user details

        // 2a. Try offscreen fetch (document context, cookies sent automatically)
        try {
            const offscreenDetect = globalThis.__coseDetectXiaohongshu
            if (offscreenDetect) {
                const offResult = await offscreenDetect()
                if (offResult && offResult.loggedIn) {
                    // Update cache
                    const userInfo = { ...offResult, cachedAt: Date.now() }
                    await chrome.storage.local.set({ xiaohongshu_user: userInfo })
                    return { loggedIn: true, username: offResult.username || '', avatar: offResult.avatar || '' }
                }
            }
        } catch (e) {
            console.log('[COSE] xiaohongshu offscreen detection failed:', e.message)
        }

        // 2b. Try open tab injection
        try {
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
        } catch (e) {
            console.log('[COSE] xiaohongshu tab detection failed:', e.message)
        }

        // 2c. Fall back to cache for user details
        const stored = await chrome.storage.local.get('xiaohongshu_user')
        const cachedUser = stored.xiaohongshu_user
        if (cachedUser && cachedUser.username) {
            const cacheAge = Date.now() - (cachedUser.cachedAt || 0)
            const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days
            if (cacheAge < maxAge) {
                console.log('[COSE] xiaohongshu 从缓存读取:', cachedUser.username)
                return { loggedIn: true, username: cachedUser.username || '', avatar: cachedUser.avatar || '' }
            }
        }

        // Cookie exists but couldn't get user details — still logged in
        return { loggedIn: true, username: '', avatar: '' }
    } catch (e) {
        console.log('[COSE] xiaohongshu 检测失败:', e.message)
        return { loggedIn: false }
    }
}
