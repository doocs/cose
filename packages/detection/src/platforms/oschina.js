import { convertAvatarToBase64 } from '../utils.js'

/**
 * OSChina platform detection logic
 * Strategy:
 * 1. Check oscid cookie existence as login indicator (MV3 service worker compatible)
 * 2. Best-effort: fetch user info via API for username and avatar
 */
export async function detectOSChinaUser() {
    try {
        // Check oscid cookie as login indicator
        const oscidCookie = await chrome.cookies.get({ url: 'https://www.oschina.net', name: 'oscid' })
        if (!oscidCookie || !oscidCookie.value) {
            return { loggedIn: false }
        }

        // Collect all cookies for API request
        const cookies = await chrome.cookies.getAll({ domain: '.oschina.net' })
        const wwwCookies = await chrome.cookies.getAll({ url: 'https://www.oschina.net' })
        const apiCookies = await chrome.cookies.getAll({ url: 'https://apiv1.oschina.net' })
        const allCookies = [...cookies, ...wwwCookies, ...apiCookies]
        const seen = new Set()
        const uniqueCookies = allCookies.filter(c => {
            const key = `${c.name}=${c.value}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
        const cookieStr = uniqueCookies.map(c => `${c.name}=${c.value}`).join('; ')

        // Best-effort: try to get username and avatar via API
        let username = ''
        let avatar = ''
        let userId = ''
        try {
            const response = await fetch('https://apiv1.oschina.net/oschinapi/user/myDetails', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Cookie': cookieStr,
                },
            })
            if (response.ok) {
                const data = await response.json()
                if (data?.success && data?.result?.userVo) {
                    username = data.result.userVo.name || ''
                    avatar = data.result.userVo.portraitUrl || ''
                    userId = String(data.result.userVo.id || '')
                }
            }
        } catch (e) {
            console.log('[COSE] OSChina: API fetch failed, using cookie-only detection')
        }

        if (avatar && (avatar.includes('oschina.net') || avatar.includes('oscimg'))) {
            avatar = await convertAvatarToBase64(avatar, 'https://www.oschina.net/')
        }

        // Store userId for sync URL construction
        if (userId) {
            try { await chrome.storage.local.set({ oschina_userId: userId }) } catch (e) { /* ignore */ }
        }

        return { loggedIn: true, username, avatar, userId }
    } catch (e) {
        console.error('[COSE] OSChina Detection Error:', e)
        return { loggedIn: false, error: e.message }
    }
}
