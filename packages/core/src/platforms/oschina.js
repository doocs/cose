// OSChina 平台配置
const OSChinaPlatform = {
    id: 'oschina',
    name: 'OSChina',
    icon: 'https://wsrv.nl/?url=static.oschina.net/new-osc/img/favicon.ico',
    url: 'https://www.oschina.net',
    publishUrl: 'https://my.oschina.net/blog/ai-write',
    title: '开源中国',
    type: 'oschina',
}

// OSChina 内容填充函数 (AI 写作平台 - 切换到 Markdown 编辑器)
async function fillOSChinaContent(content, waitFor, setInputValue) {
    const { title, markdown, body } = content
    const mdContent = markdown || body || ''

    // 1. 切换到 MD 编辑器（如果当前不是）
    const switchText = document.querySelector('.editor-switch-text')
    if (switchText && switchText.textContent.includes('切换到MD编辑器')) {
        const switchBtn = document.querySelector('.editor-switch-btn') || switchText.parentElement
        if (switchBtn) {
            switchBtn.click()
            let confirmBtn = null
            for (let i = 0; i < 20; i++) {
                await new Promise(resolve => setTimeout(resolve, 200))
                confirmBtn = Array.from(document.querySelectorAll('button'))
                    .find(btn => btn.textContent.trim() === '确定切换')
                if (confirmBtn) break
            }
            if (confirmBtn) {
                confirmBtn.click()
                console.log('[COSE] OSChina 已确认切换到MD编辑器')
            }
            await new Promise(resolve => setTimeout(resolve, 2000))
        }
    }

    // 2. 填充标题
    const titleInput = await waitFor('input[placeholder*="标题"]')
    if (titleInput) {
        titleInput.focus()
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
        if (nativeSetter) {
            nativeSetter.call(titleInput, title)
        } else {
            titleInput.value = title
        }
        titleInput.dispatchEvent(new Event('input', { bubbles: true }))
        titleInput.dispatchEvent(new Event('change', { bubbles: true }))
        console.log('[COSE] OSChina 标题填充成功')
    }

    // 3. 填充 Markdown 内容到 textarea
    await new Promise(resolve => setTimeout(resolve, 500))
    let textarea = null
    for (let i = 0; i < 10; i++) {
        textarea = document.querySelector('textarea')
        if (textarea) break
        await new Promise(resolve => setTimeout(resolve, 300))
    }
    if (textarea) {
        textarea.focus()
        const textareaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
        if (textareaSetter) {
            textareaSetter.call(textarea, mdContent)
        } else {
            textarea.value = mdContent
        }
        textarea.dispatchEvent(new Event('input', { bubbles: true }))
        textarea.dispatchEvent(new Event('change', { bubbles: true }))
        console.log('[COSE] OSChina Markdown 内容填充成功')
    } else {
        console.log('[COSE] OSChina 未找到 Markdown textarea')
    }
}

// 导出
export { OSChinaPlatform, fillOSChinaContent }
