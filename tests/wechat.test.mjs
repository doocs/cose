import assert from 'node:assert/strict'
import test from 'node:test'

import { pickWechatBodyProseMirrorCandidate } from '../packages/core/src/platforms/wechat.js'

function createEditor({
  textContent = '',
  top = 0,
  height = 120,
  width = 640,
  classes = [],
} = {}) {
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
    closest: (selector) => {
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

  const picked = pickWechatBodyProseMirrorCandidate([titleEditor, bodyEditor], { titleInput, titleEditor })
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
