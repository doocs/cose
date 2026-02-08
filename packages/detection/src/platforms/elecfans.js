/**
 * Elecfans platform detection logic
 * Strategy:
 * 1. Check auth/auth_www cookies
 * 2. Call checklogin API for username/avatar
 */
export async function detectElecfansUser() {
    const platformId = 'elecfans'
    try {
        const authCookie = await chrome.cookies.get({ url: 'https://www.elecfans.com', name: 'auth' })
        const authWwwCookie = await chrome.cookies.get({ url: 'https://www.elecfans.com', name: 'auth_www' })

        if (!authCookie && !authWwwCookie) {
            return { loggedIn: false }
        }

        try {
            const response = await fetch('https://www.elecfans.com/webapi/passport/checklogin?_=' + Date.now(), {
                method: 'GET',
                credentials: 'include',
                headers: { 'Accept': 'application/json, text/javascript, */*; q=0.01' }
            })

            if (!response.ok) return { loggedIn: true, username: '', avatar: '' }

            const data = await response.json()
            if (data && data.uid) {
                const username = data.username || ''
                const avatar = data.avatar || ''
                return { loggedIn: true, username, avatar }
            } else {
                return { loggedIn: true, username: '', avatar: '' }
            }
        } catch (e) {
            return { loggedIn: true, username: '', avatar: '' }
        }
    } catch (e) {
        return { loggedIn: false }
    }
}
