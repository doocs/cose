/**
 * Convert an avatar URL to a base64 data URL to bypass CORS/ORB blocking.
 * The service worker can fetch with a custom Referer header.
 * @param {string} avatarUrl - The original avatar URL
 * @param {string} referer - The Referer header to use for the fetch
 * @returns {Promise<string>} - base64 data URL, or original URL if conversion fails
 */
export async function convertAvatarToBase64(avatarUrl, referer) {
    try {
        const imgResp = await fetch(avatarUrl, {
            headers: { 'Referer': referer }
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
            return `data:${mime};base64,${base64}`
        }
    } catch (e) {
        console.log('[COSE] avatar base64 conversion failed:', e.message)
    }
    return avatarUrl
}

export async function logToStorage(msg, data = null) {
    if (data) {
        console.log(msg, data)
    } else {
        console.log(msg)
    }
}

// 通过 Cookie 检测登录状态
export async function checkLoginByCookie(platformId, config) {
    try {
        // 直接按名称查找 cookie
        const cookieMap = {}
        if (config.cookieNames) {
            for (const name of config.cookieNames) {
                const cookie = await chrome.cookies.get({
                    url: config.cookieUrl || `https://${config.cookieDomain}`,
                    name: name
                })
                if (cookie) {
                    cookieMap[name] = cookie.value
                }
            }
        }

        console.log(`[COSE] ${platformId} 找到的cookies:`, Object.keys(cookieMap))

        const hasLoginCookie = config.cookieNames && config.cookieNames.some(name => cookieMap[name])

        if (!hasLoginCookie) {
            console.log(`[COSE] ${platformId} 未找到登录 cookie`)
            return { loggedIn: false }
        }

        // 自定义 cookie 值检测逻辑（如 InfoQ）
        if (config.customCheck && config.checkCookieValue) {
            console.log(`[COSE] ${platformId} 使用自定义 cookie 检测`)
            const result = config.checkCookieValue(cookieMap)
            console.log(`[COSE] ${platformId} 自定义检测结果:`, result)
            return result
        }

        let username = ''
        let avatar = ''

        // 如果配置了从 cookie 获取用户名
        if (config.getUsernameFromCookie && config.usernameCookie) {
            username = decodeURIComponent(cookieMap[config.usernameCookie] || '')
        }


        // 使用平台配置的 fetchAvatar 回调获取头像
        if (config.fetchAvatar && typeof config.fetchAvatar === 'function') {
            try {
                const fetchedAvatar = await config.fetchAvatar(cookieMap)
                if (fetchedAvatar) {
                    avatar = fetchedAvatar
                    console.log(`[COSE] ${platformId} 找到头像:`, avatar)
                }
            } catch (e) {
                console.log(`[COSE] ${platformId} 获取头像失败:`, e.message)
            }
        }

        return { loggedIn: true, username, avatar }

    } catch (e) {
        console.log(`[COSE] ${platformId} Cookie 检测失败:`, e.message)
        return { loggedIn: false, error: e.message }
    }
}

// 通用 API 检测逻辑
export async function detectByApi(platformId, config) {
    try {
        console.log(`[COSE] ${platformId} 开始 API 检测: ${config.api}`)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000)

        const fetchOptions = {
            method: config.method || 'GET',
            credentials: 'include',
            headers: {
                'Accept': config.isHtml ? 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' : 'application/json',
                'Cache-Control': 'no-cache',
                ...(config.headers || {})
            },
            signal: controller.signal,
        }

        if (config.body) {
            fetchOptions.body = config.body
        }

        const response = await fetch(config.api, fetchOptions)
        clearTimeout(timeoutId)
        console.log(`[COSE] ${platformId} API 响应状态: ${response.status}`)

        let data = null
        if (config.isHtml) {
            // 明确指定为 HTML 响应时，使用 text() 解析
            try { data = await response.text() } catch (e) { data = '' }
        } else {
            // 其他情况尝试 JSON 解析
            try { data = await response.json() } catch (e) { data = null }
        }
        // console.log(`[COSE] ${platformId} API 数据:`, data)

        const loggedIn = config.checkLogin(data)
        // console.log(`[COSE] ${platformId} checkLogin 结果: ${loggedIn}`)
        if (loggedIn && config.getUserInfo) {
            const userInfo = config.getUserInfo(data)
            console.log(`[COSE] ${platformId} 用户信息:`, userInfo)
            return { loggedIn: true, ...userInfo }
        }
        return { loggedIn: !!loggedIn }
    } catch (error) {
        console.log(`[COSE] ${platformId} API 检测失败: ${error.message}`)
        return { loggedIn: false, error: error.message }
    }
}
