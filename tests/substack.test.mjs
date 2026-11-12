import assert from 'node:assert/strict'
import test from 'node:test'
import {
  checkSubstackLogin,
  substackDraftId,
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
  publicationUsers: [
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
    return Response.json(url === profileUrl ? profile : handleRequest(input))
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

test('validates the publication and same-site draft edit link', () => {
  assert.equal(substackSite(`${site}/publish`), site)
  assert.equal(substackSite('https://cose-test.substack.com.example.com'), null)
  assert.equal(substackSite('https://substack.com/@cose-test'), null)
  assert.equal(substackDraftId(`${site}/publish/post/42`, site), '42')
  assert.equal(substackDraftId('https://another-site.substack.com/publish/post/42', site), null)
})

test('creates and reads back a draft in the configured publication', async t => {
  let draft
  const { requests } = mockSubstack(t, { site }, ({ url, method, body }) => {
    if (method === 'POST') {
      assert.equal(url, draftsUrl)
      assert.equal(body.type, 'newsletter')
      assert.deepEqual(body.draft_bylines, [{ id: 9, publicationUserId: 10 }])
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
    username: 'COSE Test',
    home: site,
  })
  assert.deepEqual(await syncSubstackDraft(content, sender), {
    success: true,
    draftLink: `${site}/publish/post/42`,
  })
  assert.deepEqual(
    requests.map(({ method }) => method),
    ['GET', 'GET', 'POST', 'GET']
  )
})

test('updates the explicitly selected draft and clears the update target', async t => {
  let draft = { id: 42, is_published: false, draft_updated_at: '2026-11-12T00:00:00Z' }
  const { requests, storage } = mockSubstack(
    t,
    { site, draftId: '42' },
    ({ url, method, body }) => {
      assert.equal(url, `${draftsUrl}/42`)
      if (method === 'PUT') {
        assert.equal(body.last_updated_at, draft.draft_updated_at)
        draft = { ...draft, ...body }
      }
      return draft
    }
  )
  assert.equal((await syncSubstackDraft(content, sender)).success, true)
  assert.deepEqual(
    requests.map(({ method }) => method),
    ['GET', 'GET', 'PUT', 'GET']
  )
  assert.deepEqual(storage.substackConnection, { site })
})

test('refuses scheduled drafts and untrusted editor origins before writing', async t => {
  const { requests } = mockSubstack(t, { site, draftId: '42' }, () => ({
    id: 42,
    is_published: false,
    postSchedules: [{ trigger_at: '2026-12-01T00:00:00Z' }],
  }))
  const untrusted = { ...sender, url: 'https://example.com/' }
  assert.equal((await syncSubstackDraft(content, untrusted)).success, false)
  assert.equal(requests.length, 0)
  assert.equal((await syncSubstackDraft(content, sender)).success, false)
  assert.deepEqual(
    requests.map(({ method }) => method),
    ['GET', 'GET']
  )
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
