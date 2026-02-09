import { convertAvatarToBase64 } from '../utils.js'

/**
 * Elecfans (电子发烧友) detection logic
 * API: /api/mobile/index.php?module=profile (Discuz standard mobile API)
 * Response: { Variables: { member_uid, space: { username, realname }, member_avatar } }
 * Uses chrome.cookies.getAll to attach cookies manually (SameSite workaround)
 */
export async function detectElecfansUser() {
    try {
        // Collect cookies for bbs.elecfans.com
        const cookies = await chrome.cookies.getAll({ domain: '.elecfans.com' })
        const bbsCookies = await chrome.cookies.getAll({ url: 'https://bbs.elecfans.com' })
        const allCookies = [...cookies, ...bbsCookies]
        const seen = new Set()
        const uniqueCookies = allCookies.filter(c => {
            const key = `${c.name}=${c.value}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
        const cookieStr = uniqueCookies.map(c => `${c.name}=${c.value}`).join('; ')

        if (!cookieStr) return { loggedIn: false }

        const response = await fetch('https://bbs.elecfans.com/api/mobile/index.php?module=profile', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Cookie': cookieStr,
            },
        })

        if (!response.ok) return { loggedIn: false }

        const data = await response.json()
        if (!data?.Variables?.member_uid) return { loggedIn: false }

        const username = data.Variables.space?.username
            || data.Variables.space?.realname
            || data.Variables.member_username || ''
        let avatar = data.Variables.member_avatar || ''

        if (!username) return { loggedIn: false }

        if (avatar) avatar = await convertAvatarToBase64(avatar, 'https://bbs.elecfans.com/')
        return { loggedIn: true, username, avatar }
    } catch (e) {
        return { loggedIn: false }
    }
}
