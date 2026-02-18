// 百度千帆开发者社区平台配置
// 编辑器支持 Markdown 自动转换功能

const QianfanPlatform = {
  id: 'qianfan',
  name: 'Qianfan',
  icon: 'https://bce.bdstatic.com/img/favicon.ico',
  url: 'https://qianfan.cloud.baidu.com/qianfandev',
  publishUrl: 'https://qianfan.cloud.baidu.com/qianfandev/topic/create',
  title: '百度云千帆',
  type: 'qianfan',
}



// 千帆平台拦截函数
// 在 MAIN world 中执行，拦截所有可能导致跳转到登录页的行为
// 包括：fetch, XHR, sendBeacon, location 跳转, window.open, Navigation API, History API
function qianfanIntercept() {
  if (!location.href.includes('qianfan.cloud.baidu.com')) return

  const INTERCEPT_PATTERN = '/api/community/topic'
  const LOGIN_URL_PATTERN = 'login.bce.baidu.com'
  let blockedCount = 0

  const FAKE_RESPONSE = JSON.stringify({
    success: true,
    status: 200,
    result: { id: 'cose-intercepted' }
  })

  console.log('[COSE] 千帆拦截器开始安装...')

  // ========== 拦截 fetch ==========
  const originalFetch = window.fetch
  window.fetch = function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || ''
    const opts = args[1] || {}
    const method = (opts.method || (args[0]?.method) || 'GET').toUpperCase()

    if (url.includes(INTERCEPT_PATTERN) && method === 'POST') {
      console.log('[COSE] 拦截 fetch POST:', url, '(已拦截', ++blockedCount, '个)')
      return Promise.resolve(new Response(FAKE_RESPONSE, {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }))
    }
    return originalFetch.apply(this, args)
  }

  // ========== 拦截 XMLHttpRequest ==========
  const originalXHROpen = XMLHttpRequest.prototype.open
  const originalXHRSend = XMLHttpRequest.prototype.send

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._coseUrl = url
    this._coseMethod = (method || 'GET').toUpperCase()
    return originalXHROpen.call(this, method, url, ...rest)
  }

  XMLHttpRequest.prototype.send = function (body) {
    if (this._coseUrl?.includes(INTERCEPT_PATTERN) && this._coseMethod === 'POST') {
      console.log('[COSE] 拦截 XHR POST:', this._coseUrl, '(已拦截', ++blockedCount, '个)')
      const self = this
      setTimeout(() => {
        Object.defineProperty(self, 'readyState', { get: () => 4, configurable: true })
        Object.defineProperty(self, 'status', { get: () => 200, configurable: true })
        Object.defineProperty(self, 'statusText', { get: () => 'OK', configurable: true })
        Object.defineProperty(self, 'responseText', { get: () => FAKE_RESPONSE, configurable: true })
        Object.defineProperty(self, 'response', { get: () => FAKE_RESPONSE, configurable: true })
        self.dispatchEvent(new Event('readystatechange'))
        self.dispatchEvent(new Event('load'))
        self.dispatchEvent(new Event('loadend'))
        if (typeof self.onreadystatechange === 'function') self.onreadystatechange()
        if (typeof self.onload === 'function') self.onload()
      }, 10)
      return
    }
    return originalXHRSend.call(this, body)
  }

  // ========== 拦截 navigator.sendBeacon ==========
  const originalSendBeacon = navigator.sendBeacon?.bind(navigator)
  if (originalSendBeacon) {
    navigator.sendBeacon = function (url, data) {
      if (url?.includes(INTERCEPT_PATTERN)) {
        console.log('[COSE] 拦截 sendBeacon:', url, '(已拦截', ++blockedCount, '个)')
        return true
      }
      return originalSendBeacon(url, data)
    }
  }

  // ========== 拦截 location 跳转到登录页 ==========
  const origAssign = window.location.assign.bind(window.location)
  const origReplace = window.location.replace.bind(window.location)

  window.location.assign = function (url) {
    if (typeof url === 'string' && url.includes(LOGIN_URL_PATTERN)) {
      console.log('[COSE] 拦截 location.assign 跳转到登录页:', url)
      return
    }
    return origAssign(url)
  }

  window.location.replace = function (url) {
    if (typeof url === 'string' && url.includes(LOGIN_URL_PATTERN)) {
      console.log('[COSE] 拦截 location.replace 跳转到登录页:', url)
      return
    }
    return origReplace(url)
  }

  // ========== 拦截 window.open 到登录页 ==========
  const originalOpen = window.open
  window.open = function (url, ...rest) {
    if (typeof url === 'string' && url.includes(LOGIN_URL_PATTERN)) {
      console.log('[COSE] 拦截 window.open 跳转到登录页:', url)
      return null
    }
    return originalOpen.call(this, url, ...rest)
  }

  // ========== 拦截 Navigation API ==========
  if (window.navigation) {
    window.navigation.addEventListener('navigate', (e) => {
      const destUrl = e.destination?.url || ''
      console.log('[COSE] Navigation API navigate 事件:', destUrl)
      if (destUrl.includes(LOGIN_URL_PATTERN)) {
        console.log('[COSE] 拦截 Navigation API 跳转到登录页')
        e.preventDefault()
      }
    })
  }

  // ========== 拦截 History API ==========
  const origPushState = history.pushState.bind(history)
  const origReplaceState = history.replaceState.bind(history)

  history.pushState = function (state, title, url) {
    if (typeof url === 'string' && url.includes(LOGIN_URL_PATTERN)) {
      console.log('[COSE] 拦截 pushState 跳转到登录页:', url)
      return
    }
    return origPushState(state, title, url)
  }

  history.replaceState = function (state, title, url) {
    if (typeof url === 'string' && url.includes(LOGIN_URL_PATTERN)) {
      console.log('[COSE] 拦截 replaceState 跳转到登录页:', url)
      return
    }
    return origReplaceState(state, title, url)
  }

  console.log('[COSE] 千帆拦截器安装完成（fetch/XHR/sendBeacon/location/navigation）')
}

// 导出
export { QianfanPlatform, qianfanIntercept }
