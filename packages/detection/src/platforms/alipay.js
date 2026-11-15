const cacheKey = 'alipayopen_user'
const cacheLifetime = 8 * 60 * 60 * 1000

async function alipaySessionKey() {
  const session = await chrome.cookies.get({
    url: 'https://developerportal.alipay.com/',
    name: 'ALIPAYJSESSIONID',
  })
  if (!session?.value) return null

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(session.value))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function cacheAlipayUser(account, sessionKey) {
  const currentSessionKey = await alipaySessionKey()
  if (!account.loggedIn || !currentSessionKey || (sessionKey && currentSessionKey !== sessionKey))
    return
  await chrome.storage.local.set({
    [cacheKey]: {
      loggedIn: true,
      username: account.username || '',
      avatar: account.avatar || '',
      cachedAt: Date.now(),
      sessionKey: currentSessionKey,
    },
  })
}

/**
 * Alipay Open platform detection logic
 * Verify the current account in an open Alipay tab or use its session-bound cache.
 */
export async function detectAlipayUser() {
  try {
    const sessionKey = await alipaySessionKey()
    if (!sessionKey) {
      await chrome.storage.local.remove(cacheKey)
      return { loggedIn: false }
    }

    // Prefer an open platform tab, where the forum identity is available.
    const tabs = await chrome.tabs.query({ url: 'https://open.alipay.com/*' })
    const tab = tabs.find(tab => tab.id && !tab.discarded)

    if (tab) {
      try {
        // 在已打开的页面上下文中调用 API
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: async () => {
            try {
              const response = await fetch(
                'https://developerportal.alipay.com/octopus/service.do',
                {
                  method: 'POST',
                  credentials: 'include',
                  headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
                  },
                  body: 'data=%5B%7B%7D%5D&serviceName=alipay.open.developerops.forum.user.query',
                }
              )
              if (!response.ok) return null
              return await response.json()
            } catch (e) {
              return null
            }
          },
        })

        const data = results?.[0]?.result
        if (data?.stat === 'ok' && data?.data?.isLoginUser === 1) {
          const username = data.data.nickname || ''
          const avatar = data.data.avatar || ''

          const account = { loggedIn: true, username, avatar }
          await cacheAlipayUser(account, sessionKey)
          return account
        }
      } catch (e) {
        console.log(`[COSE] alipayopen 从页面获取用户信息失败:`, e.message)
      }
    }

    const account = await globalThis.__coseFetchInOpenSiteTab?.(
      'https://open.alipay.com/',
      'https://developerportal.alipay.com/account/getOpenAccount.json'
    )
    if (account?.stat === 'ok' && account.data?.uid) {
      const { name, avatar } = account.data
      const result = { loggedIn: true, username: name || '', avatar: avatar || '' }
      await cacheAlipayUser(result, sessionKey)
      return result
    }
    if (account?.stat === 'deny') {
      await chrome.storage.local.remove(cacheKey)
      return { loggedIn: false }
    }

    const { [cacheKey]: cached } = await chrome.storage.local.get(cacheKey)
    if (
      cached?.loggedIn &&
      cached.sessionKey === sessionKey &&
      Date.now() - cached.cachedAt < cacheLifetime
    ) {
      return { loggedIn: true, username: cached.username, avatar: cached.avatar }
    }

    console.log(`[COSE] alipayopen 未检测到登录状态`)
    return { loggedIn: false }
  } catch (e) {
    console.log(`[COSE] alipayopen 检测失败:`, e.message)
    return { loggedIn: false, error: e.message }
  }
}
