// 支付宝开放平台配置
const AlipayOpenPlatform = {
  id: 'alipayopen',
  name: 'AlipayOpen',
  icon: 'https://www.alipay.com/favicon.ico',
  url: 'https://open.alipay.com',
  publishUrl: 'https://open.alipay.com/portal/forum/post/add#article',
  title: '支付宝开放平台',
  type: 'alipayopen',
}

// 支付宝开放平台登录检测配置
const AlipayOpenLoginConfig = {
  api: 'https://developerportal.alipay.com/account/getOpenAccount.json',
  method: 'GET',
  checkLogin: (response) => response?.stat === 'ok' && !!response?.data,
  getUserInfo: (response) => {
    const data = response?.data
    return {
      username: data?.name || data?.logonId,
      avatar: data?.avatar,
    }
  },
}

/**
 * 支付宝开放平台内容填充函数
 * 注意：此函数会被序列化后通过 chrome.scripting.executeScript 注入页面执行
 * 因此必须是自包含的，不能依赖外部模块或闭包
 * @param {string} title - 文章标题
 * @param {string} markdown - Markdown 内容
 */
function fillAlipayOpenContent(title, markdown) {
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))
  
  return (async () => {
    try {
      console.log('[COSE] 支付宝开放平台 开始填充, 标题:', title)

      // 等待页面加载
      await sleep(500)

      // 填充标题 - 尝试多种选择器
      let titleInput = document.querySelector('input[placeholder*="标题"]')
      if (!titleInput) {
        titleInput = document.querySelector('input[placeholder*="请输入"]')
      }
      if (!titleInput) {
        const allInputs = document.querySelectorAll('input')
        for (const inp of allInputs) {
          if (inp.placeholder && inp.placeholder.includes('标题')) {
            titleInput = inp
            break
          }
        }
      }
      
      console.log('[COSE] 支付宝开放平台 查找标题输入框:', !!titleInput)
      
      if (titleInput && title) {
        titleInput.focus()
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        nativeSetter.call(titleInput, title)
        titleInput.dispatchEvent(new Event('input', { bubbles: true }))
        titleInput.dispatchEvent(new Event('change', { bubbles: true }))
        titleInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }))
        console.log('[COSE] 支付宝开放平台 标题填充成功:', title)
      } else {
        console.log('[COSE] 支付宝开放平台 标题填充失败 - input:', !!titleInput, 'title:', !!title)
      }

      await sleep(300)

      // 填充内容 - 支付宝开放平台使用 ne-engine 富文本编辑器
      const editor = document.querySelector('.ne-engine')
      if (editor && markdown) {
        editor.focus()
        await sleep(100)

        // 使用 ClipboardEvent 模拟粘贴 Markdown 内容
        const dt = new DataTransfer()
        dt.setData('text/plain', markdown)
        
        const pasteEvent = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: dt
        })
        
        editor.dispatchEvent(pasteEvent)
        console.log('[COSE] 支付宝开放平台 内容粘贴成功')

        // 等待并点击"立即转换"按钮
        let confirmed = false
        for (let i = 0; i < 15; i++) {
          await sleep(200)
          const convertBtn = Array.from(document.querySelectorAll('button')).find(
            btn => btn.textContent.includes('立即转换')
          )
          if (convertBtn) {
            convertBtn.click()
            confirmed = true
            console.log('[COSE] 支付宝开放平台 Markdown 转换成功')
            break
          }
        }

        return { success: true, confirmed }
      }

      return { success: false, error: '未找到编辑器' }
    } catch (e) {
      console.error('[COSE] 支付宝开放平台 填充失败:', e)
      return { success: false, error: e.message }
    }
  })()
}

// 导出
export { AlipayOpenPlatform, AlipayOpenLoginConfig, fillAlipayOpenContent }
