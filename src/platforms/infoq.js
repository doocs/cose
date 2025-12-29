// InfoQ 平台配置
const InfoQPlatform = {
    id: 'infoq',
    name: 'InfoQ',
    icon: 'https://static001.infoq.cn/static/write/img/write-favicon.jpg',
    url: 'https://xie.infoq.cn',
    // InfoQ 需要先调用 API 创建草稿获取 ID，不能直接访问 /draft/write
    publishUrl: 'https://xie.infoq.cn/draft/write', // 这个 URL 仅作为占位，实际会被动态替换
    createDraftApi: 'https://xie.infoq.cn/api/v1/draft/create',
    title: 'InfoQ',
    type: 'infoq',
}

// InfoQ 登录检测配置 - 使用 API 获取用户信息
const InfoQLoginConfig = {
    api: 'https://xie.infoq.cn/public/v1/user/get_user',
    method: 'POST',
    checkLogin: (data) => {
        // API 返回 code: 0 且有用户数据表示已登录
        return data && data.code === 0 && data.data && data.data.nickname
    },
    getUserInfo: (data) => {
        const user = data.data
        return {
            username: user.nickname || 'InfoQ用户',
            avatar: user.avatar || '',
            userId: user.uid || user.id
        }
    }
}

// InfoQ 内容填充函数
async function fillInfoQContent(content, waitFor, setInputValue) {
    const { title, body, markdown } = content
    const contentToFill = markdown || body || ''

    // 填充标题
    const titleInput = await waitFor('input[placeholder*="标题"], .title-input input, input.article-title')
    if (titleInput) {
        setInputValue(titleInput, title)
        console.log('[COSE] InfoQ 标题填充成功')
    }

    // 等待编辑器加载
    await new Promise(resolve => setTimeout(resolve, 1000))

    // InfoQ 使用自定义 Vue 编辑器，通过 readMarkdown 方法填充内容
    const gkEditor = document.querySelector('.gk-editor')
    if (gkEditor && gkEditor.__vue__) {
        const vm = gkEditor.__vue__
        if (typeof vm.readMarkdown === 'function') {
            try {
                vm.readMarkdown(contentToFill)
                console.log('[COSE] InfoQ readMarkdown 填充成功')
                return
            } catch (e) {
                console.log('[COSE] InfoQ readMarkdown 失败:', e.message)
            }
        }
    }

    // 备用方案：尝试 CodeMirror
    const cmElement = document.querySelector('.CodeMirror')
    if (cmElement && cmElement.CodeMirror) {
        cmElement.CodeMirror.setValue(contentToFill)
        console.log('[COSE] InfoQ CodeMirror 填充成功')
        return
    }

    console.log('[COSE] InfoQ 未找到编辑器')
}

// 导出
export { InfoQPlatform, InfoQLoginConfig, fillInfoQContent }
