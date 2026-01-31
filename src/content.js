// Content Script - 在 md.doocs.org 或本地开发环境中运行
// 注入 $cose 全局对象供页面使用

console.log('[COSE Content Script] Loaded!')
console.log('[COSE Content Script] URL:', window.location.href)
console.log('[COSE Content Script] Hostname:', window.location.hostname)

;(function () {
  'use strict'

  // 小红书页面：自动获取并缓存用户信息
  if (window.location.hostname.includes('xiaohongshu.com')) {
    console.log('[COSE] 检测到小红书页面')
    
    // 通过 background script 处理缓存
    setTimeout(async () => {
      try {
        console.log('[COSE] 开始获取小红书用户信息')
        const response = await fetch('https://creator.xiaohongshu.com/api/galaxy/user/info', {
          method: 'GET',
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        })
        console.log('[COSE] API 响应:', response.status)
        if (!response.ok) return
        
        const data = await response.json()
        console.log('[COSE] API 数据:', data?.success, data?.code)
        if (data?.success === true && data?.code === 0 && data?.data?.userId) {
          const userInfo = {
            loggedIn: true,
            username: data.data.userName || data.data.redId || '',
            avatar: data.data.userAvatar || '',
            userId: data.data.userId,
            cachedAt: Date.now()
          }
          
          // 发送给 background script 保存
          if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({
              type: 'CACHE_USER_INFO',
              platform: 'xiaohongshu',
              userInfo
            }).then(() => {
              console.log('[COSE] 小红书用户信息已缓存:', userInfo.username)
            }).catch(e => {
              console.log('[COSE] 缓存失败:', e.message)
            })
          } else {
            console.log('[COSE] Chrome runtime 不可用')
          }
        }
      } catch (e) {
        console.log('[COSE] 缓存失败:', e.message)
      }
    }, 2000)
  }

  // 支付宝开放平台页面：自动获取并缓存用户信息
  if (window.location.hostname.includes('alipay.com')) {
    const cacheAlipayUserInfo = async () => {
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
        if (!response.ok) return
        
        const data = await response.json()
        if (data?.stat === 'ok' && data?.data?.isLoginUser === 1) {
          const userInfo = {
            loggedIn: true,
            username: data.data.nickname || '',
            avatar: data.data.avatar || '',
            cachedAt: Date.now()
          }
          // 通过 background script 保存
          if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({
              type: 'CACHE_USER_INFO',
              platform: 'alipayopen',
              userInfo
            })
          }
          console.log('[COSE] 支付宝用户信息已缓存:', userInfo.username)
        }
      } catch (e) {
        console.log('[COSE] 支付宝用户信息缓存失败:', e.message)
      }
    }
    
    // 页面加载完成后获取用户信息
    if (document.readyState === 'complete') {
      cacheAlipayUserInfo()
    } else {
      window.addEventListener('load', cacheAlipayUserInfo)
    }
  }

  // 注入脚本到页面主世界
  const script = document.createElement('script')
  script.src = chrome.runtime.getURL('src/inject.js')
  script.onload = function () {
    this.remove()
  }
  ;(document.head || document.documentElement).appendChild(script)

  // 监听来自页面的消息
  window.addEventListener('message', async (event) => {
    if (event.source !== window) return
    if (!event.data || event.data.source !== 'cose-page') return

    const { type, requestId, payload } = event.data

    try {
      let result
      switch (type) {
        case 'GET_PLATFORMS':
          result = await chrome.runtime.sendMessage({ type: 'GET_PLATFORMS' })
          break
        case 'CHECK_PLATFORM_STATUS':
          result = await chrome.runtime.sendMessage({
            type: 'CHECK_PLATFORM_STATUS',
            platforms: payload?.platforms,
          })
          break
        case 'CHECK_PLATFORM_STATUS_PROGRESSIVE':
          result = await chrome.runtime.sendMessage({
            type: 'CHECK_PLATFORM_STATUS_PROGRESSIVE',
            platforms: payload?.platforms,
          })
          break
        case 'START_SYNC_BATCH':
          result = await chrome.runtime.sendMessage({ type: 'START_SYNC_BATCH' })
          break
        case 'SYNC_TO_PLATFORM':
          result = await chrome.runtime.sendMessage({
            type: 'SYNC_TO_PLATFORM',
            platformId: payload?.platformId,
            content: payload?.content,
          })
          break
        default:
          result = { error: 'Unknown type' }
      }

      // 发送响应回页面
      window.postMessage(
        {
          source: 'cose-extension',
          requestId,
          result,
        },
        '*'
      )
    } catch (error) {
      window.postMessage(
        {
          source: 'cose-extension',
          requestId,
          error: error.message,
        },
        '*'
      )
    }
  })

  // 监听来自页面的缓存请求（用于手动触发缓存）
  window.addEventListener('message', (event) => {
    if (event.source !== window) return
    
    if (event.data.type === 'COSE_CACHE_USER' && event.data.platform === 'xiaohongshu') {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        console.log('[COSE] 收到缓存请求，保存用户信息')
        chrome.storage.local.set({ xiaohongshu_user: event.data.userInfo })
          .then(() => console.log('[COSE] 小红书用户信息已手动缓存'))
          .catch(e => console.log('[COSE] 缓存失败:', e))
      } else {
        console.log('[COSE] Chrome API 不可用，无法保存缓存')
      }
    }
  })
  // 监听来自 background 的消息并转发到页面（用于渐进式状态更新）
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'PLATFORM_STATUS_UPDATE' || message.type === 'PLATFORM_STATUS_COMPLETE') {
      window.postMessage({
        source: 'cose-extension',
        type: message.type,
        ...message
      }, '*')
    }
  })
})()
