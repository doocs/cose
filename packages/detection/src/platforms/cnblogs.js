import { convertAvatarToBase64 } from '../utils.js'

/**
 * Cnblogs (博客园) detection logic (offscreen approach)
 * Fetch https://account.cnblogs.com/user/userinfo via offscreen document,
 * where cookies are sent automatically in document context.
 */
export async function detectCnblogsUser() {
    try {
        console.log('[COSE] Cnblogs Detection: Starting (offscreen)')

        if (typeof globalThis.__coseDetectCnblogs === 'function') {
            const result = await globalThis.__coseDetectCnblogs()
            if (result && result.loggedIn) {
                let avatar = result.avatar || ''
                if (avatar && avatar.includes('cnblogs.com')) {
                    avatar = await convertAvatarToBase64(avatar, 'https://www.cnblogs.com/')
                }
                console.log('[COSE] Cnblogs: Logged in:', result.username)
                return { loggedIn: true, username: result.username || '', avatar }
            }
        }

        console.log('[COSE] Cnblogs: Not logged in')
        return { loggedIn: false }
    } catch (e) {
        console.error('[COSE] Cnblogs Detection Error:', e)
        return { loggedIn: false, error: e.message }
    }
}
