import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  checkWordPressLogin,
  connectWordPress,
  syncWordPressDraft,
  wordPressConnectionKey,
  wordPressSite,
} from '../packages/core/src/platforms/wordpress.js'

const editor = { frameId: 0, tab: { id: 1 }, url: 'https://md.doocs.org/editor' }
const otherEditor = { ...editor, url: 'https://editor.example/' }
const site = 'https://blog.example/wordpress/'
const content = { wordpressSite: site, title: 'Draft', body: '<p>Body</p>' }

test('WordPress connects using the plain REST route and sends credentials only to the chosen site', async t => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url: url.href, options })
    if (url.pathname.endsWith('/wp-json/')) return new Response(null, { status: 404 })
    if (url.searchParams.get('rest_route') === '/') return Response.json({ namespaces: ['wp/v2'] })
    return Response.json({ id: 1 })
  })

  assert.throws(() => wordPressSite('http://blog.example'))
  assert.throws(() => wordPressSite('https://blog.example@another.example/'))
  assert.equal(wordPressSite(' https://blog.example/wordpress '), site)
  const connection = await connectWordPress(site, ' author ', 'abc def')
  assert.equal(connection.site, site)
  assert.deepEqual(
    calls.map(call => call.url),
    [`${site}wp-json/`, `${site}?rest_route=/`, `${site}?rest_route=%2Fwp%2Fv2%2Fusers%2Fme`]
  )
  assert.ok(
    calls.every(call => call.options.redirect === 'error' && call.options.credentials === 'omit')
  )
  assert.ok(calls.slice(0, 2).every(call => !call.options.headers?.Authorization))
  assert.equal(calls[2].options.headers.Authorization, `Basic ${btoa('author:abcdef')}`)
})

test('WordPress rejects requests from other editors and stale site selections', async t => {
  const connection = { site, apiRoot: `${site}wp-json/`, username: 'author', password: 'secret' }
  const storage = { [wordPressConnectionKey('https://md.doocs.org')]: connection }
  globalThis.chrome = {
    storage: { local: { get: async key => ({ [key]: storage[key] }) } },
    permissions: { contains: async () => true },
  }
  t.after(() => delete globalThis.chrome)
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ id: 1 }))
  assert.equal((await syncWordPressDraft(content, otherEditor)).success, false)
  assert.equal((await syncWordPressDraft(content, { ...editor, frameId: 1 })).success, false)
  assert.equal(
    (await syncWordPressDraft({ ...content, wordpressSite: 'https://other.example/' }, editor))
      .success,
    false
  )
  assert.equal(fetch.mock.callCount(), 0)
  assert.deepEqual(await checkWordPressLogin(editor), {
    loggedIn: true,
    username: 'blog.example/wordpress',
    home: site,
  })
})

test('WordPress reports success only for a confirmed draft and never retries the POST', async t => {
  const connection = { site, apiRoot: `${site}wp-json/`, username: 'author', password: 'secret' }
  globalThis.chrome = {
    storage: { local: { get: async key => ({ [key]: connection }) } },
    permissions: { contains: async () => true },
  }
  t.after(() => delete globalThis.chrome)
  const responses = [
    () =>
      Response.json({ id: 42, status: 'draft', link: 'https://other.example/' }, { status: 201 }),
    () => Response.json({ id: 42, status: 'publish' }, { status: 201 }),
    () => {
      throw new TypeError('Timed out')
    },
  ]
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url.href, `${site}wp-json/wp/v2/posts`)
    assert.equal(options.method, 'POST')
    assert.deepEqual(JSON.parse(options.body), {
      title: content.title,
      content: content.body,
      status: 'draft',
    })
    return responses.shift()()
  })

  const result = await syncWordPressDraft(content, editor)
  assert.equal(result.success, true)
  assert.equal(result.draftLink, `${site}wp-admin/post.php?post=42&action=edit`)
  assert.equal((await syncWordPressDraft(content, editor)).success, false)
  assert.equal((await syncWordPressDraft(content, editor)).success, false)
  assert.equal(fetch.mock.callCount(), 3)
})
