import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { chromium } from 'playwright-core'

import { prepareToutiaoArticle } from '../packages/core/src/platforms/toutiao-article.js'
import { syncZhihuContent } from '../packages/core/src/platforms/zhihu.js'

const extension = resolve(process.argv[2] ?? 'apps/extension/dist')
const server = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end('<!doctype html><title>COSE smoke test</title>')
})
server.listen(0, '127.0.0.1')
await once(server, 'listening')

let context
try {
  context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  })
  const page = await context.newPage()
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  await page.waitForFunction(() => typeof window.$cose?.getPlatforms === 'function', null, {
    timeout: 15000,
  })
  const platforms = await page.evaluate(() => window.$cose.getPlatforms())
  assert.ok(
    platforms.some(p => p.uid === 'wechat'),
    'The editor API must expose WeChat'
  )

  // getPlatforms() reads a page-side list. Also exercise the message bridge to the worker.
  const reply = await page.evaluate(() => {
    return new Promise((resolve, reject) => {
      const requestId = 'smoke-platforms'
      const timeout = setTimeout(() => reject(new Error('No response from the COSE worker')), 10000)
      window.addEventListener('message', function receive(event) {
        if (event.source !== window || event.data?.source !== 'cose-extension') return
        if (event.data.requestId !== requestId) return
        window.removeEventListener('message', receive)
        clearTimeout(timeout)
        resolve(event.data)
      })
      window.postMessage({ source: 'cose-page', type: 'GET_PLATFORMS', requestId }, location.origin)
    })
  })
  assert.ifError(reply.error ?? reply.result?.error)
  assert.ok(
    reply.result?.platforms?.some(p => p.id === 'wechat'),
    'The worker must expose WeChat'
  )
  console.log('COSE loaded in Chromium and its background worker returned WeChat')

  const first = 'https://example.com/first.png'
  const second = 'https://example.com/second.png'
  const prepared = await page.evaluate(
    prepareToutiaoArticle,
    `<p>Before<img src="${first}">Between</p>
     <div class="katex-block"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"
     viewBox="0 0 40 30"><text x="2" y="20">x=y</text></svg></div>
     <p><img src="${second}">After</p>`
  )
  assert.deepEqual(
    prepared.images.map(image => image.src),
    [first, undefined, second]
  )
  assert.match(prepared.images[1].dataUrl, /^data:image\/png;base64,/)
  assert.doesNotMatch(prepared.html, /<img\b/)
  assert.ok(prepared.html.indexOf('Before') < prepared.html.indexOf(prepared.images[0].marker))
  assert.ok(prepared.html.indexOf(prepared.images[0].marker) < prepared.html.indexOf('Between'))
  assert.ok(prepared.html.indexOf(prepared.images[2].marker) < prepared.html.indexOf('After'))
  console.log('Toutiao queues ordinary images and rendered formulas in article order')

  await checkZhihu(context)
  console.log('Zhihu checks saved images before reloading and preserves incomplete drafts')
} finally {
  await context?.close()
  server.close()
}

async function checkZhihu(context) {
  const page = await context.newPage()
  const image = 'https://pica.zhimg.com/test.png'
  const draftUrl = 'https://zhuanlan.zhihu.com/p/123/edit'
  await page.route(draftUrl, route =>
    route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: `<textarea placeholder="请输入标题"></textarea>
        <div class="public-DraftEditor-content" contenteditable="true"></div>
        <button hidden>确认并解析</button><button hidden>确认</button>`,
    })
  )

  for (const scenario of ['loaded', 'failed', 'missing', 'text']) {
    await page.goto(draftUrl)
    await page.clock.install()
    await page.evaluate(
      ({ scenario, image }) => {
        const editor = document.querySelector('[contenteditable="true"]')
        const [parse, confirm] = document.querySelectorAll('button')
        editor.addEventListener('paste', event => {
          event.preventDefault()
          if (scenario === 'text') {
            editor.textContent = event.clipboardData.getData('text/plain')
            return
          }
          parse.hidden = false
        })
        parse.onclick = () => {
          parse.hidden = true
          confirm.hidden = false
        }
        confirm.onclick = () => {
          confirm.hidden = true
          // Simulate the editor remounting after parsing.
          const rendered = editor.cloneNode()
          rendered.innerHTML = '<p>Article text</p>'
          editor.replaceWith(rendered)
          let count = 0
          window.fetch = async url => {
            if (url !== '/api/articles/123/draft') throw new Error('Unexpected API URL')
            return Response.json({
              title: document.querySelector('textarea').value,
              content: '<p>Article text</p>' + `<img src="${image}">`.repeat(count),
            })
          }
          setTimeout(() => {
            if (scenario === 'failed') rendered.innerHTML += '<figure><div>上传失败</div></figure>'
            else count = 1
          }, 1000)
          if (scenario === 'loaded')
            setTimeout(() => {
              count = 2
            }, 2500)
        }
      },
      { scenario, image }
    )

    let reloads = 0
    const oldChrome = globalThis.chrome
    globalThis.chrome = {
      tabs: { update: async () => {}, reload: async () => ++reloads },
      scripting: {
        executeScript: async ({ func, args = [] }) => {
          // Use a fresh browser realm, as chrome.scripting does, with only the provided args.
          const result = page.evaluate(({ source, args }) => window.eval(`(${source})`)(...args), {
            source: String(func),
            args,
          })
          return [{ result: await result }]
        },
      },
    }
    try {
      const hasImages = scenario !== 'text'
      let settled = false
      const result = syncZhihuContent(
        { id: 1 },
        {
          title: 'Zhihu smoke test',
          body: '<p>Article text</p>' + (hasImages ? `<img src="${image}">`.repeat(2) : ''),
          markdown: 'Article text' + (hasImages ? `\n\n![image](${image})`.repeat(2) : ''),
        },
        { waitForTab: async () => {} }
      ).finally(() => {
        settled = true
      })
      await page.waitForFunction(() => typeof window.setInputValue === 'function')
      await page.clock.runFor(4500)
      if (scenario === 'loaded' || scenario === 'missing') {
        assert.equal(settled, false, 'The first autosave must not complete the article')
      }
      await page.clock.runFor(scenario === 'missing' ? 31000 : 6500)
      const actual = await result
      assert.equal(actual.success, scenario === 'loaded' || scenario === 'text', actual.message)
      if (scenario === 'failed') assert.match(actual.message, /上传失败/)
      if (scenario === 'missing') assert.match(actual.message, /已确认 1 张，原文 2 张/)
      assert.equal(reloads, actual.success ? 1 : 0)
    } finally {
      globalThis.chrome = oldChrome
    }
  }
  await page.close()
}
