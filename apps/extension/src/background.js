// 平台配置
import { PLATFORMS, LOGIN_CHECK_CONFIG, SYNC_HANDLERS } from '@cose/core/src/platforms/index.js'
// [DISABLED] import { fillAlipayOpenContent } from '@cose/core/src/platforms/alipayopen.js'

// 点击扩展图标时打开 md.doocs.org
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'https://md.doocs.org' })
})

// 当前同步任务的 Tab Group ID
let currentSyncGroupId = null
// 存储平台用户信息
const PLATFORM_USER_INFO = {}

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
// 登录检测配置由 import 导入

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
    case 'CHECK_PLATFORM_STATUS_PROGRESSIVE':
      // 渐进式检测：每个平台检测完成后立即返回结果
      checkAllPlatformsProgressive(request.platforms || PLATFORMS, sender.tab?.id)
      return { started: true, total: (request.platforms || PLATFORMS).length }
    case 'START_SYNC_BATCH':
      // 开始新的同步批次，重置 tab group
      currentSyncGroupId = null
      return { success: true }
    case 'SYNC_TO_PLATFORM':
      return await syncToPlatform(request.platformId, request.content)
    case 'CACHE_USER_INFO':
      // 缓存用户信息
      if (request.platform === 'xiaohongshu' && request.userInfo) {
        await chrome.storage.local.set({ xiaohongshu_user: request.userInfo })
        console.log('[COSE] 小红书用户信息已缓存:', request.userInfo.username)
      } else if (request.platform === 'alipayopen' && request.userInfo) {
        await chrome.storage.local.set({ alipayopen_user: request.userInfo })
        console.log('[COSE] 支付宝用户信息已缓存:', request.userInfo.username)
      }
      return { success: true }
    default:
      return { error: 'Unknown message type' }
  }
}

// 检查所有平台登录状态
async function checkAllPlatforms(platforms) {
  const status = {}
  try {
    // 过滤掉无效的平台配置
    const validPlatforms = (platforms || []).filter(p => p && p.id)
    const results = await Promise.allSettled(
      validPlatforms.map(async (platform) => {
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

// 渐进式检查所有平台登录状态（每个平台完成后立即返回结果）
async function checkAllPlatformsProgressive(platforms, tabId) {
  const validPlatforms = (platforms || []).filter(p => p && p.id)
  let completed = 0
  const total = validPlatforms.length

  // 并行检查所有平台，每个完成后立即发送结果
  const promises = validPlatforms.map(async (platform) => {
    try {
      const result = await checkPlatformLogin(platform)
      completed++

      // 通过 content script 发送单个平台结果回页面
      if (tabId) {
        try {
          await chrome.tabs.sendMessage(tabId, {
            type: 'PLATFORM_STATUS_UPDATE',
            platformId: platform.id,
            platform: platform,
            result: result,
            completed: completed,
            total: total
          })
        } catch (e) {
          console.log('[COSE] 发送平台状态更新失败:', platform.id, e.message)
        }
      }

      return { id: platform.id, result }
    } catch (e) {
      completed++
      const errorResult = { loggedIn: false, error: e.message }

      if (tabId) {
        try {
          await chrome.tabs.sendMessage(tabId, {
            type: 'PLATFORM_STATUS_UPDATE',
            platformId: platform.id,
            platform: platform,
            result: errorResult,
            completed: completed,
            total: total
          })
        } catch (e2) {
          console.log('[COSE] 发送平台状态更新失败:', platform.id, e2.message)
        }
      }

      return { id: platform.id, result: errorResult }
    }
  })

  // 等待所有完成后发送完成消息
  await Promise.allSettled(promises)

  if (tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'PLATFORM_STATUS_COMPLETE',
        total: total
      })
    } catch (e) {
      console.log('[COSE] 发送完成消息失败:', e.message)
    }
  }
}

// 检查单个平台登录状态
async function checkPlatformLogin(platform) {
  if (!platform || !platform.id) {
    return { loggedIn: false, error: '无效的平台配置' }
  }
  const config = LOGIN_CHECK_CONFIG[platform.id]
  if (!config) {
    return { loggedIn: false, error: '未配置检测' }
  }

  // 支付宝开放平台特殊处理：从 storage 读取缓存的用户信息（由 content script 在访问支付宝时缓存）
  if (platform.id === 'alipayopen') {
    try {
      // 从 storage 读取缓存的用户信息
      const stored = await chrome.storage.local.get('alipayopen_user')
      const cachedUser = stored.alipayopen_user

      if (cachedUser && cachedUser.loggedIn) {
        // 检查缓存是否过期（1小时）
        const cacheAge = Date.now() - (cachedUser.cachedAt || 0)
        const maxAge = 1 * 60 * 60 * 1000 // 1 hour

        if (cacheAge < maxAge) {
          console.log(`[COSE] alipayopen 从缓存读取用户信息:`, cachedUser.username)
          return {
            loggedIn: true,
            username: cachedUser.username || '',
            avatar: cachedUser.avatar || ''
          }
        } else {
          console.log(`[COSE] alipayopen 缓存已过期`)
          // 清除过期缓存
          await chrome.storage.local.remove('alipayopen_user')
        }
      }

      // 尝试从已打开的支付宝页面获取用户信息并缓存
      let tabs = await chrome.tabs.query({ url: 'https://open.alipay.com/*' })
      if (tabs.length === 0) {
        tabs = await chrome.tabs.query({ url: 'https://*.alipay.com/*' })
      }

      if (tabs.length > 0) {
        try {
          // 在已打开的页面上下文中调用 API
          const results = await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: async () => {
              try {
                const response = await fetch('https://developerportal.alipay.com/octopus/service.do', {
                  method: 'POST',
                  credentials: 'include',
                  headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
                  },
                  body: 'data=%5B%7B%7D%5D&serviceName=alipay.open.developerops.forum.user.query',
                })
                if (!response.ok) return null
                return await response.json()
              } catch (e) {
                return null
              }
            }
          })

          const data = results?.[0]?.result
          console.log(`[COSE] alipayopen API 数据:`, data)

          if (data?.stat === 'ok' && data?.data?.isLoginUser === 1) {
            const username = data.data.nickname || ''
            const avatar = data.data.avatar || ''

            // 缓存用户信息
            await chrome.storage.local.set({
              alipayopen_user: {
                loggedIn: true,
                username,
                avatar,
                cachedAt: Date.now()
              }
            })

            console.log(`[COSE] alipayopen 用户信息:`, username, avatar ? '有头像' : '无头像')
            return { loggedIn: true, username, avatar }
          }
        } catch (e) {
          console.log(`[COSE] alipayopen 从页面获取用户信息失败:`, e.message)
        }
      }

      console.log(`[COSE] alipayopen 未检测到登录状态，请先访问支付宝开放平台`)
      return { loggedIn: false }
    } catch (e) {
      console.log(`[COSE] alipayopen 检测失败:`, e.message)
      return { loggedIn: false, error: e.message }
    }
  }

  // 微博特殊处理：通过 cookie 检测登录，通过 fetch HTML 获取用户信息
  if (platform.id === 'weibo') {
    try {
      // 检查 card.weibo.com 的 SUBP cookie
      const subpCookie = await chrome.cookies.get({
        url: 'https://card.weibo.com',
        name: 'SUBP'
      })

      // 也检查 ALF cookie
      const alfCookie = await chrome.cookies.get({
        url: 'https://card.weibo.com',
        name: 'ALF'
      })

      console.log(`[COSE] weibo cookies: SUBP=${!!subpCookie}, ALF=${!!alfCookie}`)

      if (!subpCookie && !alfCookie) {
        console.log(`[COSE] weibo 未找到登录 cookie，未登录`)
        return { loggedIn: false }
      }

      // 有 cookie，通过 fetch HTML 获取用户信息
      let username = ''
      let avatar = ''

      try {
        // 获取所有相关 cookies 并手动添加到请求
        const weiboCookies = await chrome.cookies.getAll({ domain: '.weibo.com' })
        const cardCookies = await chrome.cookies.getAll({ domain: 'card.weibo.com' })
        const sinaCookies = await chrome.cookies.getAll({ domain: '.sina.com.cn' })
        const allCookies = [...weiboCookies, ...cardCookies, ...sinaCookies]
        const cookieString = allCookies.map(c => `${c.name}=${c.value}`).join('; ')

        console.log(`[COSE] weibo 获取到 ${allCookies.length} 个 cookies`)

        const response = await fetch('https://card.weibo.com/article/v5/editor', {
          method: 'GET',
          headers: {
            'Cookie': cookieString,
          },
          credentials: 'include',
        })
        const html = await response.text()

        console.log(`[COSE] weibo HTML 长度:`, html.length)

        // 从 HTML 中提取用户名
        const nickMatch = html.match(/"nick"\s*:\s*"([^"]+)"/)
        if (nickMatch) {
          username = nickMatch[1]
        }

        // 从 HTML 中提取头像
        const avatarMatch = html.match(/"avatar_large"\s*:\s*"([^"]+)"/)
        if (avatarMatch) {
          // 处理转义的 URL 并去掉签名参数
          let rawAvatar = avatarMatch[1].replace(/\\\//g, '/')
          // 去掉 URL 中的查询参数（签名参数有时效性，去掉后仍可访问）
          if (rawAvatar.includes('sinaimg.cn')) {
            avatar = rawAvatar.split('?')[0]
          }
        }

        console.log(`[COSE] weibo 用户信息:`, username, avatar ? '有头像' : '无头像')
      } catch (e) {
        console.log(`[COSE] weibo 获取用户详情失败:`, e.message)
      }

      // 如果没有获取到用户名，说明实际上未登录或登录已过期
      if (!username) {
        console.log(`[COSE] weibo 未获取到用户名，视为未登录`)
        return { loggedIn: false }
      }

      return { loggedIn: true, username, avatar }
    } catch (e) {
      console.log(`[COSE] weibo 检测失败:`, e.message)
      return { loggedIn: false }
    }
  }

  if (config.useCookie) {
    return await checkLoginByCookie(platform.id, config)
  }

  // 小红书特殊处理：直接使用 scripting API 检测登录状态
  if (platform.id === 'xiaohongshu') {
    try {
      // 先检查缓存
      const stored = await chrome.storage.local.get('xiaohongshu_user')
      const cachedUser = stored.xiaohongshu_user

      if (cachedUser && cachedUser.loggedIn) {
        const cacheAge = Date.now() - (cachedUser.cachedAt || 0)
        const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days

        if (cacheAge < maxAge) {
          console.log(`[COSE] xiaohongshu 从缓存读取:`, cachedUser.username)
          return {
            loggedIn: true,
            username: cachedUser.username || '',
            avatar: cachedUser.avatar || ''
          }
        } else {
          await chrome.storage.local.remove('xiaohongshu_user')
        }
      }

      // 缓存无效，尝试在已打开的小红书页面中检测
      const tabs = await chrome.tabs.query({ url: 'https://creator.xiaohongshu.com/*' })
      if (tabs.length > 0) {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: async () => {
            try {
              const response = await fetch('https://creator.xiaohongshu.com/api/galaxy/user/info', {
                method: 'GET',
                credentials: 'include',
                headers: { 'Accept': 'application/json' }
              })

              if (!response.ok) return null

              const data = await response.json()
              if (data?.success === true && data?.code === 0 && data?.data?.userId) {
                return {
                  loggedIn: true,
                  username: data.data.userName || data.data.redId || '',
                  avatar: data.data.userAvatar || '',
                  userId: data.data.userId
                }
              }
              return null
            } catch (e) {
              return null
            }
          }
        })

        const result = results?.[0]?.result
        if (result && result.loggedIn) {
          // 缓存结果
          const userInfo = {
            ...result,
            cachedAt: Date.now()
          }
          await chrome.storage.local.set({ xiaohongshu_user: userInfo })
          console.log(`[COSE] xiaohongshu 检测成功:`, userInfo.username)
          return {
            loggedIn: true,
            username: userInfo.username || '',
            avatar: userInfo.avatar || ''
          }
        }
      }

      console.log(`[COSE] xiaohongshu 未登录，请先访问小红书创作者中心`)
      return { loggedIn: false }
    } catch (e) {
      console.log(`[COSE] xiaohongshu 检测失败:`, e.message)
      return { loggedIn: false }
    }
  }

  // 电子发烧友特殊处理：直接调用 API 检测登录状态
  if (platform.id === 'elecfans') {
    try {
      // 先获取 elecfans 的登录 cookie
      const authCookie = await chrome.cookies.get({
        url: 'https://www.elecfans.com',
        name: 'auth'
      })

      const authWwwCookie = await chrome.cookies.get({
        url: 'https://www.elecfans.com',
        name: 'auth_www'
      })

      console.log(`[COSE] elecfans cookies: auth=${!!authCookie}, auth_www=${!!authWwwCookie}`)

      if (!authCookie && !authWwwCookie) {
        console.log(`[COSE] elecfans 未找到登录 cookie，未登录`)
        return { loggedIn: false }
      }

      // 直接调用 API 获取用户信息
      try {
        const response = await fetch('https://www.elecfans.com/webapi/passport/checklogin?_=' + Date.now(), {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json, text/javascript, */*; q=0.01',
          }
        })

        if (!response.ok) {
          console.log(`[COSE] elecfans API 响应错误:`, response.status)
          return { loggedIn: true, username: '', avatar: '' }
        }

        const data = await response.json()
        console.log(`[COSE] elecfans API 数据:`, data)

        // API 返回格式: {"uid":"6997925","username":"jf_50332692","avatar":"https://..."}
        if (data && data.uid) {
          const username = data.username || ''
          const avatar = data.avatar || ''
          console.log(`[COSE] elecfans 用户信息:`, username, avatar ? '有头像' : '无头像')
          return { loggedIn: true, username, avatar }
        } else {
          // 有 cookie 但 API 返回无用户，仍然认为已登录
          console.log(`[COSE] elecfans API 返回无用户数据，但有 cookie`)
          return { loggedIn: true, username: '', avatar: '' }
        }
      } catch (e) {
        console.log(`[COSE] elecfans API 调用失败:`, e.message)
        // API 失败但有 cookie，仍然认为已登录
        return { loggedIn: true, username: '', avatar: '' }
      }
    } catch (e) {
      console.log(`[COSE] elecfans 检测失败:`, e.message)
      return { loggedIn: false }
    }
  }

  try {
    console.log(`[COSE] ${platform.id} 开始 API 检测:`, config.api)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)
    const response = await fetch(config.api, {
      method: config.method || 'GET',
      credentials: 'include',
      headers: {
        'Accept': config.isHtml ? 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' : 'application/json',
        'Cache-Control': 'no-cache'
      },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    console.log(`[COSE] ${platform.id} API 响应状态:`, response.status)

    let data = null
    const contentType = response.headers.get('content-type') || ''
    if (config.isHtml || contentType.includes('text/html')) {
      try { data = await response.text() } catch (e) { data = '' }
    } else if (contentType.includes('application/json') || contentType.includes('text/plain')) {
      try { data = await response.json() } catch (e) { data = null }
    }
    console.log(`[COSE] ${platform.id} API 数据:`, data)

    const loggedIn = config.checkLogin(data)
    console.log(`[COSE] ${platform.id} checkLogin 结果:`, loggedIn, 'type:', typeof loggedIn)
    if (loggedIn && config.getUserInfo) {
      const userInfo = config.getUserInfo(data)
      console.log(`[COSE] ${platform.id} 用户信息:`, userInfo)
      return { loggedIn: true, ...userInfo }
    }
    return { loggedIn: !!loggedIn }
  } catch (error) {
    console.log(`[COSE] ${platform.id} API 检测失败:`, error.message)
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

    // 自定义 cookie 值检测逻辑（如 InfoQ）
    if (config.customCheck && config.checkCookieValue) {
      console.log(`[COSE] ${platformId} 使用自定义 cookie 检测`)
      const result = config.checkCookieValue(cookieMap)
      console.log(`[COSE] ${platformId} 自定义检测结果:`, result)
      return result
    }

    let username = ''
    let avatar = ''

    // 如果配置了从 cookie 获取用户名
    if (config.getUsernameFromCookie && config.usernameCookie) {
      username = decodeURIComponent(cookieMap[config.usernameCookie] || '')
    }


    // 使用平台配置的 fetchAvatar 回调获取头像
    if (config.fetchAvatar && typeof config.fetchAvatar === 'function') {
      try {
        const fetchedAvatar = await config.fetchAvatar(cookieMap)
        if (fetchedAvatar) {
          avatar = fetchedAvatar
          console.log(`[COSE] ${platformId} 找到头像:`, avatar)
        }
      } catch (e) {
        console.log(`[COSE] ${platformId} 获取头像失败:`, e.message)
      }
    }

    // 百家号特殊处理：通过 API 获取用户信息
    if (platformId === 'baijiahao') {
      try {
        // 百家号的 API 需要从页面获取 token，这里直接请求一个不需要 token 的页面
        // 然后从返回的 HTML 中提取用户信息
        const response = await fetch('https://baijiahao.baidu.com/builder/app/appinfo', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
          }
        })
        const data = await response.json()

        if (data.errno === 0 && data.data?.user?.username) {
          username = data.data.user.username || data.data.user.name
          avatar = data.data.user.avatar || ''
          if (avatar.startsWith('//')) {
            avatar = 'https:' + avatar
          }
          console.log(`[COSE] ${platformId} 用户信息:`, username, avatar ? '有头像' : '无头像')
          return { loggedIn: true, username, avatar }
        } else {
          console.log(`[COSE] ${platformId} API 返回未登录状态`)
          return { loggedIn: false }
        }
      } catch (e) {
        console.log(`[COSE] ${platformId} 获取用户信息失败:`, e.message)
        // 如果 API 失败，但有 BDUSS cookie，仍然认为已登录
        return { loggedIn: true, username: '', avatar: '' }
      }
    }

    // 网易号特殊处理：通过 navinfo.do API 获取用户信息
    if (platformId === 'wangyihao') {
      try {
        const timestamp = Date.now()
        const response = await fetch(`https://mp.163.com/wemedia/navinfo.do?_=${timestamp}`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
          }
        })
        const data = await response.json()

        if (data.code === 1 && data.data?.tname) {
          username = data.data.tname
          avatar = data.data.icon || ''
          console.log(`[COSE] ${platformId} 用户信息:`, username, avatar ? '有头像' : '无头像')
          return { loggedIn: true, username, avatar }
        } else {
          console.log(`[COSE] ${platformId} API 返回未登录状态`)
          return { loggedIn: false }
        }
      } catch (e) {
        console.log(`[COSE] ${platformId} 获取用户信息失败:`, e.message)
        // 如果 API 失败，但有登录 cookie，仍然认为已登录
        return { loggedIn: true, username: '', avatar: '' }
      }
    }

    // 搜狐号特殊处理：通过 API 获取用户信息
    if (platformId === 'sohu') {
      try {
        // 检查 ppinf cookie 判断是否登录
        const ppinfCookie = await chrome.cookies.get({
          url: 'https://mp.sohu.com',
          name: 'ppinf'
        })

        if (!ppinfCookie || !ppinfCookie.value) {
          console.log(`[COSE] ${platformId} 未找到 ppinf cookie，未登录`)
          return { loggedIn: false }
        }

        // 直接调用 API 获取用户信息
        try {
          const response = await fetch('https://mp.sohu.com/mpbp/bp/account/list', {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Accept': 'application/json',
            }
          })
          const data = await response.json()

          if (data.success && data.data?.data?.[0]?.accounts?.[0]) {
            const account = data.data.data[0].accounts[0]
            let avatar = account.avatar || ''
            if (avatar.startsWith('//')) {
              avatar = 'https:' + avatar
            }
            console.log(`[COSE] ${platformId} 用户信息:`, account.nickName, avatar ? '有头像' : '无头像')
            return {
              loggedIn: true,
              username: account.nickName,
              avatar
            }
          } else {
            console.log(`[COSE] ${platformId} API 返回无用户数据`)
            return { loggedIn: true, username: '', avatar: '' }
          }
        } catch (e) {
          console.log(`[COSE] ${platformId} API 调用失败:`, e.message)
          // API 失败但有 cookie，仍然认为已登录
          return { loggedIn: true, username: '', avatar: '' }
        }
      } catch (e) {
        console.log(`[COSE] ${platformId} 获取用户信息失败:`, e.message)
        return { loggedIn: false }
      }
    }

    // 阿里云开发者社区特殊处理：通过 API 获取用户信息
    if (platformId === 'aliyun') {
      try {
        // 检查 login_aliyunid_ticket cookie 判断是否登录
        const ticketCookie = await chrome.cookies.get({
          url: 'https://developer.aliyun.com',
          name: 'login_aliyunid_ticket'
        })

        if (!ticketCookie || !ticketCookie.value) {
          console.log(`[COSE] ${platformId} 未找到 login_aliyunid_ticket cookie，未登录`)
          return { loggedIn: false }
        }

        // 调用 API 获取用户信息
        const response = await fetch('https://developer.aliyun.com/developer/api/my/user/getUser', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
          }
        })
        const data = await response.json()

        if (data.success && data.data?.nickname) {
          const username = data.data.nickname
          const avatar = data.data.avatar || ''
          console.log(`[COSE] ${platformId} 用户信息:`, username, avatar ? '有头像' : '无头像')
          return { loggedIn: true, username, avatar }
        } else {
          console.log(`[COSE] ${platformId} API 返回未登录状态`)
          return { loggedIn: false }
        }
      } catch (e) {
        console.log(`[COSE] ${platformId} 获取用户信息失败:`, e.message)
        return { loggedIn: false }
      }
    }

    // 华为云开发者博客特殊处理
    if (platformId === 'huaweicloud') {
      try {
        // 查找华为云相关页面（优先 bbs，其次其他华为云页面）
        let tabs = await chrome.tabs.query({ url: 'https://bbs.huaweicloud.com/*' })

        if (tabs.length === 0) {
          tabs = await chrome.tabs.query({ url: 'https://*.huaweicloud.com/*' })
        }

        if (tabs.length === 0) {
          console.log(`[COSE] ${platformId} 没有打开的华为云页面`)
          return { loggedIn: false }
        }

        console.log(`[COSE] ${platformId} 使用页面:`, tabs[0].url)

        // 在页面上下文中调用 API（使用同步包装）
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => {
              return new Promise((resolve) => {
                const csrf = document.cookie.match(/csrf=([^;]+)/)?.[1] || ''
                fetch('https://devdata.huaweicloud.com/rest/developer/fwdu/rest/developer/user/hdcommunityservice/v1/member/get-personal-info', {
                  method: 'GET',
                  credentials: 'include',
                  headers: { 'Accept': 'application/json', 'csrf': csrf }
                })
                  .then(response => response.ok ? response.json() : null)
                  .then(data => {
                    if (data && data.memName) {
                      resolve({ memName: data.memName, memAlias: data.memAlias, memPhoto: data.memPhoto })
                    } else {
                      resolve(null)
                    }
                  })
                  .catch(() => resolve(null))
              })
            }
          })

          // executeScript 返回的 result 可能是 Promise，需要 await
          let data = results?.[0]?.result
          if (data && typeof data.then === 'function') {
            data = await data
          }

          if (data && data.memName) {
            console.log(`[COSE] ${platformId} 已登录:`, data.memName)
            return {
              loggedIn: true,
              username: data.memAlias || data.memName,
              avatar: data.memPhoto || ''
            }
          }
          console.log(`[COSE] ${platformId} API 返回:`, data)
        } catch (e) {
          console.log(`[COSE] ${platformId} scripting 失败:`, e.message)
        }

        return { loggedIn: false }
      } catch (e) {
        console.log(`[COSE] ${platformId} 检测失败:`, e.message)
        return { loggedIn: false }
      }
    }

    // 华为开发者文章特殊处理
    if (platformId === 'huaweidev') {
      try {
        // 检查 developer_userinfo cookie
        const userInfoCookie = await chrome.cookies.get({
          url: 'https://developer.huawei.com',
          name: 'developer_userinfo'
        })

        if (!userInfoCookie || !userInfoCookie.value) {
          console.log(`[COSE] ${platformId} 未找到 developer_userinfo cookie，未登录`)
          return { loggedIn: false }
        }

        console.log(`[COSE] ${platformId} 找到 developer_userinfo cookie`)

        // 解析 cookie 获取 csrfToken
        let csrfToken = ''
        try {
          const userInfoData = JSON.parse(decodeURIComponent(userInfoCookie.value))
          csrfToken = userInfoData.csrftoken || ''
        } catch (e) {
          console.log(`[COSE] ${platformId} 解析 cookie 失败:`, e.message)
        }

        // 如果没有 csrfToken，尝试从单独的 cookie 获取
        if (!csrfToken) {
          const csrfCookie = await chrome.cookies.get({
            url: 'https://developer.huawei.com',
            name: 'csrfToken'
          })
          csrfToken = csrfCookie?.value || ''
        }

        if (!csrfToken) {
          console.log(`[COSE] ${platformId} 未找到 csrfToken，返回已登录但无用户信息`)
          return { loggedIn: true, username: '', avatar: '' }
        }

        // 通过 API 获取用户信息
        const now = new Date()
        const hdDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
        const serialNo = Math.floor(Math.random() * 10000000).toString()

        const response = await fetch('https://svc-drcn.developer.huawei.com/codeserver/Common/v1/delegate', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json;charset=UTF-8',
            'x-hd-csrf': csrfToken,
            'x-hd-date': hdDate,
            'x-hd-serialno': serialNo,
            'Origin': 'https://developer.huawei.com',
            'Referer': 'https://developer.huawei.com/'
          },
          body: JSON.stringify({
            svc: 'GOpen.User.getInfo',
            reqType: 0,
            reqJson: JSON.stringify({ getNickName: '1' })
          })
        })

        const data = await response.json()

        if (data.returnCode === '0' && data.resJson) {
          const userInfo = JSON.parse(data.resJson)
          const username = userInfo.displayName || userInfo.loginID || ''
          const avatar = userInfo.headPictureURL || ''
          console.log(`[COSE] ${platformId} 用户信息:`, username, avatar ? '有头像' : '无头像')
          return { loggedIn: true, username, avatar }
        } else {
          console.log(`[COSE] ${platformId} API 返回错误:`, data.returnCode, data.description)
          return { loggedIn: true, username: '', avatar: '' }
        }
      } catch (e) {
        console.log(`[COSE] ${platformId} 检测失败:`, e.message)
        return { loggedIn: false }
      }
    }

    // 少数派特殊处理：通过 /api/v1/user/info/get API 获取用户信息
    // 需要从 cookie 中读取 JWT token 并添加到 Authorization header
    if (platformId === 'sspai') {
      try {
        // 先获取 JWT token
        const jwtCookie = await chrome.cookies.get({
          url: 'https://sspai.com',
          name: 'sspai_jwt_token'
        })

        if (!jwtCookie || !jwtCookie.value) {
          console.log(`[COSE] ${platformId} 未找到 JWT token`)
          return { loggedIn: false }
        }

        const token = jwtCookie.value
        const response = await fetch('https://sspai.com/api/v1/user/info/get', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`,
          }
        })
        const data = await response.json()

        if (data.error === 0 && data.data?.nickname) {
          username = data.data.nickname
          // 少数派 CDN 没有跨域限制，直接使用原始头像 URL
          avatar = data.data.avatar || ''
          console.log(`[COSE] ${platformId} 用户信息:`, username, avatar ? '有头像' : '无头像')
          return { loggedIn: true, username, avatar }
        } else {
          console.log(`[COSE] ${platformId} API 返回未登录状态:`, data.msg || data.error)
          return { loggedIn: false }
        }
      } catch (e) {
        console.log(`[COSE] ${platformId} 获取用户信息失败:`, e.message)
        return { loggedIn: false }
      }
    }

    // 腾讯云开发者社区特殊处理：通过创作中心页面获取用户信息
    if (platformId === 'tencentcloud') {
      try {
        const response = await fetch('https://cloud.tencent.com/developer/creator', {
          method: 'GET',
          credentials: 'include',
        })
        const html = await response.text()
        const finalUrl = response.url

        // 检查是否被重定向到首页（未登录时会重定向）
        if (!finalUrl.includes('/creator')) {
          console.log(`[COSE] ${platformId} 未登录：被重定向到 ${finalUrl}`)
          return { loggedIn: false }
        }

        // 检查页面是否包含登录按钮（未登录标志）
        if (html.includes('登录/注册') || html.includes('"isLogin":false') || html.includes('"login":false')) {
          console.log(`[COSE] ${platformId} 未登录：页面包含登录按钮`)
          return { loggedIn: false }
        }

        // 从创作中心页面提取当前用户信息（通常在页面的用户信息区域）
        // 匹配 "userInfo" 或 "creatorInfo" 等包含当前用户信息的 JSON 对象
        const userInfoMatch = html.match(/"userInfo"\s*:\s*\{[^}]*"nickname"\s*:\s*"([^"]+)"[^}]*\}/) ||
          html.match(/"creatorInfo"\s*:\s*\{[^}]*"nickname"\s*:\s*"([^"]+)"[^}]*\}/) ||
          html.match(/"currentUser"\s*:\s*\{[^}]*"nickname"\s*:\s*"([^"]+)"[^}]*\}/)

        // 备用方案：匹配创作中心特有的用户信息结构
        const creatorNicknameMatch = html.match(/class="creator-info[^"]*"[^>]*>[\s\S]*?<[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)</) ||
          html.match(/"isCreator"\s*:\s*true[\s\S]*?"nickname"\s*:\s*"([^"]+)"/)

        const nicknameMatch = userInfoMatch || creatorNicknameMatch
        const avatarMatch = html.match(/"userInfo"[\s\S]*?"avatarUrl"\s*:\s*"([^"]+)"/) ||
          html.match(/"avatar"\s*:\s*"(https?:\/\/[^"]+)"/)

        if (nicknameMatch && nicknameMatch[1]) {
          username = nicknameMatch[1]
          avatar = avatarMatch ? avatarMatch[1] : ''
          console.log(`[COSE] ${platformId} 用户信息:`, username, avatar ? '有头像' : '无头像')
          return { loggedIn: true, username, avatar }
        } else {
          // 如果在创作中心页面但无法提取用户信息，可能是页面结构变化
          // 检查是否有创作中心特有的元素来确认登录状态
          if (html.includes('创作中心') || html.includes('我的文章') || html.includes('发布文章')) {
            console.log(`[COSE] ${platformId} 已登录但无法提取用户名`)
            return { loggedIn: true, username: '', avatar: '' }
          }
          console.log(`[COSE] ${platformId} 未检测到登录状态`)
          return { loggedIn: false }
        }
      } catch (e) {
        console.log(`[COSE] ${platformId} 获取用户信息失败:`, e.message)
        return { loggedIn: false }
      }
    }

    // Medium 特殊处理：先检查 cookies，再获取用户信息
    if (platformId === 'medium') {
      try {
        // Medium 使用 sid 和 uid cookies 来标识登录状态
        const sidCookie = await chrome.cookies.get({
          url: 'https://medium.com',
          name: 'sid'
        })
        const uidCookie = await chrome.cookies.get({
          url: 'https://medium.com',
          name: 'uid'
        })

        // 如果没有 sid 或 uid cookie，说明未登录
        if (!sidCookie && !uidCookie) {
          console.log(`[COSE] ${platformId} 未找到登录 cookie`)
          return { loggedIn: false }
        }

        console.log(`[COSE] ${platformId} 找到登录 cookie: sid=${!!sidCookie}, uid=${!!uidCookie}`)

        // 尝试获取用户信息
        const response = await fetch('https://medium.com/me/stats', {
          method: 'GET',
          credentials: 'include',
        })
        const html = await response.text()
        const finalUrl = response.url

        // 检查是否被重定向到登录页（未登录标志）
        if (finalUrl.includes('/m/signin') || finalUrl.includes('?signIn') || finalUrl.includes('/m/callback')) {
          console.log(`[COSE] ${platformId} 未登录：被重定向到登录页`)
          return { loggedIn: false }
        }

        // 从页面提取用户名 - 优先使用 JSON 格式
        const profileMatch = html.match(/"username"\s*:\s*"([^"]+)"/) ||
          html.match(/href="https:\/\/medium\.com\/@([^"?\/]+)"/) ||
          html.match(/medium\.com\/@([a-zA-Z0-9_]+)/)

        if (profileMatch && profileMatch[1] && profileMatch[1] !== 'gmail' && profileMatch[1] !== 'medium') {
          username = profileMatch[1]

          // 从页面提取头像 - 查找导航栏用户头像
          // Medium 的用户头像 img 标签的 alt 属性是用户名的简称（如 "fwen"）
          // 格式: <img alt="fwen" src="https://miro.medium.com/v2/resize:fill:64:64/...">
          const shortName = username.replace(/\d+$/, '') // 移除末尾数字，如 fwen925 -> fwen
          const avatarPattern = new RegExp(`<img[^>]*alt="${shortName}"[^>]*src="([^"]+)"`)
          const avatarMatch = html.match(avatarPattern)

          // 备用: src 在 alt 之前
          const avatarPattern2 = new RegExp(`<img[^>]*src="([^"]+)"[^>]*alt="${shortName}"`)
          const avatarMatch2 = html.match(avatarPattern2)

          avatar = (avatarMatch && avatarMatch[1]) || (avatarMatch2 && avatarMatch2[1]) || ''

          console.log(`[COSE] ${platformId} 用户信息:`, username, avatar ? '有头像' : '无头像')
          return { loggedIn: true, username, avatar }
        } else {
          // 有 cookie 但无法提取用户名，仍然认为已登录
          console.log(`[COSE] ${platformId} 已登录但无法提取用户名`)
          return { loggedIn: true, username: '', avatar: '' }
        }
      } catch (e) {
        console.log(`[COSE] ${platformId} 获取用户信息失败:`, e.message)
        return { loggedIn: false }
      }
    }

    // Twitter/X 特殊处理：检查 auth_token 和 ct0 cookies
    if (platformId === 'twitter') {
      try {
        // Twitter 使用 auth_token 和 ct0 cookies 来标识登录状态
        const authTokenCookie = await chrome.cookies.get({
          url: 'https://x.com',
          name: 'auth_token'
        })
        const ct0Cookie = await chrome.cookies.get({
          url: 'https://x.com',
          name: 'ct0'
        })

        // 如果没有 auth_token cookie，说明未登录
        if (!authTokenCookie) {
          console.log(`[COSE] ${platformId} 未找到 auth_token cookie，未登录`)
          return { loggedIn: false }
        }

        console.log(`[COSE] ${platformId} 找到登录 cookie: auth_token=${!!authTokenCookie}, ct0=${!!ct0Cookie}`)

        // 尝试获取用户信息
        let username = ''
        let avatar = ''

        try {
          // 方法1: 从 Twitter 首页 HTML 中提取用户信息
          const response = await fetch('https://x.com/home', {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Accept': 'text/html',
            }
          })

          if (response.ok) {
            const html = await response.text()

            // 从页面脚本中提取 screen_name
            const screenNameMatch = html.match(/"screen_name"\s*:\s*"([^"]+)"/)
            if (screenNameMatch) {
              username = screenNameMatch[1]
            }

            // 从页面脚本中提取头像 URL
            const avatarMatch = html.match(/"profile_image_url_https"\s*:\s*"([^"]+)"/)
            if (avatarMatch) {
              // 将 _normal 替换为 _x96 获取更大的头像
              avatar = avatarMatch[1].replace('_normal.', '_x96.')
            }

            console.log(`[COSE] ${platformId} 用户信息:`, username, avatar ? '有头像' : '无头像')
          }
        } catch (e) {
          console.log(`[COSE] ${platformId} 获取用户信息失败:`, e.message)
        }

        // 有 auth_token cookie 就认为已登录
        return { loggedIn: true, username, avatar }
      } catch (e) {
        console.log(`[COSE] ${platformId} 检测失败:`, e.message)
        return { loggedIn: false }
      }
    }

    // 百度云千帆特殊处理：通过 API 获取用户信息
    if (platformId === 'qianfan') {
      try {
        // 调用千帆社区用户信息 API
        const response = await fetch('https://qianfan.cloud.baidu.com/api/community/user/current', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
          }
        })

        if (!response.ok) {
          console.log(`[COSE] ${platformId} API 请求失败: ${response.status}`)
          return { loggedIn: false }
        }

        const data = await response.json()
        console.log(`[COSE] ${platformId} API 响应:`, data)

        // 检查 API 返回是否成功且有用户信息
        if (data.success && data.result) {
          const username = data.result.displayName || data.result.nickname || ''
          const avatar = data.result.avatar || ''

          console.log(`[COSE] ${platformId} 用户信息: ${username}, ${avatar ? '有头像' : '无头像'}`)
          return { loggedIn: true, username, avatar }
        } else {
          console.log(`[COSE] ${platformId} 未登录或无用户信息`)
          return { loggedIn: false }
        }
      } catch (e) {
        console.log(`[COSE] ${platformId} 检测失败:`, e.message)
        return { loggedIn: false }
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
        // 思否用户信息提取（从 __NEXT_DATA__ 中获取）
        // 注意：思否的 PHPSESSID 即使未登录也存在，必须通过用户信息判断登录状态
        else if (platformId === 'segmentfault') {
          // 从 __NEXT_DATA__ 中提取用户信息
          const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/i)
          if (nextDataMatch) {
            try {
              const nextData = JSON.parse(nextDataMatch[1])
              const sessionUser = nextData?.props?.pageProps?.initialState?.global?.sessionUser?.user
              if (sessionUser && sessionUser.name) {
                username = sessionUser.name
                avatar = sessionUser.avatar_url || ''
              }
            } catch (e) {
              console.log(`[COSE] ${platformId} 解析 NEXT_DATA 失败:`, e.message)
            }
          }
          // 思否：只有成功提取到用户名才算已登录
          if (!username) {
            console.log(`[COSE] ${platformId} 未登录或无法获取用户信息`)
            return { loggedIn: false }
          }
          console.log(`[COSE] ${platformId} 用户信息:`, username, avatar ? '有头像' : '无头像')
        }
        // 微信公众号用户信息提取
        else if (platformId === 'wechat') {
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
        // OSChina 用户信息提取
        else if (platformId === 'oschina') {
          // 提取用户 ID（从个人空间链接）
          const uidMatch = html.match(/href=["']https:\/\/my\.oschina\.net\/u\/(\d+)["']/i) ||
            html.match(/space\.oschina\.net\/u\/(\d+)/i) ||
            html.match(/data-user-id=["'](\d+)["']/i)

          let userId = null
          if (uidMatch) {
            userId = uidMatch[1]
            PLATFORM_USER_INFO['oschina'] = { userId }
            console.log(`[COSE] ${platformId} 获取到 userId:`, userId)
          }

          // 从 HTML 中提取用户名
          const nameMatch = html.match(/<a[^>]*class="[^"]*user-name[^"]*"[^>]*>([^<]+)<\/a>/i) ||
            html.match(/<span[^>]*class="[^"]*nick[^"]*"[^>]*>([^<]+)<\/span>/i) ||
            html.match(/title="([^"]+)"[^>]*class="[^"]*avatar/i) ||
            html.match(/class="[^"]*avatar[^"]*"[^>]*title="([^"]+)"/i) ||
            html.match(/alt="([^"]+)"[^>]*class="[^"]*avatar/i)

          if (nameMatch) {
            username = nameMatch[1].trim()
          }

          // 如果首页没提取到用户名，但有 userId，尝试从个人空间获取
          if (!username && userId) {
            try {
              console.log(`[COSE] ${platformId} 尝试从个人空间获取用户名...`)
              const userPageResp = await fetch(`https://my.oschina.net/u/${userId}`, {
                method: 'GET',
                credentials: 'include'
              })
              const userPageHtml = await userPageResp.text()
              const userPageNameMatch = userPageHtml.match(/<h3[^>]*class="[^"]*header[^"]*"[^>]*>([^<]+)<\/h3>/i) ||
                userPageHtml.match(/<div[^>]*class="[^"]*user-name[^"]*"[^>]*>([^<]+)<\/div>/i) ||
                userPageHtml.match(/<title>([^<]+)的个人空间<\/title>/i)
              if (userPageNameMatch) {
                username = userPageNameMatch[1].trim()
                console.log(`[COSE] ${platformId} 从个人空间获取用户名成功:`, username)
              }
            } catch (err) {
              console.error(`[COSE] ${platformId} 获取个人空间失败:`, err)
            }
          }

          // 如果还是没有用户名，但有 userId，使用 userId 作为兜底
          if (!username && userId) {
            username = userId
          }

          // 头像提取
          const avatarMatch = html.match(/<img[^>]*src="([^"]+)"[^>]*class="[^"]*avatar/i) ||
            html.match(/<img[^>]*class="[^"]*avatar[^"]*"[^>]*src="([^"]+)"/i)
          if (avatarMatch) {
            avatar = avatarMatch[1]
          }

          console.log(`[COSE] ${platformId} 用户信息:`, username, avatar ? '有头像' : '无头像')
        }
        // 通用模块化解析逻辑 (支持 51CTO 等新平台)
        else if (config.parseUserInfo) {
          console.log(`[COSE] ${platformId} 使用通用解析逻辑`)
          const info = config.parseUserInfo(html)
          if (info) {
            // 允许解析函数显式返回未登录状态
            if (info.loggedIn === false) {
              console.log(`[COSE] ${platformId} 解析结果判定为未登录`)
              return { loggedIn: false }
            }
            if (info.username) username = info.username
            if (info.avatar) avatar = info.avatar
            // 如果解析出了 userId，保存到全局存储
            if (info.userId && typeof PLATFORM_USER_INFO !== 'undefined') {
              PLATFORM_USER_INFO[platformId] = { userId: info.userId }
              console.log(`[COSE] ${platformId} 获取到 userId:`, info.userId)
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
  const platform = PLATFORMS.find(p => p && p.id === platformId)
  if (!platform || !platform.publishUrl) {
    return { success: false, message: '暂不支持该平台' }
  }

  try {
    let tab

    // 检查是否有平台特定的同步处理器
    const syncHandler = SYNC_HANDLERS[platformId]
    if (syncHandler) {
      console.log(`[COSE] 使用 ${platformId} 平台特定同步处理器`)
      // 创建新标签页（对于微信等需要特殊处理的平台，使用首页）
      const initialUrl = platformId === 'wechat' ? 'https://mp.weixin.qq.com/' : platform.publishUrl
      tab = await chrome.tabs.create({ url: initialUrl, active: false })
      await addTabToSyncGroup(tab.id, tab.windowId)

      // 调用平台特定处理器
      const helpers = {
        chrome,
        waitForTab,
        addTabToSyncGroup,
        PLATFORMS,
      }
      return await syncHandler(tab, content, helpers)
    }

    // ==== 以下是原有的平台特定逻辑（待迁移）====

    if (platformId === 'infoq') {
      // InfoQ：需要先调用 API 创建草稿获取 ID，不能直接访问 /draft/write
      try {
        // 调用创建草稿 API
        const response = await fetch('https://xie.infoq.cn/api/v1/draft/create', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }
        })
        const data = await response.json()

        if (data.code === 0 && data.data?.id) {
          const draftId = data.data.id
          const targetUrl = `https://xie.infoq.cn/draft/${draftId}`
          console.log('[COSE] InfoQ 创建草稿成功，ID:', draftId)

          tab = await chrome.tabs.create({ url: targetUrl, active: false })
          await addTabToSyncGroup(tab.id, tab.windowId)
          await waitForTab(tab.id)
        } else {
          console.error('[COSE] InfoQ 创建草稿失败:', data)
          return { success: false, message: 'InfoQ 创建草稿失败，请确保已登录' }
        }
      } catch (e) {
        console.error('[COSE] InfoQ API 调用失败:', e)
        return { success: false, message: 'InfoQ API 调用失败: ' + e.message }
      }
    } else if (platformId === 'jianshu') {
      // 简书：需要先获取文集列表，然后创建新文章
      try {
        // 获取用户的文集列表
        const notebooksResp = await fetch('https://www.jianshu.com/author/notebooks', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
          }
        })
        const notebooks = await notebooksResp.json()

        if (!notebooks || notebooks.length === 0) {
          return { success: false, message: '简书未找到文集，请先创建一个文集' }
        }

        // 使用第一个文集
        const notebookId = notebooks[0].id
        console.log('[COSE] 简书使用文集:', notebooks[0].name, 'ID:', notebookId)

        // 创建新文章
        const createResp = await fetch('https://www.jianshu.com/author/notes', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            notebook_id: String(notebookId),
            title: content.title || '无标题',
            at_bottom: false
          })
        })
        const noteData = await createResp.json()

        if (noteData && noteData.id) {
          const noteId = noteData.id
          const targetUrl = `https://www.jianshu.com/writer#/notebooks/${notebookId}/notes/${noteId}`
          console.log('[COSE] 简书创建文章成功，ID:', noteId)

          tab = await chrome.tabs.create({ url: targetUrl, active: false })
          await addTabToSyncGroup(tab.id, tab.windowId)
          await waitForTab(tab.id)
        } else {
          console.error('[COSE] 简书创建文章失败:', noteData)
          return { success: false, message: '简书创建文章失败，请确保已登录' }
        }
      } catch (e) {
        console.error('[COSE] 简书 API 调用失败:', e)
        return { success: false, message: '简书 API 调用失败: ' + e.message }
      }
    } else if (platformId === 'xiaohongshu') {
      // 小红书：需要先点击"新的创作"按钮，等待编辑器加载后填充
      console.log('[COSE] 开始处理小红书同步...')

      // 打开发布页面
      tab = await chrome.tabs.create({ url: platform.publishUrl, active: false })
      await addTabToSyncGroup(tab.id, tab.windowId)
      await waitForTab(tab.id)

      // 等待页面加载完成
      await new Promise(resolve => setTimeout(resolve, 3000))

      // 在页面中执行：点击"新的创作"并等待编辑器加载
      const clickResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async () => {
          const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

          // 查找"新的创作"按钮
          const createBtn = Array.from(document.querySelectorAll('button'))
            .find(el => el.textContent.includes('新的创作'))

          if (createBtn) {
            createBtn.click()
            console.log('[COSE] 小红书已点击"新的创作"按钮')

            // 等待编辑器加载（等待富文本编辑器出现）
            const waitForEditor = async (timeout = 10000) => {
              const start = Date.now()
              while (Date.now() - start < timeout) {
                // 查找编辑器元素，可能是 contenteditable 或 textarea
                const editor = document.querySelector('[contenteditable="true"]') ||
                  document.querySelector('textarea') ||
                  document.querySelector('.editor') ||
                  document.querySelector('.content-editor')
                if (editor) return true
                await sleep(200)
              }
              return false
            }

            const editorLoaded = await waitForEditor()
            return { success: editorLoaded, message: editorLoaded ? 'Editor loaded' : 'Editor timeout' }
          }

          return { success: false, message: 'Create button not found' }
        }
      })

      if (!clickResult[0]?.result?.success) {
        return { success: false, message: '小红书创建文章失败: ' + (clickResult[0]?.result?.message || '未知错误') }
      }

      // 等待页面稳定
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 使用剪贴板 HTML（带完整样式）或降级到 body
      const htmlContent = content.wechatHtml || content.body
      console.log('[COSE] 小红书 HTML 内容长度:', htmlContent?.length || 0)

      // 填充标题和内容
      const fillResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async (title, htmlBody) => {
          const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

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

          try {
            console.log('[COSE] 小红书开始填充内容...')

            // 等待并查找标题输入框
            const titleInput = await waitForElement('input[placeholder*="标题"], textarea[placeholder*="标题"], .title-input', 5000)
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
              console.log('[COSE] 小红书标题已填充:', title)
            }

            // 稍等一下让标题生效
            await new Promise(r => setTimeout(r, 300))

            // 等待并查找内容编辑器
            const contentEditor = await waitForElement('[contenteditable="true"], .editor-content, .content-editor', 5000)
            if (contentEditor && htmlBody) {
              contentEditor.focus()

              // 清空现有占位符内容
              if (contentEditor.textContent.includes('从这里开始写正文') ||
                contentEditor.textContent.includes('请输入正文') ||
                contentEditor.textContent.includes('写点什么')) {
                contentEditor.innerHTML = ''
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

              contentEditor.dispatchEvent(pasteEvent)
              console.log('[COSE] 小红书内容已通过 paste 事件注入')

              // 等待内容渲染
              await new Promise(r => setTimeout(r, 500))

              // 验证内容是否注入成功
              const wordCount = contentEditor.textContent?.length || 0
              if (wordCount === 0) {
                // 备用方案：直接设置 innerHTML
                console.log('[COSE] paste 事件未生效，尝试备用方案')
                contentEditor.innerHTML = htmlBody
              }

              return { success: true, method: 'paste-html', length: htmlBody.length }
            }

            return { success: false, error: 'Content editor not found' }
          } catch (e) {
            console.error('[COSE] 小红书同步失败:', e)
            return { success: false, error: e.message }
          }
        },
        args: [content.title, htmlContent],
        world: 'MAIN',
      })

      console.log('[COSE] 小红书填充结果:', fillResult[0]?.result)

      // 等待内容注入完成
      await new Promise(resolve => setTimeout(resolve, 1000))

      return { success: true, message: '已同步到小红书', tabId: tab.id }
    } else if (platformId === 'twitter') {
      // Twitter Articles：需要先打开草稿列表页，然后点击 create 按钮创建新文章
      // 注意：Twitter 使用 Page Visibility API，后台标签页不会渲染编辑器
      // 解决方案：短暂激活 Tab，等编辑器加载后切回原 Tab

      // 记录当前活动的 Tab
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true })

      // 第一步：打开草稿列表页（激活状态，触发编辑器渲染）
      tab = await chrome.tabs.create({ url: platform.publishUrl, active: true })
      await addTabToSyncGroup(tab.id, tab.windowId)
      await waitForTab(tab.id)

      // 等待页面加载
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 第二步：点击 create 按钮并等待编辑器加载完成
      const clickResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async () => {
          const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

          // 查找 create 按钮
          const createBtn = document.querySelector('button[aria-label="create"]') ||
            Array.from(document.querySelectorAll('button')).find(b =>
              b.getAttribute('aria-label')?.toLowerCase() === 'create'
            )

          if (createBtn) {
            createBtn.click()
            console.log('[COSE] Twitter Articles 已点击 create 按钮')

            // 等待编辑器加载（等待标题输入框出现）
            const waitForEditor = async (timeout = 10000) => {
              const start = Date.now()
              while (Date.now() - start < timeout) {
                const titleInput = document.querySelector('textarea[placeholder="Add a title"]')
                if (titleInput) return true
                await sleep(200)
              }
              return false
            }

            const editorLoaded = await waitForEditor()
            return { success: editorLoaded, message: editorLoaded ? 'Editor loaded' : 'Editor timeout' }
          }

          return { success: false, message: 'Create button not found' }
        },
        world: 'MAIN',
      })

      console.log('[COSE] Twitter Articles create 结果:', clickResult[0]?.result)

      // 编辑器加载完成后，切回原 Tab
      if (currentTab?.id) {
        try {
          await chrome.tabs.update(currentTab.id, { active: true })
          console.log('[COSE] Twitter 已切回原 Tab')
        } catch (e) {
          // 原 Tab 可能已关闭，忽略
        }
      }

      if (!clickResult[0]?.result?.success) {
        return { success: false, message: 'Twitter Articles 创建文章失败: ' + (clickResult[0]?.result?.message || '未知错误') }
      }

      // 等待页面稳定
      await new Promise(resolve => setTimeout(resolve, 500))

      // 使用 Markdown 内容
      const markdownContent = content.markdown || content.body || ''
      console.log('[COSE] Twitter Articles Markdown 内容长度:', markdownContent?.length || 0)

      // 第三步：填充标题和内容
      const fillResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async (title, markdown) => {
          // ========== 工具函数 ==========
          const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

          const waitForElement = async (selector, timeout = 10000) => {
            const start = Date.now()
            while (Date.now() - start < timeout) {
              const el = document.querySelector(selector)
              if (el) return el
              await sleep(200)
            }
            return null
          }



          // ========== 内置 Markdown 解析器（支持代码块和公式）==========
          // 使用占位符保护机制，避免正则冲突
          // 代码块使用样式化 HTML，公式使用 CodeCogs API 渲染为图片
          function parseMarkdownToHtml(md) {
            if (!md) return ''

            // 存储需要保护的内容
            const codeBlocks = []
            const inlineCodes = []
            const blockFormulas = []
            const inlineFormulas = []

            let html = md

            // ========== 第一阶段：提取并保护特殊内容 ==========

            // 1. 提取代码块 ```...```
            html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
              const index = codeBlocks.length
              codeBlocks.push({ lang: lang || '', code: code })
              return `__CODE_BLOCK_${index}__`
            })

            // 2. 提取行内代码 `...`
            html = html.replace(/`([^`\n]+)`/g, (match, code) => {
              const index = inlineCodes.length
              inlineCodes.push(code)
              return `__INLINE_CODE_${index}__`
            })

            // 3. 提取块级公式 $$...$$
            html = html.replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => {
              const index = blockFormulas.length
              blockFormulas.push(formula.trim())
              return `__BLOCK_FORMULA_${index}__`
            })

            // 4. 提取行内公式 $...$
            html = html.replace(/\$([^\$\n]+)\$/g, (match, formula) => {
              const index = inlineFormulas.length
              inlineFormulas.push(formula.trim())
              return `__INLINE_FORMULA_${index}__`
            })

            // ========== 第二阶段：处理标准 Markdown 语法 ==========

            // 处理标题
            html = html.replace(/^#### (.+)$/gm, '<h3>$1</h3>')
            html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
            html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
            html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')

            // 处理引用块
            html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')

            // 处理水平分割线
            html = html.replace(/^---$/gm, '<hr />')
            html = html.replace(/^\*\*\*$/gm, '<hr />')

            // 处理图片
            html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width: 100%;" />')

            // 处理链接
            html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')

            // 处理粗体、斜体、删除线
            html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')
            html = html.replace(/~~([^~]+)~~/g, '<s>$1</s>')

            // ========== 第三阶段：恢复保护的内容 ==========

            // 恢复代码块（使用样式化的 pre/code）
            codeBlocks.forEach((block, index) => {
              const escapedCode = block.code
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;')

              const langLabel = block.lang ? `<div style="background: #e1e4e8; padding: 4px 12px; font-size: 12px; color: #586069; border-radius: 6px 6px 0 0;">${block.lang}</div>` : ''
              const codeHtml = `<div style="margin: 16px 0;">${langLabel}<pre style="background: #f6f8fa; padding: 16px; border-radius: ${block.lang ? '0 0 6px 6px' : '6px'}; overflow-x: auto; font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 14px; line-height: 1.45; margin: 0; white-space: pre-wrap; word-wrap: break-word;"><code>${escapedCode}</code></pre></div>`

              html = html.replace(`__CODE_BLOCK_${index}__`, codeHtml)
            })

            // 恢复行内代码
            inlineCodes.forEach((code, index) => {
              const escapedCode = code
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
              const codeHtml = `<code style="background: #f6f8fa; padding: 2px 6px; border-radius: 3px; font-family: 'SF Mono', Consolas, monospace; font-size: 0.9em;">${escapedCode}</code>`

              html = html.replace(`__INLINE_CODE_${index}__`, codeHtml)
            })

            // 恢复块级公式（使用 CodeCogs API 渲染为图片）
            blockFormulas.forEach((formula, index) => {
              const encodedFormula = encodeURIComponent(formula)
              const formulaHtml = `<div style="text-align: center; margin: 16px 0;"><img src="https://latex.codecogs.com/svg.image?${encodedFormula}" alt="${formula.replace(/"/g, '&quot;')}" style="max-width: 100%;" /></div>`

              html = html.replace(`__BLOCK_FORMULA_${index}__`, formulaHtml)
            })

            // 恢复行内公式
            inlineFormulas.forEach((formula, index) => {
              const encodedFormula = encodeURIComponent(formula)
              const formulaHtml = `<img src="https://latex.codecogs.com/svg.image?${encodedFormula}" alt="${formula.replace(/"/g, '&quot;')}" style="vertical-align: middle;" />`

              html = html.replace(`__INLINE_FORMULA_${index}__`, formulaHtml)
            })

            // ========== 第四阶段：处理列表和段落 ==========

            // 处理无序列表项
            html = html.replace(/^[\*\-\+] (.+)$/gm, '<li>$1</li>')

            // 处理有序列表项
            html = html.replace(/^\d+[\.\)] (.+)$/gm, '<li>$1</li>')

            // 将连续的 <li> 包装成 <ul>
            html = html.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, (match) => {
              return `<ul>${match}</ul>`
            })

            // 处理段落
            const lines = html.split('\n')
            const result = []
            let paragraphLines = []

            const isBlockElement = (line) => {
              const trimmed = line.trim()
              return !trimmed ||
                trimmed.startsWith('<h') ||
                trimmed.startsWith('<pre') ||
                trimmed.startsWith('<blockquote') ||
                trimmed.startsWith('<ul') ||
                trimmed.startsWith('<ol') ||
                trimmed.startsWith('<hr') ||
                trimmed.startsWith('<div') ||
                trimmed.startsWith('<li') ||
                trimmed.startsWith('<img') ||
                trimmed.startsWith('</ul') ||
                trimmed.startsWith('</ol')
            }

            const flushParagraph = () => {
              if (paragraphLines.length > 0) {
                result.push(`<p>${paragraphLines.join('<br />')}</p>`)
                paragraphLines = []
              }
            }

            for (const line of lines) {
              const trimmed = line.trim()

              if (!trimmed) {
                flushParagraph()
                continue
              }

              if (isBlockElement(line)) {
                flushParagraph()
                result.push(trimmed)
              } else {
                paragraphLines.push(trimmed)
              }
            }

            flushParagraph()

            return result.join('\n')
          }

          // ========== 主流程 ==========
          try {
            console.log('[COSE] Twitter Articles 开始填充内容...')

            // 使用内置解析器转换 Markdown 为 HTML
            const htmlContent = parseMarkdownToHtml(markdown)
            console.log('[COSE] Markdown 已转换为 HTML')

            // 第一步：填充标题
            const titleInput = await waitForElement('textarea[placeholder="Add a title"], textarea[name="Article Title"]', 5000)
            if (titleInput && title) {
              titleInput.focus()
              const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
              nativeSetter.call(titleInput, title)
              titleInput.dispatchEvent(new Event('input', { bubbles: true }))
              titleInput.dispatchEvent(new Event('change', { bubbles: true }))
              console.log('[COSE] Twitter Articles 标题填充成功')
            } else {
              console.log('[COSE] Twitter Articles 未找到标题输入框')
            }

            await sleep(500)

            // 第二步：填充内容
            const contentEl = await waitForElement('.public-DraftEditor-content[contenteditable="true"], .DraftEditor-root [contenteditable="true"]', 5000)
            if (contentEl && htmlContent) {
              contentEl.focus()

              const dt = new DataTransfer()
              dt.setData('text/html', htmlContent)
              dt.setData('text/plain', htmlContent.replace(/<[^>]*>/g, ''))

              const pasteEvent = new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
                clipboardData: dt
              })

              contentEl.dispatchEvent(pasteEvent)
              console.log('[COSE] Twitter Articles 内容填充成功')
              return { success: true, method: 'paste-html', length: htmlContent.length }
            } else {
              console.log('[COSE] Twitter Articles 未找到内容编辑器')
              return { success: false, error: 'Content editor not found' }
            }
          } catch (e) {
            console.error('[COSE] Twitter Articles 同步失败:', e)
            return { success: false, error: e.message }
          }
        },
        args: [content.title, markdownContent],
        world: 'MAIN',
      })

      console.log('[COSE] Twitter Articles 填充结果:', fillResult[0]?.result)

      // 等待内容注入完成
      await new Promise(resolve => setTimeout(resolve, 1000))

      return { success: true, message: '已同步到 Twitter Articles', tabId: tab.id }
    }

    // 百度千帆开发者社区：注入 Markdown 并确认转换
    if (platformId === 'qianfan') {
      // 先打开发布页面
      tab = await chrome.tabs.create({ url: platform.publishUrl, active: false })
      await addTabToSyncGroup(tab.id, tab.windowId)
      await waitForTab(tab.id)

      // 等待页面加载（缩短为1秒，后续用 waitForElement 确保元素就绪）
      await new Promise(resolve => setTimeout(resolve, 1000))

      const markdownContent = content.markdown || content.body || ''
      console.log('[COSE] 百度千帆 Markdown 内容长度:', markdownContent?.length || 0)

      // 填充标题和内容
      const fillResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async (title, markdown) => {
          const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

          // 等待元素出现（带超时）
          const waitForElement = (selector, timeout = 5000) => {
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
                resolve(null)
              }, timeout)
            })
          }

          try {
            // 填充标题
            const titleInput = await waitForElement('textarea[placeholder="请输入文章标题"]')
            if (titleInput && title) {
              titleInput.focus()
              const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
              nativeSetter.call(titleInput, title)
              titleInput.dispatchEvent(new Event('input', { bubbles: true }))
              console.log('[COSE] 百度千帆标题填充成功')
            }

            await sleep(200)

            // 填充内容 - 使用 paste 事件注入
            const contentEditor = await waitForElement('.mp-editor-container[contenteditable="true"]')
            if (contentEditor && markdown) {
              contentEditor.focus()
              await sleep(100)

              // 使用 ClipboardEvent 模拟粘贴
              const dt = new DataTransfer()
              dt.setData('text/plain', markdown)

              const pasteEvent = new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
                clipboardData: dt
              })

              contentEditor.dispatchEvent(pasteEvent)
              console.log('[COSE] 百度千帆内容填充成功')

              // 等待并点击确认按钮（轮询检测，最多等待3秒）
              let confirmed = false
              for (let i = 0; i < 15; i++) {
                await sleep(200)
                const pageText = document.body.innerText
                if (pageText.includes('检测到 Markdown')) {
                  const confirmBtn = document.querySelector('.mp-modal-enter-btn')
                  if (confirmBtn) {
                    confirmBtn.click()
                    confirmed = true
                    console.log('[COSE] 百度千帆已确认 Markdown 转换')
                    break
                  }
                }
              }

              return { success: true, confirmed }
            }

            return { success: false, error: 'Editor not found' }
          } catch (e) {
            console.error('[COSE] 百度千帆同步失败:', e)
            return { success: false, error: e.message }
          }
        },
        args: [content.title, markdownContent],
        world: 'MAIN',
      })

      console.log('[COSE] 百度千帆填充结果:', fillResult[0]?.result)

      // 等待内容处理完成
      await new Promise(resolve => setTimeout(resolve, 2000))

      return { success: true, message: '已同步到百度云千帆', tabId: tab.id }
    }

    /* [DISABLED] 支付宝开放平台：使用 ne-engine 富文本编辑器，支持 Markdown 转换
    if (platformId === 'alipayopen') {
      // 先打开发布页面
      tab = await chrome.tabs.create({ url: platform.publishUrl, active: false })
      await addTabToSyncGroup(tab.id, tab.windowId)
      await waitForTab(tab.id)

      // 等待页面加载
      await new Promise(resolve => setTimeout(resolve, 2000))

      const markdownContent = content.markdown || content.body || ''
      console.log('[COSE] 支付宝开放平台 Markdown 内容长度:', markdownContent?.length || 0)

      // 使用导入的填充函数
      const fillResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: fillAlipayOpenContent,
        args: [content.title, markdownContent],
        world: 'MAIN',
      })

      console.log('[COSE] 支付宝开放平台填充结果:', fillResult[0]?.result)

      // 等待内容处理完成
      await new Promise(resolve => setTimeout(resolve, 2000))

      return { success: true, message: '已同步到支付宝开放平台', tabId: tab.id }
    } else [DISABLED] */
    if (platformId !== 'wechat') {
      // 其他平台（排除微信，因为微信在上面已经处理）
      let targetUrl = platform.publishUrl

      // 开源中国：尝试使用动态用户 ID
      if (platformId === 'oschina') {
        const userId = PLATFORM_USER_INFO['oschina']?.userId
        if (userId) {
          targetUrl = `https://my.oschina.net/u/${userId}/blog/write`
          console.log('[COSE] 使用 OSChina 动态 URL:', targetUrl)
        } else {
          console.warn('[COSE] 未找到 OSChina 用户 ID，使用默认 URL')
        }
      }

      // 直接打开发布页面
      tab = await chrome.tabs.create({ url: targetUrl, active: false })
      await addTabToSyncGroup(tab.id, tab.windowId)
      await waitForTab(tab.id)
    }

    // 微信公众号：直接注入 HTML 到编辑器
    if (platformId === 'wechat') {
      // 使用剪贴板 HTML（带完整样式）或降级到 body
      const htmlContent = content.wechatHtml || content.body
      console.log('[COSE] 微信 HTML 内容长度:', htmlContent?.length || 0)

      // 等待额外时间确保编辑器完全加载
      await new Promise(resolve => setTimeout(resolve, 2000))

      // 等待编辑器就绪并注入内容
      console.log('[COSE] 开始注入微信内容...')
      console.log('[COSE] 目标 tab ID:', tab.id)

      let result
      try {
        result = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: async (title, htmlBody) => {
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
          },
          args: [content.title, htmlContent],
          world: 'MAIN',
        })
      } catch (e) {
        console.error('[COSE] executeScript 执行失败:', e)
        return { success: false, message: '脚本执行失败: ' + e.message, tabId: tab.id }
      }

      console.log('[COSE] executeScript 返回数组长度:', result?.length)
      console.log('[COSE] executeScript 完整返回:', JSON.stringify(result, null, 2))

      if (!result || result.length === 0) {
        console.error('[COSE] executeScript 返回空数组')
        return { success: false, message: '脚本执行失败：无返回值', tabId: tab.id }
      }

      const fillResult = result[0].result
      console.log('[COSE] 微信填充结果:', JSON.stringify(fillResult, null, 2))

      // 检查 result 结构
      if (!result || !result[0]) {
        console.error('[COSE] executeScript 没有返回有效结果')
        return { success: false, message: '内容注入失败：脚本执行无返回值', tabId: tab.id }
      }

      if (!fillResult?.success) {
        console.error('[COSE] 微信内容填充失败:', fillResult?.error)
        console.error('[COSE] 完整 result 对象:', result)
        return { success: false, message: fillResult?.error || '内容填充失败', tabId: tab.id }
      }

      console.log('[COSE] 微信内容填充成功，字数:', fillResult.wordCount)

      // 等待内容稳定后，点击保存为草稿按钮
      await new Promise(resolve => setTimeout(resolve, 1000))
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
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

    // 抖音：使用剪贴板 HTML 粘贴到编辑器（类似微信公众号）
    if (platformId === 'douyin') {
      // 使用剪贴板 HTML（带完整样式）或降级到 body
      const htmlContent = content.wechatHtml || content.body
      console.log('[COSE] 抖音 HTML 内容长度:', htmlContent?.length || 0)
      console.log('[COSE] 开始注入抖音内容...')

      let result
      try {
        result = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: async (title, htmlBody) => {
            // 等待元素出现的工具函数（检测到立即返回）
            const waitForElement = (selector, timeout = 10000) => {
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

            try {
              // 等待编辑器加载完成 - 抖音使用 contenteditable div
              const editor = await waitForElement('[contenteditable="true"]')
              if (!editor) {
                return { success: false, error: '未找到编辑器' }
              }

              // 等待标题输入框
              const titleInput = await waitForElement('input[placeholder*="标题"]')

              // 填充标题
              if (titleInput && title) {
                titleInput.focus()
                // 使用 native setter 确保 React 等框架能检测到变化
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
                if (nativeSetter) {
                  nativeSetter.call(titleInput, title)
                } else {
                  titleInput.value = title
                }
                titleInput.dispatchEvent(new Event('input', { bubbles: true }))
                titleInput.dispatchEvent(new Event('change', { bubbles: true }))
                console.log('[COSE] 抖音标题已填充:', title)
              }

              // 填充正文内容
              if (editor && htmlBody) {
                editor.focus()

                // 清空现有内容
                editor.innerHTML = ''

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
                console.log('[COSE] 抖音内容已通过 paste 事件注入')

                // 立即验证内容是否注入成功
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
          },
          args: [content.title, htmlContent],
          world: 'MAIN',
        })
      } catch (e) {
        console.error('[COSE] executeScript 执行失败:', e)
        return { success: false, message: '脚本执行失败: ' + e.message, tabId: tab.id }
      }

      console.log('[COSE] 抖音填充结果:', JSON.stringify(result, null, 2))

      if (!result || result.length === 0) {
        return { success: false, message: '脚本执行失败：无返回值', tabId: tab.id }
      }

      const fillResult = result[0].result
      if (!fillResult?.success) {
        return { success: false, message: fillResult?.error || '内容填充失败', tabId: tab.id }
      }

      console.log('[COSE] 抖音内容填充成功，字数:', fillResult.wordCount)
      return { success: true, message: '已同步到抖音', tabId: tab.id }
    }

    // 搜狐号：使用剪贴板 HTML 粘贴到编辑器（类似微信公众号）
    if (platformId === 'sohu') {
      // 等待页面完全加载
      await new Promise(resolve => setTimeout(resolve, 3000))

      // 使用剪贴板 HTML（带完整样式）或降级到 body
      const htmlContent = content.wechatHtml || content.body
      console.log('[COSE] 搜狐号 HTML 内容长度:', htmlContent?.length || 0)

      // 填充标题和内容
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (title, htmlBody) => {
          // 填充标题
          const titleInput = document.querySelector('input[placeholder*="标题"]')
          if (titleInput && title) {
            titleInput.focus()
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
            nativeSetter.call(titleInput, title)
            titleInput.dispatchEvent(new Event('input', { bubbles: true }))
            titleInput.dispatchEvent(new Event('change', { bubbles: true }))
            console.log('[COSE] 搜狐号标题填充成功')
          }

          // 找到 Quill 编辑器
          const editor = document.querySelector('.ql-editor')
          if (editor && htmlBody) {
            editor.focus()

            // 清空现有内容
            editor.innerHTML = ''

            // 使用 DataTransfer 触发 paste 事件
            const dt = new DataTransfer()
            dt.setData('text/html', htmlBody)
            dt.setData('text/plain', htmlBody.replace(/<[^>]*>/g, ''))

            const pasteEvent = new ClipboardEvent('paste', {
              bubbles: true,
              cancelable: true,
              clipboardData: dt
            })

            editor.dispatchEvent(pasteEvent)
            console.log('[COSE] 搜狐号内容已通过 paste 事件注入')
          } else {
            console.log('[COSE] 搜狐号未找到编辑器')
          }
        },
        args: [content.title, htmlContent],
        world: 'MAIN',
      })

      // 等待内容注入完成
      await new Promise(resolve => setTimeout(resolve, 2000))

      return { success: true, message: '已同步到搜狐号', tabId: tab.id }
    }

    // B站专栏：使用 UEditor execCommand 插入 HTML
    if (platformId === 'bilibili') {
      // 使用剪贴板 HTML（带完整样式）或降级到 body
      const htmlContent = content.wechatHtml || content.body
      console.log('[COSE] B站专栏 HTML 内容长度:', htmlContent?.length || 0)

      // 等待 UEditor 就绪
      const waitForEditor = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          return new Promise((resolve) => {
            const startTime = Date.now()
            const maxWait = 10000

            const check = () => {
              const UE = window.UE
              if (UE && UE.instants && UE.instants['ueditorInstant0']) {
                const editor = UE.instants['ueditorInstant0']
                if (editor.isReady) {
                  console.log('[COSE] UEditor 已就绪，耗时:', Date.now() - startTime, 'ms')
                  resolve({ ready: true, time: Date.now() - startTime })
                  return
                }
              }

              if (Date.now() - startTime > maxWait) {
                console.log('[COSE] UEditor 等待超时')
                resolve({ ready: false, timeout: true })
                return
              }

              setTimeout(check, 100)
            }
            check()
          })
        },
        world: 'MAIN',
      })

      console.log('[COSE] B站专栏编辑器状态:', waitForEditor)

      // 填充标题和内容（一次性完成）
      const fillResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (title, htmlBody) => {
          // 填充标题
          const titleInput = document.querySelector('textarea')
          if (titleInput && title) {
            titleInput.focus()
            titleInput.value = title
            titleInput.dispatchEvent(new Event('input', { bubbles: true }))
            titleInput.dispatchEvent(new Event('change', { bubbles: true }))
            console.log('[COSE] B站专栏标题填充成功')
          }

          // 填充内容
          const UE = window.UE
          if (!UE || !UE.instants) {
            return { success: false, error: 'UEditor not found' }
          }

          const editor = UE.instants['ueditorInstant0']
          if (!editor) {
            return { success: false, error: 'UEditor instance not found' }
          }

          // 清空并插入内容
          editor.setContent('')
          editor.execCommand('inserthtml', htmlBody)
          editor.fireEvent('contentchange')

          console.log('[COSE] B站专栏内容已填充')
          return {
            success: true,
            contentLength: editor.getContentLength()
          }
        },
        args: [content.title, htmlContent],
        world: 'MAIN',
      })

      console.log('[COSE] B站专栏填充结果:', fillResult)

      // 短暂等待后点击存草稿
      await new Promise(resolve => setTimeout(resolve, 300))

      // 点击存草稿按钮
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const saveDraftBtn = Array.from(document.querySelectorAll('button'))
            .find(b => b.textContent && b.textContent.includes('存草稿'))
          if (saveDraftBtn) {
            saveDraftBtn.click()
            console.log('[COSE] B站专栏已点击存草稿')
          }
        },
        world: 'MAIN',
      })

      // 等待保存完成
      await new Promise(resolve => setTimeout(resolve, 500))

      return { success: true, message: '已同步并保存草稿到B站专栏', tabId: tab.id }
    }

    // 微博头条：使用 ProseMirror 编辑器
    if (platformId === 'weibo') {
      // 等待页面完全加载
      await new Promise(resolve => setTimeout(resolve, 3000))

      // 使用剪贴板 HTML（带完整样式）或降级到 body
      const htmlContent = content.wechatHtml || content.body
      console.log('[COSE] 微博头条 HTML 内容长度:', htmlContent?.length || 0)

      // 填充标题和内容
      const fillResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (title, htmlBody) => {
          // 填充标题
          const titleInput = document.querySelector('textarea[placeholder*="标题"]')
          if (titleInput && title) {
            titleInput.focus()
            titleInput.value = title
            titleInput.dispatchEvent(new Event('input', { bubbles: true }))
            titleInput.dispatchEvent(new Event('change', { bubbles: true }))
            console.log('[COSE] 微博头条标题填充成功')
          }

          // 填充内容 - 微博使用 ProseMirror/TipTap 编辑器
          const editor = document.querySelector('.ProseMirror')
          if (editor && htmlBody) {
            editor.innerHTML = htmlBody
            editor.dispatchEvent(new Event('input', { bubbles: true }))
            console.log('[COSE] 微博头条内容填充成功')
            return { success: true }
          }

          return { success: false, error: 'Editor not found' }
        },
        args: [content.title, htmlContent],
        world: 'MAIN',
      })

      console.log('[COSE] 微博头条填充结果:', fillResult)

      // 等待内容注入完成
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 点击保存草稿按钮
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const saveBtn = Array.from(document.querySelectorAll('button'))
            .find(b => b.textContent && b.textContent.includes('保存草稿'))
          if (saveBtn) {
            saveBtn.click()
            console.log('[COSE] 微博头条已点击保存草稿')
          }
        },
        world: 'MAIN',
      })

      // 等待保存完成
      await new Promise(resolve => setTimeout(resolve, 1000))

      return { success: true, message: '已同步到微博头条', tabId: tab.id }
    }

    // 阿里云开发者社区：使用 Markdown 编辑器
    if (platformId === 'aliyun') {
      // 等待页面完全加载
      await new Promise(resolve => setTimeout(resolve, 3000))

      // 阿里云使用 Markdown 编辑器
      const markdownContent = content.markdown || content.body || ''
      console.log('[COSE] 阿里云开发者社区 Markdown 内容长度:', markdownContent?.length || 0)

      // 填充标题和内容
      const fillResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (title, markdown) => {
          // 填充标题
          const titleInput = document.querySelector('input[placeholder*="标题"]')
          if (titleInput && title) {
            titleInput.focus()
            // 使用 native setter 来绕过 React 的受控组件
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
            nativeSetter.call(titleInput, title)
            titleInput.dispatchEvent(new Event('input', { bubbles: true }))
            titleInput.dispatchEvent(new Event('change', { bubbles: true }))
            console.log('[COSE] 阿里云开发者社区标题填充成功')
          }

          // 填充内容 - 阿里云使用 textarea 作为 Markdown 编辑器
          const contentTextarea = document.querySelector('textarea[class*="editor"]') ||
            document.querySelector('.markdown-editor textarea') ||
            document.querySelector('textarea:not([placeholder*="标题"])')

          if (contentTextarea && markdown) {
            contentTextarea.focus()
            // 使用 native setter 来绕过 React 的受控组件
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
            nativeSetter.call(contentTextarea, markdown)
            contentTextarea.dispatchEvent(new Event('input', { bubbles: true }))
            contentTextarea.dispatchEvent(new Event('change', { bubbles: true }))
            console.log('[COSE] 阿里云开发者社区内容填充成功')
            return { success: true }
          }

          return { success: false, error: 'Editor not found' }
        },
        args: [content.title, markdownContent],
        world: 'MAIN',
      })

      console.log('[COSE] 阿里云开发者社区填充结果:', fillResult)

      // 等待内容注入完成
      await new Promise(resolve => setTimeout(resolve, 1000))

      return { success: true, message: '已同步到阿里云开发者社区', tabId: tab.id }
    }

    // 火山引擎开发者社区：使用 ByteMD 编辑器（基于 CodeMirror）
    if (platformId === 'volcengine') {
      // 等待页面完全加载
      await new Promise(resolve => setTimeout(resolve, 3000))

      // 火山引擎使用 Markdown 编辑器
      const markdownContent = content.markdown || content.body || ''
      console.log('[COSE] 火山引擎开发者社区 Markdown 内容长度:', markdownContent?.length || 0)

      // 填充标题和内容
      const fillResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (title, markdown) => {
          // 填充标题
          const titleInput = document.querySelector('input[placeholder*="标题"]') ||
            document.querySelector('input[class*="title"]') ||
            document.querySelector('.article-title input')
          if (titleInput && title) {
            titleInput.focus()
            // 使用 native setter 来绕过 React 的受控组件
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
            nativeSetter.call(titleInput, title)
            titleInput.dispatchEvent(new Event('input', { bubbles: true }))
            titleInput.dispatchEvent(new Event('change', { bubbles: true }))
            console.log('[COSE] 火山引擎开发者社区标题填充成功')
          }

          // 火山引擎使用 ByteMD 编辑器（基于 CodeMirror）
          const codeMirrorEl = document.querySelector('.CodeMirror')
          if (codeMirrorEl && codeMirrorEl.CodeMirror && markdown) {
            codeMirrorEl.CodeMirror.setValue(markdown)
            console.log('[COSE] 火山引擎开发者社区内容填充成功')
            return { success: true, method: 'CodeMirror' }
          }

          // 备用方案：尝试直接操作 textarea
          const contentTextarea = document.querySelector('.bytemd-editor textarea') ||
            document.querySelector('textarea:not([placeholder*="标题"])')

          if (contentTextarea && markdown) {
            contentTextarea.focus()
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
            nativeSetter.call(contentTextarea, markdown)
            contentTextarea.dispatchEvent(new Event('input', { bubbles: true }))
            contentTextarea.dispatchEvent(new Event('change', { bubbles: true }))
            console.log('[COSE] 火山引擎开发者社区内容填充成功（textarea）')
            return { success: true, method: 'textarea' }
          }

          return { success: false, error: 'Editor not found' }
        },
        args: [content.title, markdownContent],
        world: 'MAIN',
      })

      console.log('[COSE] 火山引擎开发者社区填充结果:', fillResult)

      // 等待内容注入完成
      await new Promise(resolve => setTimeout(resolve, 1000))

      return { success: true, message: '已同步到火山引擎开发者社区', tabId: tab.id }
    }

    // 华为云开发者博客：使用 Markdown 编辑器（在 iframe 中）
    if (platformId === 'huaweicloud') {
      // 等待页面完全加载
      await new Promise(resolve => setTimeout(resolve, 3000))

      // 华为云使用 Markdown 编辑器
      const markdownContent = content.markdown || content.body || ''
      console.log('[COSE] 华为云开发者博客 Markdown 内容长度:', markdownContent?.length || 0)

      // 检查当前编辑器类型，如果不是 Markdown 则切换
      const switchResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // 检查当前是否已经是 Markdown 编辑器
          if (window.tinymceModal?.currentEditorType === 'markdown') {
            console.log('[COSE] 华为云已经是 Markdown 编辑器')
            return { alreadyMarkdown: true }
          }

          // 查找 "Markdown格式编辑" 标签并点击
          const allElements = document.querySelectorAll('*')
          for (const el of allElements) {
            if (el.textContent === 'Markdown格式编辑' && el.children.length === 0) {
              el.click()
              console.log('[COSE] 华为云已点击 Markdown 编辑器标签')
              return { clicked: true }
            }
          }
          return { clicked: false }
        },
        world: 'MAIN',
      })

      // 如果点击了切换按钮，需要等待确认对话框并点击确定
      if (switchResult[0]?.result?.clicked) {
        // 等待确认对话框出现
        await new Promise(resolve => setTimeout(resolve, 500))

        // 点击确认对话框的"确定"按钮
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            // 查找确认对话框中的"确定"按钮
            const allElements = document.querySelectorAll('*')
            for (const el of allElements) {
              if (el.textContent === '确定' && el.children.length === 0) {
                el.click()
                console.log('[COSE] 华为云已点击确定按钮')
                return { confirmed: true }
              }
            }
            return { confirmed: false }
          },
          world: 'MAIN',
        })

        // 等待编辑器切换完成
        await new Promise(resolve => setTimeout(resolve, 3000))
      }

      // 填充标题和内容
      const fillResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (title, markdown) => {
          // 填充标题
          const titleInput = document.querySelector('input[placeholder*="标题"]')
          if (titleInput && title) {
            titleInput.focus()
            titleInput.value = title
            titleInput.dispatchEvent(new Event('input', { bubbles: true }))
            titleInput.dispatchEvent(new Event('change', { bubbles: true }))
            console.log('[COSE] 华为云开发者博客标题填充成功')
          }

          // 使用 tinymceModal.currentEditor.setContent() 填充 Markdown 内容
          const editor = window.tinymceModal?.currentEditor
          if (editor && typeof editor.setContent === 'function') {
            editor.setContent(markdown)
            console.log('[COSE] 华为云开发者博客内容填充成功，长度:', markdown.length)
            return { success: true, method: 'tinymceModal', length: markdown.length }
          }

          return { success: false, error: 'tinymceModal.currentEditor not found' }
        },
        args: [content.title, markdownContent],
        world: 'MAIN',
      })

      console.log('[COSE] 华为云开发者博客填充结果:', fillResult)

      // 等待内容注入完成
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 点击保存草稿按钮
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const allLinks = document.querySelectorAll('a')
          for (const link of allLinks) {
            if (link.textContent && link.textContent.includes('保存草稿')) {
              link.click()
              console.log('[COSE] 华为云开发者博客已点击保存草稿')
              return { clicked: true }
            }
          }
          return { clicked: false }
        },
        world: 'MAIN',
      })

      // 等待保存完成
      await new Promise(resolve => setTimeout(resolve, 1000))

      return { success: true, message: '已同步到华为云开发者博客', tabId: tab.id }
    }

    // 华为开发者文章：使用 ACE Editor (Markdown 编辑器)
    if (platformId === 'huaweidev') {
      // 华为开发者文章使用 Markdown 编辑器
      const markdownContent = content.markdown || content.body || ''
      console.log('[COSE] 华为开发者文章 Markdown 内容长度:', markdownContent?.length || 0)

      // 注入异步弹窗监听器，并执行主流程
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async (title, markdown) => {
          // ========== 弹窗处理函数 ==========
          const handleDialog = () => {
            // 方法1: 查找 Ant Design Modal 中的按钮
            const modalBtns = document.querySelector('.ant-modal-confirm-btns')
            if (modalBtns) {
              const buttons = modalBtns.querySelectorAll('button')
              const modalText = document.querySelector('.ant-modal-confirm-content')?.textContent || ''

              console.log('[COSE] 检测到 Ant Modal:', modalText.substring(0, 50))

              // 处理"温馨提示"弹窗 - 点击"取消"
              if (modalText.includes('温馨提示') || modalText.includes('未保存')) {
                for (const btn of buttons) {
                  if (btn.textContent?.trim() === '取消') {
                    console.log('[COSE] 点击温馨提示弹窗的取消按钮')
                    btn.click()
                    return true
                  }
                }
              }

              // 处理 MD 编辑器切换确认对话框 - 点击"确认"
              if (modalText.includes('Markdown') || modalText.includes('切换')) {
                for (const btn of buttons) {
                  if (btn.textContent?.trim() === '确认') {
                    console.log('[COSE] 点击 MD 切换确认按钮')
                    btn.click()
                    return true
                  }
                }
              }
            }

            // 方法2: 查找 HTML5 dialog 元素（备用）
            const dialog = document.querySelector('dialog[open]')
            if (dialog) {
              const dialogText = dialog.textContent || ''
              const buttons = dialog.querySelectorAll('button')

              console.log('[COSE] 检测到 dialog:', dialogText.substring(0, 50))

              if (dialogText.includes('温馨提示') || dialogText.includes('未保存')) {
                for (const btn of buttons) {
                  if (btn.textContent?.trim() === '取消') {
                    btn.click()
                    return true
                  }
                }
              }

              if (dialogText.includes('Markdown') || dialogText.includes('切换')) {
                for (const btn of buttons) {
                  if (btn.textContent?.trim() === '确认') {
                    btn.click()
                    return true
                  }
                }
              }
            }

            return false
          }

          // ========== 工具函数 ==========
          const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

          // 轮询检查弹窗（比 MutationObserver 更可靠）
          let dialogCheckInterval = null
          const startDialogChecker = () => {
            // 先检查已存在的弹窗
            handleDialog()

            // 定时检查新弹窗
            dialogCheckInterval = setInterval(() => {
              handleDialog()
            }, 200)

            console.log('[COSE] 华为开发者文章弹窗检查器已启动')
          }

          const stopDialogChecker = () => {
            if (dialogCheckInterval) {
              clearInterval(dialogCheckInterval)
              dialogCheckInterval = null
              console.log('[COSE] 华为开发者文章弹窗检查器已停止')
            }
          }

          const waitForElement = async (selector, timeout = 5000) => {
            const start = Date.now()
            while (Date.now() - start < timeout) {
              const el = document.querySelector(selector)
              if (el) return el
              await sleep(100)
            }
            return null
          }

          // 等待按钮出现（支持 button 和 a 标签）
          const waitForMdButton = async (timeout = 15000) => {
            const start = Date.now()
            while (Date.now() - start < timeout) {
              // 方法1: 通过 CKEditor 的 class 选择器（最精确）
              let btn = document.querySelector('a.cke_button__cktomd')
              if (btn) return btn

              // 方法2: 查找包含 "MD编辑器" 文本的 <a> 标签
              const allLinks = document.querySelectorAll('a')
              for (const link of allLinks) {
                if (link.textContent?.trim() === 'MD编辑器') {
                  return link
                }
              }

              // 方法3: 查找包含 "MD编辑器" 文本的 <button> 标签（备用）
              const allButtons = document.querySelectorAll('button')
              for (const b of allButtons) {
                if (b.textContent?.trim() === 'MD编辑器') {
                  return b
                }
              }

              await sleep(300)
            }
            return null
          }

          // 等待富文本编辑器按钮出现
          const waitForRichTextButton = async (timeout = 2000) => {
            const start = Date.now()
            while (Date.now() - start < timeout) {
              // 查找 "富文本编辑器" 按钮（可能是 <a> 或 <button>）
              const allElements = document.querySelectorAll('a, button')
              for (const el of allElements) {
                if (el.textContent?.trim() === '富文本编辑器') {
                  return el
                }
              }
              await sleep(200)
            }
            return null
          }

          // ========== 主流程 ==========
          try {
            // 启动弹窗检查器
            startDialogChecker()

            // 等待 DOM 完全加载
            if (document.readyState !== 'complete') {
              console.log('[COSE] 等待 DOM 加载完成...')
              await new Promise(resolve => {
                if (document.readyState === 'complete') {
                  resolve()
                } else {
                  window.addEventListener('load', resolve, { once: true })
                }
              })
            }

            // 等待页面加载完成（等待 MD编辑器 或 富文本编辑器 按钮出现）
            // 华为开发者页面的编辑器工具栏是异步加载的，需要较长时间
            console.log('[COSE] 等待编辑器工具栏加载...')
            let mdButton = await waitForMdButton(15000)
            let richTextButton = await waitForRichTextButton(2000)

            // 检查是否已经是 Markdown 编辑器
            let aceEditor = document.querySelector('.ace_editor')

            // 如果有富文本编辑器按钮，说明当前已经是 Markdown 编辑器
            if (richTextButton || aceEditor) {
              console.log('[COSE] 已经是 Markdown 编辑器')
              aceEditor = aceEditor || document.querySelector('.ace_editor')
            } else if (!aceEditor) {
              // 需要切换到 Markdown 编辑器
              if (mdButton) {
                console.log('[COSE] 点击 MD编辑器 按钮')
                mdButton.click()

                // 等待 ACE Editor 出现（弹窗会被检查器自动处理）
                aceEditor = await waitForElement('.ace_editor', 10000)

                if (!aceEditor) {
                  console.error('[COSE] 等待 ACE Editor 超时')
                  return { success: false, error: 'ACE Editor not found after timeout' }
                }
              } else {
                console.error('[COSE] 未找到 MD编辑器 按钮')
                return { success: false, error: 'MD Editor button not found' }
              }
            }

            console.log('[COSE] 华为开发者文章已进入 Markdown 编辑器')

            // 等待编辑器完全初始化
            await sleep(500)

            // 填充标题
            const titleInput = document.querySelector('input[placeholder*="标题"]')
            if (titleInput && title) {
              titleInput.focus()
              const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
              nativeSetter.call(titleInput, title)
              titleInput.dispatchEvent(new Event('input', { bubbles: true }))
              titleInput.dispatchEvent(new Event('change', { bubbles: true }))
              console.log('[COSE] 华为开发者文章标题填充成功')
            }

            // 填充 Markdown 内容
            if (typeof ace !== 'undefined') {
              const editor = ace.edit(aceEditor)
              if (editor) {
                editor.session.setValue(markdown)
                console.log('[COSE] 华为开发者文章内容填充成功，长度:', markdown.length)
              }
            }

            return { success: true, method: 'ace', length: markdown.length }

          } finally {
            // 清理检查器
            stopDialogChecker()
          }
        },
        args: [content.title, markdownContent],
        world: 'MAIN',
      })

      console.log('[COSE] 华为开发者文章填充结果:', result[0]?.result)

      return { success: true, message: '已同步到华为开发者文章', tabId: tab.id }
    }

    // 百家号：使用剪贴板 HTML 粘贴到编辑器
    if (platformId === 'baijiahao') {
      // 等待页面完全加载
      await new Promise(resolve => setTimeout(resolve, 3000))

      // 使用剪贴板 HTML（带完整样式）或降级到 body
      const htmlContent = content.wechatHtml || content.body
      console.log('[COSE] 百家号 HTML 内容长度:', htmlContent?.length || 0)

      // 填充标题和内容
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (title, htmlBody) => {
          // 填充标题 - 百家号标题在 contenteditable div 中
          const titleEditor = document.querySelector('.client_components_titleInput [contenteditable="true"]') ||
            document.querySelector('.client_pages_edit_components_titleInput [contenteditable="true"]') ||
            document.querySelector('[class*="titleInput"] [contenteditable="true"]')

          if (titleEditor && title) {
            titleEditor.focus()
            titleEditor.innerHTML = ''
            document.execCommand('insertText', false, title)
            if (!titleEditor.textContent) {
              titleEditor.innerHTML = `<p dir="auto">${title}</p>`
            }
            titleEditor.dispatchEvent(new Event('input', { bubbles: true }))
            console.log('[COSE] 百家号标题已填充')
          }

          // 等待一下再填充内容
          setTimeout(() => {
            // 尝试通过 UEditor API 填充
            if (window.UE_V2 && window.UE_V2.instants && window.UE_V2.instants.ueditorInstant0) {
              try {
                const editor = window.UE_V2.instants.ueditorInstant0

                // 提取原始 HTML 中的公式（包含完整 SVG）
                const tempDiv = document.createElement('div')
                tempDiv.innerHTML = htmlBody
                const originalFormulas = []
                tempDiv.querySelectorAll('.katex-inline, .katex-block, section.katex-block').forEach((formula, index) => {
                  const svg = formula.querySelector('svg')
                  if (svg && svg.innerHTML) {
                    originalFormulas.push({
                      index,
                      className: formula.className,
                      fullHtml: formula.outerHTML
                    })
                  }
                })
                console.log('[COSE] 百家号提取到', originalFormulas.length, '个公式')

                // 先用 setContent 设置内容（公式 SVG 会被过滤）
                editor.setContent(htmlBody)

                // 然后直接向 iframe 注入完整的公式 SVG
                if (originalFormulas.length > 0) {
                  setTimeout(() => {
                    const iframe = document.querySelector('iframe')
                    if (iframe && iframe.contentDocument) {
                      const iframeDoc = iframe.contentDocument
                      const emptyFormulas = iframeDoc.querySelectorAll('.katex-inline, .katex-block, section.katex-block')

                      emptyFormulas.forEach((emptyFormula, index) => {
                        const original = originalFormulas[index]
                        if (original) {
                          // 创建新元素并替换
                          const newElement = document.createElement('div')
                          newElement.innerHTML = original.fullHtml
                          const newFormula = newElement.firstElementChild
                          if (newFormula && emptyFormula.parentNode) {
                            emptyFormula.parentNode.replaceChild(newFormula, emptyFormula)
                          }
                        }
                      })

                      console.log('[COSE] 百家号公式 SVG 已恢复')
                      editor.fireEvent('contentChange')
                    }
                  }, 300)
                }

                editor.fireEvent('contentChange');
                editor.fireEvent('selectionchange');
                console.log('[COSE] 百家号通过 UEditor API 填充成功')
                return
              } catch (e) {
                console.log('[COSE] 百家号 UEditor API 调用失败', e)
              }
            }
          }, 500)
        },
        args: [content.title, htmlContent],
        world: 'MAIN',
      })

      // 等待内容注入完成
      await new Promise(resolve => setTimeout(resolve, 2000))

      return { success: true, message: '已同步到百家号', tabId: tab.id }
    }

    // 网易号：使用剪贴板 HTML 粘贴到编辑器
    if (platformId === 'wangyihao') {
      // 等待页面完全加载
      await new Promise(resolve => setTimeout(resolve, 3000))

      // 使用剪贴板 HTML（带完整样式）或降级到 body
      const htmlContent = content.wechatHtml || content.body
      console.log('[COSE] 网易号 HTML 内容长度:', htmlContent?.length || 0)

      // 填充标题和内容
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (title, htmlBody) => {
          // 填充标题 - 网易号使用 textarea.netease-textarea
          // 需要使用 native setter 来绕过 React 的受控组件
          const titleInput = document.querySelector('textarea.netease-textarea') ||
            document.querySelector('textarea[placeholder*="标题"]')

          if (titleInput && title) {
            titleInput.focus()
            // 使用 native setter 来绕过 React 的受控组件
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
            nativeSetter.call(titleInput, title)
            // 触发 React 能识别的事件
            titleInput.dispatchEvent(new InputEvent('input', { bubbles: true, data: title, inputType: 'insertText' }))
            titleInput.dispatchEvent(new Event('change', { bubbles: true }))
            titleInput.dispatchEvent(new Event('blur', { bubbles: true }))
            console.log('[COSE] 网易号标题已填充')
          }

          // 等待一下再填充内容
          setTimeout(() => {
            // 找到 Draft.js 编辑器
            const editor = document.querySelector('.public-DraftEditor-content') ||
              document.querySelector('[contenteditable="true"]')

            if (editor && htmlBody) {
              editor.focus()

              // 清空现有内容
              if (editor.textContent.trim() === '' || editor.querySelector('[data-text="true"]')) {
                // Draft.js 编辑器可能有占位符
                const placeholder = editor.querySelector('[data-text="true"]')
                if (placeholder && placeholder.textContent.includes('请输入正文')) {
                  editor.innerHTML = ''
                }
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
              console.log('[COSE] 网易号内容已通过 paste 事件注入')
            }
          }, 500)
        },
        args: [content.title, htmlContent],
        world: 'MAIN',
      })

      // 等待内容注入完成
      await new Promise(resolve => setTimeout(resolve, 2000))

      return { success: true, message: '已同步到网易号', tabId: tab.id }
    }

    // 少数派：使用剪贴板 HTML 粘贴到编辑器
    if (platformId === 'sspai') {
      // 等待页面完全加载
      await new Promise(resolve => setTimeout(resolve, 3000))

      // 使用剪贴板 HTML（带完整样式）或降级到 body
      const htmlContent = content.wechatHtml || content.body
      console.log('[COSE] 少数派 HTML 内容长度:', htmlContent?.length || 0)

      // 填充标题和内容
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (title, htmlBody) => {
          // 填充标题 - 少数派使用 textarea
          const titleInput = document.querySelector('textarea[placeholder*="标题"]') ||
            document.querySelector('input[placeholder*="标题"]')

          if (titleInput && title) {
            titleInput.focus()
            // 使用 native setter 来绕过 Vue/React 的受控组件
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set ||
              Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
            nativeSetter.call(titleInput, title)
            // 触发事件
            titleInput.dispatchEvent(new InputEvent('input', { bubbles: true, data: title, inputType: 'insertText' }))
            titleInput.dispatchEvent(new Event('change', { bubbles: true }))
            titleInput.dispatchEvent(new Event('blur', { bubbles: true }))
            console.log('[COSE] 少数派标题已填充')
          }

          // 等待一下再填充内容
          setTimeout(() => {
            // 找到 ProseMirror 编辑器
            const editor = document.querySelector('.ProseMirror') ||
              document.querySelector('[contenteditable="true"]')

            if (editor && htmlBody) {
              editor.focus()

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
              console.log('[COSE] 少数派内容已通过 paste 事件注入')
            }
          }, 500)
        },
        args: [content.title, htmlContent],
        world: 'MAIN',
      })

      // 等待内容注入完成
      await new Promise(resolve => setTimeout(resolve, 2000))

      return { success: true, message: '已同步到少数派', tabId: tab.id }
    }

    // 支付宝开放平台：使用 ne-engine 富文本编辑器
    if (platformId === 'alipayopen') {
      // 等待页面完全加载
      await new Promise(resolve => setTimeout(resolve, 3000))

      // 使用剪贴板 HTML（带完整样式）或降级到 body
      const htmlContent = content.wechatHtml || content.body
      console.log('[COSE] 支付宝开放平台 HTML 内容长度:', htmlContent?.length || 0)

      // 填充标题和内容
      const fillResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async (title, htmlBody) => {
          // 等待元素出现的工具函数
          const waitForElement = (selector, timeout = 10000) => {
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

          try {
            console.log('[COSE] 支付宝开放平台开始填充内容...')

            // 等待并查找标题输入框
            const titleInput = await waitForElement('#title', 5000) || await waitForElement('input[placeholder*="标题"]', 5000)
            if (titleInput && title) {
              titleInput.focus()

              // Ant Design 输入框需要特殊处理
              // 先清空
              titleInput.value = ''

              // 使用 native setter 确保 React 能检测到变化
              const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
              if (nativeSetter) {
                nativeSetter.call(titleInput, title)
              } else {
                titleInput.value = title
              }

              // 触发多个事件确保 Ant Design 组件能识别
              titleInput.dispatchEvent(new Event('input', { bubbles: true }))
              titleInput.dispatchEvent(new Event('change', { bubbles: true }))
              titleInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }))
              titleInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }))

              // 使用 setValue 方法（如果存在）
              if (titleInput._valueTracker) {
                titleInput._valueTracker.setValue('')
              }

              // 再次设置值
              titleInput.value = title
              titleInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))

              // 模拟用户输入
              const inputEvent = new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                data: title,
                inputType: 'insertText'
              })
              titleInput.dispatchEvent(inputEvent)

              console.log('[COSE] 支付宝开放平台标题已填充:', title, '当前值:', titleInput.value)
            }

            // 稍等一下让标题生效
            await new Promise(r => setTimeout(r, 300))

            // 等待并查找 ne-engine 编辑器
            const editor = await waitForElement('.ne-engine[contenteditable="true"]', 5000)
            if (editor && htmlBody) {
              editor.focus()

              // 清空现有内容
              editor.innerHTML = ''

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
              console.log('[COSE] 支付宝开放平台内容已通过 paste 事件注入')

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

              return { success: true, method: 'paste-html', length: htmlBody.length }
            }

            return { success: false, error: 'ne-engine editor not found' }
          } catch (e) {
            console.error('[COSE] 支付宝开放平台同步失败:', e)
            return { success: false, error: e.message }
          }
        },
        args: [content.title, htmlContent],
        world: 'MAIN',
      })

      console.log('[COSE] 支付宝开放平台填充结果:', fillResult[0]?.result)

      // 等待内容注入完成
      await new Promise(resolve => setTimeout(resolve, 1000))

      return { success: true, message: '已同步到支付宝开放平台', tabId: tab.id }
    }

    // 电子发烧友：等待 Vditor 编辑器加载后填充内容
    if (platformId === 'elecfans') {
      // 等待页面完全加载
      await new Promise(resolve => setTimeout(resolve, 3000))

      // 使用 Markdown 内容
      const markdownContent = content.markdown || content.body || ''
      console.log('[COSE] 电子发烧友 Markdown 内容长度:', markdownContent?.length || 0)

      // 填充标题和内容
      const fillResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async (title, markdown) => {
          // 等待元素出现的工具函数
          const waitForElement = (selector, timeout = 10000) => {
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

          try {
            console.log('[COSE] 电子发烧友开始填充内容...')

            // 等待并查找标题输入框
            const titleInput = await waitForElement('input[placeholder*="标题"], input.title-input, input[name="title"]', 5000)
            if (titleInput && title) {
              titleInput.focus()
              // 使用 native setter 确保框架能检测到变化
              const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
              if (nativeSetter) {
                nativeSetter.call(titleInput, title)
              } else {
                titleInput.value = title
              }
              titleInput.dispatchEvent(new Event('input', { bubbles: true }))
              titleInput.dispatchEvent(new Event('change', { bubbles: true }))
              console.log('[COSE] 电子发烧友标题已填充:', title)
            }

            // 稍等一下让标题生效
            await new Promise(r => setTimeout(r, 500))

            // 优先查找 Vditor 编辑器（电子发烧友使用 Vditor）
            const vditorWysiwyg = document.querySelector('.vditor-wysiwyg .vditor-reset')
            if (vditorWysiwyg) {
              vditorWysiwyg.focus()

              // Vditor 需要 HTML 内容，将 Markdown 转换为简单 HTML
              // 先尝试使用 ClipboardEvent 粘贴 Markdown
              const dt = new DataTransfer()
              dt.setData('text/plain', markdown)

              const pasteEvent = new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
                clipboardData: dt
              })

              vditorWysiwyg.dispatchEvent(pasteEvent)
              console.log('[COSE] 电子发烧友 Vditor paste 事件已触发')

              // 等待内容渲染
              await new Promise(r => setTimeout(r, 500))

              // 验证内容是否注入成功
              const wordCount = vditorWysiwyg.textContent?.length || 0
              if (wordCount > 10) {
                console.log('[COSE] 电子发烧友 Vditor 内容已填充，字数:', wordCount)
                return { success: true, method: 'vditor-paste', length: wordCount }
              }

              // 备用方案：直接设置 textContent（Vditor 会自动解析 Markdown）
              console.log('[COSE] paste 事件未生效，尝试直接输入')
              vditorWysiwyg.textContent = markdown
              vditorWysiwyg.dispatchEvent(new Event('input', { bubbles: true }))

              return { success: true, method: 'vditor-direct', length: markdown.length }
            }

            // 等待并查找 CodeMirror 编辑器或 textarea
            const cmElement = document.querySelector('.CodeMirror')
            if (cmElement && cmElement.CodeMirror) {
              cmElement.CodeMirror.setValue(markdown)
              console.log('[COSE] 电子发烧友 CodeMirror 内容已填充')
              return { success: true, method: 'codemirror', length: markdown.length }
            }

            // 尝试查找 textarea
            const textarea = await waitForElement('textarea.content-textarea, textarea[name="content"], textarea', 5000)
            if (textarea && markdown) {
              textarea.focus()
              const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
              if (nativeSetter) {
                nativeSetter.call(textarea, markdown)
              } else {
                textarea.value = markdown
              }
              textarea.dispatchEvent(new Event('input', { bubbles: true }))
              textarea.dispatchEvent(new Event('change', { bubbles: true }))
              console.log('[COSE] 电子发烧友 textarea 内容已填充')
              return { success: true, method: 'textarea', length: markdown.length }
            }

            // 尝试查找通用 contenteditable 编辑器
            const editor = await waitForElement('[contenteditable="true"]', 5000)
            if (editor && markdown) {
              editor.focus()
              editor.textContent = markdown
              editor.dispatchEvent(new Event('input', { bubbles: true }))
              console.log('[COSE] 电子发烧友 contenteditable 内容已填充')
              return { success: true, method: 'contenteditable', length: markdown.length }
            }

            return { success: false, error: 'editor not found' }
          } catch (e) {
            console.error('[COSE] 电子发烧友同步失败:', e)
            return { success: false, error: e.message }
          }
        },
        args: [content.title, markdownContent],
        world: 'MAIN',
      })

      console.log('[COSE] 电子发烧友填充结果:', fillResult[0]?.result)

      // 等待内容注入完成
      await new Promise(resolve => setTimeout(resolve, 1000))

      return { success: true, message: '已同步到电子发烧友', tabId: tab.id }
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
  const { title, body, markdown, wechatHtml } = content

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

    // 知乎专栏 - 由 syncToPlatform 单独处理（使用导入文档功能）
    if (host.includes('zhihu.com')) {
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
    // 思否 SegmentFault
    else if (host.includes('segmentfault.com')) {
      // 填充标题
      const titleInput = await waitFor('input#title, input[placeholder*="标题"]')
      if (titleInput) {
        titleInput.focus()
        titleInput.value = title
        titleInput.dispatchEvent(new Event('input', { bubbles: true }))
        titleInput.dispatchEvent(new Event('change', { bubbles: true }))
        console.log('[COSE] 思否标题填充成功')
      } else {
        console.log('[COSE] 思否未找到标题输入框')
      }

      // 等待编辑器加载
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 思否使用 CodeMirror 编辑器
      const cmElement = document.querySelector('.CodeMirror')
      if (cmElement && cmElement.CodeMirror) {
        cmElement.CodeMirror.setValue(contentToFill)
        console.log('[COSE] 思否 CodeMirror 填充成功')
      } else {
        // 降级到 textarea
        const textarea = document.querySelector('textarea')
        if (textarea) {
          textarea.focus()
          textarea.value = contentToFill
          textarea.dispatchEvent(new Event('input', { bubbles: true }))
          console.log('[COSE] 思否 textarea 填充成功')
        } else {
          console.log('[COSE] 思否 未找到编辑器')
        }
      }
    }
    // 开源中国 OSChina
    else if (host.includes('oschina.net')) {
      // 填充标题
      const titleInput = await waitFor('input[name="title"], .title input, input[placeholder*="标题"]')
      if (titleInput) {
        setInputValue(titleInput, title)
        console.log('[COSE] OSChina 标题填充成功')
      }

      // 等待 CKEditor 加载
      await new Promise(resolve => setTimeout(resolve, 1500))

      // 尝试通过 CKEditor API 设置内容
      const success = await new Promise(resolve => {
        let count = 0
        const check = () => {
          if (window.CKEDITOR && window.CKEDITOR.instances) {
            const keys = Object.keys(window.CKEDITOR.instances)
            if (keys.length > 0) {
              window.CKEDITOR.instances[keys[0]].setData(body || contentToFill)
              resolve(true)
              return
            }
          }
          if (++count < 10) {
            setTimeout(check, 500)
          } else {
            resolve(false)
          }
        }
        check()
      })

      if (!success) {
        // 降级：如果 CKEditor 没找到，尝试填充隐藏的 textarea
        const textarea = document.querySelector('textarea[name="content"]') || document.querySelector('#blogContent')
        if (textarea) {
          setInputValue(textarea, body || contentToFill)
          console.log('[COSE] OSChina textarea 填充成功')
        } else {
          console.log('[COSE] OSChina 未找到编辑器')
        }
      }
    }
    // 博客园
    else if (host.includes('cnblogs.com')) {
      // 等待页面加载
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 填充标题 - 博客园标题输入框
      const titleInput = await waitFor('input[placeholder="标题"]') || document.querySelector('input')
      if (titleInput) {
        titleInput.focus()
        titleInput.value = title
        titleInput.dispatchEvent(new Event('input', { bubbles: true }))
        titleInput.dispatchEvent(new Event('change', { bubbles: true }))
        console.log('[COSE] 博客园标题填充成功')
      } else {
        console.log('[COSE] 博客园未找到标题输入框')
      }

      // 等待编辑器加载
      await new Promise(resolve => setTimeout(resolve, 500))

      // 博客园使用 id="md-editor" 的 textarea 作为 Markdown 编辑器
      const editor = document.querySelector('#md-editor') || document.querySelector('textarea.not-resizable')
      if (editor) {
        editor.focus()
        editor.value = contentToFill
        editor.dispatchEvent(new Event('input', { bubbles: true }))
        editor.dispatchEvent(new Event('change', { bubbles: true }))
        console.log('[COSE] 博客园内容填充成功')
      } else {
        console.log('[COSE] 博客园未找到编辑器')
      }
    }
    // InfoQ
    else if (host.includes('infoq.cn')) {
      // 填充标题
      const titleInput = await waitFor('input[placeholder*="标题"], .title-input input, input.article-title')
      if (titleInput) {
        setInputValue(titleInput, title)
        console.log('[COSE] InfoQ 标题填充成功')
      } else {
        console.log('[COSE] InfoQ 未找到标题输入框')
      }

      // InfoQ 使用 Vue 编辑器，需要在主世界执行才能访问 __vue__
      // 通过注入 script 标签的方式在主世界执行
      // 使用 ProseMirror view + 剪贴板粘贴方式填充内容
      const script = document.createElement('script')
      script.textContent = `
        (async function() {
          const content = ${JSON.stringify(contentToFill)};
          
          // 等待编辑器完全初始化的函数
          const waitForEditor = () => {
            return new Promise((resolve) => {
              let attempts = 0;
              const maxAttempts = 30; // 最多等待 15 秒
              
              const check = () => {
                attempts++;
                const gkEditor = document.querySelector('.gk-editor');
                if (gkEditor && gkEditor.__vue__) {
                  const vm = gkEditor.__vue__;
                  const api = vm.editorAPI;
                  // 检查 ProseMirror view 是否就绪
                  if (api && api.editor && api.editor.view) {
                    resolve(api.editor.view);
                    return;
                  }
                }
                if (attempts < maxAttempts) {
                  setTimeout(check, 500);
                } else {
                  resolve(null);
                }
              };
              check();
            });
          };
          
          const view = await waitForEditor();
          if (!view) {
            console.log('[COSE] InfoQ 编辑器初始化超时');
            return;
          }
          
          try {
            // 清空编辑器现有内容
            const state = view.state;
            const tr = state.tr.delete(0, state.doc.content.size);
            view.dispatch(tr);
            
            // 聚焦编辑器
            view.focus();
            
            // 使用剪贴板粘贴方式插入内容（会自动解析 Markdown）
            const clipboardData = new DataTransfer();
            clipboardData.setData('text/plain', content);
            
            const pasteEvent = new ClipboardEvent('paste', {
              bubbles: true,
              cancelable: true,
              clipboardData: clipboardData
            });
            
            view.dom.dispatchEvent(pasteEvent);
            console.log('[COSE] InfoQ 内容填充成功');
          } catch (e) {
            console.log('[COSE] InfoQ 内容填充失败:', e.message);
          }
        })();
      `
      document.head.appendChild(script)
      script.remove()
    }
    // 简书
    else if (host.includes('jianshu.com')) {
      // 填充标题 - 简书使用 input._24i7u，需要使用 native setter
      const titleInput = await waitFor('input._24i7u, input[class*="title"]')
      if (titleInput) {
        titleInput.focus()
        const inputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        inputSetter.call(titleInput, title)
        titleInput.dispatchEvent(new InputEvent('input', { bubbles: true, data: title, inputType: 'insertText' }))
        titleInput.dispatchEvent(new Event('change', { bubbles: true }))
        titleInput.dispatchEvent(new Event('blur', { bubbles: true }))
        console.log('[COSE] 简书标题填充成功')
      } else {
        console.log('[COSE] 简书未找到标题输入框')
      }

      // 等待编辑器加载
      await new Promise(resolve => setTimeout(resolve, 500))

      // 简书使用 textarea#arthur-editor 作为 Markdown 编辑器
      const editor = document.querySelector('#arthur-editor') || document.querySelector('textarea._3swFR')
      if (editor) {
        editor.focus()
        const textareaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
        textareaSetter.call(editor, contentToFill)
        editor.dispatchEvent(new InputEvent('input', { bubbles: true, data: contentToFill, inputType: 'insertText' }))
        editor.dispatchEvent(new Event('change', { bubbles: true }))
        console.log('[COSE] 简书内容填充成功')
      } else {
        console.log('[COSE] 简书未找到编辑器')
      }
    }
    // 腾讯云开发者社区
    else if (host.includes('cloud.tencent.com')) {
      console.log('[COSE] TencentCloud 开始同步...')

      // 等待页面加载
      await new Promise(resolve => setTimeout(resolve, 1500))

      /**
       * 第一步：确保进入 MD 编辑器模式
       * 检查是否有"切换 MD 编辑器"按钮：
       * - 如果有，说明当前是富文本编辑器，需要点击切换
       * - 如果没有（显示"切换 富文本 编辑器"），说明已经是 MD 编辑器
       */
      const headerBtns = document.querySelectorAll('.header-btn')
      let needSwitch = false
      let switchBtn = null

      for (const btn of headerBtns) {
        if (btn.textContent.includes('切换') && btn.textContent.includes('MD')) {
          needSwitch = true
          switchBtn = btn
          break
        }
      }

      if (needSwitch && switchBtn) {
        console.log('[COSE] TencentCloud 检测到富文本编辑器，正在切换到 MD 编辑器...')
        switchBtn.click()
        // 等待切换完成和 CodeMirror 加载
        await new Promise(resolve => setTimeout(resolve, 2000))
      } else {
        console.log('[COSE] TencentCloud 当前已是 MD 编辑器')
      }

      /**
       * 第二步：等待 CodeMirror 加载完成
       */
      let codeMirror = null
      const maxWait = 5000
      const startTime = Date.now()

      while (Date.now() - startTime < maxWait) {
        const cm = document.querySelector('.CodeMirror')
        if (cm && cm.CodeMirror) {
          codeMirror = cm.CodeMirror
          break
        }
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      if (!codeMirror) {
        console.error('[COSE] TencentCloud 错误：CodeMirror 未加载，请刷新页面后重试')
        return
      }

      /**
       * 第三步：填充标题
       */
      const titleInput = document.querySelector('textarea[placeholder*="标题"]')
      if (titleInput && title) {
        titleInput.focus()
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
        nativeSetter.call(titleInput, title)
        titleInput.dispatchEvent(new Event('input', { bubbles: true }))
        titleInput.dispatchEvent(new Event('change', { bubbles: true }))
        console.log('[COSE] TencentCloud 标题填充成功')
      }

      /**
       * 第四步：填充内容到 CodeMirror
       */
      codeMirror.setValue(contentToFill)
      console.log('[COSE] TencentCloud 内容填充成功')
    }
    // Medium
    else if (host.includes('medium.com')) {
      console.log('[COSE] Medium 开始同步...')

      // 等待编辑器加载
      await new Promise(resolve => setTimeout(resolve, 2000))

      /**
       * 第一步：填充标题
       * Medium 的标题在 h3.graf--title 元素中
       */
      const titleEl = document.querySelector('h3.graf--title')
      if (titleEl && title) {
        titleEl.focus()
        titleEl.textContent = title
        titleEl.dispatchEvent(new Event('input', { bubbles: true }))
        console.log('[COSE] Medium 标题填充成功')
      }

      /**
       * 第二步：填充内容
       * Medium 使用 contenteditable 编辑器，通过 paste 事件注入 HTML 内容
       * 使用剪贴板 HTML（带完整样式）或降级到 body
       */
      const htmlContent = wechatHtml || body || ''
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
    // 搜狐号 - 由 syncToPlatform 单独处理，这里跳过
    else if (host.includes('mp.sohu.com')) {
      console.log('[COSE] 搜狐号由 syncToPlatform 处理')
    }
    // ModelScope 魔搭社区
    // 使用仓颉(cangjie)富文本编辑器，需要特殊的事件序列来触发"转为富文本"
    else if (host.includes('modelscope.cn')) {
      console.log('[COSE] ModelScope 开始同步...')

      // 等待页面加载
      await new Promise(resolve => setTimeout(resolve, 2000))

      const textarea = document.querySelector('textarea')
      const cangjieEditor = document.querySelector('[data-cangjie-editable="true"]')

      if (textarea) {
        // 聚焦到 textarea
        textarea.focus()

        // 触发 paste 事件（这会设置内容并触发"转为富文本"）
        // 注意：不要预先设置 textarea.value，否则会导致内容重复
        try {
          const clipboardData = new DataTransfer()
          clipboardData.setData('text/plain', contentToFill)
          const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: clipboardData
          })
          textarea.dispatchEvent(pasteEvent)
        } catch (e) {
          // 如果 ClipboardEvent 失败，降级到手动设置
          const textareaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
          textareaSetter.call(textarea, contentToFill)
          textarea.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            data: contentToFill,
            inputType: 'insertText'
          }))
        }

        textarea.dispatchEvent(new Event('change', { bubbles: true }))

        console.log('[COSE] ModelScope 内容填充成功')

        // 等待"转为富文本"按钮出现并点击
        await new Promise(resolve => setTimeout(resolve, 800))

        // 查找并点击"转为富文本"按钮
        const findAndClickRichTextBtn = () => {
          // 使用特定选择器
          const richTextBtn = document.querySelector('[data-testid="menu-item-markdownToDoc"][data-role="markdownToDoc"]')
          if (richTextBtn) {
            console.log('[COSE] ModelScope 找到"转为富文本"按钮，点击中...')
            richTextBtn.click()
            return true
          }

          // 降级：查找文本匹配
          const allElements = document.querySelectorAll('button, span, div, a, [role="button"]')
          for (const el of allElements) {
            const text = el.textContent?.trim()
            if (text === '转为富文本' || text?.includes('转为富文本')) {
              console.log('[COSE] ModelScope 找到"转为富文本"按钮（通过文本），点击中...')
              el.click()
              return true
            }
          }
          return false
        }

        // 尝试多次查找
        let found = findAndClickRichTextBtn()
        for (let i = 0; i < 5 && !found; i++) {
          await new Promise(resolve => setTimeout(resolve, 500))
          found = findAndClickRichTextBtn()
        }

        if (found) {
          console.log('[COSE] ModelScope 已点击"转为富文本"')
        } else {
          console.log('[COSE] ModelScope 未找到"转为富文本"按钮（可能已自动转换）')
        }
      } else if (cangjieEditor) {
        // 降级：直接操作仓颉编辑器
        cangjieEditor.focus()
        document.execCommand('selectAll', false, null)
        document.execCommand('insertText', false, contentToFill)
        console.log('[COSE] ModelScope 通过 execCommand 填充')
      } else {
        console.log('[COSE] ModelScope 未找到编辑器')
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
function waitForTab(tabId, timeout = 300000) {
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
