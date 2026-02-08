/**
 * Huawei Cloud platform detection logic
 * Strategy:
 * 1. Find open Huawei Cloud tab
 * 2. Inject script to call personal info API with CSRF token
 */
export async function detectHuaweiCloudUser() {
    const platformId = 'huaweicloud'
    try {
        let tabs = await chrome.tabs.query({ url: 'https://bbs.huaweicloud.com/*' })
        if (tabs.length === 0) tabs = await chrome.tabs.query({ url: 'https://*.huaweicloud.com/*' })
        if (tabs.length === 0) return { loggedIn: false }

        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: () => {
                    return new Promise((resolve) => {
                        const csrf = document.cookie.match(/csrf=([^;]+)/)?.[1] || ''
                        fetch('https://devdata.huaweicloud.com/rest/developer/fwdu/rest/developer/user/hdcommunityservice/v1/member/get-personal-info', {
                            method: 'GET',
                            credentials: 'include',
                            headers: { 'Accept': 'application/json', 'csrf': csrf }
                        })
                            .then(response => response.ok ? response.json() : null)
                            .then(data => {
                                if (data && data.memName) {
                                    resolve({ memName: data.memName, memAlias: data.memAlias, memPhoto: data.memPhoto })
                                } else {
                                    resolve(null)
                                }
                            })
                            .catch(() => resolve(null))
                    })
                }
            })

            let data = results?.[0]?.result
            if (data && typeof data.then === 'function') data = await data

            if (data && data.memName) {
                return { loggedIn: true, username: data.memAlias || data.memName, avatar: data.memPhoto || '' }
            }
        } catch (e) { }

        return { loggedIn: false }
    } catch (e) {
        return { loggedIn: false }
    }
}
