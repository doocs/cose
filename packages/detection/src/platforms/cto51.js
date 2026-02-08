import { convertAvatarToBase64 } from '../utils.js'

/**
 * 51CTO platform detection logic
 * Strategy:
 * 1. Check '_identity' cookie on blog.51cto.com (login indicator)
 * 2. Fetch publish page (authenticated) to extract blog user ID and avatar
 * 3. Fetch user profile page (public) to extract username from title
 *
 * Note: The old API (home.51cto.com/api/user/info/getUserBasicInfo) redirects
 * to login page because session cookies are scoped to blog.51cto.com, not home.51cto.com.
 * The _identity cookie contains an internal account ID, not the blog user ID.
 * The profile page fetch from service worker may not carry cookies properly,
 * so avatar must be extracted from the authenticated publish page instead.
 */
export async function detectCTO51User() {
    try {
        console.log('[COSE] 51CTO Detection: Starting cookie check')
        const identityCookie = await chrome.cookies.get({ url: 'https://blog.51cto.com', name: '_identity' })

        if (!identityCookie || !identityCookie.value) {
            console.log('[COSE] 51CTO: No _identity cookie found')
            return { loggedIn: false }
        }

        let username = ''
        let avatar = ''
        let blogUserId = ''

        try {
            // Fetch publish page (requires auth, cookies are sent correctly)
            const publishResp = await fetch('https://blog.51cto.com/blogger/publish', {
                method: 'GET',
                credentials: 'include',
                headers: { 'Accept': 'text/html' },
            })
            const publishHtml = await publishResp.text()

            // Extract blog user ID from profile link: href="https://blog.51cto.com/15736437"
            const blogIdMatch = publishHtml.match(/blog\.51cto\.com\/(\d{5,})/)
            if (blogIdMatch) {
                blogUserId = blogIdMatch[1]
                console.log(`[COSE] 51CTO blog user ID: ${blogUserId}`)
            }

            // Extract avatar from publish page nav: <img data-uid="..." src="https://s2.51cto.com/oss/...">
            // Skip default placeholder (noavatar)
            const avatarMatch = publishHtml.match(/<img[^>]*data-uid=["']\d+["'][^>]*src=["'](https?:\/\/[^"']+)["']/i) ||
                publishHtml.match(/<img[^>]*src=["'](https:\/\/s[0-9]*\.51cto\.com\/oss\/[^"']+)["'][^>]*data-uid/i)
            if (avatarMatch && !avatarMatch[1].includes('noavatar')) {
                avatar = avatarMatch[1]
            }
        } catch (e) {
            console.log('[COSE] 51CTO publish page fetch failed:', e.message)
        }

        // Fetch profile page (public) to extract username from title
        if (blogUserId) {
            try {
                const profileResp = await fetch(`https://blog.51cto.com/u_${blogUserId}`, {
                    method: 'GET',
                    headers: { 'Accept': 'text/html' },
                })
                const profileHtml = await profileResp.text()

                // Extract username from page title: "timerring的博客_..."
                const nickMatch = profileHtml.match(/<title>([^<]+?)的博客/)
                if (nickMatch) {
                    username = nickMatch[1].trim()
                }
            } catch (e) {
                console.log('[COSE] 51CTO profile fetch failed:', e.message)
            }
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
