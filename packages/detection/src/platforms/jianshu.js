import { convertAvatarToBase64 } from '../utils.js'

/**
 * Jianshu platform detection logic
 * Strategy: Fetch settings JSON API to get nickname and avatar
 */
export async function detectJianshuUser() {
    try {
        console.log('[COSE] Jianshu Detection: Starting')
        const response = await fetch('https://www.jianshu.com/settings/basic.json', {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json' },
        })

        if (!response.ok) return { loggedIn: false }

        const json = await response.json()
        if (!json?.data) return { loggedIn: false }

        const username = json.data.nickname || ''
        let avatar = json.data.avatar || ''

        if (avatar && avatar.includes('jianshu.io')) {
            avatar = await convertAvatarToBase64(avatar, 'https://www.jianshu.com/')
        }

        return { loggedIn: true, username, avatar }
    } catch (e) {
        console.error('[COSE] Jianshu Detection Error:', e)
        return { loggedIn: false, error: e.message }
    }
}
