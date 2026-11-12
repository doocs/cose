import assert from 'node:assert/strict'
import { createHmac, randomBytes, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import test from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { WebSocket } from 'ws'
import { startBridge } from './bridge.mjs'
import { MCP_BRIDGE_VERSION, pairingProof } from '@cose/core/mcp-protocol'

async function nextMessage(socket) {
  return JSON.parse((await once(socket, 'message'))[0])
}

async function bridgeFixture(t) {
  const token = randomBytes(32).toString('base64url')
  const extensionId = 'a'.repeat(32)
  const bridge = await startBridge(token, 0, extensionId)
  t.after(() => bridge.close())
  const url = `ws://127.0.0.1:${bridge.port}/cose`
  const origin = `chrome-extension://${extensionId}`

  async function startPairing() {
    const socket = new WebSocket(url, { origin })
    await once(socket, 'open')
    const nonce = randomBytes(32).toString('hex')
    const incoming = nextMessage(socket)
    socket.send(JSON.stringify({ type: 'hello', protocol: MCP_BRIDGE_VERSION, nonce }))
    const challenge = await incoming
    assert.equal(challenge.type, 'challenge')
    const sign = role =>
      createHmac('sha256', token)
        .update(pairingProof(role, origin, nonce, challenge.nonce))
        .digest('hex')
    assert.equal(challenge.proof, sign('server'))
    return { socket, proof: sign('extension') }
  }

  async function pair(name, browserId = randomUUID()) {
    const { socket, proof } = await startPairing()
    const next = nextMessage(socket)
    socket.send(JSON.stringify({ type: 'pair', name, browserId, proof }))
    const { id } = await next
    assert.equal(id, browserId)
    return { socket, id }
  }
  return { bridge, url, startPairing, pair }
}

test(
  'starts sync immediately on the selected paired Chrome connection',
  { timeout: 5000 },
  async t => {
    const { bridge, url, startPairing, pair } = await bridgeFixture(t)

    const website = new WebSocket(url, { origin: 'https://example.com' })
    await once(website, 'error')
    const otherExtension = new WebSocket(url, { origin: `chrome-extension://${'b'.repeat(32)}` })
    await once(otherExtension, 'error')

    const stranger = await startPairing()
    const strangerClosed = once(stranger.socket, 'close')
    stranger.socket.send(
      JSON.stringify({
        type: 'pair',
        name: 'stranger',
        browserId: randomUUID(),
        proof: '0'.repeat(64),
      })
    )
    assert.equal((await strangerClosed)[0], 1008)
    assert.deepEqual(bridge.listPlatforms().browsers, [])

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
    const execute = nextMessage(personal.socket)
    assert.equal(bridge.createDraft(args).status, 'queued')
    assert.deepEqual(await execute, {
      type: 'execute',
      id: args.request_id,
      platform: 'zhihu',
      article: {
        platforms: [{ id: 'zhihu', name: '知乎', mode: 'editor' }],
        title: 'COSE',
        text: 'test',
      },
    })
    assert.deepEqual(workMessages, [])
    assert.equal(bridge.createDraft(args).status, 'saving')
    assert.throws(() => bridge.createDraft({ ...args, browser_id: work.id }), /another browser/)
    assert.throws(() => bridge.createDraft({ ...args, title: 'different' }), /different article/)
    assert.throws(() => bridge.createDraft({ ...args, platform: 'WordPress' }), /MD editor/)

    assert.equal(bridge.getDraft(args.request_id).status, 'saving')
    const closed = once(personal.socket, 'close')
    personal.socket.close()
    await closed
    while (bridge.getDraft(args.request_id).status === 'saving') {
      await delay(10, undefined, { signal: t.signal })
    }
    assert.equal(bridge.getDraft(args.request_id).status, 'not_confirmed')
    assert.equal(bridge.createDraft(args).status, 'not_confirmed')
    const reconnected = await pair('个人 Chrome', personal.id)
    assert.equal(reconnected.id, personal.id)
    assert.equal(bridge.createDraft(args).status, 'not_confirmed')
    const next = { ...args, request_id: randomUUID() }
    const nextExecution = nextMessage(reconnected.socket)
    assert.equal(bridge.createDraft(next).status, 'queued')
    assert.equal((await nextExecution).id, next.request_id)
  }
)

test(
  'executes WeChat and Zhihu in order and keeps their separate results',
  { timeout: 5000 },
  async t => {
    const { bridge, pair } = await bridgeFixture(t)
    const { id, socket } = await pair('Chrome')
    const args = {
      request_id: randomUUID(),
      browser_id: id,
      platforms: ['微信公众号', '知乎', 'wechat'],
      title: 'COSE',
      markdown: '# Test',
    }
    const platforms = request => request.results.map(result => [result.platform, result.status])
    const send = (type, data) => socket.send(JSON.stringify({ type, id: args.request_id, ...data }))

    assert.throws(() => bridge.createDraft({ ...args, platform: 'wechat' }), /exactly one/)
    assert.throws(() => bridge.createDraft({ ...args, platforms: ['微信', '未知'] }), /未知/)
    assert.throws(
      () => bridge.createDraft({ ...args, platforms: ['微信', 'WordPress'] }),
      /MD editor/
    )
    const first = nextMessage(socket)
    const request = bridge.createDraft(args)
    assert.equal(request.status, 'queued')
    assert.deepEqual(platforms(request), [
      ['wechat', 'queued'],
      ['zhihu', 'queued'],
    ])
    const wechat = await first
    assert.equal(wechat.type, 'execute')
    assert.equal(wechat.id, args.request_id)
    assert.equal(wechat.platform, 'wechat')
    assert.deepEqual(
      wechat.article.platforms.map(platform => platform.name),
      ['微信公众号', '知乎']
    )
    assert.equal(wechat.article.markdown, args.markdown)
    assert.deepEqual(
      bridge.createDraft({ ...args, platforms: ['zhihu', '微信'] }),
      bridge.getDraft(args.request_id)
    )
    assert.throws(
      () => bridge.createDraft({ ...args, request_id: randomUUID() }),
      /already has a draft request/
    )

    assert.deepEqual(platforms(bridge.getDraft(args.request_id)), [
      ['wechat', 'saving'],
      ['zhihu', 'queued'],
    ])
    const zhihu = nextMessage(socket)
    send('result', { platform: 'wechat', status: 'not_confirmed', message: 'Log in to WeChat.' })
    assert.deepEqual(await zhihu, { type: 'execute', id: args.request_id, platform: 'zhihu' })
    send('result', { platform: 'zhihu', status: 'filled', message: 'Editor filled.' })
    const pong = nextMessage(socket)
    send('ping')
    assert.equal((await pong).type, 'pong')
    const result = bridge.getDraft(args.request_id)
    assert.equal(result.status, 'partial_success')
    assert.deepEqual(result.results, [
      { platform: 'wechat', status: 'not_confirmed', message: 'Log in to WeChat.' },
      { platform: 'zhihu', status: 'filled', message: 'Editor filled.' },
    ])
    assert.deepEqual(bridge.createDraft(args), result)
  }
)

test(
  'disconnecting mid-batch preserves results and cancels destinations that never started',
  { timeout: 5000 },
  async t => {
    const { bridge, pair } = await bridgeFixture(t)
    const { id, socket } = await pair('Chrome')
    const args = {
      request_id: randomUUID(),
      browser_id: id,
      platforms: ['wechat', 'zhihu', 'bilibili'],
      title: 'COSE',
      text: 'test',
    }
    const send = (type, data) => socket.send(JSON.stringify({ type, id: args.request_id, ...data }))
    const first = nextMessage(socket)
    assert.equal(bridge.createDraft(args).status, 'queued')
    assert.equal((await first).platform, 'wechat')
    const second = nextMessage(socket)
    send('result', { platform: 'wechat', status: 'filled' })
    assert.equal((await second).platform, 'zhihu')

    const closed = once(socket, 'close')
    socket.close()
    await closed
    while (bridge.getDraft(args.request_id).status === 'saving') {
      await delay(10, undefined, { signal: t.signal })
    }
    const result = bridge.getDraft(args.request_id)
    assert.equal(result.status, 'partial_success')
    assert.deepEqual(
      result.results.map(item => item.status),
      ['filled', 'not_confirmed', 'cancelled']
    )
  }
)

test(
  'lists Substack and dispatches it to the paired browser as a draft target',
  { timeout: 5000 },
  async t => {
    const { bridge, pair } = await bridgeFixture(t)
    const browser = await pair('Draft test')
    const platform = { id: 'substack', name: 'Substack', mode: 'confirmed_draft' }
    assert.deepEqual(
      bridge.listPlatforms().platforms.find(item => item.id === 'substack'),
      platform
    )
    const incoming = nextMessage(browser.socket)
    bridge.createDraft({
      request_id: randomUUID(),
      browser_id: browser.id,
      platform: 'Substack',
      title: 'Draft test',
      markdown: '## Heading',
    })
    const message = await incoming
    assert.equal(message.platform, 'substack')
    assert.deepEqual(message.article.platforms, [platform])
  }
)
