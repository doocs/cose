/**
 * Medium platform detection logic
 * Strategy:
 * 1. Check sid/uid cookies
 * 2. Fetch stats page and extract username/avatar via regex
 */
export async function detectMediumUser() {
    try {
        const sidCookie = await chrome.cookies.get({ url: 'https://medium.com', name: 'sid' })
        const uidCookie = await chrome.cookies.get({ url: 'https://medium.com', name: 'uid' })

        if (!sidCookie && !uidCookie) return { loggedIn: false }

        const response = await fetch('https://medium.com/me/stats', {
            method: 'GET',
            credentials: 'include',
        })
        const html = await response.text()
        const finalUrl = response.url

        if (finalUrl.includes('/m/signin') || finalUrl.includes('?signIn')) return { loggedIn: false }

        const profileMatch = html.match(/"username"\s*:\s*"([^"]+)"/) ||
            html.match(/href="https:\/\/medium\.com\/@([^"?\/]+)"/) ||
            html.match(/medium\.com\/@([a-zA-Z0-9_]+)/)

        if (profileMatch && profileMatch[1] && profileMatch[1] !== 'gmail' && profileMatch[1] !== 'medium') {
            const username = profileMatch[1]

            // Extract avatar via imageId from JSON data near the username
            let avatar = ''
            const imageIdMatch = html.match(new RegExp(`"imageId"\\s*:\\s*"([^"]+)"[^}]*"username"\\s*:\\s*"${username}"`)) ||
                html.match(new RegExp(`"username"\\s*:\\s*"${username}"[^}]*"imageId"\\s*:\\s*"([^"]+)"`))
            if (imageIdMatch) {
                avatar = `https://miro.medium.com/v2/resize:fill:64:64/${imageIdMatch[1]}`
            }

            return { loggedIn: true, username, avatar }
        } else {
            return { loggedIn: true, username: '', avatar: '' }
        }
    } catch (e) { return { loggedIn: false } }
}
