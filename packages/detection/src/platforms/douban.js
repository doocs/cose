import { convertAvatarToBase64 } from '../utils.js'

async function convertToBase64WithFallback(avatarUrl) {
    if (!avatarUrl) return ''

    // Use shared utility only
    try {
        const converted = await convertAvatarToBase64(avatarUrl, 'https://www.douban.com/')
        if (converted && converted.startsWith('data:')) {
            return converted
        }
    } catch (e) {
        console.log('[COSE] douban 通用头像转换失败:', e.message)
    }

    // Fallback: manual fetch with cookies
    try {
        const doubanCookies = await chrome.cookies.getAll({ domain: '.douban.com' })
        const cookieHeader = doubanCookies.map(c => `${c.name}=${c.value}`).join('; ')
        const imgResp = await fetch(avatarUrl, {
            method: 'GET',
            headers: {
                'Referer': 'https://www.douban.com/',
                ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
            },
            credentials: 'include'
        })
        if (!imgResp.ok) {
            return avatarUrl
        }
        const blob = await imgResp.blob()
        const buffer = await blob.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i])
        }
        return `data:${blob.type || 'image/jpeg'};base64,${btoa(binary)}`
    } catch (e) {
        console.log('[COSE] douban 手动头像转换失败:', e.message)
        return avatarUrl
    }
}

/**
 * Douban platform detection logic
 * Strategy:
 * 1. Check dbcl2 cookie on douban.com as login indicator
 * 2. Parse /mine/ HTML to get user info
 * 3. Fallback: derive uid from dbcl2 cookie
 * 4. If avatar missing but uid exists, fetch profile page
 */
export async function detectDoubanUser() {
    try {
        // 1. Check dbcl2 cookie as login indicator
        const dbcl2Cookie = await chrome.cookies.get({
            url: 'https://www.douban.com',
            name: 'dbcl2'
        })

        if (!dbcl2Cookie || !dbcl2Cookie.value) {
            console.log('[COSE] douban 未找到登录 cookie，未登录')
            return { loggedIn: false }
        }

        // Logged in — now try to get user details
        let username = ''
        let avatar = ''
        let uid = ''
        let loginConfirmed = false

        // 2. Parse /mine/ HTML to get user info
        try {
            const doubanCookies = await chrome.cookies.getAll({ domain: '.douban.com' })
            const cookieHeader = doubanCookies.map(c => `${c.name}=${c.value}`).join('; ')

            const response = await fetch('https://www.douban.com/mine/', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'text/html,application/xhtml+xml',
                    ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
                }
            })

            if (response.ok) {
                const finalUrl = response.url || ''
                const html = await response.text()
                const redirectedToLogin = /\/accounts\/login/i.test(finalUrl)
                    || /name=["']form_email["']/i.test(html)
                    || /登录豆瓣|扫码登录/i.test(html)
                const hasUserSignals = /的账号</.test(html)
                    || /https?:\/\/www\.douban\.com\/people\/([^/"?#]+)\/?/.test(html)
                    || /\/people\/([^/"?#]+)\/?/.test(html)
                    || /doubanio\.com\/icon\//i.test(html)

                loginConfirmed = !redirectedToLogin && hasUserSignals

                if (!username) {
                    const accountMatch = html.match(/>([^<\n]+)的账号</)
                    if (accountMatch?.[1]) {
                        username = accountMatch[1].trim()
                    }
                }

                if (!username || !uid) {
                    const profileLinkMatch = html.match(/https?:\/\/www\.douban\.com\/people\/([^/"?#]+)\/?/)
                    if (profileLinkMatch?.[1]) {
                        uid = profileLinkMatch[1]
                    }
                }

                if (!avatar) {
                    const avatarMatch = html.match(/https?:\/\/img\d\.doubanio\.com\/icon\/[^"'\s<]+/i)
                        || html.match(/\/\/img\d\.doubanio\.com\/icon\/[^"'\s<]+/i)
                        || html.match(/\/icon\/up\d+-\d+\.jpg/i)
                    if (avatarMatch?.[1]) {
                        avatar = avatarMatch[1]
                    } else if (avatarMatch?.[0]) {
                        avatar = avatarMatch[0]
                    }

                    if (avatar && avatar.startsWith('//')) {
                        avatar = `https:${avatar}`
                    } else if (avatar && avatar.startsWith('/icon/')) {
                        avatar = `https://img3.doubanio.com${avatar}`
                    }
                }

                if (username || avatar || uid) {
                    console.log('[COSE] douban 从 /mine/ HTML 获取用户信息:', username || uid)
                }
            }
        } catch (e) {
            console.log('[COSE] douban /mine/ 解析失败:', e.message)
        }

        // 3. Fallback: derive uid from dbcl2 cookie as username placeholder
        if (loginConfirmed && !username && !uid && dbcl2Cookie.value) {
            const uidFromCookie = dbcl2Cookie.value.match(/"?([^:"]+):/)
            if (uidFromCookie?.[1]) {
                uid = uidFromCookie[1]
            }
        }

        if (!loginConfirmed) {
            console.log('[COSE] douban 仅有 cookie，未确认登录态，按未登录处理')
            return { loggedIn: false }
        }

        if (!username && uid) {
            username = uid
        }

        // 5. If avatar still missing but uid exists, fetch profile page and extract avatar
        if (!avatar && uid) {
            try {
                const doubanCookies = await chrome.cookies.getAll({ domain: '.douban.com' })
                const cookieHeader = doubanCookies.map(c => `${c.name}=${c.value}`).join('; ')
                const profileResp = await fetch(`https://www.douban.com/people/${uid}/`, {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml',
                        ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
                    }
                })

                if (profileResp.ok) {
                    const profileHtml = await profileResp.text()
                    const profileAvatar = profileHtml.match(/https?:\/\/img\d\.doubanio\.com\/icon\/[^"'\s<]+/i)
                        || profileHtml.match(/\/\/img\d\.doubanio\.com\/icon\/[^"'\s<]+/i)
                    if (profileAvatar?.[0]) {
                        avatar = profileAvatar[0]
                        console.log('[COSE] douban 从个人页补充头像成功')
                    }
                }
            } catch (e) {
                console.log('[COSE] douban 从个人页补充头像失败:', e.message)
            }
        }

        if (avatar && avatar.startsWith('//')) {
            avatar = `https:${avatar}`
        }

        // Convert douban avatar to base64 if needed
        if (avatar && avatar.startsWith('http')) {
            try {
                avatar = await convertToBase64WithFallback(avatar)
            } catch (e) {
                console.log('[COSE] douban 头像转换失败:', e.message)
            }
        }

        // Cookie exists means logged in; return best-effort user details
        return { loggedIn: true, username: username || '', avatar: avatar || '' }
    } catch (e) {
        console.log('[COSE] douban 检测失败:', e.message)
        return { loggedIn: false }
    }
}
