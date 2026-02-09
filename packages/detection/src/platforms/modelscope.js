import { convertAvatarToBase64 } from '../utils.js'

/**
 * ModelScope platform detection logic
 * Strategy:
 * 1. Try /api/v1/users/login/info API (correct endpoint found via network inspection)
 * 2. Fallback: find an open ModelScope tab and extract username/avatar from DOM
 * 3. Fallback: check for auth cookies on modelscope.cn
 * 4. Convert avatar to base64 to bypass CORS/ORB
 */
export async function detectModelScopeUser() {
    try {
        let username = ''
        let avatar = ''

        // Try the correct API endpoint (found via Chrome DevTools network inspection)
        try {
            const response = await fetch('https://modelscope.cn/api/v1/users/login/info', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                },
            })
            if (response.ok) {
                const data = await response.json()
                if (data?.Success !== false && data?.Code !== 10019901001) {
                    const user = data?.Data?.User || data?.Data || {}
                    username = user.Nickname || user.NickName || user.Name
                        || user.nickname || user.name || user.Login || user.login || ''
                    avatar = user.Avatar || user.avatar || ''
                }
            }
        } catch (e) { }

        if (username) {
            if (avatar) avatar = await convertAvatarToBase64(avatar, 'https://modelscope.cn/')
            return { loggedIn: true, username, avatar }
        }

        // Fallback: extract from open tab DOM
        try {
            const tabs = await chrome.tabs.query({ url: 'https://modelscope.cn/*' })
            if (tabs.length > 0) {
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    func: () => {
                        // Look for avatar img in the page
                        let avatarSrc = ''
                        const avatarSelectors = [
                            'img[src*="avatar"]',
                            '.ant-avatar img',
                            'img[class*="avatar" i]',
                            'img[class*="Avatar" i]',
                        ]
                        for (const sel of avatarSelectors) {
                            const img = document.querySelector(sel)
                            if (img && img.src && !img.src.includes('data:image/svg')) {
                                avatarSrc = img.src
                                break
                            }
                        }
                        // Look for username from the page's user info
                        let name = ''
                        // Try to get from the header/nav user dropdown area
                        const allLinks = document.querySelectorAll('a[href*="/profile/"]')
                        for (const a of allLinks) {
                            const href = a.getAttribute('href') || ''
                            const match = href.match(/\/profile\/([^/?#]+)/)
                            if (match && match[1]) {
                                name = match[1]
                                break
                            }
                        }
                        // Also try my/overview link text or nearby elements
                        if (!name) {
                            const myLink = document.querySelector('a[href="/my/overview"]')
                            if (myLink) {
                                const parent = myLink.closest('[class*="dropdown"]') || myLink.parentElement
                                if (parent) {
                                    const spans = parent.querySelectorAll('span')
                                    for (const s of spans) {
                                        const t = s.textContent.trim()
                                        if (t && t.length > 1 && t.length < 30
                                            && !['登录', '注册', '退出', '设置'].includes(t)) {
                                            name = t
                                            break
                                        }
                                    }
                                }
                            }
                        }
                        return { username: name, avatar: avatarSrc }
                    },
                })
                if (results?.[0]?.result) {
                    username = results[0].result.username || ''
                    avatar = results[0].result.avatar || ''
                }
                if (username || avatar) {
                    if (avatar) avatar = await convertAvatarToBase64(avatar, 'https://modelscope.cn/')
                    return { loggedIn: true, username, avatar }
                }
            }
        } catch (e) { }

        return { loggedIn: false }
    } catch (e) {
        return { loggedIn: false }
    }
}
