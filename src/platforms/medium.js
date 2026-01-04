// Medium 平台配置
const MediumPlatform = {
    id: 'medium',
    name: 'Medium',
    icon: 'https://miro.medium.com/v2/resize:fill:32:32/1*sHhtYhaCe2Uc3IU0IgKwIQ.png',
    url: 'https://medium.com',
    publishUrl: 'https://medium.com/new-story',
    title: 'Medium',
    type: 'medium',
}

// Medium 登录检测配置
// Medium 使用 sid 和 uid HttpOnly cookies 进行身份验证
// 登录检测流程：先检查 cookies，然后访问 /me/stats 获取用户名
const MediumLoginConfig = {
    useCookie: true,
    cookieUrl: 'https://medium.com',
    cookieNames: ['sid', 'uid'],
}

/**
 * Medium 内容填充函数
 * 流程：
 * 1. 等待编辑器加载
 * 2. 填充标题到 h3.graf--title
 * 3. 通过 paste 事件填充 HTML 内容到编辑器
 */
async function fillMediumContent(content, waitFor, setInputValue) {
    const { title, body, wechatHtml } = content
    const htmlContent = wechatHtml || body || ''

    console.log('[COSE] Medium 开始同步...')

    // 等待编辑器加载
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 第一步：填充标题
    const titleEl = document.querySelector('h3.graf--title')
    if (titleEl && title) {
        titleEl.focus()
        titleEl.textContent = title
        titleEl.dispatchEvent(new Event('input', { bubbles: true }))
        console.log('[COSE] Medium 标题填充成功')
    }

    // 第二步：填充内容 - 使用 paste 事件
    const contentEl = document.querySelector('p.graf--p')
    if (contentEl && htmlContent) {
        contentEl.focus()

        // 创建 DataTransfer 并设置 HTML 内容
        const dt = new DataTransfer()
        dt.setData('text/html', htmlContent)
        dt.setData('text/plain', htmlContent.replace(/<[^>]*>/g, ''))

        const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: dt
        })

        contentEl.dispatchEvent(pasteEvent)
        console.log('[COSE] Medium 内容填充成功')
    }
}

// 导出
export { MediumPlatform, MediumLoginConfig, fillMediumContent }
