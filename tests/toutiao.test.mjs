import assert from 'node:assert/strict'
import test from 'node:test'

import {
  fillToutiaoContentInPage,
  syncToutiaoContent,
} from '../packages/core/src/platforms/toutiao.js'

async function withToutiaoEnvironment(callback) {
  const previousGlobals = {
    document: globalThis.document,
    window: globalThis.window,
    InputEvent: globalThis.InputEvent,
    Event: globalThis.Event,
    setTimeout: globalThis.setTimeout,
  }
  const insertedHtml = []
  const titleInput = {
    value: '',
    focus() {},
    dispatchEvent() {},
  }
  const editor = {
    innerHTML: '',
    focus() {},
    dispatchEvent() {},
  }

  class TestEvent {
    constructor(type, init = {}) {
      this.type = type
      Object.assign(this, init)
    }
  }

  class TestTextArea {}
  Object.defineProperty(TestTextArea.prototype, 'value', {
    set(value) {
      titleInput.value = value
    },
  })

  globalThis.InputEvent = TestEvent
  globalThis.Event = TestEvent
  globalThis.setTimeout = callback => {
    callback()
    return 0
  }
  globalThis.window = {
    HTMLTextAreaElement: TestTextArea,
    getSelection: () => ({ removeAllRanges() {}, addRange() {} }),
  }
  globalThis.document = {
    body: {},
    querySelector: selector => {
      if (selector === 'textarea[placeholder*="标题"]') return titleInput
      if (selector === '.ProseMirror') return editor
      return null
    },
    createRange: () => ({ selectNodeContents() {}, collapse() {} }),
    execCommand: (command, _showUi, html) => {
      assert.equal(command, 'insertHTML')
      insertedHtml.push(html)
      return true
    },
  }

  try {
    await callback({ editor, insertedHtml, titleInput })
  } finally {
    for (const [key, value] of Object.entries(previousGlobals)) {
      if (value === undefined) delete globalThis[key]
      else globalThis[key] = value
    }
  }
}

test('Toutiao receives rendered HTML so formula markup is preserved', async () => {
  const formulaHtml = '<section class="katex-block"><svg><text>x = y</text></svg></section>'

  await withToutiaoEnvironment(async ({ insertedHtml }) => {
    await fillToutiaoContentInPage('Title', '$$x = y$$', formulaHtml)
    assert.deepEqual(insertedHtml, [formulaHtml])
  })
})

test('Toutiao retains the plain-text fallback when rendered HTML is unavailable', async () => {
  await withToutiaoEnvironment(async ({ insertedHtml }) => {
    await fillToutiaoContentInPage('Title', 'first line\nsecond line')
    assert.deepEqual(insertedHtml, ['<p>first line</p><p>second line</p>'])
  })
})

test('Toutiao sync forwards the rendered HTML to the page script', async () => {
  const formulaHtml = '<section class="katex-block"><svg><text>x = y</text></svg></section>'

  await withToutiaoEnvironment(async () => {
    const calls = []
    const result = await syncToutiaoContent(
      { id: 1 },
      { title: 'Title', body: '$$x = y$$', wechatHtml: formulaHtml },
      {
        chrome: {
          scripting: {
            executeScript: async options => {
              calls.push(options)
              return [{ result: { success: true } }]
            },
          },
        },
        waitForTab: async () => {},
      }
    )

    assert.equal(result.success, true)
    assert.deepEqual(calls.at(-1).args, ['Title', '$$x = y$$', formulaHtml])
  })
})
