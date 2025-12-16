// Content Script - 在 md.doocs.org 或本地开发环境中运行
// 注入 $cose 全局对象供页面使用

;(function () {
  'use strict'

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
})()
