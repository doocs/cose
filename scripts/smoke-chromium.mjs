import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { chromium } from 'playwright-core'

import { prepareToutiaoArticle } from '../packages/core/src/platforms/toutiao-article.js'

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
} finally {
  await context?.close()
  server.close()
}
