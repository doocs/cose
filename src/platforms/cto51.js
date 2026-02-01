// 51CTO 平台配置
const CTO51Platform = {
    id: 'cto51',
    name: '51CTO',
    icon: 'https://blog.51cto.com/favicon.ico',
    url: 'https://blog.51cto.com',
    loginUrl: 'https://home.51cto.com/index/login',
    publishUrl: 'https://blog.51cto.com/blogger/publish',
    title: '51CTO',
    type: 'cto51',
}

// 51CTO 登录检测配置
const CTO51LoginConfig = {
    useCookie: true,
    cookieUrl: 'https://blog.51cto.com',
    cookieNames: ['www51cto', 'identity'], // 移除 uid 避免误判
    fetchUserInfoFromPage: true,
    userInfoUrl: 'https://blog.51cto.com/',

    // 解析用户信息逻辑
    parseUserInfo: (html) => {
        let username = ''
        let avatar = ''
        let loggedIn = true

        // 1. 优先检测明确的未登录信号
        // 检测全局变量 isLogin = 0 (源码中通常是 var isLogin = 0; 或 window.isLogin = 0;)
        if (html.match(/var\s+isLogin\s*=\s*0/) || html.match(/window\.isLogin\s*=\s*0/)) {
            return { loggedIn: false }
        }
        
        // 检测顶部导航栏的 "登录" 链接
        // 匹配 <span class="fl">登录</span> 或单纯的 >登录<
        if (html.match(/<span[^>]*class=["'][^"']*fl[^"']*["'][^>]*>\s*登录\s*<\/span>/) || 
            html.match(/<a[^>]*href=["'][^"']*home\.51cto\.com\/index[^"']*["'][^>]*>[\s\S]*?登录[\s\S]*?<\/a>/)) {
            return { loggedIn: false }
        }

        // 2. 尝试提取用户信息 (仅在未判定为未登录时执行)
        
        // 尝试提取用户名 (Header 区域 - 针对已登录用户)
        // 登录后的下拉菜单通常包含 .user-base 或 .user-name
        const nameMatch = html.match(/class=["']user-base["'][^>]*>[\s\S]*?<span>\s*([^<]+?)\s*<\/span>/i) ||
            html.match(/class=["']user-name["'][^>]*>([^<]+)</i)

        // 3. 尝试提取用户 ID
        // 注意：页面内容中(如文章列表)会有大量 data-uid，必须确保是 header/user 区域的
        // 登录后通常 header 区域的头像或链接会包含当前用户 ID
        // 限制只在 nameMatch 成功（即找到用户名）的情况下，或者特定结构的 header 中查找 ID
        let userId = null
        if (nameMatch) {
             const uidMatch = html.match(/data-uid=["'](\d+)["']/i) // 此时可以稍微放宽，因为已经匹配到用户名区域
             userId = uidMatch ? uidMatch[1] : null
        } else {
            // 如果没找到明确的 header 用户名，但找到了 explicit 的 header 用户结构
            const headerUserMatch = html.match(/class=["']header-user["'][\s\S]*?data-uid=["'](\d+)["']/i)
            if (headerUserMatch) {
                userId = headerUserMatch[1]
            }
        }

        if (nameMatch) {
            username = nameMatch[1].trim()
        } else if (userId) {
            username = `User_${userId}`
        }

        // 4. 双重确认
        // 如果最终没找到用户名也没找到 ID，那肯定是未登录
        if (!username && !userId) {
            return { loggedIn: false }
        }

        // 提取头像
        const avatarMatch = html.match(/class=["']user-base["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i) ||
            html.match(/class=["']nav-insite-bar-avator["'][^>]*src=["']([^"']+)["']/i)

        if (avatarMatch) {
            avatar = avatarMatch[1]
            if (avatar.startsWith('//')) {
                avatar = 'https:' + avatar
            }
        }

        return { username, avatar, loggedIn }
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
