// CSDN 平台配置
const CSDNPlatform = {
  id: 'csdn',
  name: 'CSDN',
  icon: 'https://g.csdnimg.cn/static/logo/favicon32.ico',
  url: 'https://blog.csdn.net',
  publishUrl: 'https://editor.csdn.net/md/',
  title: 'CSDN',
  type: 'csdn',
}

// CSDN 登录检测配置
const CSDNLoginConfig = {
  useCookie: true,
  cookieUrl: 'https://blog.csdn.net',
  cookieNames: ['UserName', 'UserNick'],
  getUsernameFromCookie: true,
  usernameCookie: 'UserNick',
  usernameCookieForApi: 'UserName',
  // 头像获取函数 - 从用户页面抓取
  fetchAvatar: async (cookieMap) => {
    const apiUsername = cookieMap['UserName']
    if (!apiUsername) return null
    try {
      const response = await fetch(`https://blog.csdn.net/${apiUsername}`, {
        method: 'GET',
        credentials: 'include'
      })
      const html = await response.text()
      const avatarMatch = html.match(/https:\/\/i-avatar\.csdnimg\.cn\/[^"'\s!]+/i)
      if (avatarMatch) {
        const originalUrl = avatarMatch[0] + '!1'
        return `https://wsrv.nl/?url=${encodeURIComponent(originalUrl)}&w=64&h=64`
      }
    } catch (e) {
      console.log('[COSE] CSDN 获取头像失败:', e.message)
    }
    return null
  },
}

// CSDN 内容填充函数（在页面主世界中执行）
// 此函数会被序列化后注入到页面中执行
function fillCSDNContent(title, markdown, body) {
  const contentToFill = markdown || body || ''

  // 等待元素出现的工具函数
  function waitFor(selector, timeout = 10000) {
    return new Promise((resolve) => {
      const start = Date.now()
      const check = () => {
        const el = document.querySelector(selector)
        if (el) resolve(el)
        else if (Date.now() - start > timeout) resolve(null)
        else setTimeout(check, 200)
      }
      check()
    })
  }

  async function fill() {
    // 填充标题
    const titleInput = await waitFor('.article-bar__title input, input[placeholder*="标题"]')
    if (titleInput && title) {
      titleInput.focus()
      titleInput.value = title
      titleInput.dispatchEvent(new Event('input', { bubbles: true }))
    }

    // 等待编辑器加载
    await new Promise(resolve => setTimeout(resolve, 1000))

    // CSDN 使用 contenteditable 的 PRE 元素
    const editor = document.querySelector('.editor__inner[contenteditable="true"], [contenteditable="true"].markdown-highlighting')

    if (editor) {
      editor.focus()
      // 清空现有内容
      editor.textContent = ''
      // 直接设置文本内容
      editor.textContent = contentToFill
      // 触发 input 事件让编辑器识别变化
      editor.dispatchEvent(new Event('input', { bubbles: true }))
      console.log('[COSE] CSDN contenteditable 填充成功')
      return { success: true, method: 'contenteditable' }
    } else {
      // 降级尝试其他方式
      const cmElement = document.querySelector('.CodeMirror')
      if (cmElement && cmElement.CodeMirror) {
        cmElement.CodeMirror.setValue(contentToFill)
        console.log('[COSE] CSDN CodeMirror 填充成功')
        return { success: true, method: 'CodeMirror' }
      } else {
        console.log('[COSE] CSDN 未找到编辑器元素')
        return { success: false, error: 'Editor not found' }
      }
    }
  }

  return fill()
}

/**
 * CSDN 同步处理器
 * @param {object} tab - Chrome tab 对象
 * @param {object} content - 内容对象 { title, body, markdown }
 * @param {object} helpers - 帮助函数 { chrome, waitForTab, addTabToSyncGroup }
 * @returns {Promise<{success: boolean, message?: string, tabId?: number}>}
 */
async function syncCSDNContent(tab, content, helpers) {
  const { chrome } = helpers

  // 等待页面加载
  await new Promise(resolve => setTimeout(resolve, 2000))

  // 在页面中执行填充脚本
  const result = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: fillCSDNContent,
    args: [content.title, content.markdown, content.body],
    world: 'MAIN',
  })

  const fillResult = result?.[0]?.result
  if (fillResult?.success) {
    return { success: true, message: '已同步到 CSDN', tabId: tab.id }
  } else {
    return { success: false, message: fillResult?.error || '内容填充失败', tabId: tab.id }
  }
}

// 导出
export { CSDNPlatform, CSDNLoginConfig, fillCSDNContent, syncCSDNContent }

