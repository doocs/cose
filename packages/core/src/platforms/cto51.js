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
export { CTO51Platform, fillCTO51Content }
