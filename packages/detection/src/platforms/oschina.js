import { convertAvatarToBase64 } from '../utils.js'

/**
 * OSChina platform detection logic
 * Strategy:
 * 1. Fetch homepage HTML (authenticated)
 * 2. Extract username from current-user-avatar title or h3.header
 * 3. Extract avatar from user profile page
 */
export async function detectOSChinaUser() {
    try {
        console.log('[COSE] OSChina Detection: Starting')
        const response = await fetch('https://www.oschina.net/', {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'text/html' },
        })
        const html = await response.text()

        // Extract username and userId from current-user-avatar div
        // Pattern: <div class="... current-user-avatar" title="username" data-user-id="12345">
        const userMatch = html.match(/current-user-avatar[^"]*"[^>]*title="([^"]+)"[^>]*data-user-id="(\d+)"/)
        if (!userMatch) {
            console.log('[COSE] OSChina: Not logged in (no current-user-avatar found)')
            return { loggedIn: false }
        }

        const username = userMatch[1].trim()
        const userId = userMatch[2]
        console.log(`[COSE] OSChina user: ${username}, id: ${userId}`)

        // Extract avatar: look for img inside avatar-image__inner, or background-image on avatar div
        let avatar = ''
        const avatarImgMatch = html.match(/avatar-image__inner"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/)
        if (avatarImgMatch && !avatarImgMatch[1].includes('level/')) {
            avatar = avatarImgMatch[1]
        }

        // Fallback: fetch user profile page for avatar
        if (!avatar && userId) {
            try {
                const profileResp = await fetch(`https://my.oschina.net/u/${userId}`, {
                    method: 'GET',
                    credentials: 'include',
                    headers: { 'Accept': 'text/html' },
                })
                const profileHtml = await profileResp.text()
                const profileAvatar = profileHtml.match(/current-user-avatar[^>]*style="[^"]*background-image:\s*url\(([^)]+)\)/) ||
                    profileHtml.match(/<img[^>]*class="[^"]*avatar[^"]*"[^>]*src="([^"]+)"/) ||
                    profileHtml.match(/<img[^>]*src="([^"]+)"[^>]*class="[^"]*avatar/)
                if (profileAvatar) {
                    avatar = profileAvatar[1].replace(/^['"]|['"]$/g, '')
                }
            } catch (e) {
                console.log('[COSE] OSChina profile fetch failed:', e.message)
            }
        }

        if (avatar && (avatar.includes('oschina.net') || avatar.includes('oscimg'))) {
            avatar = await convertAvatarToBase64(avatar, 'https://www.oschina.net/')
        }

        return { loggedIn: true, username, avatar }
    } catch (e) {
        console.error('[COSE] OSChina Detection Error:', e)
        return { loggedIn: false, error: e.message }
    }
}
