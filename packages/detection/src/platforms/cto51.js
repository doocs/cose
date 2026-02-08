import { convertAvatarToBase64 } from '../utils.js'

/**
 * 51CTO platform detection logic
 * Strategy:
 * 1. Fetch publish page (authenticated) — if it contains blog user ID, user is logged in
 * 2. Extract avatar from publish page
 * 3. Fetch user profile page (public) to extract username from title
 *
 * Note: Cookie-based login check (_identity) is unreliable because different
 * login flows may not set _identity. Instead we use the publish page response
 * as the definitive login indicator.
 */
export async function detectCTO51User() {
    try {
        console.log('[COSE] 51CTO Detection: Fetching publish page')

        let username = ''
        let avatar = ''
        let blogUserId = ''

        // Fetch publish page (requires auth, cookies are sent correctly)
        const publishResp = await fetch('https://blog.51cto.com/blogger/publish', {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'text/html' },
            redirect: 'follow',
        })
        const publishHtml = await publishResp.text()

        // Extract blog user ID from profile link: href="https://blog.51cto.com/15736437"
        const blogIdMatch = publishHtml.match(/blog\.51cto\.com\/(\d{5,})/)
        if (!blogIdMatch) {
            // No blog user ID means not logged in (redirected to login page)
            console.log('[COSE] 51CTO: Not logged in (no blog user ID in publish page)')
            return { loggedIn: false }
        }
        blogUserId = blogIdMatch[1]
        console.log(`[COSE] 51CTO blog user ID: ${blogUserId}`)

        // Extract avatar from publish page nav: <img data-uid="..." src="https://s2.51cto.com/oss/...">
        // Skip default placeholder (noavatar)
        const avatarMatch = publishHtml.match(/<img[^>]*data-uid=["']\d+["'][^>]*src=["'](https?:\/\/[^"']+)["']/i) ||
            publishHtml.match(/<img[^>]*src=["'](https:\/\/s[0-9]*\.51cto\.com\/oss\/[^"']+)["'][^>]*data-uid/i)
        if (avatarMatch && !avatarMatch[1].includes('noavatar')) {
            avatar = avatarMatch[1]
        }

        // Fetch profile page (public) to extract username from title
        try {
            const profileResp = await fetch(`https://blog.51cto.com/u_${blogUserId}`, {
                method: 'GET',
                headers: { 'Accept': 'text/html' },
            })
            const profileHtml = await profileResp.text()

            // Extract username from page title: "xxxxx的博客_..."
            const nickMatch = profileHtml.match(/<title>([^<]+?)的博客/)
            if (nickMatch) {
                username = nickMatch[1].trim()
            }
        } catch (e) {
            console.log('[COSE] 51CTO profile fetch failed:', e.message)
        }

        console.log(`[COSE] 51CTO user info: ${username}, avatar: ${avatar ? 'found' : 'not found'}`)

        // Convert 51cto.com avatar to base64 data URL to bypass CORS/ORB
        if (avatar && avatar.includes('51cto.com')) {
            avatar = await convertAvatarToBase64(avatar, 'https://blog.51cto.com/')
        }

        return { loggedIn: true, username, avatar }
    } catch (e) {
        console.error('[COSE] 51CTO Detection Error:', e)
        return { loggedIn: false, error: e.message }
    }
}
