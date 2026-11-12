import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

import { BilibiliPlatform, syncBilibiliContent } from '../packages/core/src/platforms/bilibili.js'

const pageScript = await readFile(
  new URL('../apps/extension/src/inject.js', import.meta.url),
  'utf8'
)
const currentBody = '<p>Current article</p>'
const illustratedBody =
  currentBody +
  '<img src="https://example.org/first.png"><img src="https://example.org/second.png">'
const clipboardHtml = '<p>Previous article</p>'

function createSourcePage(t) {
  const posts = new Map()
  const copy = t.mock.fn()
  const read = t.mock.fn(async () => [
    { types: ['text/html'], getType: async () => new Blob([clipboardHtml]) },
  ])
  let onMessage
  const window = {
    addEventListener(_type, listener) {
      onMessage = listener
    },
    dispatchEvent() {},
    postMessage({ type, requestId, payload }) {
      if (type === 'SYNC_TO_PLATFORM') posts.set(payload.platformId, payload.content)
      queueMicrotask(() =>
        onMessage({
          source: window,
          data: { source: 'cose-extension-v2', requestId, result: { success: true } },
        })
      )
    },
  }
  vm.runInNewContext(pageScript, {
    window,
    document: { querySelector: () => ({ click: copy }) },
    navigator: { clipboard: { read } },
    CustomEvent,
    setTimeout(callback, delay) {
      if (delay < 120_000) queueMicrotask(callback)
    },
    clearTimeout() {},
  })
  async function sync(...platforms) {
    const post = { title: 'Title', content: currentBody }
    const accounts = platforms.map(uid => ({ checked: true, uid }))
    await new Promise(done => window.$cose.addTask({ post, accounts }, null, done))
  }
  return { api: window.$cose, sync, posts, copy, read }
}

test('Bilibili opens the current article editor and syncs without copying the clipboard', async t => {
  const page = createSourcePage(t)
  const platform = page.api.getPlatforms().find(({ uid }) => uid === 'bilibili')
  assert.equal(platform.url, 'https://member.bilibili.com/york/read-editor')
  assert.equal(BilibiliPlatform.publishUrl, platform.url)
  await page.sync('bilibili')
  assert.equal(page.copy.mock.callCount(), 0)
  assert.equal(page.read.mock.callCount(), 0)
  assert.equal(page.posts.get('bilibili').body, currentBody)
})

test('a mixed batch keeps clipboard HTML for WeChat and sends the current article to Bilibili', async t => {
  const page = createSourcePage(t)
  await page.sync('wechat', 'bilibili')
  assert.equal(page.read.mock.callCount(), 1)
  assert.equal(page.posts.get('wechat').wechatHtml, clipboardHtml)
  assert.equal(page.posts.get('bilibili').body, currentBody)
  assert.ok(!page.posts.get('bilibili').wechatHtml)
})

function createPublishPage(
  t,
  { hasEditor = true, acceptPaste = true, save = 'success', images = [] } = {}
) {
  let now = 0
  let pasted
  let modelTitle = ''
  let savedTitle
  const title = {
    value: '',
    dispatchEvent(event) {
      if (event.type === 'input')
        queueMicrotask(() => {
          modelTitle = this.value
        })
    },
  }
  const counter = { textContent: '0/100000' }
  // The Vue view also renders a timestamped tip after each autosave.
  const tip = { textContent: '10:00:00保存成功', classList: { contains: () => false } }
  const draft = {
    textContent: '保存为草稿',
    click: t.mock.fn(() => {
      savedTitle = modelTitle
      if (save === 'timeout') return
      tip.textContent = save === 'error' ? '10:00:01保存失败，请尝试手动保存' : '10:00:01保存成功'
      tip.classList.contains = name => save === 'error' && name === 'save-fail'
    }),
  }
  const publish = { textContent: '发布', click: t.mock.fn() }
  const editor = {
    editor: { storage: { biliImage: { allImages: [] } } },
    focus() {},
    dispatchEvent(event) {
      if (event.type === 'paste') {
        pasted = event.clipboardData.getData('text/html')
        if (acceptPaste && pasted?.includes(currentBody)) {
          counter.textContent = '14/100000'
          this.editor.storage.biliImage.allImages = images.map(status => ({ attrs: { status } }))
        }
      }
      return true
    },
  }
  const elements = {
    'textarea.title-input__inner': title,
    '.editor-container .ProseMirror[contenteditable="true"]': hasEditor ? editor : null,
    '.extension-suffix .counter': counter,
    '.extension-suffix .save-tip': tip,
  }
  const document = {
    createElement(tag) {
      assert.equal(tag, 'template')
      const template = {
        innerHTML: '',
        content: {
          querySelectorAll(selector) {
            assert.equal(selector, 'img[src]')
            return template.innerHTML === illustratedBody ? [{}, {}] : []
          },
        },
      }
      return template
    },
    querySelector: selector => elements[selector] ?? null,
    querySelectorAll: selector =>
      selector === '.publish-footer .footer-right button' ? [publish, draft] : [],
  }
  class ClipboardData extends Map {
    getData(type) {
      return this.get(type) || ''
    }
    setData(type, value) {
      this.set(type, value)
    }
  }
  const page = vm.createContext({
    document,
    window: {},
    Event,
    ClipboardEvent: class extends Event {
      constructor(type, options) {
        super(type, options)
        this.clipboardData = options.clipboardData
      }
    },
    DataTransfer: ClipboardData,
    Date: { now: () => now },
    setTimeout(callback, delay) {
      now += delay
      queueMicrotask(callback)
    },
  })
  const chrome = {
    scripting: {
      async executeScript({ func, args, world }) {
        assert.equal(world, 'MAIN')
        page.args = args
        return [{ result: await vm.runInContext(`(${func})(...args)`, page) }]
      },
    },
  }
  const sync = (body = currentBody) =>
    syncBilibiliContent(
      { id: 3 },
      { title: '测试标题', body, wechatHtml: clipboardHtml },
      { chrome, waitForTab: async () => {} }
    )
  return {
    sync,
    draft,
    publish,
    title,
    editor,
    getPaste: () => pasted,
    getSavedTitle: () => savedTitle,
  }
}

test('Bilibili sends the article as HTML paste, updates the title and saves only a draft', async t => {
  const page = createPublishPage(t)
  const result = await page.sync()
  assert.equal(result.success, true, result.message)
  assert.equal(page.getPaste(), currentBody)
  assert.equal(page.title.value, '测试标题')
  assert.equal(page.getSavedTitle(), '测试标题')
  assert.equal(page.draft.click.mock.callCount(), 1)
  assert.equal(page.publish.click.mock.callCount(), 0)
})

test('Bilibili stops before saving when the body editor is missing or ignores the paste', async t => {
  for (const options of [{ hasEditor: false }, { acceptPaste: false }]) {
    const page = createPublishPage(t, options)
    assert.equal((await page.sync()).success, false)
    assert.equal(page.draft.click.mock.callCount(), 0)
    assert.equal(page.publish.click.mock.callCount(), 0)
  }
})

test('Bilibili preserves a draft already open in the editor', async t => {
  for (const title of ['My unfinished draft', '']) {
    const page = createPublishPage(t)
    page.title.value = title
    if (!title) page.editor.editor.storage.biliImage.allImages = [{ attrs: { status: 1 } }]
    assert.equal((await page.sync()).success, false)
    assert.equal(page.title.value, title)
    assert.equal(page.getPaste(), undefined)
    assert.equal(page.draft.click.mock.callCount(), 0)
  }
})

test('Bilibili saves an illustrated article only after its images upload successfully', async t => {
  for (const images of [[1, 1], [1, 0], [1, 2], [1], []]) {
    const page = createPublishPage(t, { images })
    const result = await page.sync(illustratedBody)
    const expected = images.length === 2 && images.every(status => status === 1)
    assert.equal(result.success, expected, JSON.stringify(images))
    assert.equal(page.draft.click.mock.callCount(), expected ? 1 : 0)
  }
})

test('a failed save or a stale autosave message cannot confirm the Bilibili draft', async t => {
  for (const save of ['error', 'timeout']) {
    const page = createPublishPage(t, { save })
    assert.equal((await page.sync()).success, false)
    assert.equal(page.draft.click.mock.callCount(), 1)
    assert.equal(page.publish.click.mock.callCount(), 0)
  }
})

test('the new editor bridge keeps Halo available when an older extension replaces the legacy global', () => {
  const window = { addEventListener() {}, dispatchEvent() {} }
  vm.runInNewContext(pageScript, { window, document: {}, CustomEvent })
  window.$cose = { getPlatforms: () => [] }
  assert.ok(window.$coseV2.getPlatforms().some(({ id }) => id === 'halo'))
  assert.equal(typeof window.$coseV2.getHaloSetupUrl, 'function')
})
