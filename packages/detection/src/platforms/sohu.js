/**
 * Sohu (搜狐号) platform detection logic
 * Strategy:
 * 1. Check ppinf cookie on mp.sohu.com
 * 2. Call account list API for nickname/avatar
 */
export async function detectSohuUser() {
    try {
        const ppinfCookie = await chrome.cookies.get({ url: 'https://mp.sohu.com', name: 'ppinf' })
        if (!ppinfCookie || !ppinfCookie.value) return { loggedIn: false }

        try {
            const response = await fetch('https://mp.sohu.com/mpbp/bp/account/list', {
                method: 'GET',
                credentials: 'include',
                headers: { 'Accept': 'application/json' }
            })
            const data = await response.json()
            if (data.success && data.data?.data?.[0]?.accounts?.[0]) {
                const account = data.data.data[0].accounts[0]
                let avatar = account.avatar || ''
                if (avatar.startsWith('//')) avatar = 'https:' + avatar
                return { loggedIn: true, username: account.nickName, avatar }
            } else {
                return { loggedIn: true, username: '', avatar: '' }
            }
        } catch (e) {
            return { loggedIn: true, username: '', avatar: '' }
        }
    } catch (e) { return { loggedIn: false } }
}
