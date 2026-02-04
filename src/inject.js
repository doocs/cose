// 注入到页面主世界的脚本
// 在 window 上暴露 $cose 对象供 Vue 组件使用

; (function () {
  'use strict'

  let requestId = 0
  const pendingRequests = new Map()
  
  // 渐进式更新的回调
  let progressiveCallbacks = {
    onProgress: null,
    onComplete: null
  }

  // 监听来自 content script 的响应
  window.addEventListener('message', (event) => {
    if (event.source !== window) return
    if (!event.data || event.data.source !== 'cose-extension') return

    const { type, requestId: resId, result, error, platformId, platform, completed, total } = event.data
    
    // 处理渐进式平台状态更新
    if (type === 'PLATFORM_STATUS_UPDATE') {
      if (progressiveCallbacks.onProgress && platform && event.data.result) {
        const platformResult = event.data.result
        const account = {
          uid: platform.id,
          type: platform.type,
          title: platform.title,
          displayName: platformResult.loggedIn ? (platformResult.username || platform.title) : platform.title,
          icon: platform.icon,
          avatar: platformResult.avatar,
          home: platform.url || '',
          checked: false,
          loggedIn: platformResult.loggedIn || false,
          isChecking: false
        }
        progressiveCallbacks.onProgress(account, completed, total)
      }
      return
    }
    
    // 处理渐进式检测完成
    if (type === 'PLATFORM_STATUS_COMPLETE') {
      if (progressiveCallbacks.onComplete) {
        progressiveCallbacks.onComplete()
      }
      return
    }

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
    { id: 'csdn', name: 'CSDN', icon: 'https://g.csdnimg.cn/static/logo/favicon32.ico', title: 'CSDN', type: 'csdn', url: 'https://blog.csdn.net/' },
    { id: 'juejin', name: 'Juejin', icon: 'https://lf-web-assets.juejin.cn/obj/juejin-web/xitu_juejin_web/static/favicons/favicon-32x32.png', title: '掘金', type: 'juejin', url: 'https://juejin.cn/' },
    { id: 'wechat', name: 'WeChat', icon: 'https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico', title: '微信公众号', type: 'wechat', url: 'https://mp.weixin.qq.com/' },
    { id: 'zhihu', name: 'Zhihu', icon: 'https://static.zhihu.com/heifetz/favicon.ico', title: '知乎', type: 'zhihu', url: 'https://www.zhihu.com/signin' },
    { id: 'toutiao', name: 'Toutiao', icon: 'https://sf3-cdn-tos.toutiaostatic.com/obj/eden-cn/uhbfnupkbps/toutiao_favicon.ico', title: '今日头条', type: 'toutiao', url: 'https://mp.toutiao.com/' },
    { id: 'segmentfault', name: 'SegmentFault', icon: 'https://fastly.jsdelivr.net/gh/bucketio/img16@main/2026/02/01/1769960912823-e037663a-7f65-414e-a114-ed86b4e86964.png', title: '思否', type: 'segmentfault', url: 'https://segmentfault.com/user/login' },
    { id: 'cnblogs', name: 'Cnblogs', icon: 'https://www.cnblogs.com/favicon.ico', title: '博客园', type: 'cnblogs', url: 'https://account.cnblogs.com/signin' },
    { id: 'oschina', name: 'OSChina', icon: 'https://wsrv.nl/?url=static.oschina.net/new-osc/img/favicon.ico', title: '开源中国', type: 'oschina', url: 'https://www.oschina.net/home/login' },
    { id: 'cto51', name: '51CTO', icon: 'https://blog.51cto.com/favicon.ico', title: '51CTO', type: 'cto51', url: 'https://home.51cto.com/index' },
    { id: 'infoq', name: 'InfoQ', icon: 'https://static001.infoq.cn/static/write/img/write-favicon.jpg', title: 'InfoQ', type: 'infoq', url: 'https://xie.infoq.cn/' },
    { id: 'jianshu', name: 'Jianshu', icon: 'https://www.jianshu.com/favicon.ico', title: '简书', type: 'jianshu', url: 'https://www.jianshu.com/sign_in' },
    { id: 'baijiahao', name: 'Baijiahao', icon: 'https://pic.rmb.bdstatic.com/10e1e2b43c35577e1315f0f6aad6ba24.vnd.microsoft.icon', title: '百家号', type: 'baijiahao', url: 'https://baijiahao.baidu.com/' },
    { id: 'wangyihao', name: 'Wangyihao', icon: 'https://static.ws.126.net/163/f2e/news/yxybd_pc/resource/static/share-icon.png', title: '网易号', type: 'wangyihao', url: 'https://mp.163.com/' },
    { id: 'tencentcloud', name: 'TencentCloud', icon: 'https://cloudcache.tencent-cloud.com/qcloud/favicon.ico', title: '腾讯云开发者社区', type: 'tencentcloud', url: 'https://cloud.tencent.com/developer' },
    { id: 'medium', name: 'Medium', icon: 'https://cdn.simpleicons.org/medium', title: 'Medium', type: 'medium', url: 'https://medium.com' },
    { id: 'sspai', name: 'Sspai', icon: 'https://cdn-static.sspai.com/favicon/sspai.ico', title: '少数派', type: 'sspai', url: 'https://sspai.com' },
    { id: 'sohu', name: 'Sohu', icon: 'https://statics.itc.cn/mp-new/icon/1.1/favicon.ico', title: '搜狐号', type: 'sohu', url: 'https://mp.sohu.com' },
    { id: 'bilibili', name: 'Bilibili', icon: 'https://www.bilibili.com/favicon.ico', title: 'B站专栏', type: 'bilibili', url: 'https://member.bilibili.com/article-text/home?newEditor=-1' },
    { id: 'weibo', name: 'Weibo', icon: 'https://weibo.com/favicon.ico', title: '微博头条', type: 'weibo', url: 'https://card.weibo.com/article/v5/editor#/draft' },
    { id: 'aliyun', name: 'Aliyun', icon: 'https://img.alicdn.com/tfs/TB1_ZXuNcfpK1RjSZFOXXa6nFXa-32-32.ico', title: '阿里云开发者社区', type: 'aliyun', url: 'https://developer.aliyun.com/article/new#/' },
    { id: 'huaweicloud', name: 'HuaweiCloud', icon: 'https://www.huaweicloud.com/favicon.ico', title: '华为云开发者博客', type: 'huaweicloud', url: 'https://bbs.huaweicloud.com/blogs/article' },
    { id: 'huaweidev', name: 'HuaweiDev', icon: 'https://developer.huawei.com/favicon.ico', title: '华为开发者文章', type: 'huaweidev', url: 'https://developer.huawei.com/consumer/cn/blog/create' },
    { id: 'twitter', name: 'Twitter', icon: 'https://abs.twimg.com/favicons/twitter.3.ico', title: 'Twitter Articles', type: 'twitter', url: 'https://x.com/compose/articles/edit/' },
    { id: 'qianfan', name: 'Qianfan', icon: 'https://bce.bdstatic.com/img/favicon.ico', title: '百度云千帆', type: 'qianfan', url: 'https://qianfan.cloud.baidu.com/qianfandev/topic/create' },
    { id: 'alipayopen', name: 'AlipayOpen', icon: 'https://www.alipay.com/favicon.ico', title: '支付宝开放平台', type: 'alipayopen', url: 'https://open.alipay.com/portal/forum/post/add#article' },
    { id: 'modelscope', name: 'ModelScope', icon: 'https://img.alicdn.com/imgextra/i4/O1CN01fvt4it25rEZU4Gjso_!!6000000007579-2-tps-128-128.png', title: 'ModelScope 魔搭社区', type: 'modelscope', url: 'https://modelscope.cn/learn/create' },
    { id: 'volcengine', name: 'Volcengine', icon: 'https://lf1-cdn-tos.bytegoofy.com/goofy/tech-fe/fav.png', title: '火山引擎开发者社区', type: 'volcengine', url: 'https://developer.volcengine.com/articles/draft' },
    { id: 'douyin', name: 'Douyin', icon: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/yvahlyj_upfbvk_zlp/ljhwZthlaukjlkulzlp/pc_creator/favicon_v2_7145ff0.ico', title: '抖音文章', type: 'douyin', url: 'https://creator.douyin.com/creator-micro/content/post/article?default-tab=5&enter_from=publish_page&media_type=article&type=new' },
    { id: 'xiaohongshu', name: 'Xiaohongshu', icon: 'https://www.xiaohongshu.com/favicon.ico', title: '小红书', type: 'xiaohongshu', url: 'https://creator.xiaohongshu.com/publish/publish?from=menu&target=article' },
    { id: 'elecfans', name: 'Elecfans', icon: 'https://www.elecfans.com/favicon.ico', title: '电子发烧友', type: 'elecfans', url: 'https://www.elecfans.com/d/article/md/' },
    { id: 'llmapis', name: 'LLMAPIS', icon: 'https://llmapis.com/favicon.ico', title: 'LLMAPIS', type: 'llmapis', url: 'https://llmapis.com/garden/post/new' },
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

        const accounts = PLATFORMS.map(p => {
          const platformStatus = status[p.id] || {}
          const isLoggedIn = platformStatus.loggedIn || false
          return {
            uid: p.id,
            type: p.type,
            title: p.title,
            displayName: isLoggedIn ? (platformStatus.username || p.title) : p.title,
            icon: p.icon,
            avatar: platformStatus.avatar,
            home: p.url || '',
            checked: false,
            loggedIn: isLoggedIn,
          }
        })

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
          home: p.url || '',
          checked: false,
          loggedIn: false,
        }))
        if (typeof callback === 'function') {
          callback(accounts)
        }
        return accounts
      }
    },

    // 渐进式获取账号列表（每个平台检测完成后立即返回）
    // onProgress(account, completed, total) - 每个平台完成时调用
    // onComplete() - 所有平台完成时调用
    getAccountsProgressive(onProgress, onComplete) {
      progressiveCallbacks.onProgress = onProgress
      progressiveCallbacks.onComplete = onComplete
      
      // 发送渐进式检测请求
      sendMessage('CHECK_PLATFORM_STATUS_PROGRESSIVE', { platforms: PLATFORMS })
        .catch(error => {
          console.error('[COSE] 渐进式检测启动失败:', error)
          // 如果启动失败，调用完成回调
          if (typeof onComplete === 'function') {
            onComplete()
          }
        })
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

        // 检查是否需要同步到微信公众号或百家号或网易号或 Medium 或少数派或B站专栏或微博头条或小红书（需要使用剪贴板 HTML）
        const hasWechat = selectedAccounts.some(a => (a.uid || a.type) === 'wechat')
        const hasBaijiahao = selectedAccounts.some(a => (a.uid || a.type) === 'baijiahao')
        const hasWangyihao = selectedAccounts.some(a => (a.uid || a.type) === 'wangyihao')
        const hasMedium = selectedAccounts.some(a => (a.uid || a.type) === 'medium')
        const hasSspai = selectedAccounts.some(a => (a.uid || a.type) === 'sspai')
        const hasBilibili = selectedAccounts.some(a => (a.uid || a.type) === 'bilibili')
        const hasWeibo = selectedAccounts.some(a => (a.uid || a.type) === 'weibo')
        const hasXiaohongshu = selectedAccounts.some(a => (a.uid || a.type) === 'xiaohongshu')
        let clipboardHtmlContent = null
        if (hasWechat || hasBaijiahao || hasWangyihao || hasMedium || hasSspai || hasBilibili || hasWeibo || hasXiaohongshu) {
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
                  clipboardHtmlContent = await blob.text()
                  console.log('[COSE] 已读取剪贴板 HTML 内容，长度:', clipboardHtmlContent.length)
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
                // 微信公众号、百家号、网易号、Medium、少数派、B站专栏、微博头条和小红书使用剪贴板中带样式的 HTML
                wechatHtml: (platformId === 'wechat' || platformId === 'baijiahao' || platformId === 'wangyihao' || platformId === 'medium' || platformId === 'sspai' || platformId === 'bilibili' || platformId === 'weibo' || platformId === 'xiaohongshu') ? clipboardHtmlContent : null,
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
