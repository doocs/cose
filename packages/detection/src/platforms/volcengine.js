import { convertAvatarToBase64 } from '../utils.js'

/**
 * Volcengine (火山引擎开发者社区) detection logic
 * API: /api/fe/v1/user (found via Chrome DevTools network inspection)
 * Response: { data: { name, avatar: { url } }, err_no: 0 }
 * Query from the developer site so the browser sends its first-party cookies.
 */
export async function detectVolcengineUser() {
  try {
    const site = 'https://developer.volcengine.com/'
    const api = new URL('api/fe/v1/user', site).href
    let data = await globalThis.__coseFetchInOpenSiteTab?.(site, api)
    if (!data) {
      const response = await fetch(api, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) return { loggedIn: false }
      data = await response.json()
    }
    if (data?.err_no !== 0 || !(data.data?.user_id || data.data?.name)) return { loggedIn: false }

    const username = data.data.name || ''
    let avatar = data.data.avatar?.url || ''

    if (avatar) avatar = await convertAvatarToBase64(avatar, site)
    return { loggedIn: true, username, avatar }
  } catch (e) {
    return { loggedIn: false }
  }
}
