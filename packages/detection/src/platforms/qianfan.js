import { convertAvatarToBase64 } from '../utils.js'

/**
 * Baidu Qianfan platform detection logic
 * Strategy:
 * 1. Read csrftoken from bce-user-info-ct-id cookie
 * 2. Call current user API with csrftoken header
 */
export async function detectQianfanUser() {
    try {
        console.log('[COSE] Qianfan Detection: Starting')

        // Read csrftoken from cookie
        const csrfCookie = await chrome.cookies.get({ url: 'https://qianfan.cloud.baidu.com', name: 'bce-user-info-ct-id' })
        const csrfToken = csrfCookie?.value ? csrfCookie.value.replace(/"/g, '') : ''

        const response = await fetch('https://qianfan.cloud.baidu.com/api/community/user/current', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                ...(csrfToken ? { 'csrftoken': csrfToken } : {}),
            }
        })
        if (!response.ok) return { loggedIn: false }

        const data = await response.json()
        if (data.success && data.result) {
            const username = data.result.displayName || data.result.nickname || ''
            let avatar = data.result.avatar || ''

            if (avatar && avatar.includes('bdimg.com')) {
                avatar = await convertAvatarToBase64(avatar, 'https://qianfan.cloud.baidu.com/')
            }

            return { loggedIn: true, username, avatar }
        } else {
            return { loggedIn: false }
        }
    } catch (e) {
        console.error('[COSE] Qianfan Detection Error:', e)
        return { loggedIn: false, error: e.message }
    }
}
