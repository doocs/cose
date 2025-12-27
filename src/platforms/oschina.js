// OSChina 平台配置
const OSChinaPlatform = {
    id: 'oschina',
    name: 'OSChina',
    icon: 'https://wsrv.nl/?url=static.oschina.net/new-osc/img/favicon.ico',
    url: 'https://www.oschina.net',
    publishUrl: 'https://my.oschina.net/blog/write',
    title: '开源中国',
    type: 'oschina',
}

// OSChina 登录检测配置
const OSChinaLoginConfig = {
    useCookie: true,
    cookieUrl: 'https://www.oschina.net',
    cookieNames: ['oscid', 'osc_id'],
    fetchUserInfoFromPage: true,
    userInfoUrl: 'https://www.oschina.net/', // 使用首页获取更全的信息（包括个人主页链接）

    // 解析用户信息逻辑 (供参考/未来集成)
    parseUserInfo: (html) => {
        let username = ''
        let avatar = ''
        let userId = null

        // 提取用户 ID
        const uidMatch = html.match(/href=["']https:\/\/my\.oschina\.net\/u\/(\d+)["']/i) ||
            html.match(/space\.oschina\.net\/u\/(\d+)/i) ||
            html.match(/data-user-id=["'](\d+)["']/i)
        if (uidMatch) {
            userId = uidMatch[1]
        }

        // 提取用户名
        const nameMatch = html.match(/<a[^>]*class="[^"]*user-name[^"]*"[^>]*>([^<]+)<\/a>/i) ||
            html.match(/<span[^>]*class="[^"]*nick[^"]*"[^>]*>([^<]+)<\/span>/i) ||
            html.match(/title="([^"]+)"[^>]*class="[^"]*avatar/i) ||
            html.match(/class="[^"]*avatar[^"]*"[^>]*title="([^"]+)"/i) ||
            html.match(/alt="([^"]+)"[^>]*class="[^"]*avatar/i)
        if (nameMatch) {
            username = nameMatch[1].trim()
        }

        // 提取头像
        const avatarMatch = html.match(/<img[^>]*src="([^"]+)"[^>]*class="[^"]*avatar/i) ||
            html.match(/<img[^>]*class="[^"]*avatar[^"]*"[^>]*src="([^"]+)"/i)
        if (avatarMatch) {
            avatar = avatarMatch[1]
        }

        // 只有 userId 的情况
        if (!username && userId) {
            username = userId
        }

        return { username, avatar, userId }
    }
}

// OSChina 内容填充函数
async function fillOSChinaContent(content, waitFor, setInputValue) {
    const { title, body, markdown } = content
    const contentToFill = markdown || body || ''

    // 填充标题
    const titleInput = await waitFor('input[name="title"], .title input, input[placeholder*="标题"]')
    if (titleInput) {
        setInputValue(titleInput, title)
        console.log('[COSE] OSChina 标题填充成功')
    }

    // 等待 CKEditor 加载
    await new Promise(resolve => setTimeout(resolve, 1500))

    // 尝试通过 CKEditor API 设置内容
    const success = await new Promise(resolve => {
        let count = 0
        const check = () => {
            if (window.CKEDITOR && window.CKEDITOR.instances) {
                const keys = Object.keys(window.CKEDITOR.instances)
                if (keys.length > 0) {
                    window.CKEDITOR.instances[keys[0]].setData(contentToFill)
                    resolve(true)
                    return
                }
            }
            if (++count < 10) {
                setTimeout(check, 500)
            } else {
                resolve(false)
            }
        }
        check()
    })

    if (success) {
        console.log('[COSE] OSChina CKEditor 填充成功')
    } else {
        // 降级：如果 CKEditor 没找到，尝试填充隐藏的 textarea
        const textarea = document.querySelector('textarea[name="content"]') || document.querySelector('#blogContent')
        if (textarea) {
            setInputValue(textarea, contentToFill)
            console.log('[COSE] OSChina textarea 填充成功')
        } else {
            console.log('[COSE] OSChina 未找到编辑器')
        }
    }
}

// 导出
export { OSChinaPlatform, OSChinaLoginConfig, fillOSChinaContent }
