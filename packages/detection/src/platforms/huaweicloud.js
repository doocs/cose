import { convertAvatarToBase64 } from '../utils.js'

/**
 * Huawei Cloud platform detection logic
 * Strategy:
 * 1. Read csrf cookie via chrome.cookies API
 * 2. Fetch personal info API directly with csrf header
 */
export async function detectHuaweiCloudUser() {
    try {
        console.log('[COSE] HuaweiCloud Detection: Starting')

        // Read csrf cookie from huaweicloud.com domain
        const csrfCookie = await chrome.cookies.get({ url: 'https://bbs.huaweicloud.com', name: 'csrf' })
        if (!csrfCookie || !csrfCookie.value) {
            console.log('[COSE] HuaweiCloud: No csrf cookie found')
            return { loggedIn: false }
        }

        const response = await fetch('https://devdata.huaweicloud.com/rest/developer/fwdu/rest/developer/user/hdcommunityservice/v1/member/get-personal-info', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'csrf': csrfCookie.value,
                'Origin': 'https://bbs.huaweicloud.com',
                'Referer': 'https://bbs.huaweicloud.com/',
            },
        })

        if (!response.ok) {
            console.log('[COSE] HuaweiCloud: API response not ok', response.status)
            return { loggedIn: false }
        }

        const data = await response.json()
        if (!data || !data.memName) {
            console.log('[COSE] HuaweiCloud: No user data in response')
            return { loggedIn: false }
        }

        const username = data.memAlias || data.memName || ''
        let avatar = data.memPhoto || ''

        if (avatar && avatar.includes('huaweicloud.com')) {
            avatar = await convertAvatarToBase64(avatar, 'https://bbs.huaweicloud.com/')
        }

        return { loggedIn: true, username, avatar }
    } catch (e) {
        console.error('[COSE] HuaweiCloud Detection Error:', e)
        return { loggedIn: false, error: e.message }
    }
}
