const BilibiliPlatform = {
  id: 'bilibili',
  name: 'Bilibili',
  icon: 'https://www.bilibili.com/favicon.ico',
  url: 'https://member.bilibili.com',
  publishUrl: 'https://member.bilibili.com/york/read-editor',
  title: 'B站专栏',
  type: 'bilibili',
}

// chrome.scripting serializes this function into the editor's main world.
async function fillBilibiliDraftInPage(title, html) {
  async function waitFor(read, timeout) {
    const until = Date.now() + timeout
    do {
      const value = read()
      if (value) return value
      await new Promise(resolve => setTimeout(resolve, 150))
    } while (Date.now() < until)
    return null
  }

  const editor = await waitFor(
    () => document.querySelector('.editor-container .ProseMirror[contenteditable="true"]'),
    15000
  )
  if (!editor) return { success: false, message: 'B站正文编辑器未就绪，请确认已登录并可创建专栏' }

  const titleInput = document.querySelector('textarea.title-input__inner')
  const counter = document.querySelector('.extension-suffix .counter')
  const wordCount = () => Number.parseInt(counter?.textContent, 10)
  const draftButton = Array.from(
    document.querySelectorAll('.publish-footer .footer-right button')
  ).find(button =>
    ['保存为草稿', '儲存為草稿', 'Save as draft'].includes(button.textContent.trim())
  )
  if (!titleInput || !counter || !draftButton || draftButton.disabled) {
    return { success: false, message: 'B站专栏缺少可用的标题、字数统计或草稿按钮' }
  }
  const images = () => editor.editor?.storage?.biliImage?.allImages || []
  if (wordCount() !== 0 || titleInput.value || editor.textContent?.trim() || images().length) {
    return { success: false, message: 'B站打开的草稿已有内容，已停止写入' }
  }

  titleInput.value = title
  titleInput.dispatchEvent(new Event('input', { bubbles: true }))

  // Use the same HTML paste path as Bilibili's document importer. This
  // updates Tiptap's document, the platform word count and its image pipeline.
  editor.focus()
  const data = new DataTransfer()
  data.setData('text/html', html)
  data.setData('text/plain', '')
  editor.dispatchEvent(
    new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data })
  )
  if (!(await waitFor(() => wordCount() > 0, 5000))) {
    return { success: false, message: 'B站未识别正文（字数为 0），已停止保存' }
  }

  if (/<img[\s/>]/i.test(html)) {
    const source = document.createElement('template')
    source.innerHTML = html
    const expected = source.content.querySelectorAll('img[src]').length
    const settled = await waitFor(() => {
      const current = images()
      return (
        current.length >= expected && current.every(image => image.attrs.status !== 0) && current
      )
    }, 30000)
    if (!settled || settled.some(image => image.attrs.status !== 1)) {
      return { success: false, message: 'B站正文图片未上传成功，请在编辑器中检查后保存' }
    }
  }

  const saveTip = () => document.querySelector('.extension-suffix .save-tip')
  const previousTip = saveTip()?.textContent
  draftButton.click()
  const confirmed = await waitFor(() => {
    const tip = saveTip()
    return tip?.textContent && tip.textContent !== previousTip && tip
  }, 15000)
  if (!confirmed) return { success: false, message: 'B站尚未确认草稿保存，请在编辑器中检查' }
  if (confirmed.classList.contains('save-fail'))
    return { success: false, message: confirmed.textContent }
  return { success: true, message: 'B站已确认保存专栏草稿' }
}

async function syncBilibiliContent(tab, content, { chrome, waitForTab }) {
  const html = content.body || content.wechatHtml
  if (!html?.trim()) return { success: false, message: '没有可同步到B站的正文' }
  await waitForTab(tab.id)
  const [frame] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: fillBilibiliDraftInPage,
    args: [content.title || '', html],
  })
  return {
    ...(frame?.result || { success: false, message: 'B站编辑器未返回同步结果' }),
    tabId: tab.id,
  }
}

export { BilibiliPlatform, syncBilibiliContent }
