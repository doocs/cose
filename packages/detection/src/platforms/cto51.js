import { convertAvatarToBase64 } from '../utils.js'

/**
 * 51CTO platform detection logic (same approach as 爱贝壳)
 * Fetch https://home.51cto.com/space via offscreen document,
 * parse HTML with DOMParser to extract avatar, uid, nickname.
 */
export async function detectCTO51User() {
    try {
        console.log('[COSE] 51CTO Detection: Starting (offscreen)')

        if (typeof globalThis.__coseDetectCto51 === 'function') {
            const result = await globalThis.__coseDetectCto51()
            if (result && result.loggedIn) {
                let avatar = result.avatar || ''
                if (avatar && avatar.startsWith('http') && avatar.includes('51cto.com')) {
                    avatar = await convertAvatarToBase64(avatar, 'https://home.51cto.com/')
                }
                console.log('[COSE] 51CTO: Logged in:', result.username)
                return { loggedIn: true, username: result.username || '', avatar }
            }
        }

        console.log('[COSE] 51CTO: Not logged in')
        return { loggedIn: false }
    } catch (e) {
        console.error('[COSE] 51CTO Detection Error:', e)
        return { loggedIn: false, error: e.message }
    }
}
