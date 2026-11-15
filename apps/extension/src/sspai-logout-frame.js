// Run only in the frame that the extension opens for a confirmed logout.
if (window.parent !== window && location.pathname === '/robots.txt') {
  const extensionOrigin = chrome.runtime.getURL('').replace(/\/$/, '')
  window.addEventListener('message', event => {
    if (
      event.source !== window.parent ||
      event.origin !== extensionOrigin ||
      event.data?.type !== 'COSE_CLEAR_SSPAI_STORAGE'
    )
      return

    let cleared = false
    try {
      localStorage.removeItem('ssToken')
      const cachedState = localStorage.getItem('vuex')
      if (cachedState) {
        const state = JSON.parse(cachedState)
        if (state && typeof state === 'object') {
          delete state.token
          delete state.userInfo
          delete state.isLogin
          delete state.loginTime
          localStorage.setItem('vuex', JSON.stringify(state))
        }
      }
      cleared = true
    } catch {
      // Report failure if the browser denied access or the stored state was unreadable.
    }
    event.source.postMessage(
      {
        type: 'COSE_SSPAI_STORAGE_RESULT',
        id: event.data.id,
        cleared,
      },
      extensionOrigin
    )
  })
}
