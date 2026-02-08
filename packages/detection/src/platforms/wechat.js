/**
 * WeChat Official Account platform detection logic
 * Strategy:
 * 1. Check chrome.storage.local cache (1 hour TTL)
 * 2. Inject script into open mp.weixin.qq.com tab to read wx.data
 * 3. Fallback: fetch mp.weixin.qq.com HTML and parse nick_name/head_img
 */
export async function detectWechatUser() {
    const platformId = 'wechat'
    try {
        // 先检查缓存
        const stored = await chrome.storage.local.get('wechat_user')
        const cachedUser = stored.wechat_user

        if (cachedUser && cachedUser.loggedIn) {
            const cacheAge = Date.now() - (cachedUser.cachedAt || 0)
            const maxAge = 1 * 60 * 60 * 1000 // 1 hour

            if (cacheAge < maxAge) {
                console.log(`[COSE] wechat 从缓存读取:`, cachedUser.username)
                return {
                    loggedIn: true,
                    username: cachedUser.username || '',
                    avatar: cachedUser.avatar || ''
                }
            } else {
                await chrome.storage.local.remove('wechat_user')
            }
        }

        // 优先尝试在已打开的微信公众号页面中检测
        const tabs = await chrome.tabs.query({ url: 'https://mp.weixin.qq.com/*' })
        if (tabs.length > 0) {
            try {
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    func: () => {
                        const wxData = window.wx?.data
                        if (wxData && wxData.nick_name) {
                            return {
                                loggedIn: true,
                                username: wxData.nick_name || wxData.user_name || '',
                                avatar: wxData.head_img || '',
                                token: wxData.t || ''
                            }
                        }
                        return null
                    }
                })

                const result = results?.[0]?.result
                if (result && result.loggedIn) {
                    const userInfo = { ...result, cachedAt: Date.now() }
                    await chrome.storage.local.set({ wechat_user: userInfo })
                    return {
                        loggedIn: true,
                        username: userInfo.username || '',
                        avatar: userInfo.avatar || ''
                    }
                }
            } catch (e) {
                console.log(`[COSE] wechat 页面脚本执行失败:`, e.message)
            }
        }

        // 备用方案：fetch 首页并解析 HTML
        try {
            const response = await fetch('https://mp.weixin.qq.com/', {
                method: 'GET',
                credentials: 'include',
                headers: { 'Accept': 'text/html' }
            })
            const html = await response.text()

            if (html.includes('请使用微信扫描') || html.includes('扫码登录')) {
                return { loggedIn: false }
            }

            const nickMatch = html.match(/nick_name\s*[:=]\s*["']([^"']+)["']/)
            const avatarMatch = html.match(/head_img\s*[:=]\s*["']([^"']+)["']/)

            if (nickMatch) {
                const username = nickMatch[1]
                const avatar = avatarMatch ? avatarMatch[1] : ''
                await chrome.storage.local.set({
                    wechat_user: {
                        loggedIn: true,
                        username,
                        avatar,
                        cachedAt: Date.now()
                    }
                })
                return { loggedIn: true, username, avatar }
            }
        } catch (e) {
            console.log(`[COSE] wechat fetch 失败:`, e.message)
        }

        return { loggedIn: false }
    } catch (e) {
        console.log(`[COSE] wechat 检测失败:`, e.message)
        return { loggedIn: false }
    }
}
