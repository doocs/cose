import { convertAvatarToBase64 } from '../utils.js'

/**
 * Huawei Developer platform detection logic
 * Strategy:
 * 1. Read developer_userdata cookie via chrome.cookies API
 * 2. Parse csrftoken from cookie
 * 3. Fetch user info via API with csrf header and cookies
 */
export async function detectHuaweiDevUser() {
    try {
        // 检查 developer_userdata cookie 判断是否登录
        // SSO 登录流程可能需要时间设置 cookie，使用重试机制
        let userInfoCookie = null
        const retryDelays = [0, 500, 1000, 2000]
        for (const delay of retryDelays) {
            if (delay > 0) {
                console.log(`[COSE] huaweidev: developer_userdata cookie not found, retrying in ${delay}ms...`)
                await new Promise(resolve => setTimeout(resolve, delay))
            }
            userInfoCookie = await chrome.cookies.get({ url: 'https://developer.huawei.com', name: 'developer_userdata' })
            if (userInfoCookie && userInfoCookie.value) break
        }
        if (!userInfoCookie || !userInfoCookie.value) {
            console.log('[COSE] huaweidev: No developer_userdata cookie found after retries')
            return { loggedIn: false }
        }

        // 从 cookie 中解析 csrftoken
        let csrftoken = ''
        try {
            const cookieData = JSON.parse(decodeURIComponent(userInfoCookie.value))
            csrftoken = cookieData.csrftoken || ''
        } catch (e) {
            console.log(`[COSE] huaweidev: Failed to parse cookie:`, e.message)
        }

        if (!csrftoken) {
            console.log('[COSE] huaweidev: No csrftoken in cookie')
            return { loggedIn: false }
        }

        // 收集 cookies 用于 API 请求
        const cookies = await chrome.cookies.getAll({ domain: '.huawei.com' })
        const devCookies = await chrome.cookies.getAll({ url: 'https://developer.huawei.com' })
        const svcCookies = await chrome.cookies.getAll({ url: 'https://svc-drcn.developer.huawei.com' })
        const allCookies = [...cookies, ...devCookies, ...svcCookies]
        const seen = new Set()
        const uniqueCookies = allCookies.filter(c => {
            const key = `${c.name}=${c.value}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
        const cookieStr = uniqueCookies.map(c => `${c.name}=${c.value}`).join('; ')

        // 生成 x-hd-date（紧凑 ISO 格式：YYYYMMDDTHHmmssZ）
        const d = new Date()
        const pad = (n) => String(n).padStart(2, '0')
        const hdDate = d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z'

        // 通过 API 获取用户信息
        const response = await fetch('https://svc-drcn.developer.huawei.com/codeserver/Common/v1/delegate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'x-hd-csrf': csrftoken,
                'x-hd-date': hdDate,
                'Origin': 'https://developer.huawei.com',
                'Referer': 'https://developer.huawei.com/',
                'Cookie': cookieStr,
            },
            body: JSON.stringify({
                svc: 'GOpen.User.getInfo',
                reqType: 0,
                reqJson: JSON.stringify({ queryRangeFlag: '00000000000001' }),
            }),
        })

        if (!response.ok) {
            console.log('[COSE] huaweidev: API response not ok', response.status)
            return { loggedIn: false }
        }

        const data = await response.json()
        if (!data || data.returnCode !== '0' || !data.resJson) {
            console.log('[COSE] huaweidev: No user data in response')
            return { loggedIn: false }
        }

        const userInfo = JSON.parse(data.resJson)
        const username = userInfo.loginID || userInfo.displayName || ''
        let avatar = userInfo.headPictureURL || ''

        if (avatar) {
            avatar = await convertAvatarToBase64(avatar, 'https://developer.huawei.com/')
        }

        console.log(`[COSE] huaweidev 用户信息:`, username)
        return { loggedIn: true, username, avatar }
    } catch (e) {
        console.error('[COSE] huaweidev Detection Error:', e)
        return { loggedIn: false, error: e.message }
    }
}
