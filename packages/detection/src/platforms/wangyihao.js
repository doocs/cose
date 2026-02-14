import { convertAvatarToBase64 } from '../utils.js'

/**
 * 网易号 detection logic
 * Strategy:
 * 1. Collect cookies via chrome.cookies.getAll (MV3 service worker compatible)
 * 2. Fetch user info via mp.163.com/wemedia/navinfo.do with cookies attached manually
 * 3. Extract username and avatar from API response
 */
export async function detectWangyihaoUser() {
    try {
        const cookies = await chrome.cookies.getAll({ domain: '.163.com' })
        const mpCookies = await chrome.cookies.getAll({ url: 'https://mp.163.com' })
        const allCookies = [...cookies, ...mpCookies]
        const seen = new Set()
        const uniqueCookies = allCookies.filter(c => {
            const key = `${c.name}=${c.value}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
        const cookieStr = uniqueCookies.map(c => `${c.name}=${c.value}`).join('; ')

        if (!cookieStr) return { loggedIn: false }

        const response = await fetch(`https://mp.163.com/wemedia/navinfo.do?_=${Date.now()}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Cookie': cookieStr,
            },
        })

        if (!response.ok) return { loggedIn: false }

        const data = await response.json()
        if (data?.code !== 1 || !data?.data?.wemediaId) return { loggedIn: false }

        const username = data.data.tname || ''
        let avatar = data.data.icon || ''

        if (avatar && (avatar.includes('126.net') || avatar.includes('163.com'))) {
            avatar = await convertAvatarToBase64(avatar, 'https://mp.163.com/')
        }

        return { loggedIn: true, username, avatar }
    } catch (e) {
        console.error('[COSE] Wangyihao Detection Error:', e)
        return { loggedIn: false, error: e.message }
    }
}
