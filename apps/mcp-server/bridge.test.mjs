import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import test from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { WebSocket } from 'ws'
import { startBridge } from './bridge.mjs'

test(
  'routes drafts only to the selected Chrome connection and saves only after approval',
  { timeout: 5000 },
  async t => {
    const token = randomBytes(32).toString('base64url')
    const bridge = await startBridge(token, 0)
    t.after(() => bridge.close())
    const url = `ws://127.0.0.1:${bridge.port}/cose`
    const origin = `chrome-extension://${'a'.repeat(32)}`

    const website = new WebSocket(url, { origin: 'https://example.com' })
    await once(website, 'error')
    const stranger = new WebSocket(url, { origin })
    await once(stranger, 'open')
    const strangerClosed = once(stranger, 'close')
    stranger.send(JSON.stringify({ type: 'pair', protocol: 2, name: 'stranger', token: 'wrong' }))
    assert.equal((await strangerClosed)[0], 1008)
    assert.deepEqual(bridge.listPlatforms().browsers, [])

    async function pair(name) {
      const socket = new WebSocket(url, { origin })
      await once(socket, 'open')
      const next = once(socket, 'message')
      socket.send(JSON.stringify({ type: 'pair', protocol: 2, name, token }))
      const [data] = await next
      const { id } = JSON.parse(data)
      return { socket, id }
    }

    const work = await pair('工作 Chrome')
    const personal = await pair('个人 Chrome')
    assert.deepEqual(
      bridge.listPlatforms().browsers.map(browser => browser.id),
      [work.id, personal.id]
    )
    const workMessages = []
    work.socket.on('message', data => workMessages.push(JSON.parse(data)))

    const args = {
      request_id: randomUUID(),
      browser_id: personal.id,
      platform: '知乎',
      title: 'COSE',
      text: 'test',
    }
    const queued = once(personal.socket, 'message')
    assert.equal(bridge.createDraft(args).status, 'awaiting_confirmation')
    const [draft] = await queued
    assert.deepEqual(JSON.parse(draft), {
      type: 'draft',
      id: args.request_id,
      platform: { id: 'zhihu', name: '知乎', mode: 'editor' },
      title: 'COSE',
      text: 'test',
    })
    assert.deepEqual(workMessages, [])
    assert.equal(bridge.createDraft(args).status, 'awaiting_confirmation')
    assert.throws(() => bridge.createDraft({ ...args, browser_id: work.id }), /another browser/)
    assert.throws(() => bridge.createDraft({ ...args, title: 'different' }), /different article/)
    assert.throws(() => bridge.createDraft({ ...args, platform: 'WordPress' }), /MD editor/)

    const execute = once(personal.socket, 'message')
    personal.socket.send(JSON.stringify({ type: 'decision', id: args.request_id, approved: true }))
    assert.deepEqual(JSON.parse((await execute)[0]), { type: 'execute', id: args.request_id })
    assert.equal(bridge.getDraft(args.request_id).status, 'saving')
    assert.deepEqual(workMessages, [])
    const closed = once(personal.socket, 'close')
    personal.socket.close()
    await closed
    while (bridge.getDraft(args.request_id).status === 'saving') {
      await delay(10, undefined, { signal: t.signal })
    }
    assert.equal(bridge.getDraft(args.request_id).status, 'not_confirmed')
    assert.equal(bridge.createDraft(args).status, 'not_confirmed')
  }
)
