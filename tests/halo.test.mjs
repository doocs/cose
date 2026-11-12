import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  connectHalo,
  haloConnectionKey,
  syncHaloDraft,
} from '../packages/core/src/platforms/halo.js'

const site = 'https://halo.example/blog/'
const editor = { frameId: 0, tab: { id: 1 }, url: 'https://md.doocs.org/editor' }
const content = { haloSite: site, title: '测试草稿', body: '<p>测试正文</p>' }
const posts = '/blog/apis/uc.api.content.halo.run/v1alpha1/posts'
const connection = { site, token: 'pat_test', owner: 'contributor' }

function mockConnection(t, granted = true) {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ items: [] }))
  globalThis.chrome = {
    permissions: { contains: async () => granted },
    storage: {
      local: {
        get: async key =>
          key === haloConnectionKey('https://md.doocs.org') ? { [key]: connection } : {},
      },
    },
  }
  t.after(() => delete globalThis.chrome)
}

test('Halo connects using a bearer token and a read-only request to the configured site', async t => {
  const profile = '/blog/apis/uc.api.halo.run/v1alpha1/users/-'
  const fetch = t.mock.method(globalThis, 'fetch', async url =>
    url.pathname === profile
      ? Response.json({ user: { metadata: { name: connection.owner } } })
      : Response.json({ items: [] })
  )
  await assert.rejects(connectHalo('http://halo.example/', 'pat_test'))
  await assert.rejects(connectHalo(site, 'invalid'))
  assert.deepEqual(await connectHalo('https://halo.example/blog', ' pat_test '), connection)
  assert.deepEqual(
    fetch.mock.calls.map(call => call.arguments[0].href),
    [`https://halo.example${posts}?size=1`, `https://halo.example${profile}`]
  )
  for (const {
    arguments: [, options],
  } of fetch.mock.calls) {
    assert.equal(options.method, 'GET')
    assert.equal(options.headers.Authorization, 'Bearer pat_test')
    assert.equal(options.credentials, 'omit')
    assert.equal(options.redirect, 'error')
  }
})

test('Halo scopes sync to the connected editor, site and host permission', async t => {
  mockConnection(t)
  assert.equal((await syncHaloDraft(content, { ...editor, frameId: 1 })).success, false)
  assert.equal(
    (await syncHaloDraft(content, { ...editor, url: 'https://another-editor.example/' })).success,
    false
  )
  assert.equal(
    (await syncHaloDraft({ ...content, haloSite: 'https://other.example/' }, editor)).success,
    false
  )
  t.mock.method(chrome.permissions, 'contains', async () => false)
  assert.equal((await syncHaloDraft(content, editor)).success, false)
  assert.equal(globalThis.fetch.mock.callCount(), 0)
})

test('Halo recovers a timed-out creation by reading the named draft and verifies its body', async t => {
  mockConnection(t)
  let post
  let draftBody = content.body
  let postWrites = 0
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push([url.pathname, options.method])
    if (url.pathname === posts && options.method === 'POST') {
      postWrites++
      post = JSON.parse(options.body)
      throw new TypeError('Connection interrupted after write')
    }
    if (!post) return new Response(null, { status: 404 })
    if (url.pathname.endsWith('/draft') && url.searchParams.get('patched') === 'true') {
      return Response.json({ spec: { rawPatch: draftBody } })
    }
    return Response.json({
      ...post,
      spec: { ...post.spec, owner: connection.owner },
      status: { phase: 'DRAFT' },
    })
  })

  const result = await syncHaloDraft(content, editor)
  assert.equal(result.success, true)
  const { name } = post.metadata
  assert.equal(result.draftLink, `${site}uc/posts/editor?name=${name}`)
  assert.equal(post.spec.publish, false)
  assert.equal(post.apiVersion, 'content.halo.run/v1alpha1')
  assert.deepEqual(JSON.parse(post.metadata.annotations['content.halo.run/content-json']), {
    raw: content.body,
    content: content.body,
    rawType: 'HTML',
  })
  assert.deepEqual(calls, [
    [`${posts}/${name}`, 'GET'],
    [posts, 'POST'],
    [`${posts}/${name}`, 'GET'],
    [`${posts}/${name}/draft`, 'GET'],
  ])
  assert.equal((await syncHaloDraft(content, editor)).success, true)
  draftBody = 'Modified elsewhere'
  assert.equal((await syncHaloDraft(content, editor)).success, false)
  post.spec.publish = true
  draftBody = content.body
  assert.equal((await syncHaloDraft(content, editor)).success, false)
  assert.equal(postWrites, 1)
})
