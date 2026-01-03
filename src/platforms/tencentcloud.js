// 腾讯云开发者平台配置
const TencentCloudPlatform = {
    id: 'tencentcloud',
    name: 'TencentCloud',
    icon: 'https://cloudcache.tencent-cloud.com/qcloud/favicon.ico',
    url: 'https://cloud.tencent.com/developer',
    publishUrl: 'https://cloud.tencent.com/developer/article/write-new',
    title: '腾讯云开发者社区',
    type: 'tencentcloud',
}

// 腾讯云登录检测配置
const TencentCloudLoginConfig = {
    useCookie: true,
    cookieUrl: 'https://cloud.tencent.com',
    cookieNames: ['qcloud_uid', 'uin'],
}

/**
 * 检查当前是否需要切换到 MD 编辑器
 * 判断依据：页面中是否存在"切换 MD 编辑器"的按钮
 * - 如果存在，说明当前是富文本编辑器，需要切换
 * - 如果不存在（显示"切换 富文本 编辑器"），说明已经是 MD 编辑器
 * @returns {HTMLElement|null} 返回切换按钮元素，如果已经是 MD 编辑器则返回 null
 */
function findSwitchToMDButton() {
    const headerBtns = document.querySelectorAll('.header-btn')
    for (const btn of headerBtns) {
        // 只有当按钮文本包含"MD"时才需要切换（说明当前是富文本编辑器）
        // 如果按钮文本包含"富文本"，说明已经是 MD 编辑器，不需要切换
        if (btn.textContent.includes('切换') && btn.textContent.includes('MD')) {
            return btn
        }
    }
    return null
}

/**
 * 确保编辑器处于 Markdown 模式
 * 1. 检查是否有"切换 MD 编辑器"按钮
 * 2. 如果有，点击切换到 MD 编辑器
 * 3. 如果没有，说明已经是 MD 编辑器
 * @returns {Promise<boolean>} 是否成功进入 MD 编辑器模式
 */
async function ensureMarkdownEditor() {
    // 等待页面加载完成
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const switchBtn = findSwitchToMDButton()
    
    if (switchBtn) {
        // 找到了"切换 MD 编辑器"按钮，说明当前是富文本编辑器，需要切换
        console.log('[COSE] TencentCloud 检测到富文本编辑器，正在切换到 MD 编辑器...')
        switchBtn.click()
        
        // 等待切换完成
        await new Promise(resolve => setTimeout(resolve, 1500))
        
        // 验证切换是否成功：检查 CodeMirror 是否存在
        const cm = document.querySelector('.CodeMirror')
        if (cm && cm.CodeMirror) {
            console.log('[COSE] TencentCloud 成功切换到 MD 编辑器')
            return true
        }
        
        // 如果 CodeMirror 还没加载，再等待一下
        await new Promise(resolve => setTimeout(resolve, 1000))
        const cmRetry = document.querySelector('.CodeMirror')
        if (cmRetry && cmRetry.CodeMirror) {
            console.log('[COSE] TencentCloud 成功切换到 MD 编辑器（延迟加载）')
            return true
        }
        
        console.error('[COSE] TencentCloud 切换失败：CodeMirror 未加载')
        return false
    } else {
        // 没有找到"切换 MD 编辑器"按钮，说明已经是 MD 编辑器
        console.log('[COSE] TencentCloud 当前已是 MD 编辑器')
        
        // 验证 CodeMirror 是否存在
        const cm = document.querySelector('.CodeMirror')
        if (cm && cm.CodeMirror) {
            return true
        }
        
        // 等待 CodeMirror 加载
        await new Promise(resolve => setTimeout(resolve, 1000))
        const cmRetry = document.querySelector('.CodeMirror')
        return !!(cmRetry && cmRetry.CodeMirror)
    }
}

/**
 * 获取 CodeMirror 实例
 * @param {number} maxWait 最大等待时间（毫秒）
 * @returns {Promise<CodeMirror|null>}
 */
async function getCodeMirror(maxWait = 3000) {
    const startTime = Date.now()
    while (Date.now() - startTime < maxWait) {
        const cm = document.querySelector('.CodeMirror')
        if (cm && cm.CodeMirror) {
            return cm.CodeMirror
        }
        await new Promise(resolve => setTimeout(resolve, 200))
    }
    return null
}

/**
 * 腾讯云内容填充函数
 * 流程：
 * 1. 确保进入 MD 编辑器模式
 * 2. 填充标题
 * 3. 填充内容到 CodeMirror
 */
async function fillTencentCloudContent(content, waitFor, setInputValue) {
    const { title, body, markdown } = content
    const contentToFill = markdown || body || ''

    console.log('[COSE] TencentCloud 开始同步...')
    
    // 第一步：确保进入 MD 编辑器模式
    const isMarkdownMode = await ensureMarkdownEditor()
    if (!isMarkdownMode) {
        console.error('[COSE] TencentCloud 错误：无法进入 MD 编辑器模式，请手动切换后重试')
        return
    }

    // 第二步：获取 CodeMirror 实例
    const codeMirror = await getCodeMirror(3000)
    if (!codeMirror) {
        console.error('[COSE] TencentCloud 错误：CodeMirror 未加载，请刷新页面后重试')
        return
    }

    // 第三步：填充标题
    const titleInput = document.querySelector('textarea[placeholder*="标题"]')
    if (titleInput && title) {
        titleInput.focus()
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
        nativeSetter.call(titleInput, title)
        titleInput.dispatchEvent(new Event('input', { bubbles: true }))
        titleInput.dispatchEvent(new Event('change', { bubbles: true }))
        console.log('[COSE] TencentCloud 标题填充成功')
    }

    // 第四步：填充内容到 CodeMirror
    codeMirror.setValue(contentToFill)
    console.log('[COSE] TencentCloud 内容填充成功')
}

// 导出
export { TencentCloudPlatform, TencentCloudLoginConfig, fillTencentCloudContent, ensureMarkdownEditor, getCodeMirror }
