import { convertAvatarToBase64 } from '../utils.js'

/**
 * SegmentFault platform detection logic
 * Strategy: Fetch homepage HTML and extract user info from __NEXT_DATA__ JSON
 * The /gateway/user/me API requires CSRF tokens (ivd param), so we use HTML scraping instead.
 */
export async function detectSegmentFaultUser() {
    try {
        console.log('[COSE] SegmentFault Detection: Starting')
        const response = await fetch('https://segmentfault.com/', {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'text/html' },
        })
        const html = await response.text()

        // Extract __NEXT_DATA__ JSON
        const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
        if (!nextDataMatch) {
            console.log('[COSE] SegmentFault: No __NEXT_DATA__ found')
            return { loggedIn: false }
        }

        const nextData = JSON.parse(nextDataMatch[1])
        const sessionUser = nextData?.props?.pageProps?.initialState?.global?.sessionUser
        const sessionInfo = nextData?.props?.pageProps?.initialState?.global?.sessionInfo

        if (!sessionUser?.user?.id && !sessionInfo?.login) {
            console.log('[COSE] SegmentFault: Not logged in')
            return { loggedIn: false }
        }

        const user = sessionUser?.user || {}
        const username = user.name || user.slug || ''
        let avatar = user.avatar_url || ''

        if (avatar && avatar.includes('segmentfault.com')) {
            avatar = await convertAvatarToBase64(avatar, 'https://segmentfault.com/')
        }

        return { loggedIn: true, username, avatar }
    } catch (e) {
        console.error('[COSE] SegmentFault Detection Error:', e)
        return { loggedIn: false, error: e.message }
    }
}
