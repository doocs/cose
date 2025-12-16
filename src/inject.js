// 注入到页面主世界的脚本
// 在 window 上暴露 $cose 对象供 Vue 组件使用

;(function () {
  'use strict'

  let requestId = 0
  const pendingRequests = new Map()

  // 监听来自 content script 的响应
  window.addEventListener('message', (event) => {
    if (event.source !== window) return
    if (!event.data || event.data.source !== 'cose-extension') return

    const { requestId: resId, result, error } = event.data
    const pending = pendingRequests.get(resId)
    if (pending) {
      pendingRequests.delete(resId)
      try {
        if (error) {
          // 检查是否是扩展上下文失效的错误
          if (error.includes && error.includes('Extension context invalidated')) {
            console.warn('[COSE] 扩展已重新加载，请刷新页面')
            pending.reject(new Error('扩展已重新加载，请刷新页面'))
          } else {
            pending.reject(new Error(error))
          }
        } else {
          pending.resolve(result)
        }
      } catch (e) {
        console.warn('[COSE] 扩展上下文已失效，请刷新页面')
        pending.reject(new Error('扩展上下文已失效，请刷新页面'))
      }
    }
  })

  // 发送消息到 content script 并等待响应
  function sendMessage(type, payload) {
    return new Promise((resolve, reject) => {
      const id = ++requestId
      pendingRequests.set(id, { resolve, reject })

      window.postMessage(
        {
          source: 'cose-page',
          type,
          requestId: id,
          payload,
        },
        '*'
      )

      // 超时处理
      setTimeout(() => {
        if (pendingRequests.has(id)) {
          pendingRequests.delete(id)
          reject(new Error('Request timeout'))
        }
      }, 120000)
    })
  }

  // 平台配置（与 background.js 保持一致）
  const PLATFORMS = [
    { id: 'csdn', name: 'CSDN', icon: 'https://g.csdnimg.cn/static/logo/favicon32.ico', title: 'CSDN', type: 'csdn' },
    { id: 'juejin', name: 'Juejin', icon: 'https://lf-web-assets.juejin.cn/obj/juejin-web/xitu_juejin_web/static/favicons/favicon-32x32.png', title: '掘金', type: 'juejin' },
    { id: 'wechat', name: 'WeChat', icon: 'https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico', title: '微信公众号', type: 'wechat' },
    { id: 'zhihu', name: 'Zhihu', icon: 'https://static.zhihu.com/heifetz/favicon.ico', title: '知乎', type: 'zhihu' },
  ]

  // 暴露 $cose 全局对象
  window.$cose = {
    // 版本标识
    version: '1.0.0',

    // 获取支持的平台列表
    getPlatforms() {
      return PLATFORMS.map(p => ({
        ...p,
        uid: p.id,
        displayName: p.title,
        home: '',
        checked: false,
      }))
    },

    // 获取账号列表（带登录状态）
    async getAccounts(callback) {
      try {
        // 获取登录状态
        const result = await sendMessage('CHECK_PLATFORM_STATUS', { platforms: PLATFORMS })
        const status = result?.status || {}
        
        const accounts = PLATFORMS.map(p => ({
          uid: p.id,
          type: p.type,
          title: p.title,
          displayName: status[p.id]?.username || p.title,
          icon: p.icon,
          avatar: status[p.id]?.avatar,
          home: '',
          checked: false,
          loggedIn: status[p.id]?.loggedIn || false,
        }))
        
        if (typeof callback === 'function') {
          callback(accounts)
        }
        return accounts
      } catch (error) {
        console.error('获取账号列表失败:', error)
        // 检测是否是扩展重新加载的错误
        if (error.message && (error.message.includes('扩展已重新加载') || error.message.includes('Extension context'))) {
          throw new Error('扩展已重新加载，请刷新页面后重试')
        }
        const accounts = PLATFORMS.map(p => ({
          uid: p.id,
          type: p.type,
          title: p.title,
          displayName: p.title,
          icon: p.icon,
          home: '',
          checked: false,
          loggedIn: false,
        }))
        if (typeof callback === 'function') {
          callback(accounts)
        }
        return accounts
      }
    },

    // 添加发布任务（兼容 wechatsync 的 addTask 接口）
    addTask(taskData, onProgress, onComplete) {
      const { post, accounts } = taskData
      const selectedAccounts = accounts.filter(a => a.checked)

      if (selectedAccounts.length === 0) {
        if (typeof onComplete === 'function') onComplete()
        return
      }

      // 初始化状态
      const status = {
        accounts: selectedAccounts.map(a => ({
          ...a,
          status: 'pending',
          msg: '等待中',
        })),
      }

      if (typeof onProgress === 'function') {
        onProgress(status)
      }

      // 依次同步到各平台
      const syncAll = async () => {
        // 开始新的同步批次，将所有 tab 放入一个 group
        await sendMessage('START_SYNC_BATCH', {})
        
        // 检查是否需要同步到微信公众号
        const hasWechat = selectedAccounts.some(a => (a.uid || a.type) === 'wechat')
        let wechatHtmlContent = null
        if (hasWechat) {
          // 先点击复制按钮，将带样式的内容复制到剪贴板
          const copyBtn = document.querySelector('.copy-btn') || 
                          document.querySelector('button[class*="copy"]') ||
                          document.querySelector('button:has(.lucide-copy)') ||
                          Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('复制'))
          if (copyBtn && typeof copyBtn.click === 'function') {
            copyBtn.click()
            // 等待复制完成
            await new Promise(resolve => setTimeout(resolve, 2000))
            
            // 读取剪贴板中的 HTML 内容
            try {
              const clipboardItems = await navigator.clipboard.read()
              for (const item of clipboardItems) {
                if (item.types.includes('text/html')) {
                  const blob = await item.getType('text/html')
                  wechatHtmlContent = await blob.text()
                  console.log('[COSE] 已读取剪贴板 HTML 内容，长度:', wechatHtmlContent.length)
                  break
                }
              }
            } catch (e) {
              console.log('[COSE] 读取剪贴板失败:', e.message)
            }
          }
        }
        
        for (let i = 0; i < selectedAccounts.length; i++) {
          const account = selectedAccounts[i]
          status.accounts[i].status = 'uploading'
          status.accounts[i].msg = '同步中...'
          if (typeof onProgress === 'function') onProgress({ ...status })

          try {
            const platformId = account.uid || account.type
            const result = await sendMessage('SYNC_TO_PLATFORM', {
              platformId,
              content: {
                title: post.title,
                body: post.content,
                markdown: post.markdown,
                thumb: post.thumb,
                desc: post.desc,
                // 微信公众号使用剪贴板中带样式的 HTML
                wechatHtml: platformId === 'wechat' ? wechatHtmlContent : null,
              },
            })

            if (result?.success) {
              status.accounts[i].status = 'done'
              status.accounts[i].msg = '同步成功'
              status.accounts[i].editResp = { draftLink: '' }
            } else {
              status.accounts[i].status = 'failed'
              status.accounts[i].error = result?.message || '同步失败'
            }
          } catch (error) {
            status.accounts[i].status = 'failed'
            status.accounts[i].error = error.message || '同步失败'
          }

          if (typeof onProgress === 'function') onProgress({ ...status })
        }

        if (typeof onComplete === 'function') onComplete()
      }

      syncAll()
    },
  }

  // 通知页面插件已加载
  console.log('[COSE] 文章同步助手已加载')
  window.dispatchEvent(new CustomEvent('cose-ready'))
})()
