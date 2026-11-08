import { lexer } from 'marked'

export function prepareTwitterTables(markdown, batchId = crypto.randomUUID()) {
  if (!markdown.includes('|')) return { markdown, tables: [] }

  // Marked normalizes line endings before lexing.
  const source = markdown.replace(/\r\n?/g, '\n')
  const tables = []
  let cursor = 0
  let searchFrom = 0
  let prepared = ''
  for (const token of lexer(source, { gfm: true })) {
    const start = source.indexOf(token.raw, searchFrom)
    if (start < 0) continue
    searchFrom = start + token.raw.length
    if (token.type !== 'table') continue
    const marker = `COSETABLE${batchId.replaceAll('-', '')}N${tables.length + 1}END`
    tables.push({
      marker,
      markdown: token.raw.replace(/\n+$/, ''),
      rows: token.rows.length + 1,
      columns: token.header.length,
    })
    prepared += source.slice(cursor, start) + `\n\n${marker}\n\n`
    cursor = searchFrom
  }
  return tables.length
    ? { markdown: prepared + source.slice(cursor), tables }
    : { markdown, tables }
}

// Runs in the page's main world. Keep its helpers inside the function for chrome.scripting.
export async function insertTwitterTables(tables) {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
  async function waitFor(find) {
    const deadline = Date.now() + 2500
    do {
      const result = find()
      if (result) return result
      await sleep(80)
    } while (Date.now() < deadline)
    return null
  }
  const getEditor = () =>
    [
      ...document.querySelectorAll(
        '.public-DraftEditor-content, .DraftEditor-root [contenteditable="true"]'
      ),
    ].find(element => element.isContentEditable && element.getClientRects().length)
  const getBlocks = () => [...(getEditor()?.querySelectorAll('[data-block="true"]') ?? [])]
  const getMarker = marker => getBlocks().find(block => block.textContent === marker)
  const getDialog = () =>
    document
      .querySelector('[role="dialog"] textarea[name="markdown-input"]')
      ?.closest('[role="dialog"]')
  const label = element => (element.getAttribute('aria-label') || element.textContent).trim()
  const visible = element =>
    element.getClientRects().length && !element.matches(':disabled,[aria-disabled="true"]')

  async function selectMarker(marker, collapse, includeBreak = false) {
    const editor = getEditor()
    const block = getMarker(marker)
    if (!editor || !block) throw new Error('找不到表格在正文中的位置')
    editor.focus()
    const range = document.createRange()
    range.selectNodeContents(block)
    if (collapse) range.collapse(false)
    if (includeBreak) {
      const blocks = getBlocks()
      const previous = blocks[blocks.indexOf(block) - 1]
      if (previous?.isContentEditable) {
        const leaf = [...previous.querySelectorAll('[data-text="true"]')].at(-1)
        const text = leaf?.lastChild
        if (text?.nodeType === Node.TEXT_NODE) range.setStart(text, text.length)
      }
    }
    const selection = getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    // Draft.js must process the selection change before a toolbar click or paste.
    document.dispatchEvent(new Event('selectionchange'))
    await sleep(100)
    if (
      !block.contains(selection.focusNode) ||
      (!collapse && selection.toString().trim() !== marker)
    ) {
      throw new Error('无法选中表格位置')
    }
  }

  async function insertTable(table, onCreated) {
    await selectMarker(table.marker, true)
    const existing = new Set(getBlocks().map(block => block.getAttribute('data-offset-key')))
    const insert = document.querySelector('button[aria-label="Add Media"]')
    if (!insert || !visible(insert)) throw new Error('找不到 X 的插入菜单')
    insert.click()
    const item = await waitFor(() =>
      [...document.querySelectorAll('[role="menuitem"]')].find(
        element => visible(element) && label(element) === 'Table'
      )
    )
    if (!item) throw new Error('当前 X 编辑器没有表格菜单')
    item.click()
    // The Markdown editor expands the grid to match its contents.
    const grid = await waitFor(() =>
      document.querySelector('button[aria-label="Insert a 2 by 2 table"]')
    )
    if (!grid || !visible(grid)) throw new Error('找不到 X 的表格尺寸选择器')
    grid.click()
    const created = await waitFor(() =>
      getBlocks().find(
        block =>
          block.querySelector('table') && !existing.has(block.getAttribute('data-offset-key'))
      )
    )
    if (!created) throw new Error('X 未创建原生表格')
    const key = created.getAttribute('data-offset-key')
    const getCreated = () =>
      getBlocks().find(block => block.getAttribute('data-offset-key') === key)
    onCreated(getCreated)
    const blocks = getBlocks()
    if (blocks[blocks.indexOf(getMarker(table.marker)) + 1] !== created) {
      throw new Error('X 在意外的位置插入了表格')
    }

    const edit = created.querySelector('button[aria-label="Edit block"]')
    if (!edit) throw new Error('找不到原生表格的编辑按钮')
    edit.click()
    const dialog = await waitFor(getDialog)
    if (!dialog) throw new Error('找不到原生表格的 Markdown 编辑框')
    const input = dialog.querySelector('textarea[name="markdown-input"]')
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
    setValue.call(input, table.markdown)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    const update = await waitFor(() =>
      [...dialog.querySelectorAll('button')].find(
        button => visible(button) && label(button) === 'Update'
      )
    )
    if (!update || input.value !== table.markdown) throw new Error('X 未接收完整的表格 Markdown')
    const original = created.querySelector('table').innerHTML
    update.click()
    const updated = await waitFor(() => {
      const rendered = getCreated()?.querySelector('table')
      return (
        !getDialog() &&
        rendered &&
        rendered.innerHTML !== original &&
        rendered.rows.length === table.rows &&
        [...rendered.rows].every(row => row.cells.length === table.columns)
      )
    })
    if (!updated) throw new Error('X 未渲染完整的表格')

    // Include the separator before the marker so deleting it leaves no empty paragraph.
    await selectMarker(table.marker, false, true)
    if (!document.execCommand('delete') || !(await waitFor(() => !getMarker(table.marker)))) {
      throw new Error('未能移除表格占位文字')
    }
  }

  async function restoreMarkdown(table) {
    await selectMarker(table.marker, false)
    const html = table.markdown
      .split('\n')
      .map(
        line =>
          `<p>${line.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</p>`
      )
      .join('')
    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', html)
    clipboardData.setData('text/plain', table.markdown)
    getEditor().dispatchEvent(
      new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData })
    )
    return waitFor(() => !getMarker(table.marker))
  }

  const failures = []
  // Work backward so adjacent tables still have an editable preceding marker.
  for (let index = tables.length - 1; index >= 0; index--) {
    const table = tables[index]
    let getCreated
    try {
      await insertTable(table, getBlock => {
        getCreated = getBlock
      })
    } catch (error) {
      let restored = false
      try {
        getDialog()?.querySelector('button[aria-label="Close"]')?.click()
        getCreated?.()?.querySelector('button[aria-label="Delete block"]')?.click()
        restored = await restoreMarkdown(table)
      } catch {
        // Report if the editor would not accept the fallback either.
      }
      failures.push(
        `第 ${index + 1} 张表格：${error.message}${restored ? '，已保留 Markdown' : '，请从原文补入'}`
      )
    }
  }
  return failures.length
    ? { success: false, error: failures.reverse().join('；') }
    : { success: true }
}
