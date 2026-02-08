/**
 * Baidu Qianfan platform detection logic
 * Strategy:
 * 1. Call current user API directly
 */
export async function detectQianfanUser() {
    try {
        const response = await fetch('https://qianfan.cloud.baidu.com/api/community/user/current', {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        })
        if (!response.ok) return { loggedIn: false }

        const data = await response.json()
        if (data.success && data.result) {
            const username = data.result.displayName || data.result.nickname || ''
            const avatar = data.result.avatar || ''
            return { loggedIn: true, username, avatar }
        } else {
            return { loggedIn: false }
        }
    } catch (e) { return { loggedIn: false } }
}
