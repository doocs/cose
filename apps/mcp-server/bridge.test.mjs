import assert from 'node:assert/strict'
import { createHmac, randomBytes, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import test from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { WebSocket } from 'ws'
import { startBridge } from './bridge.mjs'
import { MCP_BRIDGE_VERSION, pairingProof } from '@cose/core/mcp-protocol'

test(
  'routes drafts only to the selected Chrome connection and saves only after approval',
  { timeout: 5000 },
  async t => {
    const token = randomBytes(32).toString('base64url')
    const extensionId = 'a'.repeat(32)
    const bridge = await startBridge(token, 0, extensionId)
    t.after(() => bridge.close())
    const url = `ws://127.0.0.1:${bridge.port}/cose`
    const origin = `chrome-extension://${extensionId}`

    const website = new WebSocket(url, { origin: 'https://example.com' })
    await once(website, 'error')
    const otherExtension = new WebSocket(url, { origin: `chrome-extension://${'b'.repeat(32)}` })
    await once(otherExtension, 'error')

    async function startPairing() {
      const socket = new WebSocket(url, { origin })
      await once(socket, 'open')
      const nonce = randomBytes(32).toString('hex')
      const incoming = once(socket, 'message')
      socket.send(JSON.stringify({ type: 'hello', protocol: MCP_BRIDGE_VERSION, nonce }))
      const challenge = JSON.parse((await incoming)[0])
      assert.equal(challenge.type, 'challenge')
      const sign = role =>
        createHmac('sha256', token)
          .update(pairingProof(role, origin, nonce, challenge.nonce))
          .digest('hex')
      assert.equal(challenge.proof, sign('server'))
      return { socket, proof: sign('extension') }
    }

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

    async function pair(name, browserId = randomUUID(), autoFill = false) {
      const { socket, proof } = await startPairing()
      const next = once(socket, 'message')
      socket.send(JSON.stringify({ type: 'pair', name, browserId, proof, autoFill }))
      const { id } = JSON.parse((await next)[0])
      assert.equal(id, browserId)
      return { socket, id }
    }

    const work = await pair('工作 Chrome', randomUUID(), true)
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
    const reconnected = await pair('个人 Chrome', personal.id)
    assert.equal(reconnected.id, personal.id)
    assert.equal(bridge.createDraft(args).status, 'not_confirmed')
    assert.equal(
      bridge.listPlatforms().browsers.find(browser => browser.id === work.id).confirmation_required,
      false
    )
    const automatic = { ...args, request_id: randomUUID(), browser_id: work.id }
    const autoDraft = once(work.socket, 'message')
    assert.equal(bridge.createDraft(automatic).status, 'queued')
    assert.equal(JSON.parse((await autoDraft)[0]).id, automatic.request_id)
  }
)
