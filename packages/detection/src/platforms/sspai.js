/**
 * Sspai (少数派) platform detection logic
 * Strategy:
 * 1. Check sspai_jwt_token cookie
 * 2. Call user info API with Bearer token
 */
export async function detectSspaiUser() {
    try {
        const jwtCookie = await chrome.cookies.get({ url: 'https://sspai.com', name: 'sspai_jwt_token' })
        if (!jwtCookie || !jwtCookie.value) return { loggedIn: false }

        const token = jwtCookie.value
        const response = await fetch('https://sspai.com/api/v1/user/info/get', {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` }
        })
        const data = await response.json()

        if (data.error === 0 && data.data?.nickname) {
            return { loggedIn: true, username: data.data.nickname, avatar: data.data.avatar || '' }
        } else {
            return { loggedIn: false }
        }
    } catch (e) { return { loggedIn: false } }
}
