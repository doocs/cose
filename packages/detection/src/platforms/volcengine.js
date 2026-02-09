import { convertAvatarToBase64 } from '../utils.js'

/**
 * Volcengine (火山引擎开发者社区) detection logic
 * API: /api/fe/v1/user (found via Chrome DevTools network inspection)
 * Response: { data: { name, avatar: { url } }, err_no: 0 }
 * Uses chrome.cookies.getAll to attach cookies manually since service worker
 * fetch with credentials:'include' doesn't reliably send SameSite cookies.
 */
export async function detectVolcengineUser() {
    try {
        // Collect cookies for volcengine.com to attach to API request
        const cookies = await chrome.cookies.getAll({ domain: '.volcengine.com' })
        const devCookies = await chrome.cookies.getAll({ url: 'https://developer.volcengine.com' })
        const allCookies = [...cookies, ...devCookies]
        const seen = new Set()
        const uniqueCookies = allCookies.filter(c => {
            const key = `${c.name}=${c.value}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
        const cookieStr = uniqueCookies.map(c => `${c.name}=${c.value}`).join('; ')

        if (!cookieStr) return { loggedIn: false }

        const response = await fetch('https://developer.volcengine.com/api/fe/v1/user', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Cookie': cookieStr,
            },
        })

        if (!response.ok) return { loggedIn: false }

        const data = await response.json()
        if (data?.err_no !== 0 || !data?.data?.name) return { loggedIn: false }

        let username = data.data.name
        let avatar = data.data.avatar?.url || ''

        if (avatar) avatar = await convertAvatarToBase64(avatar, 'https://developer.volcengine.com/')
        return { loggedIn: true, username, avatar }
    } catch (e) {
        return { loggedIn: false }
    }
}
