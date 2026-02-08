/**
 * CSDN platform detection logic
 * Strategy:
 * 1. Check 'UserName' cookie (reliable indicator of login)
 * 2. Use 'UserNick' cookie for display name (UserName is the user ID, UserNick is the display name)
 * 3. If logged in, fetch public blog page to get avatar
 */
export async function detectCSDNUser() {
    try {
        console.log('[COSE] CSDN Detection: Starting cookie check')
        const userNameCookie = await chrome.cookies.get({ url: 'https://www.csdn.net', name: 'UserName' })

        if (userNameCookie && userNameCookie.value) {
            const userId = userNameCookie.value
            console.log(`[COSE] CSDN UserName cookie found: ${userId}`)

            // UserNick cookie contains the display name (e.g. 'timerring')
            const userNickCookie = await chrome.cookies.get({ url: 'https://www.csdn.net', name: 'UserNick' })
            const username = (userNickCookie && userNickCookie.value) ? decodeURIComponent(userNickCookie.value) : userId
            console.log(`[COSE] CSDN display name: ${username}`)

            let avatar = ''
            try {
                // Fetch public blog page for avatar
                const blogUrl = `https://blog.csdn.net/${userId}`
                const blogResp = await fetch(blogUrl, { method: 'GET' })
                const blogHtml = await blogResp.text()

                // Extract avatar
                const avatarMatch = blogHtml.match(/<img[^>]*src=["'](https:\/\/(?:profile|i-avatar)\.csdnimg\.cn\/[^"']+)["']/i) ||
                    blogHtml.match(/<img[^>]*class=["']avatar[^"']*["'][^>]*src=["']([^"']+)["']/i)

                if (avatarMatch) {
                    avatar = avatarMatch[1]
                }
            } catch (e) {
                console.warn('[COSE] CSDN Avatar fetch failed:', e)
            }

            return {
                loggedIn: true,
                username: username,
                avatar: avatar
            }
        }

        console.log('[COSE] CSDN: No login detected')
        return { loggedIn: false }
    } catch (e) {
        console.error('[COSE] CSDN Detection Error:', e)
        return { loggedIn: false, error: e.message }
    }
}
