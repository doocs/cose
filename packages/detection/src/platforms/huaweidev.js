import { convertAvatarToBase64 } from '../utils.js'

/**
 * Huawei Developer platform detection logic
 * Strategy:
 * 1. Check developer_userinfo cookie for login status
 * 2. Find an open developer.huawei.com tab and inject script to extract
 *    avatar (img#avatar-img) and username (span in .avatarArea) from rendered DOM
 * 3. Convert avatar to base64 to bypass CORS/ORB
 */
export async function detectHuaweiDevUser() {
    try {
        const userInfoCookie = await chrome.cookies.get({ url: 'https://developer.huawei.com', name: 'developer_userinfo' })
        if (!userInfoCookie || !userInfoCookie.value) return { loggedIn: false }

        let username = ''
        let avatar = ''

        // Find an open Huawei Developer tab
        const tabs = await chrome.tabs.query({ url: 'https://developer.huawei.com/*' })
        if (tabs.length > 0) {
            const tab = tabs[0]
            try {
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => {
                        const avatarImg = document.getElementById('avatar-img')
                        const avatarSrc = avatarImg ? avatarImg.src : ''
                        let name = ''
                        const area = document.querySelector('.avatarArea')
                        if (area) {
                            const spans = area.querySelectorAll('span')
                            const skip = ['已认证', '我的发布', '我的回复', '我的关注', '我的粉丝',
                                '管理中心', '个人中心', '我的学堂', '我的收藏', '我的活动',
                                '我的工单', '退出登录', '我的']
                            for (const span of spans) {
                                const text = span.textContent.trim()
                                if (text && !/^\d/.test(text) && !/^Lv\s/i.test(text) && !skip.includes(text)) {
                                    name = text
                                    break
                                }
                            }
                        }
                        return { username: name, avatar: avatarSrc }
                    },
                })
                if (results?.[0]?.result) {
                    username = results[0].result.username || ''
                    avatar = results[0].result.avatar || ''
                }
            } catch (e) { }
        }

        if (avatar) {
            avatar = await convertAvatarToBase64(avatar, 'https://developer.huawei.com/')
        }

        return { loggedIn: true, username, avatar }
    } catch (e) {
        return { loggedIn: false }
    }
}
