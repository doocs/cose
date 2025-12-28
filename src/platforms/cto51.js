// 51CTO 平台配置
const CTO51Platform = {
    id: 'cto51',
    name: '51CTO',
    icon: 'https://www.google.com/s2/favicons?domain=51cto.com&sz=32',
    url: 'https://blog.51cto.com',
    publishUrl: 'https://blog.51cto.com/blogger/publish',
    title: '51CTO',
    type: 'cto51',
}

// 51CTO 登录检测配置
const CTO51LoginConfig = {
    useCookie: true,
    cookieUrl: 'https://blog.51cto.com',
    cookieNames: ['www51cto', 'uid', 'identity'], // 常见的 51CTO 登录 cookie
    fetchUserInfoFromPage: true,
    userInfoUrl: 'https://blog.51cto.com/',

    // 解析用户信息逻辑
    parseUserInfo: (html) => {
        let username = ''
        let avatar = ''

        // 尝试提取用户 ID (从头像的 data-uid 属性)
        const uidMatch = html.match(/data-uid=["'](\d+)["']/i)
        let userId = uidMatch ? uidMatch[1] : null

        // 尝试提取用户名 (Header 区域 - 针对已登录用户 .user-base)
        // 使用 [\s\S] 代替 . 并且优化对空白字符的处理
        const nameMatch = html.match(/class=["']user-base["'][^>]*>[\s\S]*?<span>\s*([^<]+?)\s*<\/span>/i) ||
            html.match(/class=["']name["'][^>]*>([^<]+)</i) ||
            html.match(/class=["']user-name["'][^>]*>([^<]+)</i)

        if (nameMatch) {
            username = nameMatch[1].trim()
        } else if (userId) {
            // 如果没找到用户名但找到了 ID，使用 ID 作为用户名
            username = `User_${userId}`
        }

        // 尝试提取头像
        // 匹配 .user-base 下的 img，或者直接匹配带有 user-avatar/avatar 类的 img
        const avatarMatch = html.match(/class=["']user-base["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i) ||
            html.match(/class=["']nav-insite-bar-avator["'][^>]*src=["']([^"']+)["']/i) ||
            html.match(/src=["']([^"']+)["'][^>]*class=["']nav-insite-bar-avator["']/i)

        if (avatarMatch) {
            avatar = avatarMatch[1]
            if (avatar.startsWith('//')) {
                avatar = 'https:' + avatar
            }
        }

        return { username, avatar }
    }
}

// 51CTO 内容填充函数
async function fillCTO51Content(content, waitFor, setInputValue) {
    const { title, body, markdown } = content
    const contentToFill = markdown || body || ''

    // 1. 填充标题
    // 51CTO 标题输入框通常是 input#title 或 placeholder="请输入标题"
    const titleInput = await waitFor('#title, input[placeholder*="标题"]')
    if (titleInput) {
        setInputValue(titleInput, title)
        console.log('[COSE] 51CTO 标题填充成功')
    }

    // 2. 等待编辑器加载
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 3. 填充内容
    // 51CTO 有 Markdown 编辑器和富文本编辑器，通常默认 Markdown
    // 尝试寻找 Markdown 编辑器的 textarea 或 CodeMirror
    const editor = document.querySelector('.editormd-markdown-textarea') || // Editor.md
        document.querySelector('#my-editormd-markdown-doc') ||   // 常见 ID
        document.querySelector('.CodeMirror textarea') ||          // CodeMirror 核心
        document.querySelector('textarea[name="content"]')         // 通用 fallback

    if (editor) {
        // 如果是 CodeMirror，通常需要操作 DOM 或使用 setValue
        // 尝试直接设置 value 并触发事件
        editor.focus()
        editor.value = contentToFill
        editor.dispatchEvent(new Event('input', { bubbles: true }))
        editor.dispatchEvent(new Event('change', { bubbles: true }))

        // 如果页面上有 editor.md 的全局实例，尝试调用
        // 这需要在 page context 执行，目前 fillContentOnPage 是在 Main world 执行的，所以可以访问 window
        if (window.editor) {
            try {
                window.editor.setMarkdown(contentToFill)
                console.log('[COSE] 51CTO 通过 window.editor 设置成功')
                return
            } catch (e) {
                console.log('[COSE] 51CTO window.editor 调用失败', e)
            }
        }

        console.log('[COSE] 51CTO textarea 填充尝试完成')
    } else {
        console.log('[COSE] 51CTO 未找到编辑器元素，尝试降级 contenteditable')

        // 可能是富文本模式的 contenteditable
        const contentEditable = document.querySelector('[contenteditable="true"]')
        if (contentEditable) {
            contentEditable.innerHTML = contentToFill.replace(/\n/g, '<br>')
            console.log('[COSE] 51CTO contenteditable 填充成功')
        }
    }
}

// 导出
export { CTO51Platform, CTO51LoginConfig, fillCTO51Content }
