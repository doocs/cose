import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

import { syncToutiaoContent } from '../packages/core/src/platforms/toutiao.js'

function mockToutiaoTab({ prepared, filled = { success: true } } = {}) {
  const calls = { prepare: [], fill: [] }
  const helpers = {
    waitForTab: async () => {},
    chrome: {
      scripting: {
        async executeScript({ func, args }) {
          if (args) assert.ok(!args.includes(undefined), 'Chrome requires serializable arguments')
          if (func?.name === 'prepareToutiaoArticle') {
            calls.prepare.push(args)
            return prepared ? [{ result: prepared }] : []
          }
          if (func?.name === 'fillToutiaoContentInPage') {
            calls.fill.push(args)
            return [{ result: filled }]
          }
          assert.fail('Unexpected page script')
        },
      },
    },
  }
  return { calls, sync: content => syncToutiaoContent({ id: 1 }, content, helpers) }
}

async function mockEditorPage(t, { batchError } = {}) {
  const readClipboard = t.mock.fn(async () => [])
  const messages = []
  const timeouts = []
  const active = new Set()
  let receive
  const window = {
    addEventListener(_type, listener) {
      receive = listener
    },
    dispatchEvent() {},
    postMessage(message) {
      messages.push(message)
      queueMicrotask(() =>
        receive({
          source: window,
          data: {
            source: 'cose-extension-v2',
            requestId: message.requestId,
            result: { success: true },
            error: message.type === 'START_SYNC_BATCH' ? batchError : undefined,
          },
        })
      )
    },
  }
  const script = await readFile(new URL('../apps/extension/src/inject.js', import.meta.url), 'utf8')
  vm.runInNewContext(script, {
    window,
    document: { querySelector: () => ({ click() {} }) },
    navigator: { clipboard: { read: readClipboard } },
    CustomEvent,
    setTimeout(callback, delay) {
      timeouts.push(delay)
      active.add(timeouts.length)
      if (delay < 120_000) queueMicrotask(callback)
      return timeouts.length
    },
    clearTimeout: id => active.delete(id),
  })
  function sync(post, platformId, onProgress = null) {
    return new Promise(resolve => {
      window.$cose.addTask(
        { post, accounts: [{ uid: platformId, checked: true }] },
        onProgress,
        resolve
      )
    })
  }
  return { sync, readClipboard, messages, timeouts, active }
}

test('a stale extension context ends the sync batch and reports the refresh instruction', async t => {
  const page = await mockEditorPage(t, { batchError: 'Extension context invalidated.' })
  const progress = t.mock.fn()
  await page.sync({ title: 'Current' }, 'toutiao', progress)
  const [account] = progress.mock.calls.at(-1).arguments[0].accounts
  assert.equal(account.status, 'failed')
  assert.match(account.error, /请刷新页面/)
  assert.deepEqual(
    page.messages.map(message => message.type),
    ['START_SYNC_BATCH']
  )
  assert.equal(page.active.size, 0)
})

test('selecting only Toutiao never reads the system clipboard', async t => {
  const page = await mockEditorPage(t)
  const post = { title: 'Current', content: '<p>Current article</p>', markdown: 'Current article' }
  await page.sync(post, 'toutiao')

  assert.equal(page.readClipboard.mock.callCount(), 0)
  const { content } = page.messages.find(message => message.type === 'SYNC_TO_PLATFORM').payload
  assert.equal(content.body, post.content)
  assert.equal(content.markdown, post.markdown)
  assert.ok(!content.wechatHtml)
})

test('only Toutiao gets a per-image time budget and answered requests release their timers', async t => {
  const page = await mockEditorPage(t)
  const post = {
    content: '<p><img src="https://example.com/article.png"></p>'.repeat(5),
  }
  await page.sync(post, 'toutiao')
  const [batchTimeout, toutiaoTimeout] = page.timeouts
  assert.equal(batchTimeout, 120_000)
  assert.ok(toutiaoTimeout >= batchTimeout + 5 * 40_000)
  assert.equal(page.active.size, 0)

  await page.sync(post, 'zhihu')
  assert.equal(page.timeouts.at(-1), batchTimeout)
  assert.equal(page.active.size, 0)
})

test('Toutiao prepares the current article and inserts its prepared HTML and formula images', async () => {
  const body = '<p>Current article</p><section class="katex-block"><svg></svg></section>'
  const markdown = 'Current article\n\n$$x = y$$'
  const prepared = {
    html: '<p>Current article</p><p>formula-marker</p>',
    images: [{ marker: 'formula-marker', dataUrl: 'data:image/png;base64,AA==' }],
  }
  const tab = mockToutiaoTab({ prepared })

  const result = await tab.sync({
    title: 'Title',
    body,
    markdown,
    wechatHtml: '<p>Other document</p>',
  })

  assert.equal(result.success, true)
  assert.deepEqual(tab.calls.prepare, [[body, markdown]])
  assert.deepEqual(tab.calls.fill, [['Title', prepared.html, prepared.images]])
})

test('Toutiao can sync without clipboard data and escapes a Markdown-only article', async () => {
  const tab = mockToutiaoTab()
  const result = await tab.sync({ title: 'Title', markdown: 'First & second\n<img src=x>' })

  assert.equal(result.success, true)
  assert.deepEqual(tab.calls.prepare, [])
  assert.equal(tab.calls.fill.length, 1)
  const [title, html] = tab.calls.fill[0]
  assert.equal(title, 'Title')
  assert.match(html, /First &amp; second/)
  assert.match(html, /&lt;img src=x&gt;/)
  assert.doesNotMatch(html, /<img\b/)
})

test('Toutiao stops before touching the editor if formula preparation returns no result', async () => {
  const tab = mockToutiaoTab()
  const result = await tab.sync({ title: 'Title', body: '<p>Current article</p>' })

  assert.equal(result.success, false)
  assert.equal(tab.calls.prepare.length, 1)
  assert.deepEqual(tab.calls.fill, [])
})

test('Toutiao reports an editor failure back to the sync caller', async () => {
  const tab = mockToutiaoTab({ filled: { success: false, error: 'editor rejected insertion' } })
  const result = await tab.sync({ title: 'Title', markdown: 'Current article' })

  assert.equal(tab.calls.fill.length, 1)
  assert.equal(result.success, false)
  assert.equal(result.message, 'editor rejected insertion')
})
