import { convertAvatarToBase64 } from '../utils.js'

/**
 * Huawei Developer platform detection logic
 * Strategy:
 * 1. Check chrome.storage.local cache (1 hour TTL)
 * 2. If cache miss, check developer_userdata cookie
 * 3. Fetch user info via API with manually attached cookies
 */
export async function detectHuaweiDevUser() {
    try {
        // 从 storage 读取缓存的用户信息
        const stored = await chrome.storage.local.get('huaweidev_user')
        const cachedUser = stored.huaweidev_user

        if (cachedUser && cachedUser.loggedIn) {
            const cacheAge = Date.now() - (cachedUser.cachedAt || 0)
            const maxAge = 1 * 60 * 60 * 1000 // 1 hour

            if (cacheAge < maxAge) {
                console.log(`[COSE] huaweidev 从缓存读取用户信息:`, cachedUser.username)
                return {
                    loggedIn: true,
                    username: cachedUser.username || '',
                    avatar: cachedUser.avatar || ''
                }
            } else {
                console.log(`[COSE] huaweidev 缓存已过期`)
                await chrome.storage.local.remove('huaweidev_user')
            }
        }

        // 检查 cookie 判断是否登录
        const userInfoCookie = await chrome.cookies.get({ url: 'https://developer.huawei.com', name: 'developer_userdata' })
        if (!userInfoCookie || !userInfoCookie.value) return { loggedIn: false }

        // 从 cookie 中解析 csrftoken
        let csrftoken = ''
        try {
            const cookieData = JSON.parse(decodeURIComponent(userInfoCookie.value))
            csrftoken = cookieData.csrftoken || ''
        } catch (e) {
            console.log(`[COSE] huaweidev 解析 cookie 失败:`, e.message)
        }

        if (!csrftoken) {
            console.log(`[COSE] huaweidev 已登录（无 csrftoken）`)
            return { loggedIn: true, username: '', avatar: '' }
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
        try {
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

            if (response.ok) {
                const data = await response.json()
                if (data?.returnCode === '0' && data?.resJson) {
                    const userInfo = JSON.parse(data.resJson)
                    const username = userInfo.loginID || userInfo.displayName || ''
                    let avatar = userInfo.headPictureURL || ''

                    if (avatar) {
                        try {
                            // 头像在 hicloud.com 域名，需要附带 cookies 才能访问
                            const hicloudCookies = await chrome.cookies.getAll({ domain: '.hicloud.com' })
                            const avatarCookieStr = hicloudCookies.map(c => `${c.name}=${c.value}`).join('; ')
                            const imgResp = await fetch(avatar, {
                                headers: {
                                    'Referer': 'https://developer.huawei.com/',
                                    ...(avatarCookieStr ? { 'Cookie': avatarCookieStr } : {}),
                                },
                            })
                            if (imgResp.ok) {
                                const blob = await imgResp.blob()
                                const buffer = await blob.arrayBuffer()
                                const bytes = new Uint8Array(buffer)
                                let binary = ''
                                for (let i = 0; i < bytes.length; i++) {
                                    binary += String.fromCharCode(bytes[i])
                                }
                                const base64 = btoa(binary)
                                const mime = blob.type || 'image/jpeg'
                                avatar = `data:${mime};base64,${base64}`
                            }
                        } catch (e) {
                            console.log(`[COSE] huaweidev 头像转换失败:`, e.message)
                        }
                    }

                    // 缓存用户信息
                    await chrome.storage.local.set({
                        huaweidev_user: {
                            loggedIn: true,
                            username,
                            avatar,
                            cachedAt: Date.now()
                        }
                    })

                    console.log(`[COSE] huaweidev 用户信息:`, username)
                    return { loggedIn: true, username, avatar }
                }
            }
        } catch (e) {
            console.log(`[COSE] huaweidev API 获取用户信息失败:`, e.message)
        }

        // cookie 存在即视为已登录，即使 API 调用失败
        console.log(`[COSE] huaweidev 已登录（通过 cookie 检测）`)
        return { loggedIn: true, username: '', avatar: '' }
    } catch (e) {
        console.log(`[COSE] huaweidev 检测失败:`, e.message)
        return { loggedIn: false }
    }
}
