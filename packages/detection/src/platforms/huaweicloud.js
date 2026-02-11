import { convertAvatarToBase64 } from '../utils.js'

/**
 * Huawei Cloud platform detection logic
 * Strategy:
 * 1. Read csrf cookie via chrome.cookies API
 * 2. Fetch personal info API directly with csrf header
 */
export async function detectHuaweiCloudUser() {
    try {
        // 通过 get 获取 csrf cookie（getAll 可能无法返回该 cookie）
        // SSO 登录流程可能需要时间设置 cookie，使用重试机制
        let csrfCookie = null
        const retryDelays = [0, 500, 1000, 2000]
        for (const delay of retryDelays) {
            if (delay > 0) {
                console.log(`[COSE] HuaweiCloud: csrf cookie not found, retrying in ${delay}ms...`)
                await new Promise(resolve => setTimeout(resolve, delay))
            }
            csrfCookie = await chrome.cookies.get({ url: 'https://bbs.huaweicloud.com', name: 'csrf' })
            if (csrfCookie && csrfCookie.value) break
        }
        if (!csrfCookie || !csrfCookie.value) {
            console.log('[COSE] HuaweiCloud: No csrf cookie found after retries')
            return { loggedIn: false }
        }

        // 收集 cookies 用于 API 请求
        const cookies = await chrome.cookies.getAll({ domain: '.huaweicloud.com' })
        const bbsCookies = await chrome.cookies.getAll({ url: 'https://bbs.huaweicloud.com' })
        const devdataCookies = await chrome.cookies.getAll({ url: 'https://devdata.huaweicloud.com' })
        const allCookies = [...cookies, ...bbsCookies, ...devdataCookies]
        const seen = new Set()
        const uniqueCookies = allCookies.filter(c => {
            const key = `${c.name}=${c.value}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
        // 确保 csrf cookie 在列表中（getAll 可能遗漏）
        if (!uniqueCookies.find(c => c.name === 'csrf')) {
            uniqueCookies.push(csrfCookie)
        }
        const cookieStr = uniqueCookies.map(c => `${c.name}=${c.value}`).join('; ')

        const response = await fetch('https://devdata.huaweicloud.com/rest/developer/fwdu/rest/developer/user/hdcommunityservice/v1/member/get-personal-info', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'csrf': csrfCookie.value,
                'Origin': 'https://bbs.huaweicloud.com',
                'Referer': 'https://bbs.huaweicloud.com/',
                'Cookie': cookieStr,
            },
        })

        if (!response.ok) {
            console.log('[COSE] HuaweiCloud: API response not ok', response.status)
            return { loggedIn: false }
        }

        const data = await response.json()
        if (!data || !data.memName) {
            console.log('[COSE] HuaweiCloud: No user data in response')
            return { loggedIn: false }
        }

        const username = data.memAlias || data.memName || ''
        let avatar = data.memPhoto || ''

        if (avatar && avatar.includes('huaweicloud.com')) {
            avatar = await convertAvatarToBase64(avatar, 'https://bbs.huaweicloud.com/')
        }

        return { loggedIn: true, username, avatar }
    } catch (e) {
        console.error('[COSE] HuaweiCloud Detection Error:', e)
        return { loggedIn: false, error: e.message }
    }
}
