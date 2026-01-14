// Twitter Articles 平台配置
// 使用 marked 进行 Markdown 解析，并转换为 Twitter Articles 支持的格式

const TwitterPlatform = {
  id: 'twitter',
  name: 'Twitter',
  icon: 'https://abs.twimg.com/favicons/twitter.3.ico',
  url: 'https://x.com',
  publishUrl: 'https://x.com/compose/articles/edit/',
  title: 'Twitter Articles',
  type: 'twitter',
}

// Twitter Articles 登录检测配置
// Twitter 使用 auth_token 和 ct0 cookies 进行身份验证
const TwitterLoginConfig = {
  useCookie: true,
  cookieUrl: 'https://x.com',
  cookieNames: ['auth_token', 'ct0'],
}

/**
 * 自定义 Markdown 渲染器
 * 将 Markdown 转换为 Twitter Articles 支持的 HTML 格式
 */
function createTwitterRenderer(marked) {
  const renderer = new marked.Renderer()

  // 标题转换 - Twitter Articles 支持 h1, h2, h3
  renderer.heading = function (text, level) {
    // Twitter Articles 使用 h1 作为标题，h2 作为副标题
    // 文章内容中的标题映射：# -> h2, ## -> h3, ### -> h4
    const mappedLevel = Math.min(level + 1, 4)
    return `<h${mappedLevel}>${text}</h${mappedLevel}>\n`
  }

  // 段落
  renderer.paragraph = function (text) {
    return `<p>${text}</p>\n`
  }

  // 粗体
  renderer.strong = function (text) {
    return `<strong>${text}</strong>`
  }

  // 斜体
  renderer.em = function (text) {
    return `<em>${text}</em>`
  }

  // 删除线
  renderer.del = function (text) {
    return `<s>${text}</s>`
  }

  // 代码块 - Twitter Articles 不原生支持代码高亮，使用 pre + code 格式
  renderer.code = function (code, language) {
    // 转义 HTML 特殊字符
    const escapedCode = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')

    // 使用带样式的 pre 标签，模拟代码块效果
    return `<pre style="background-color: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 14px; line-height: 1.45;"><code>${escapedCode}</code></pre>\n`
  }

  // 行内代码
  renderer.codespan = function (code) {
    const escapedCode = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    return `<code style="background-color: #f6f8fa; padding: 2px 6px; border-radius: 3px; font-family: 'SF Mono', Consolas, monospace; font-size: 0.9em;">${escapedCode}</code>`
  }

  // 引用块
  renderer.blockquote = function (quote) {
    return `<blockquote style="border-left: 4px solid #1d9bf0; padding-left: 16px; margin: 16px 0; color: #536471;">${quote}</blockquote>\n`
  }

  // 无序列表
  renderer.list = function (body, ordered) {
    const tag = ordered ? 'ol' : 'ul'
    return `<${tag}>${body}</${tag}>\n`
  }

  // 列表项
  renderer.listitem = function (text) {
    return `<li>${text}</li>\n`
  }

  // 链接
  renderer.link = function (href, title, text) {
    const titleAttr = title ? ` title="${title}"` : ''
    return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`
  }

  // 图片
  renderer.image = function (href, title, text) {
    const titleAttr = title ? ` title="${title}"` : ''
    const altAttr = text ? ` alt="${text}"` : ''
    return `<img src="${href}"${altAttr}${titleAttr} style="max-width: 100%; height: auto;" />`
  }

  // 水平分割线
  renderer.hr = function () {
    return `<hr style="border: none; border-top: 1px solid #cfd9de; margin: 24px 0;" />\n`
  }

  // 表格
  renderer.table = function (header, body) {
    return `<table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
<thead>${header}</thead>
<tbody>${body}</tbody>
</table>\n`
  }

  renderer.tablerow = function (content) {
    return `<tr>${content}</tr>\n`
  }

  renderer.tablecell = function (content, flags) {
    const tag = flags.header ? 'th' : 'td'
    const align = flags.align ? ` style="text-align: ${flags.align}; border: 1px solid #cfd9de; padding: 8px;"` : ' style="border: 1px solid #cfd9de; padding: 8px;"'
    return `<${tag}${align}>${content}</${tag}>\n`
  }

  return renderer
}

/**
 * 处理数学公式
 * 将 LaTeX 公式转换为可显示的格式
 * Twitter Articles 不原生支持 LaTeX，这里转换为图片或文本格式
 */
function processLatexFormulas(markdown) {
  // 处理行内公式 $...$
  let processed = markdown.replace(/\$([^\$\n]+)\$/g, (match, formula) => {
    // 使用 CodeCogs API 将 LaTeX 转换为图片
    const encodedFormula = encodeURIComponent(formula.trim())
    return `<img src="https://latex.codecogs.com/svg.image?${encodedFormula}" alt="${formula}" style="vertical-align: middle;" />`
  })

  // 处理块级公式 $$...$$
  processed = processed.replace(/\$\$([^\$]+)\$\$/g, (match, formula) => {
    const encodedFormula = encodeURIComponent(formula.trim())
    return `<div style="text-align: center; margin: 16px 0;"><img src="https://latex.codecogs.com/svg.image?${encodedFormula}" alt="${formula}" /></div>`
  })

  return processed
}

/**
 * 将 Markdown 转换为 Twitter Articles 支持的 HTML
 * @param {string} markdown - 原始 Markdown 内容
 * @param {object} marked - marked 库实例
 * @returns {string} - 转换后的 HTML
 */
function convertMarkdownToTwitterHtml(markdown, marked) {
  if (!markdown) return ''

  // 先处理 LaTeX 公式
  let processedMarkdown = processLatexFormulas(markdown)

  // 配置 marked
  const renderer = createTwitterRenderer(marked)
  marked.setOptions({
    renderer: renderer,
    gfm: true,
    breaks: true,
    pedantic: false,
  })

  // 转换 Markdown 为 HTML
  const html = marked.parse(processedMarkdown)

  return html
}

/**
 * Twitter Articles 内容填充函数
 * 流程：
 * 1. 等待编辑器加载
 * 2. 使用 marked 解析 Markdown 并转换格式
 * 3. 填充标题到 textarea[placeholder="Add a title"]
 * 4. 通过 paste 事件填充 HTML 内容到 Draft.js 编辑器
 */
async function fillTwitterContent(content, waitFor, setInputValue) {
  const { title, body, markdown } = content

  console.log('[COSE] Twitter Articles 开始同步...')

  // 等待编辑器加载
  await new Promise(resolve => setTimeout(resolve, 3000))

  // 动态加载 marked 库
  let marked
  try {
    // 尝试从 CDN 加载 marked
    if (!window.marked) {
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js'
      document.head.appendChild(script)
      await new Promise((resolve, reject) => {
        script.onload = resolve
        script.onerror = reject
        setTimeout(reject, 5000) // 5秒超时
      })
    }
    marked = window.marked
  } catch (e) {
    console.error('[COSE] 加载 marked 库失败:', e)
    // 降级处理：直接使用原始内容
    marked = null
  }

  // 转换 Markdown 为 Twitter Articles HTML
  let htmlContent
  if (marked && markdown) {
    htmlContent = convertMarkdownToTwitterHtml(markdown, marked)
    console.log('[COSE] Markdown 已转换为 HTML')
  } else {
    // 降级：使用原始 body 或简单转换
    htmlContent = body || markdown || ''
    if (!htmlContent.includes('<')) {
      // 如果是纯文本，简单转换为段落
      htmlContent = htmlContent.split('\n\n').map(p => `<p>${p}</p>`).join('\n')
    }
  }

  // 第一步：填充标题
  // Twitter Articles 使用 textarea[placeholder="Add a title"]
  const titleInput = await waitFor('textarea[placeholder="Add a title"], textarea[name="Article Title"]', 5000)
  if (titleInput && title) {
    titleInput.focus()
    // 使用 native setter 来绑定 React 的受控组件
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    nativeSetter.call(titleInput, title)
    titleInput.dispatchEvent(new Event('input', { bubbles: true }))
    titleInput.dispatchEvent(new Event('change', { bubbles: true }))
    console.log('[COSE] Twitter Articles 标题填充成功')
  }

  // 第二步：填充内容
  // Twitter Articles 使用 Draft.js 编辑器
  const contentEl = await waitFor('.public-DraftEditor-content[contenteditable="true"], .DraftEditor-root [contenteditable="true"]', 5000)
  if (contentEl && htmlContent) {
    contentEl.focus()

    // 创建 DataTransfer 并设置 HTML 内容
    const dt = new DataTransfer()
    dt.setData('text/html', htmlContent)
    dt.setData('text/plain', htmlContent.replace(/<[^>]*>/g, ''))

    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: dt
    })

    contentEl.dispatchEvent(pasteEvent)
    console.log('[COSE] Twitter Articles 内容填充成功 (Draft.js)')
  } else {
    console.log('[COSE] Twitter Articles 未找到内容编辑器')
  }
}

// 导出
export { TwitterPlatform, TwitterLoginConfig, fillTwitterContent, convertMarkdownToTwitterHtml }
