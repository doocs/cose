import { convertAvatarToBase64 } from '../utils.js'

/**
 * InfoQ platform detection logic
 * Strategy: POST to /public/v1/user/get_user API to get user info
 * The old /public/v1/my/menu endpoint returns 404.
 */
export async function detectInfoQUser() {
    try {
        console.log('[COSE] InfoQ Detection: Starting')
        const response = await fetch('https://www.infoq.cn/public/v1/user/get_user', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({}),
        })

        if (!response.ok) return { loggedIn: false }

        const json = await response.json()
        if (json?.code !== 0 || !json?.data?.uid) {
            console.log('[COSE] InfoQ: Not logged in', json?.code)
            return { loggedIn: false }
        }

        const username = json.data.nickname || ''
        let avatar = json.data.avatar || ''

        if (avatar && avatar.includes('geekbang.org')) {
            avatar = await convertAvatarToBase64(avatar, 'https://www.infoq.cn/')
        }

        return { loggedIn: true, username, avatar }
    } catch (e) {
        console.error('[COSE] InfoQ Detection Error:', e)
        return { loggedIn: false, error: e.message }
    }
}
