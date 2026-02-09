import { convertAvatarToBase64 } from '../utils.js'

/**
 * Tencent Cloud platform detection logic
 * Strategy:
 * 1. Fetch creator page
 * 2. Check redirect and parse HTML for nickname/avatar
 */
export async function detectTencentCloudUser() {
    try {
        const response = await fetch('https://cloud.tencent.com/developer/creator', {
            method: 'GET',
            credentials: 'include',
        })
        const html = await response.text()
        const finalUrl = response.url

        if (!finalUrl.includes('/creator')) return { loggedIn: false }
        if (html.includes('登录/注册') || html.includes('"isLogin":false') || html.includes('"login":false')) return { loggedIn: false }

        const userInfoMatch = html.match(/"userInfo"\s*:\s*\{[^}]*"nickname"\s*:\s*"([^"]+)"[^}]*\}/) ||
            html.match(/"creatorInfo"\s*:\s*\{[^}]*"nickname"\s*:\s*"([^"]+)"[^}]*\}/) ||
            html.match(/"currentUser"\s*:\s*\{[^}]*"nickname"\s*:\s*"([^"]+)"[^}]*\}/)

        const creatorNicknameMatch = html.match(/class="creator-info[^"]*"[^>]*>[\s\S]*?<[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)</) ||
            html.match(/"isCreator"\s*:\s*true[\s\S]*?"nickname"\s*:\s*"([^"]+)"/)

        const nicknameMatch = userInfoMatch || creatorNicknameMatch
        const avatarMatch = html.match(/"userInfo"[\s\S]*?"avatarUrl"\s*:\s*"([^"]+)"/) ||
            html.match(/"avatar"\s*:\s*"(https?:\/\/[^"]+)"/)

        if (nicknameMatch && nicknameMatch[1]) {
            let avatar = avatarMatch ? avatarMatch[1] : ''
            if (avatar && avatar.includes('qcloudimg.com')) {
                avatar = await convertAvatarToBase64(avatar, 'https://cloud.tencent.com/')
            }
            return { loggedIn: true, username: nicknameMatch[1], avatar }
        } else {
            if (html.includes('创作中心') || html.includes('我的文章')) return { loggedIn: true, username: '', avatar: '' }
            return { loggedIn: false }
        }
    } catch (e) { return { loggedIn: false } }
}
