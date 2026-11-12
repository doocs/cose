const origin = 'https://mp.xueqiu.com'

const XueqiuPlatform = {
  id: 'xueqiu',
  mcpMode: 'confirmed_draft',
  name: 'Xueqiu',
  title: '雪球',
  type: 'xueqiu',
  icon: 'https://www.xueqiu.com/favicon.ico',
  url: 'https://www.xueqiu.com/',
  publishUrl: `${origin}/writeV2`,
}

async function checkXueqiuLogin() {
  const cookie = await chrome.cookies.get({ url: origin, name: 'xq_is_login' })
  if (cookie?.value !== '1') return { loggedIn: false }

  try {
    const response = await fetch(XueqiuPlatform.publishUrl, {
      credentials: 'include',
      signal: AbortSignal.timeout(8000),
    })
    if (response.ok) {
      const html = await response.text()
      // The creator page embeds the signed-in profile as JSON.
      const profile = html.match(
        /window\.UOM_CURRENTUSER\s*=\s*(\{[^\r\n]*?\})\s*;?\s*<\/script>/
      )?.[1]
      if (profile) {
        const { currentUser } = JSON.parse(profile)
        const username = currentUser?.screen_name || currentUser?.name
        if (typeof username === 'string' && username.trim()) {
          return { loggedIn: true, username: username.trim() }
        }
      }
    }
  } catch {
    // Preserve cookie-based login detection if the profile cannot be fetched.
  }
  return { loggedIn: true }
}

async function fillXueqiuDraft(title, html, markdown) {
  const waitFor = async (check, timeout) => {
    const deadline = Date.now() + timeout
    do {
      const value = check()
      if (value) return value
      await new Promise(resolve => setTimeout(resolve, 250))
    } while (Date.now() < deadline)
  }

  const fields = await waitFor(() => {
    const input = document.querySelector('textarea[placeholder="请输入标题"]')
    const editor = document.querySelector('.ProseMirror[contenteditable="true"]')
    return input && editor && { input, editor }
  }, 12000)
  if (!fields) return { success: false, message: '找不到雪球长文编辑器，请确认已登录' }

  const { input, editor } = fields
  if (
    location.pathname !== '/writeV2' ||
    input.value ||
    editor.innerText.trim() ||
    editor.querySelector('img')
  ) {
    return { success: false, message: '雪球编辑器已有内容，已停止同步' }
  }

  const template = document.createElement('template')
  if (html) template.innerHTML = html
  else template.content.textContent = markdown || ''

  for (const table of template.content.querySelectorAll('table')) {
    const rows = Array.from(table.rows, row =>
      Array.from(row.cells, cell => cell.textContent.trim().replace(/\s+/g, ' '))
    )
    if (!rows.length || !rows[0].length) continue

    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    const font = '22px sans-serif'
    context.font = font
    const columns = Math.max(...rows.map(row => row.length))
    const widths = Array(columns).fill(120)
    for (const row of rows) {
      row.forEach((cell, index) => {
        widths[index] = Math.max(widths[index], Math.ceil(context.measureText(cell).width) + 32)
      })
    }
    const height = 48
    canvas.width = widths.reduce((sum, width) => sum + width, 0) + 2
    canvas.height = rows.length * height + 2
    if (canvas.width > 8192 || canvas.height > 8192) {
      return { success: false, message: '雪球表格太大，无法转成图片' }
    }
    context.font = font
    context.textBaseline = 'middle'
    rows.forEach((row, rowIndex) => {
      let x = 1
      const y = 1 + rowIndex * height
      widths.forEach((width, columnIndex) => {
        context.fillStyle = rowIndex === 0 ? '#eef2f7' : '#fff'
        context.fillRect(x, y, width, height)
        context.strokeStyle = '#aab4c1'
        context.strokeRect(x, y, width, height)
        context.fillStyle = '#182334'
        context.fillText(row[columnIndex] ?? '', x + 16, y + height / 2)
        x += width
      })
    })
    const image = document.createElement('img')
    image.alt = '表格'
    image.src = canvas.toDataURL('image/png')
    table.replaceWith(image)
  }

  const imageCount = template.content.querySelectorAll('img').length
  const bodyText = template.content.textContent.trim()
  if (!title?.trim() || (!bodyText && !imageCount)) {
    return { success: false, message: '雪球长文需要标题和正文' }
  }

  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, title)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  const data = new DataTransfer()
  data.setData('text/html', template.innerHTML)
  data.setData('text/plain', bodyText)
  editor.focus()
  editor.dispatchEvent(
    new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })
  )

  const saved = await waitFor(() => {
    const images = [...editor.querySelectorAll('img')]
    return (
      input.value === title &&
      (!bodyText || editor.innerText.trim()) &&
      images.length === imageCount &&
      images.every(
        image => new URL(image.src).hostname === 'xqimg.imedao.com' && image.naturalWidth
      ) &&
      document.body.innerText.includes('已经保存至草稿')
    )
  }, 30000)
  if (!saved) return { success: false, message: '未确认雪球已保存完整草稿，请检查打开的编辑器' }
  return { success: true, draftLink: 'https://mp.xueqiu.com/draft/long' }
}

async function syncXueqiuDraft(tab, content, { chrome, waitForTab }) {
  await waitForTab(tab.id, 12000)
  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: fillXueqiuDraft,
    args: [content.title ?? '', content.body ?? '', content.markdown ?? ''],
    world: 'MAIN',
  })
  return result?.result ?? { success: false, message: '雪球编辑器未返回草稿状态' }
}

export { XueqiuPlatform, checkXueqiuLogin, syncXueqiuDraft }
