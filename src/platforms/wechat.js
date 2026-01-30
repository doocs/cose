// 微信公众号平台配置
const WechatPlatform = {
  id: 'wechat',
  name: 'WeChat',
  icon: 'https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico',
  url: 'https://mp.weixin.qq.com',
  // 先打开草稿箱，再自动点击新建
  publishUrl: 'https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit_v2&action=edit&isNew=1&type=10',
  title: '微信公众号',
  type: 'wechat',
}

// 微信公众号登录检测配置
const WechatLoginConfig = {
  useCookie: true,
  cookieUrl: 'https://mp.weixin.qq.com',
  cookieNames: ['slave_user', 'slave_sid'],
  // 获取用户信息需要从页面抓取
  fetchUserInfoFromPage: true,
  userInfoUrl: 'https://mp.weixin.qq.com/',
}

// 微信公众号内容填充函数（在页面主世界中执行）
function fillWechatContent(title, htmlBody) {
  // 等待元素出现的工具函数
  const waitForElement = (selector, timeout = 15000) => {
    return new Promise((resolve) => {
      const el = document.querySelector(selector)
      if (el) return resolve(el)

      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector)
        if (el) {
          observer.disconnect()
          resolve(el)
        }
      })
      observer.observe(document.body, { childList: true, subtree: true })

      setTimeout(() => {
        observer.disconnect()
        resolve(document.querySelector(selector))
      }, timeout)
    })
  }

  async function fill() {
    try {
      // 等待编辑器加载完成
      const editor = await waitForElement('.ProseMirror')
      if (!editor) {
        return { success: false, error: '未找到编辑器' }
      }

      // 等待标题输入框
      const titleInput = await waitForElement('#title')

      // 填充标题
      if (titleInput && title) {
        titleInput.focus()
        // 使用 native setter 确保 React/Vue 等框架能检测到变化
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
        if (nativeSetter) {
          nativeSetter.call(titleInput, title)
        } else {
          titleInput.value = title
        }
        titleInput.dispatchEvent(new Event('input', { bubbles: true }))
        titleInput.dispatchEvent(new Event('change', { bubbles: true }))
        console.log('[COSE] 微信标题已填充:', title)
      }

      // 稍等一下让标题生效
      await new Promise(r => setTimeout(r, 300))

      // 填充正文内容
      if (editor && htmlBody) {
        editor.focus()

        // 清空现有占位符内容
        if (editor.textContent.includes('从这里开始写正文')) {
          editor.innerHTML = ''
        }

        // 使用 ClipboardEvent + DataTransfer 注入 HTML
        const dt = new DataTransfer()
        dt.setData('text/html', htmlBody)
        dt.setData('text/plain', htmlBody.replace(/<[^>]*>/g, ''))

        const pasteEvent = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: dt
        })

        editor.dispatchEvent(pasteEvent)
        console.log('[COSE] 微信内容已通过 paste 事件注入')

        // 等待内容渲染
        await new Promise(r => setTimeout(r, 500))

        // 验证内容是否注入成功
        const wordCount = editor.textContent?.length || 0
        if (wordCount === 0) {
          // 备用方案：直接设置 innerHTML
          console.log('[COSE] paste 事件未生效，尝试备用方案')
          editor.innerHTML = htmlBody
          editor.dispatchEvent(new Event('input', { bubbles: true }))
        }

        return { 
          success: true, 
          wordCount: editor.textContent?.length || 0,
          titleFilled: titleInput?.value === title
        }
      }

      return { success: false, error: '内容为空' }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  return fill()
}

// 微信公众号保存草稿函数（在页面主世界中执行）
function saveWechatDraft() {
  const saveDraftBtn = Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent.includes('保存为草稿'))
  if (saveDraftBtn) {
    saveDraftBtn.click()
    console.log('[COSE] 已点击保存为草稿')
    return { success: true }
  }
  return { success: false, error: '未找到保存按钮' }
}

/**
 * 微信公众号同步处理器
 * @param {object} tab - Chrome tab 对象（初始为首页）
 * @param {object} content - 内容对象 { title, body, markdown, wechatHtml }
 * @param {object} helpers - 帮助函数 { chrome, waitForTab, addTabToSyncGroup, PLATFORMS }
 * @returns {Promise<{success: boolean, message?: string, tabId?: number}>}
 */
async function syncWechatContent(tab, content, helpers) {
  const { chrome, waitForTab } = helpers

  // 步骤1：等待首页加载完成
  console.log('[COSE] 微信公众号等待页面加载')
  await waitForTab(tab.id)
  
  // 步骤2：使用 MutationObserver 监听获取 token
  console.log('[COSE] 开始检测 token...')
  const [tokenResult] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      return new Promise((resolve) => {
        // 先检查当前页面是否已有 token
        const checkToken = () => {
          const urlMatch = window.location.href.match(/token=(\d+)/)
          if (urlMatch) return urlMatch[1]
          
          const links = document.querySelectorAll('a[href*="token"]')
          for (const link of links) {
            const match = link.href?.match(/token=(\d+)/)
            if (match) return match[1]
          }
          
          const scripts = document.querySelectorAll('script:not([src])')
          for (const script of scripts) {
            const content = script.textContent
            const match = content.match(/token["']?\s*[:=]\s*["']?(\d+)["']?/i)
            if (match && match[1]) return match[1]
          }
          return null
        }

        const existing = checkToken()
        if (existing) return resolve(existing)

        // 使用 MutationObserver 监听 DOM 变化
        const observer = new MutationObserver(() => {
          const token = checkToken()
          if (token) {
            observer.disconnect()
            resolve(token)
          }
        })
        observer.observe(document.documentElement, { childList: true, subtree: true })

        // 超时保护
        setTimeout(() => {
          observer.disconnect()
          resolve(checkToken())
        }, 10000)
      })
    },
    world: 'MAIN'
  })
  
  const token = tokenResult?.result
  
  if (!token) {
    console.error('[COSE] 无法从页面获取 token')
    return { success: false, message: '无法获取微信公众号 token，请确保已登录', tabId: tab.id }
  }
  
  // 步骤3：跳转到编辑器页面
  const editorUrl = `https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit_v2&action=edit&isNew=1&type=10&token=${token}&lang=zh_CN`
  console.log('[COSE] 获取到 token:', token, '跳转到编辑器')
  
  await chrome.tabs.update(tab.id, { url: editorUrl })
  await waitForTab(tab.id)
  
  // 使用剪贴板 HTML（带完整样式）或降级到 body
  const htmlContent = content.wechatHtml || content.body
  console.log('[COSE] 微信 HTML 内容长度:', htmlContent?.length || 0)

  // 步骤4：使用 MutationObserver 监听编辑器出现
  console.log('[COSE] 正在等待编辑器...')
  const [editorResult] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      return new Promise((resolve) => {
        const existing = document.querySelector('.ProseMirror')
        if (existing) return resolve(true)

        const observer = new MutationObserver(() => {
          if (document.querySelector('.ProseMirror')) {
            observer.disconnect()
            resolve(true)
          }
        })
        observer.observe(document.documentElement, { childList: true, subtree: true })

        setTimeout(() => {
          observer.disconnect()
          resolve(!!document.querySelector('.ProseMirror'))
        }, 15000)
      })
    },
    world: 'MAIN'
  })

  if (!editorResult?.result) {
    console.error('[COSE] 编辑器等待超时')
    return { success: false, message: '编辑器加载超时', tabId: tab.id }
  }

  console.log('[COSE] 编辑器已就绪，开始注入内容...')
  
  // 步骤5：填充内容
  let result
  try {
    result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillWechatContent,
      args: [content.title, htmlContent],
      world: 'MAIN',
    })
  } catch (e) {
    console.error('[COSE] executeScript 执行失败:', e)
    return { success: false, message: '脚本执行失败: ' + e.message, tabId: tab.id }
  }

  const fillResult = result?.[0]?.result
  console.log('[COSE] 微信填充结果:', JSON.stringify(fillResult, null, 2))
  
  if (!fillResult?.success) {
    console.error('[COSE] 微信内容填充失败:', fillResult?.error)
    return { success: false, message: fillResult?.error || '内容填充失败', tabId: tab.id }
  }

  console.log('[COSE] 微信内容填充成功，字数:', fillResult.wordCount)

  // 步骤6：等待内容稳定后，点击保存为草稿按钮
  await new Promise(resolve => setTimeout(resolve, 500))
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: saveWechatDraft,
    world: 'MAIN',
  })

  return { success: true, message: '已同步并保存为草稿', tabId: tab.id }
}

// 导出
export { WechatPlatform, WechatLoginConfig, fillWechatContent, syncWechatContent }

