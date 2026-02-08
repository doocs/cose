/**
 * Huawei Developer platform detection logic
 * Strategy:
 * 1. Check developer_userinfo cookie for CSRF token
 * 2. Call delegate API with CSRF token to get user info
 */
export async function detectHuaweiDevUser() {
    const platformId = 'huaweidev'
    try {
        const userInfoCookie = await chrome.cookies.get({ url: 'https://developer.huawei.com', name: 'developer_userinfo' })
        if (!userInfoCookie || !userInfoCookie.value) return { loggedIn: false }

        let csrfToken = ''
        try {
            const userInfoData = JSON.parse(decodeURIComponent(userInfoCookie.value))
            csrfToken = userInfoData.csrftoken || ''
        } catch (e) { }

        if (!csrfToken) {
            const csrfCookie = await chrome.cookies.get({ url: 'https://developer.huawei.com', name: 'csrfToken' })
            csrfToken = csrfCookie?.value || ''
        }

        if (!csrfToken) return { loggedIn: true, username: '', avatar: '' }

        const response = await fetch('https://svc-drcn.developer.huawei.com/codeserver/Common/v1/delegate', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json;charset=UTF-8',
                'x-hd-csrf': csrfToken,
            },
            body: JSON.stringify({ svc: 'GOpen.User.getInfo', reqType: 0, reqJson: JSON.stringify({ getNickName: '1' }) })
        })

        const data = await response.json()
        if (data.returnCode === '0' && data.resJson) {
            const userInfo = JSON.parse(data.resJson)
            return {
                loggedIn: true,
                username: userInfo.displayName || userInfo.loginID || '',
                avatar: userInfo.headPictureURL || ''
            }
        } else {
            return { loggedIn: true, username: '', avatar: '' }
        }
    } catch (e) {
        return { loggedIn: false }
    }
}
