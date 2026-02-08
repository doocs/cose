/**
 * Aliyun Developer platform detection logic
 * Strategy:
 * 1. Check login_aliyunid_ticket cookie
 * 2. Call getUser API for username/avatar
 */
export async function detectAliyunUser() {
    try {
        const ticketCookie = await chrome.cookies.get({ url: 'https://developer.aliyun.com', name: 'login_aliyunid_ticket' })
        if (!ticketCookie || !ticketCookie.value) return { loggedIn: false }

        const response = await fetch('https://developer.aliyun.com/developer/api/my/user/getUser', {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        })
        const data = await response.json()

        if (data.success && data.data?.nickname) {
            return { loggedIn: true, username: data.data.nickname, avatar: data.data.avatar || '' }
        }
        return { loggedIn: false }
    } catch (e) { return { loggedIn: false } }
}
