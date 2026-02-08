/**
 * OSChina platform detection logic
 * Strategy:
 * 1. Fetch homepage, extract user ID or username
 * 2. If only ID found, fetch personal space to get username
 */
export async function detectOSChinaUser() {
    try {
        console.log('[COSE] OSChina Detection: Starting')
        const response = await fetch('https://www.oschina.net/', {
            method: 'GET',
            credentials: 'include'
        })
        const html = await response.text()

        // Extract User ID
        const uidMatch = html.match(/href=["']https:\/\/my\.oschina\.net\/u\/(\d+)["']/i) ||
            html.match(/space\.oschina\.net\/u\/(\d+)/i) ||
            html.match(/data-user-id=["'](\d+)["']/i)

        const userId = uidMatch ? uidMatch[1] : null

        // Extract Username
        let username = ''
        const nameMatch = html.match(/<a[^>]*class="[^"]*user-name[^"]*"[^>]*>([^<]+)<\/a>/i) ||
            html.match(/<span[^>]*class="[^"]*nick[^"]*"[^>]*>([^<]+)<\/span>/i) ||
            html.match(/title="([^"]+)"[^>]*class="[^"]*avatar/i)

        if (nameMatch) {
            username = nameMatch[1].trim()
        }

        // Fallback: Fetch personal space if only ID is known
        if (!username && userId) {
            console.log(`[COSE] OSChina: Fetching personal space for userId ${userId}`)
            try {
                const userPageResp = await fetch(`https://my.oschina.net/u/${userId}`, {
                    method: 'GET',
                    credentials: 'include'
                })
                const userPageHtml = await userPageResp.text()
                const userPageNameMatch = userPageHtml.match(/<h3[^>]*class="[^"]*header[^"]*"[^>]*>([^<]+)<\/h3>/i) ||
                    userPageHtml.match(/<div[^>]*class="[^"]*user-name[^"]*"[^>]*>([^<]+)<\/div>/i) ||
                    userPageHtml.match(/<title>([^<]+)的个人空间<\/title>/i)
                if (userPageNameMatch) {
                    username = userPageNameMatch[1].trim()
                }
            } catch (e) {
                console.warn('[COSE] OSChina: Failed to fetch user page', e)
            }
        }

        // Fallback: Use ID as username if name still missing
        if (!username && userId) {
            username = userId
        }

        // Extract Avatar
        let avatar = ''
        const avatarMatch = html.match(/<img[^>]*src="([^"]+)"[^>]*class="[^"]*avatar/i) ||
            html.match(/<img[^>]*class="[^"]*avatar[^"]*"[^>]*src="([^"]+)"/i)
        if (avatarMatch) {
            avatar = avatarMatch[1]
        }

        if (username) {
            return { loggedIn: true, username, avatar }
        }

        return { loggedIn: false }
    } catch (e) {
        console.error('[COSE] OSChina Detection Error:', e)
        return { loggedIn: false, error: e.message }
    }
}
