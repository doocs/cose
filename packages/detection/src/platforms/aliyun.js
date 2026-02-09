import { convertAvatarToBase64 } from '../utils.js'

/**
 * Aliyun Developer platform detection logic
 * Strategy:
 * 1. Check login_aliyunid_ticket cookie
 * 2. Call getUser API for username/avatar
 * 3. Convert avatar to base64 to bypass CORS/ORB
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
            let avatar = data.data.avatar || ''
            if (avatar) {
                avatar = await convertAvatarToBase64(avatar, 'https://developer.aliyun.com/')
            }
            return { loggedIn: true, username: data.data.nickname, avatar }
        }
        return { loggedIn: false }
    } catch (e) { return { loggedIn: false } }
}
