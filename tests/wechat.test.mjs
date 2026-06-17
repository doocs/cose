import assert from 'node:assert/strict'
import test from 'node:test'

import {
  fillWechatContent,
  pickWechatBodyProseMirrorCandidate,
} from '../packages/core/src/platforms/wechat.js'

function createEditor({ textContent = '', top = 0, height = 120, width = 640, classes = [] } = {}) {
  const classSet = new Set(classes)
  const rect = {
    top,
    bottom: top + height,
    left: 0,
    right: width,
    width,
    height,
  }

  return {
    textContent,
    clientHeight: height,
    clientWidth: width,
    getBoundingClientRect: () => rect,
    closest: selector => {
      const selectors = selector.split(',').map(item => item.trim().replace(/^\./, ''))
      return selectors.some(item => classSet.has(item)) ? { selector } : null
    },
  }
}

function createTitleInput({ top = 0, height = 48 } = {}) {
  return {
    getBoundingClientRect: () => ({
      top,
      bottom: top + height,
      left: 0,
      right: 640,
      width: 640,
      height,
    }),
  }
}

function createInputElement() {
  return {
    value: '',
    focus() {},
    dispatchEvent() {},
  }
}

function createProseMirrorElement({ textContent = '', classes = [], onDispatchEvent } = {}) {
  const classSet = new Set(classes)
  let html = ''
  let text = textContent
  let imageCount = 0
  const innerHTMLWrites = []

  return {
    clientHeight: 480,
    clientWidth: 720,
    innerHTMLWrites,
    focus() {},
    dispatchEvent(event) {
      onDispatchEvent?.(event)
      return true
    },
    get textContent() {
      return text
    },
    set textContent(value) {
      text = value
    },
    get innerHTML() {
      return html
    },
    set innerHTML(value) {
      innerHTMLWrites.push(value)
      html = value
      if (value === '') {
        text = ''
        imageCount = 0
      }
    },
    setRenderedContent(value) {
      html = value
      text = value.replace(/<[^>]*>/g, '')
      imageCount = (value.match(/<img\b/gi) || []).length
    },
    querySelectorAll(selector) {
      if (selector === 'img') return Array.from({ length: imageCount }, () => ({}))
      return []
    },
    getBoundingClientRect: () => ({
      top: classSet.has('title-editor__input') ? 8 : 180,
      bottom: classSet.has('title-editor__input') ? 48 : 660,
      left: 0,
      right: 720,
      width: 720,
      height: classSet.has('title-editor__input') ? 40 : 480,
    }),
    closest: selector => {
      const selectors = selector.split(',').map(item => item.trim().replace(/^\./, ''))
      return selectors.some(item => classSet.has(item)) ? { selector } : null
    },
  }
}

async function withWechatFillEnvironment({ jsapiInvoke, bodyEditor, callback }) {
  const previousGlobals = {
    window: globalThis.window,
    document: globalThis.document,
    Event: globalThis.Event,
    ClipboardEvent: globalThis.ClipboardEvent,
    DataTransfer: globalThis.DataTransfer,
    setTimeout: globalThis.setTimeout,
  }

  const titleInput = createInputElement()
  const titleEditor = createProseMirrorElement({ classes: ['title-editor__input'] })

  class TestEvent {
    constructor(type, init = {}) {
      this.type = type
      Object.assign(this, init)
    }
  }

  class TestDataTransfer {
    constructor() {
      this.data = new Map()
    }

    setData(type, value) {
      this.data.set(type, value)
    }

    getData(type) {
      return this.data.get(type)
    }
  }

  globalThis.Event = TestEvent
  globalThis.ClipboardEvent = TestEvent
  globalThis.DataTransfer = TestDataTransfer
  globalThis.setTimeout = fn => {
    fn()
    return 0
  }

  globalThis.window = {
    waitFor: async selector => {
      if (selector === '#title') return titleInput
      if (selector === '.title-editor__input .ProseMirror') return titleEditor
      return null
    },
    HTMLTextAreaElement: class HTMLTextAreaElement {},
    HTMLInputElement: class HTMLInputElement {},
  }

  if (jsapiInvoke) {
    globalThis.window.__MP_Editor_JSAPI__ = {
      invoke: jsapiInvoke,
    }
  }

  globalThis.document = {
    querySelectorAll: selector => (selector === '.ProseMirror' ? [titleEditor, bodyEditor] : []),
    querySelector: selector => {
      if (selector === '#title') return titleInput
      if (selector === '.title-editor__input .ProseMirror') return titleEditor
      return null
    },
  }

  try {
    return await callback({ titleInput, titleEditor })
  } finally {
    for (const [key, value] of Object.entries(previousGlobals)) {
      if (value === undefined) delete globalThis[key]
      else globalThis[key] = value
    }
  }
}

test('只有标题编辑器时返回 null，避免把正文贴到标题', () => {
  const titleInput = createTitleInput()
  const titleEditor = createEditor({
    top: 8,
    height: 40,
    width: 640,
    classes: ['title-editor__input'],
  })

  const picked = pickWechatBodyProseMirrorCandidate([titleEditor], { titleInput, titleEditor })
  assert.equal(picked, null)
})

test('标题和正文同时存在时优先选择正文编辑器', () => {
  const titleInput = createTitleInput()
  const titleEditor = createEditor({
    top: 8,
    height: 40,
    width: 640,
    classes: ['title-editor__input'],
  })
  const bodyEditor = createEditor({
    textContent: '从这里开始写正文',
    top: 180,
    height: 520,
    width: 720,
  })

  const picked = pickWechatBodyProseMirrorCandidate([titleEditor, bodyEditor], {
    titleInput,
    titleEditor,
  })
  assert.equal(picked, bodyEditor)
})

test('没有标题编辑器时保留单编辑器场景的兼容性', () => {
  const bodyEditor = createEditor({
    textContent: '正文内容',
    top: 120,
    height: 480,
    width: 720,
  })

  const picked = pickWechatBodyProseMirrorCandidate([bodyEditor], {})
  assert.equal(picked, bodyEditor)
})

test('正文填充优先使用微信编辑器 JSAPI 注入含图 HTML', async () => {
  const htmlBody = '<p>正文</p><img src="https://example.com/a.png">'
  const bodyEditor = createProseMirrorElement({
    textContent: '从这里开始写正文',
  })
  const calls = []

  const result = await withWechatFillEnvironment({
    bodyEditor,
    jsapiInvoke: params => {
      calls.push(params)
      bodyEditor.setRenderedContent(params.apiParam.content)
      params.sucCb({})
    },
    callback: () => fillWechatContent('测试标题', htmlBody),
  })

  assert.equal(calls.length, 1)
  assert.equal(calls[0].apiName, 'mp_editor_set_content')
  assert.deepEqual(calls[0].apiParam, { content: htmlBody })
  assert.equal(result.success, true)
  assert.equal(result.wordCount, 2)
  assert.equal(result.imageCount, 1)
})

test('微信 JSAPI 不可用时使用 paste 事件兜底而不是直接写 innerHTML', async () => {
  const htmlBody = '<p>正文</p>'
  let pasteEvent
  const bodyEditor = createProseMirrorElement({
    textContent: '从这里开始写正文',
    onDispatchEvent: event => {
      if (event.type === 'paste') {
        pasteEvent = event
        bodyEditor.setRenderedContent(event.clipboardData.getData('text/html'))
      }
    },
  })

  const result = await withWechatFillEnvironment({
    bodyEditor,
    callback: () => fillWechatContent('测试标题', htmlBody),
  })

  assert.equal(pasteEvent?.type, 'paste')
  assert.equal(pasteEvent.clipboardData.getData('text/html'), htmlBody)
  assert.equal(bodyEditor.innerHTML, htmlBody)
  assert.deepEqual(bodyEditor.innerHTMLWrites, [''])
  assert.equal(result.success, true)
  assert.equal(result.wordCount, 2)
})
