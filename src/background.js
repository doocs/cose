// 平台配置
const PLATFORMS = [
  { id: 'csdn', name: 'CSDN', icon: 'https://g.csdnimg.cn/static/logo/favicon32.ico', url: 'https://blog.csdn.net', publishUrl: 'https://editor.csdn.net/md/' },
  { id: 'juejin', name: 'Juejin', icon: 'https://lf-web-assets.juejin.cn/obj/juejin-web/xitu_juejin_web/static/favicons/favicon-32x32.png', url: 'https://juejin.cn', publishUrl: 'https://juejin.cn/editor/drafts/new' },
  { id: 'wechat', name: 'WeChat', icon: 'https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico', url: 'https://mp.weixin.qq.com', publishUrl: 'https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit_v2&action=edit&isNew=1&type=10' },
  { id: 'zhihu', name: 'Zhihu', icon: 'https://static.zhihu.com/heifetz/favicon.ico', url: 'https://www.zhihu.com', publishUrl: 'https://zhuanlan.zhihu.com/write' },
  { id: 'toutiao', name: 'Toutiao', icon: 'https://sf3-cdn-tos.toutiaostatic.com/obj/eden-cn/uhbfnupkbps/toutiao_favicon.ico', url: 'https://mp.toutiao.com', publishUrl: 'https://mp.toutiao.com/profile_v4/graphic/publish' },
]

// 当前同步任务的 Tab Group ID
let currentSyncGroupId = null

// 获取或创建同步标签组
async function getOrCreateSyncGroup(windowId) {
  // 如果已有 group 且仍然有效，直接返回
  if (currentSyncGroupId !== null) {
    try {
      const groups = await chrome.tabGroups.query({ windowId })
      const existingGroup = groups.find(g => g.id === currentSyncGroupId)
      if (existingGroup) {
        return currentSyncGroupId
      }
    } catch (e) {
      // Group 不存在，需要创建新的
    }
  }
  
  // 创建新的标签组（先创建一个空组是不行的，需要先有 tab）
  currentSyncGroupId = null
  return null
}

// 将标签添加到同步组
async function addTabToSyncGroup(tabId, windowId) {
  try {
    if (currentSyncGroupId === null) {
      // 创建新组
      currentSyncGroupId = await chrome.tabs.group({ tabIds: tabId })
      // 设置组的样式，使用时间戳作为标题
      const now = new Date()
      const timestamp = `${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      await chrome.tabGroups.update(currentSyncGroupId, {
        title: `${timestamp}`,
        color: 'blue',
        collapsed: false,
      })
    } else {
      // 添加到现有组
      await chrome.tabs.group({ tabIds: tabId, groupId: currentSyncGroupId })
    }
  } catch (error) {
    console.error('[COSE] 添加标签到组失败:', error)
  }
}

// 登录检测配置
const LOGIN_CHECK_CONFIG = {
  csdn: {
    useCookie: true,
    cookieUrl: 'https://blog.csdn.net',
    cookieNames: ['UserName', 'UserNick'],
    getUsernameFromCookie: true,
    usernameCookie: 'UserNick',
    usernameCookieForApi: 'UserName',
    // 从用户页面抓取头像
    fetchAvatarFromPage: true,
  },
  juejin: {
    api: 'https://api.juejin.cn/user_api/v1/user/get',
    method: 'GET',
    checkLogin: (response) => response?.err_no === 0 && response?.data?.user_id,
    getUserInfo: (response) => ({
      username: response?.data?.user_name,
      avatar: response?.data?.avatar_large,
    }),
  },
  wechat: {
    useCookie: true,
    cookieUrl: 'https://mp.weixin.qq.com',
    cookieNames: ['slave_user', 'slave_sid'],
    // 获取用户信息需要从页面抓取
    fetchUserInfoFromPage: true,
    userInfoUrl: 'https://mp.weixin.qq.com/',
  },
  zhihu: {
    api: 'https://www.zhihu.com/api/v4/me',
    method: 'GET',
    checkLogin: (response) => response?.id,
    getUserInfo: (response) => ({
      username: response?.name,
      avatar: response?.avatar_url,
    }),
  },
  toutiao: {
    api: 'https://mp.toutiao.com/mp/agw/media/get_media_info',
    method: 'GET',
    checkLogin: (response) => response?.err_no === 0 && response?.data?.media?.display_name,
    getUserInfo: (response) => ({
      username: response?.data?.media?.display_name,
      avatar: response?.data?.media?.https_avatar_url,
    }),
  },
}

// 消息监听
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      const result = await handleMessage(request, sender)
      sendResponse(result)
    } catch (err) {
      console.error('[COSE] 消息处理错误:', err)
      sendResponse({ error: err.message || '未知错误' })
    }
  })()
  return true // 表示异步响应
})

async function handleMessage(request, sender) {
  switch (request.type) {
    case 'GET_PLATFORMS':
      return { platforms: PLATFORMS }
    case 'CHECK_PLATFORM_STATUS':
      return { status: await checkAllPlatforms(request.platforms || PLATFORMS) }
    case 'START_SYNC_BATCH':
      // 开始新的同步批次，重置 tab group
      currentSyncGroupId = null
      return { success: true }
    case 'SYNC_TO_PLATFORM':
      return await syncToPlatform(request.platformId, request.content)
    default:
      return { error: 'Unknown message type' }
  }
}

// 检查所有平台登录状态
async function checkAllPlatforms(platforms) {
  const status = {}
  try {
    const results = await Promise.allSettled(
      platforms.map(async (platform) => {
        try {
          const result = await checkPlatformLogin(platform)
          return { id: platform.id, result }
        } catch (e) {
          return { id: platform.id, result: { loggedIn: false, error: e.message } }
        }
      })
    )
    results.forEach((res) => {
      if (res.status === 'fulfilled' && res.value?.id) {
        status[res.value.id] = res.value.result
      }
    })
  } catch (e) {
    console.error('[COSE] 检查平台状态失败:', e)
  }
  return status
}

// 检查单个平台登录状态
async function checkPlatformLogin(platform) {
  const config = LOGIN_CHECK_CONFIG[platform.id]
  if (!config) {
    return { loggedIn: false, error: '未配置检测' }
  }

  if (config.useCookie) {
    return await checkLoginByCookie(platform.id, config)
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)
    const response = await fetch(config.api, {
      method: config.method || 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    let data = null
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json') || contentType.includes('text/plain')) {
      try { data = await response.json() } catch (e) { data = null }
    }

    const loggedIn = config.checkLogin(data)
    if (loggedIn && config.getUserInfo) {
      const userInfo = config.getUserInfo(data)
      return { loggedIn: true, ...userInfo }
    }
    return { loggedIn: !!loggedIn }
  } catch (error) {
    return { loggedIn: false, error: error.message }
  }
}

// 通过 Cookie 检测登录状态
async function checkLoginByCookie(platformId, config) {
  try {
    // 直接按名称查找 cookie
    const cookieMap = {}
    for (const name of config.cookieNames) {
      const cookie = await chrome.cookies.get({
        url: config.cookieUrl || `https://${config.cookieDomain}`,
        name: name
      })
      if (cookie) {
        cookieMap[name] = cookie.value
      }
    }
    
    console.log(`[COSE] ${platformId} 找到的cookies:`, Object.keys(cookieMap))
    
    const hasLoginCookie = config.cookieNames.some(name => cookieMap[name])
    
    if (!hasLoginCookie) {
      console.log(`[COSE] ${platformId} 未找到登录 cookie`)
      return { loggedIn: false }
    }
    
    let username = ''
    let avatar = ''
    
    // 如果配置了从 cookie 获取用户名
    if (config.getUsernameFromCookie && config.usernameCookie) {
      username = decodeURIComponent(cookieMap[config.usernameCookie] || '')
    }
    
    // 从用户页面抓取头像 (CSDN)
    if (config.fetchAvatarFromPage && config.usernameCookieForApi) {
      const apiUsername = cookieMap[config.usernameCookieForApi]
      if (apiUsername) {
        try {
          const response = await fetch(`https://blog.csdn.net/${apiUsername}`, {
            method: 'GET',
            credentials: 'include'
          })
          const html = await response.text()
          // 从 HTML 中提取头像 URL
          const avatarMatch = html.match(/https:\/\/i-avatar\.csdnimg\.cn\/[^"'\s!]+/i)
          if (avatarMatch) {
            // 使用 wsrv.nl 图片代理解决跨域问题
            const originalUrl = avatarMatch[0] + '!1'
            avatar = `https://wsrv.nl/?url=${encodeURIComponent(originalUrl)}&w=64&h=64`
            console.log(`[COSE] ${platformId} 找到头像:`, avatar)
          }
        } catch (e) {
          console.log(`[COSE] ${platformId} 获取头像失败:`, e.message)
        }
      }
    }
    
    // 从页面抓取用户信息
    if (config.fetchUserInfoFromPage && config.userInfoUrl) {
      try {
        const response = await fetch(config.userInfoUrl, {
          method: 'GET',
          credentials: 'include'
        })
        const html = await response.text()
        
        // 头条号用户信息提取
        if (platformId === 'toutiao') {
          // 尝试从页面中提取用户名
          const nameMatch = html.match(/\"name\"\s*:\s*\"([^"]+)\"/i) ||
                            html.match(/screen_name[\"']?\s*[:=]\s*[\"']([^\"']+)[\"']/i) ||
                            html.match(/<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/span>/i)
          if (nameMatch) {
            username = nameMatch[1]
          }
          // 尝试从页面中提取头像
          const avatarMatch = html.match(/\"avatar_url\"\s*:\s*\"([^"]+)\"/i) ||
                              html.match(/avatar[\"']?\s*[:=]\s*[\"']([^\"']+)[\"']/i)
          if (avatarMatch) {
            avatar = avatarMatch[1].replace(/\\/g, '')
          }
          console.log(`[COSE] ${platformId} 用户信息:`, username, avatar ? '有头像' : '无头像')
        }
        // 微信公众号用户信息提取
        else {
          // 从 HTML 中提取公众号名称
          const nameMatch = html.match(/nick_name\s*[:=]\s*["']([^"']+)["']/i) ||
                            html.match(/<span[^>]*class="nickname"[^>]*>([^<]+)<\/span>/i)
          if (nameMatch) {
            username = nameMatch[1]
          }
          // 从 HTML 中提取头像
          const avatarMatch = html.match(/head_img\s*[:=]\s*["']([^"']+)["']/i) ||
                              html.match(/<img[^>]*class="avatar"[^>]*src="([^"]+)"/i)
          if (avatarMatch) {
            avatar = avatarMatch[1].replace(/\\x26amp;/g, '&').replace(/\\/g, '')
            if (!avatar.startsWith('http')) {
              avatar = 'https://mp.weixin.qq.com' + avatar
            }
          }
          console.log(`[COSE] ${platformId} 用户信息:`, username, avatar ? '有头像' : '无头像')
        }
      } catch (e) {
        console.log(`[COSE] ${platformId} 获取用户信息失败:`, e.message)
      }
    }
    
    console.log(`[COSE] ${platformId} 登录用户:`, username, avatar ? '有头像' : '无头像')
    return { loggedIn: true, username, avatar }
  } catch (error) {
    console.error(`[COSE] ${platformId} cookie检测错误:`, error)
    return { loggedIn: false, error: error.message }
  }
}

// 使用 Debugger API 发送真实的 Ctrl+V 粘贴
async function pasteWithDebugger(tabId) {
  const debuggee = { tabId }
  
  try {
    // 附加调试器
    await chrome.debugger.attach(debuggee, '1.3')
    console.log('[COSE] Debugger attached')
    
    // 发送 Ctrl/Cmd 按下
    await chrome.debugger.sendCommand(debuggee, 'Input.dispatchKeyEvent', {
      type: 'keyDown',
      modifiers: 2, // Ctrl
      windowsVirtualKeyCode: 17,
      code: 'ControlLeft',
      key: 'Control'
    })
    
    // 发送 V 按下（带 Ctrl 修饰符）
    await chrome.debugger.sendCommand(debuggee, 'Input.dispatchKeyEvent', {
      type: 'keyDown',
      modifiers: 2, // Ctrl
      windowsVirtualKeyCode: 86,
      code: 'KeyV',
      key: 'v'
    })
    
    // 发送 V 释放
    await chrome.debugger.sendCommand(debuggee, 'Input.dispatchKeyEvent', {
      type: 'keyUp',
      modifiers: 2,
      windowsVirtualKeyCode: 86,
      code: 'KeyV',
      key: 'v'
    })
    
    // 发送 Ctrl 释放
    await chrome.debugger.sendCommand(debuggee, 'Input.dispatchKeyEvent', {
      type: 'keyUp',
      modifiers: 0,
      windowsVirtualKeyCode: 17,
      code: 'ControlLeft',
      key: 'Control'
    })
    
    console.log('[COSE] Paste command sent via debugger')
    
    // 等待粘贴完成
    await new Promise(resolve => setTimeout(resolve, 1000))
    
  } catch (error) {
    console.error('[COSE] Debugger paste failed:', error)
  } finally {
    // 分离调试器
    try {
      await chrome.debugger.detach(debuggee)
      console.log('[COSE] Debugger detached')
    } catch (e) {
      // 忽略分离错误
    }
  }
}

// 同步到平台
async function syncToPlatform(platformId, content) {
  const platform = PLATFORMS.find(p => p.id === platformId)
  if (!platform || !platform.publishUrl) {
    return { success: false, message: '暂不支持该平台' }
  }

  try {
    let tab
    
    // 微信公众号需要特殊处理：先打开首页获取 token，再跳转到编辑器
    if (platformId === 'wechat') {
      // 先打开首页
      tab = await chrome.tabs.create({ url: 'https://mp.weixin.qq.com/', active: false })
      await addTabToSyncGroup(tab.id, tab.windowId)
      await waitForTab(tab.id)
      
      // 从首页提取 token 并跳转到编辑器
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // 从页面 URL 或 DOM 中提取 token
          const tokenMatch = document.body.innerHTML.match(/token[=:]["']?(\d+)["']?/i)
          return tokenMatch ? tokenMatch[1] : null
        },
      })
      
      const token = result?.result
      if (token) {
        // 跳转到编辑器页面
        const editorUrl = `https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit_v2&action=edit&isNew=1&type=10&token=${token}&lang=zh_CN`
        await chrome.tabs.update(tab.id, { url: editorUrl })
        await waitForTab(tab.id)
      } else {
        console.log('[COSE] 未能获取微信 token，使用默认页面')
      }
    } else if (platformId === 'zhihu') {
      // 知乎：使用导入文档功能上传 md 文件
      tab = await chrome.tabs.create({ url: platform.publishUrl, active: false })
      await addTabToSyncGroup(tab.id, tab.windowId)
      await waitForTab(tab.id)
      
      // 等待页面完全加载
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // 在页面中执行：点击导入文档并上传 md 文件
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (title, markdown) => {
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
          
          async function uploadMarkdown() {
            // 先填充标题
            const titleInput = await waitFor('textarea[placeholder*="标题"]')
            if (titleInput && title) {
              titleInput.focus()
              titleInput.value = title
              titleInput.dispatchEvent(new Event('input', { bubbles: true }))
              console.log('[COSE] 知乎标题填充成功')
            }
            
            // 第一步：点击工具栏的"导入"按钮，打开子菜单
            // 注意：按钮文本可能包含零宽字符，使用 includes 匹配
            const importBtn = Array.from(document.querySelectorAll('button'))
              .find(el => el.innerText.includes('导入') && !el.innerText.includes('导入文档') && !el.innerText.includes('导入链接'))
            
            if (importBtn) {
              importBtn.click()
              console.log('[COSE] 已点击导入按钮')
              
              // 等待子菜单出现
              await new Promise(resolve => setTimeout(resolve, 500))
              
              // 第二步：点击子菜单中的"导入文档"按钮
              const importDocBtn = Array.from(document.querySelectorAll('button'))
                .find(el => el.innerText.includes('导入文档'))
              
              if (importDocBtn) {
                importDocBtn.click()
                console.log('[COSE] 已点击导入文档按钮')
                
                // 等待上传对话框出现
                await new Promise(resolve => setTimeout(resolve, 1000))
                
                // 查找接受 md 文件的输入框
                const fileInput = document.querySelector('input[type="file"][accept*=".md"]')
                if (fileInput) {
                  // 创建 md 文件（使用 text/plain 类型，更通用）
                  const mdContent = markdown || ''
                  const fileName = (title || 'article').replace(/[\\/:*?"<>|]/g, '_') + '.md'
                  const file = new File([mdContent], fileName, { type: 'text/plain' })
                  
                  // 创建 DataTransfer 并设置文件
                  const dt = new DataTransfer()
                  dt.items.add(file)
                  fileInput.files = dt.files
                  
                  // 触发 input 和 change 事件
                  fileInput.dispatchEvent(new Event('input', { bubbles: true }))
                  fileInput.dispatchEvent(new Event('change', { bubbles: true }))
                  console.log('[COSE] 已上传 md 文件:', fileName)
                  
                  // 如果 change 不起作用，尝试拖放方式
                  await new Promise(resolve => setTimeout(resolve, 500))
                  
                  // 查找上传按钮区域并触发拖放
                  const dropZone = document.querySelector('[class*="Modal"]') || document.body
                  const dropEvent = new DragEvent('drop', {
                    bubbles: true,
                    cancelable: true,
                    dataTransfer: dt
                  })
                  dropZone.dispatchEvent(dropEvent)
                  console.log('[COSE] 已触发拖放事件')
                } else {
                  console.log('[COSE] 未找到文件输入框')
                }
              } else {
                console.log('[COSE] 未找到导入文档按钮')
              }
            } else {
              console.log('[COSE] 未找到导入按钮')
            }
          }
          
          uploadMarkdown().catch(console.error)
        },
        args: [content.title, content.markdown],
        world: 'MAIN',
      })
      
      return { success: true, message: '已打开知乎并导入文档', tabId: tab.id }
    } else {
      // 其他平台直接打开发布页面
      tab = await chrome.tabs.create({ url: platform.publishUrl, active: false })
      await addTabToSyncGroup(tab.id, tab.windowId)
      await waitForTab(tab.id)
    }
    
    // 微信公众号：直接注入 HTML 到编辑器
    if (platformId === 'wechat') {
      // 等待页面完全加载
      await new Promise(resolve => setTimeout(resolve, 4000))
      
      // 使用剪贴板 HTML（带完整样式）或降级到 body
      const htmlContent = content.wechatHtml || content.body
      console.log('[COSE] 微信 HTML 内容长度:', htmlContent?.length || 0)
      
      // 直接注入内容到编辑器（同步函数，避免 async 问题）
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (title, htmlBody) => {
          // 填充标题
          const titleInput = document.querySelector('#title')
          if (titleInput && title) {
            titleInput.focus()
            titleInput.value = title
            titleInput.dispatchEvent(new Event('input', { bubbles: true }))
            console.log('[COSE] 标题已填充')
          }
          
          // 找到编辑器
          const editor = document.querySelector('.ProseMirror') || document.querySelector('[contenteditable="true"]')
          if (editor && htmlBody) {
            editor.focus()
            
            // 清空现有占位符内容
            if (editor.textContent.includes('从这里开始写正文')) {
              editor.innerHTML = ''
            }
            
            // 方法：创建 DataTransfer 并触发 paste 事件
            const dt = new DataTransfer()
            dt.setData('text/html', htmlBody)
            dt.setData('text/plain', htmlBody.replace(/<[^>]*>/g, ''))
            
            const pasteEvent = new ClipboardEvent('paste', {
              bubbles: true,
              cancelable: true,
              clipboardData: dt
            })
            
            editor.dispatchEvent(pasteEvent)
            console.log('[COSE] 内容已通过 paste 事件注入')
          }
        },
        args: [content.title, htmlContent],
        world: 'MAIN',
      })
      
      // 等待内容注入完成后，点击保存为草稿按钮
      await new Promise(resolve => setTimeout(resolve, 2000))
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // 查找保存为草稿按钮
          const saveDraftBtn = Array.from(document.querySelectorAll('button'))
            .find(b => b.textContent.includes('保存为草稿'))
          if (saveDraftBtn) {
            saveDraftBtn.click()
            console.log('[COSE] 已点击保存为草稿')
          }
        },
        world: 'MAIN',
      })
      
      return { success: true, message: '已同步并保存为草稿', tabId: tab.id }
    }
    
    // 其他平台使用 scripting API 直接注入填充脚本
    // 使用 MAIN world 才能访问页面的 CodeMirror 实例
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillContentOnPage,
      args: [content, platformId],
      world: 'MAIN',
    })

    return { success: true, message: '已打开发布页面并填充内容', tabId: tab.id }
  } catch (error) {
    return { success: false, message: error.message }
  }
}

// 在目标页面执行的填充函数
function fillContentOnPage(content, platformId) {
  const { title, body, markdown } = content
  
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

  // 设置输入值
  function setInputValue(el, value) {
    if (!el || !value) return
    el.focus()
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      el.value = value
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    } else if (el.contentEditable === 'true') {
      el.innerHTML = value.replace(/\n/g, '<br>')
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }

  // 根据平台填充内容
  async function fill() {
    const host = window.location.hostname
    const contentToFill = markdown || body || ''

    // CSDN
    if (host.includes('csdn.net')) {
      // 填充标题
      const titleInput = await waitFor('.article-bar__title input, input[placeholder*="标题"]')
      setInputValue(titleInput, title)
      
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
      } else {
        // 降级尝试其他方式
        const cmElement = document.querySelector('.CodeMirror')
        if (cmElement && cmElement.CodeMirror) {
          cmElement.CodeMirror.setValue(contentToFill)
          console.log('[COSE] CSDN CodeMirror 填充成功')
        } else {
          console.log('[COSE] CSDN 未找到编辑器元素')
        }
      }
    }
    // 掘金 - 使用 ByteMD (CodeMirror)
    else if (host.includes('juejin.cn')) {
      // 填充标题
      const titleInput = await waitFor('input[placeholder*="标题"]')
      if (titleInput) {
        titleInput.focus()
        titleInput.value = title
        titleInput.dispatchEvent(new Event('input', { bubbles: true }))
      }
      
      // 等待编辑器加载
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // 掘金使用 ByteMD 编辑器（基于 CodeMirror）
      const cmElement = document.querySelector('.CodeMirror')
      if (cmElement && cmElement.CodeMirror) {
        cmElement.CodeMirror.setValue(contentToFill)
        console.log('[COSE] 掘金 CodeMirror 填充成功')
      } else {
        // 降级到 textarea
        const textarea = document.querySelector('.bytemd-body textarea')
        if (textarea) {
          textarea.focus()
          textarea.value = contentToFill
          textarea.dispatchEvent(new Event('input', { bubbles: true }))
          console.log('[COSE] 掘金 textarea 填充成功')
        } else {
          console.log('[COSE] 掘金 未找到编辑器')
        }
      }
    }
    // 微信公众号 - 由 syncToPlatform 单独处理，这里跳过
    else if (host.includes('mp.weixin.qq.com')) {
      console.log('[COSE] 微信公众号由 debugger API 处理')
    }
    // 知乎专栏 - 由 syncToPlatform 单独处理（使用导入文档功能）
    else if (host.includes('zhihu.com')) {
      console.log('[COSE] 知乎由导入文档功能处理')
    }
    // 今日头条
    else if (host.includes('toutiao.com')) {
      // 填充标题 - 头条使用 textarea
      const titleInput = await waitFor('textarea[placeholder*="标题"]')
      if (titleInput) {
        titleInput.focus()
        // 模拟用户输入
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
        nativeSetter.call(titleInput, title)
        titleInput.dispatchEvent(new InputEvent('input', { bubbles: true, data: title, inputType: 'insertText' }))
        titleInput.dispatchEvent(new Event('change', { bubbles: true }))
        titleInput.dispatchEvent(new Event('blur', { bubbles: true }))
        console.log('[COSE] 头条标题填充成功:', title)
      } else {
        console.log('[COSE] 头条未找到标题输入框')
      }
      
      // 等待编辑器加载
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // 头条使用 ProseMirror 富文本编辑器
      const editor = document.querySelector('.ProseMirror')
      if (editor) {
        editor.focus()
        editor.innerHTML = body || contentToFill.replace(/\n/g, '<br>')
        editor.dispatchEvent(new InputEvent('input', { bubbles: true }))
        console.log('[COSE] 头条内容填充成功')
      } else {
        console.log('[COSE] 头条未找到编辑器')
      }
    }
    // 通用处理
    else {
      const titleSelectors = ['input[placeholder*="标题"]', 'input[name="title"]', 'textarea[placeholder*="标题"]']
      for (const sel of titleSelectors) {
        const el = document.querySelector(sel)
        if (el) { setInputValue(el, title); break }
      }
      
      const contentSelectors = ['.CodeMirror', '.ProseMirror', '.ql-editor', '[contenteditable="true"]', 'textarea']
      for (const sel of contentSelectors) {
        const el = document.querySelector(sel)
        if (el) {
          if (el.CodeMirror) {
            el.CodeMirror.setValue(contentToFill)
          } else {
            setInputValue(el, contentToFill)
          }
          break
        }
      }
    }
    
    console.log('[COSE] 内容已填充，请检查并发布')
  }

  fill().catch(console.error)
}

// 等待标签页加载
function waitForTab(tabId, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      chrome.tabs.get(tabId, tab => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else if (tab.status === 'complete') {
          setTimeout(resolve, 1500)
        } else if (Date.now() - start > timeout) {
          reject(new Error('页面加载超时'))
        } else {
          setTimeout(check, 300)
        }
      })
    }
    check()
  })
}

// 安装时初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log('MD 文章同步助手已安装')
})
