/**
 * Xiaohongshu (Little Red Book) platform detection logic
 * Strategy:
 * 1. Check for the browser's visitor cookie before contacting the creator API
 * 2. Best-effort: fetch user info via offscreen document or open tab
 * 3. Fall back to chrome.storage.local cache for user details
 */
export async function detectXiaohongshuUser() {
  try {
    // a1 identifies the browser and can be present after logout.
    const a1Cookie = await chrome.cookies.get({
      url: 'https://creator.xiaohongshu.com',
      name: 'a1',
    })
    if (!a1Cookie || !a1Cookie.value) {
      return { loggedIn: false }
    }

    let sessionRejected = false
    // 2a. Try offscreen fetch (document context, cookies sent automatically)
    try {
      const offscreenDetect = globalThis.__coseDetectXiaohongshu
      if (offscreenDetect) {
        const offResult = await offscreenDetect()
        sessionRejected = offResult?.sessionRejected === true
        if (offResult && offResult.loggedIn) {
          // Update cache
          const userInfo = { ...offResult, cachedAt: Date.now() }
          await chrome.storage.local.set({ xiaohongshu_user: userInfo })
          return {
            loggedIn: true,
            username: offResult.username || '',
            avatar: offResult.avatar || '',
          }
        }
      }
    } catch (e) {
      console.log('[COSE] xiaohongshu offscreen detection failed:', e.message)
    }

    // 2b. Try open tab injection
    try {
      const tabs = await chrome.tabs.query({ url: 'https://creator.xiaohongshu.com/*' })
      if (tabs.length > 0) {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: async () => {
            try {
              const response = await fetch('https://creator.xiaohongshu.com/api/galaxy/user/info', {
                method: 'GET',
                credentials: 'include',
                headers: { Accept: 'application/json' },
              })
              if (response.status === 401) return { loggedIn: false, sessionRejected: true }
              if (!response.ok) return null
              const data = await response.json()
              if (data?.success === true && data?.code === 0 && data?.data?.userId) {
                return {
                  loggedIn: true,
                  username: data.data.userName || data.data.redId || '',
                  avatar: data.data.userAvatar || '',
                  userId: data.data.userId,
                }
              }
              return null
            } catch (e) {
              return null
            }
          },
        })
        const result = results?.[0]?.result
        sessionRejected ||= result?.sessionRejected === true
        if (result && result.loggedIn) {
          const userInfo = { ...result, cachedAt: Date.now() }
          await chrome.storage.local.set({ xiaohongshu_user: userInfo })
          return {
            loggedIn: true,
            username: userInfo.username || '',
            avatar: userInfo.avatar || '',
          }
        }
      }
    } catch (e) {
      console.log('[COSE] xiaohongshu tab detection failed:', e.message)
    }

    // Cached identity is only usable while the creator session cookie exists.
    const session = await chrome.cookies.get({
      url: 'https://creator.xiaohongshu.com/',
      name: 'web_session',
    })
    if (sessionRejected || !session?.value) {
      await chrome.storage.local.remove('xiaohongshu_user')
      return { loggedIn: false }
    }

    const stored = await chrome.storage.local.get('xiaohongshu_user')
    const cachedUser = stored.xiaohongshu_user
    if (cachedUser && cachedUser.username) {
      const cacheAge = Date.now() - (cachedUser.cachedAt || 0)
      const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days
      if (cacheAge < maxAge) {
        console.log('[COSE] xiaohongshu 从缓存读取:', cachedUser.username)
        return {
          loggedIn: true,
          username: cachedUser.username || '',
          avatar: cachedUser.avatar || '',
        }
      }
    }

    return { loggedIn: false }
  } catch (e) {
    console.log('[COSE] xiaohongshu 检测失败:', e.message)
    return { loggedIn: false }
  }
}

// Also injected into an open creator tab when browser cookie policy requires it.
export async function fetchRednoteUser() {
  try {
    const response = await fetch('https://creator.rednote.com/api/galaxy/user/info', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    })
    if (response.ok) {
      const { success, code, data } = await response.json()
      if (success === true && code === 0 && data?.userId) {
        return {
          loggedIn: true,
          username: data.userName || data.redId || '',
          avatar: data.userAvatar || '',
        }
      }
    }
  } catch {
    // Try the creator tab when the extension request cannot use its session.
  }
  return { loggedIn: false }
}
