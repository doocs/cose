/**
 * Weibo platform detection logic
 * Strategy:
 * 1. Check SUBP/ALF cookies on card.weibo.com
 * 2. Fetch editor page HTML and extract nick/avatar via regex
 */
export async function detectWeiboUser() {
    const platformId = 'weibo'
    try {
        // 检查 card.weibo.com 的 SUBP cookie
        const subpCookie = await chrome.cookies.get({
            url: 'https://card.weibo.com',
            name: 'SUBP'
        })

        // 也检查 ALF cookie
        const alfCookie = await chrome.cookies.get({
            url: 'https://card.weibo.com',
            name: 'ALF'
        })

        if (!subpCookie && !alfCookie) {
            console.log(`[COSE] weibo 未找到登录 cookie，未登录`)
            return { loggedIn: false }
        }

        // 有 cookie，通过 fetch HTML 获取用户信息
        let username = ''
        let avatar = ''

        try {
            // 获取所有相关 cookies 并手动添加到请求
            const weiboCookies = await chrome.cookies.getAll({ domain: '.weibo.com' })
            const cardCookies = await chrome.cookies.getAll({ domain: 'card.weibo.com' })
            const sinaCookies = await chrome.cookies.getAll({ domain: '.sina.com.cn' })
            const allCookies = [...weiboCookies, ...cardCookies, ...sinaCookies]
            const cookieString = allCookies.map(c => `${c.name}=${c.value}`).join('; ')

            const response = await fetch('https://card.weibo.com/article/v5/editor', {
                method: 'GET',
                headers: {
                    'Cookie': cookieString,
                },
                credentials: 'include',
            })
            const html = await response.text()

            // 从 HTML 中提取用户名
            const nickMatch = html.match(/"nick"\s*:\s*"([^"]+)"/)
            if (nickMatch) {
                username = nickMatch[1]
            } else {
                // 深度查找 nick
                const altNickMatch = html.match(/\\"nick\\"\s*:\s*\\"([^\\"]+)\\"/)
                if (altNickMatch) {
                    username = altNickMatch[1]
                }
            }

            // 从 HTML 中提取头像
            const avatarMatch = html.match(/"avatar_large"\s*:\s*"([^"]+)"/)
            if (avatarMatch) {
                avatar = avatarMatch[1].replace(/\\/g, '')
            } else {
                const altAvatarMatch = html.match(/\\"avatar_large\\"\s*:\s*\\"([^\\"]+)\\"/)
                if (altAvatarMatch) {
                    let rawAvatar = altAvatarMatch[1].replace(/\\\\\\\//g, '/')
                    if (rawAvatar.includes('sinaimg.cn')) {
                        avatar = rawAvatar.split('?')[0]
                    } else {
                        avatar = rawAvatar
                    }
                }
            }

            console.log(`[COSE] weibo 用户信息: ${username}`)
        } catch (e) {
            console.log(`[COSE] weibo 获取用户详情失败:`, e.message)
        }

        if (!username) {
            return { loggedIn: false }
        }

        return { loggedIn: true, username, avatar }
    } catch (e) {
        console.log(`[COSE] weibo 检测失败:`, e.message)
        return { loggedIn: false }
    }
}
