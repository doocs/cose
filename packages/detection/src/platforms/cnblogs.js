import { convertAvatarToBase64 } from '../utils.js'

/**
 * Cnblogs (博客园) detection logic
 * Strategy:
 * 1. Collect cookies via chrome.cookies.getAll (MV3 service worker compatible)
 * 2. Fetch user info via account.cnblogs.com/user/userinfo with cookies attached manually
 * 3. Extract username and avatar from API response
 */
export async function detectCnblogsUser() {
    try {
        const cookies = await chrome.cookies.getAll({ domain: '.cnblogs.com' })
        const wwwCookies = await chrome.cookies.getAll({ url: 'https://www.cnblogs.com' })
        const accountCookies = await chrome.cookies.getAll({ url: 'https://account.cnblogs.com' })
        const allCookies = [...cookies, ...wwwCookies, ...accountCookies]
        const seen = new Set()
        const uniqueCookies = allCookies.filter(c => {
            const key = `${c.name}=${c.value}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
        const cookieStr = uniqueCookies.map(c => `${c.name}=${c.value}`).join('; ')

        if (!cookieStr) return { loggedIn: false }

        const response = await fetch('https://account.cnblogs.com/user/userinfo', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Cookie': cookieStr,
            },
        })

        if (!response.ok) return { loggedIn: false }

        const data = await response.json()
        if (!data?.spaceUserId) return { loggedIn: false }

        const username = data.displayName || ''
        let avatar = data.iconName || ''

        if (avatar && !avatar.startsWith('http')) {
            avatar = 'https:' + avatar
        }
        if (avatar && avatar.includes('cnblogs.com')) {
            avatar = await convertAvatarToBase64(avatar, 'https://www.cnblogs.com/')
        }

        return { loggedIn: true, username, avatar }
    } catch (e) {
        console.error('[COSE] Cnblogs Detection Error:', e)
        return { loggedIn: false, error: e.message }
    }
}
