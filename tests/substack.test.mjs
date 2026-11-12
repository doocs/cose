import assert from 'node:assert/strict'
import test from 'node:test'
import {
  checkSubstackLogin,
  createSubstackMcpDraft,
  getSubstackPublications,
  substackSite,
  syncSubstackDraft,
} from '../packages/core/src/platforms/substack.js'

const site = 'https://cose-test.substack.com'
const profileUrl = 'https://substack.com/api/v1/user/profile/self'
const draftsUrl = `${site}/api/v1/drafts`
const sender = { frameId: 0, tab: { id: 1 }, url: 'https://md.doocs.org/' }
const content = {
  title: 'Substack smoke test',
  markdown: '## Heading\n\n- [Link](https://example.com)\n- **Bold**\n\n```js\nconst a = 1\n```',
  substackSite: site,
}
const profile = {
  id: 9,
  handle: 'draftauthor',
  photo_url: 'https://substackcdn.com/image.png',
  publicationUsers: [
    { role: 'subscriber', publication: { subdomain: 'subscriber-only' } },
    { role: 'admin', publication: { subdomain: 'another-site' } },
    { id: 10, role: 'contributor', publication: { subdomain: 'cose-test', name: 'COSE Test' } },
  ],
}

function mockSubstack(t, connection, handleRequest) {
  const storage = { substackConnection: connection }
  const requests = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const { method, credentials, redirect, body } = options
    assert.equal(credentials, 'include')
    assert.equal(redirect, 'error')
    const input = { url, method, body: body && JSON.parse(body) }
    requests.push(input)
    const result = url === profileUrl ? profile : handleRequest(input)
    return result instanceof Response ? result : Response.json(result)
  })
  const previousChrome = globalThis.chrome
  t.after(() => {
    globalThis.chrome = previousChrome
  })
  globalThis.chrome = {
    permissions: { contains: async () => true },
    storage: {
      local: {
        get: async key => ({ [key]: storage[key] }),
        set: async values => Object.assign(storage, values),
      },
    },
  }
  return { storage, requests }
}

test('validates the publication URL', () => {
  assert.equal(substackSite(`${site}/publish`), site)
  assert.equal(substackSite('https://cose-test.substack.com.example.com'), null)
  assert.equal(substackSite('https://substack.com/@cose-test'), null)
})

test('creates and reads back a new draft even when an old update target is stored', async t => {
  let draft
  const { requests } = mockSubstack(t, { site, draftId: '99' }, ({ url, method, body }) => {
    if (method === 'POST') {
      assert.equal(url, draftsUrl)
      assert.equal(body.type, 'newsletter')
      assert.deepEqual(body.draft_bylines, [{ id: 9, is_guest: false }])
      assert.equal(body.audience, 'everyone')
      assert.equal(body.section_chosen, false)
      assert.equal(body.draft_section_id, null)
      const doc = JSON.parse(body.draft_body)
      assert.deepEqual(
        doc.content.map(node => node.type),
        ['heading', 'bulletList', 'code_block']
      )
      draft = { id: 42, is_published: false, ...body }
      return { id: 42 }
    }
    assert.equal(url, `${draftsUrl}/42`)
    return draft
  })
  assert.deepEqual(await checkSubstackLogin(sender), {
    loggedIn: true,
    username: 'draftauthor',
    avatar: 'https://substackcdn.com/image.png',
    home: site,
  })
  assert.deepEqual(await syncSubstackDraft(content, sender), {
    success: true,
    message: '已确认保存 Substack 草稿',
    draftLink: `${site}/publish/post/42`,
  })
  assert.deepEqual(
    requests.map(({ method }) => method),
    ['GET', 'GET', 'POST', 'GET']
  )
})

test('refuses untrusted editor origins before writing', async t => {
  const { requests } = mockSubstack(t, { site }, () => assert.fail('Unexpected draft request'))
  const untrusted = { ...sender, url: 'https://example.com/' }
  assert.equal((await syncSubstackDraft(content, untrusted)).success, false)
  assert.equal(requests.length, 0)
})

test('reports missing saved content without repeating a create request', async t => {
  const { requests } = mockSubstack(t, { site }, ({ method }) =>
    method === 'POST'
      ? { id: 42 }
      : {
          id: 42,
          is_published: false,
          draft_title: content.title,
          draft_body: JSON.stringify({ type: 'doc', content: [] }),
        }
  )
  assert.match((await syncSubstackDraft(content, sender)).message, /Drafts/)
  assert.deepEqual(
    requests.map(({ method }) => method),
    ['GET', 'POST', 'GET']
  )
})

test('MCP creates in the configured publication and preserves the editor update target', async t => {
  let draft
  const { requests, storage } = mockSubstack(
    t,
    { site, draftId: '99' },
    ({ url, method, body }) => {
      if (method === 'POST') {
        assert.equal(url, draftsUrl)
        draft = { id: 42, is_published: false, ...body }
        return { id: 42 }
      }
      assert.equal(url, `${draftsUrl}/42`)
      return draft
    }
  )
  assert.equal(
    (await createSubstackMcpDraft({ ...content, substackSite: undefined })).success,
    true
  )
  assert.deepEqual(
    requests.map(({ method }) => method),
    ['GET', 'POST', 'GET']
  )
  assert.equal(storage.substackConnection.draftId, '99')
})

test('shows the signed-in identity on local MD before selecting a publication', async t => {
  const { storage, requests } = mockSubstack(t, { site }, () =>
    assert.fail('Unexpected draft request')
  )
  const local = { ...sender, url: 'http://localhost:5173/' }
  const identity = await checkSubstackLogin(local)
  assert.equal(identity.loggedIn, true)
  assert.equal(identity.username, 'draftauthor')
  assert.equal(identity.avatar, profile.photo_url)
  assert.equal(identity.home, undefined)
  assert.equal((await syncSubstackDraft(content, local)).success, false)
  storage.substackConnection.allowLocalEditor = true
  assert.equal((await checkSubstackLogin(local)).home, site)
  assert.equal(
    (await checkSubstackLogin({ ...local, url: 'http://localhost:5174/' })).loggedIn,
    false
  )
  assert.deepEqual(
    requests.map(({ method }) => method),
    ['GET', 'GET']
  )
})

test('publication discovery lists editable publications without guessing the target', async t => {
  mockSubstack(t, { site }, () => assert.fail('Unexpected draft request'))
  const { publications } = await getSubstackPublications()
  assert.deepEqual(
    publications.map(({ site, name }) => ({ site, name })),
    [
      { site: 'https://another-site.substack.com', name: 'another-site' },
      { site, name: 'COSE Test' },
    ]
  )
})

test('reports a rejected create request with its validation field and does not retry', async t => {
  const { requests } = mockSubstack(t, { site }, () =>
    Response.json({ errors: [{ param: 'draft_title', msg: 'Invalid value' }] }, { status: 400 })
  )
  const result = await syncSubstackDraft(content, sender)
  assert.equal(result.success, false)
  assert.match(result.message, /创建草稿失败.*HTTP 400.*draft_title Invalid value/)
  assert.deepEqual(
    requests.map(({ method }) => method),
    ['GET', 'POST']
  )
})
