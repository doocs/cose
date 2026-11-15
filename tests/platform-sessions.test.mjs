import assert from 'node:assert/strict'
import test from 'node:test'

import { clearPlatformSession, platformSessions } from '../apps/extension/src/platform-sessions.js'

test('finds a login cookie by name when the domain listing omits it', async t => {
  const platform = platformSessions.find(item => item.id === 'baijiahao')
  const shadow = { name: 'BDUSS', domain: 'passport.baidu.com', path: '/', storeId: '0' }
  let cookie = { ...shadow, domain: '.baidu.com' }
  const removed = []
  const previous = globalThis.chrome
  t.after(() => {
    globalThis.chrome = previous
  })
  globalThis.chrome = {
    cookies: {
      getAll: async () => [shadow],
      get: async ({ url, name }) => {
        assert.equal(url, 'https://baidu.com/')
        return cookie?.name === name ? cookie : null
      },
      remove: async options => {
        removed.push(options)
        cookie = null
      },
    },
  }

  assert.equal(await clearPlatformSession(platform), 'cleared')
  assert.deepEqual(removed, [{ url: 'https://baidu.com/', name: 'BDUSS', storeId: '0' }])
})

test('removes only the targeted platform partition and passes it to the cookie API', async t => {
  const platform = platformSessions.find(item => item.id === 'volcengine')
  const partitionKey = { topLevelSite: 'https://volcengine.com', hasCrossSiteAncestor: false }
  const otherSite = { topLevelSite: 'https://example.com', hasCrossSiteAncestor: true }
  let cookies = [partitionKey, otherSite].map(key => ({
    name: 'digest',
    domain: '.volcengine.com',
    path: '/',
    storeId: '0',
    partitionKey: key,
  }))
  const previous = globalThis.chrome
  t.after(() => {
    globalThis.chrome = previous
  })
  globalThis.chrome = {
    cookies: {
      getAll: async query => {
        if (!query.partitionKey) return []
        assert.equal(query.partitionKey.topLevelSite, partitionKey.topLevelSite)
        return cookies
      },
      get: async () => null,
      remove: async options => {
        assert.deepEqual(options, {
          url: 'https://volcengine.com/',
          name: 'digest',
          storeId: '0',
          partitionKey,
        })
        cookies = cookies.filter(cookie => cookie.partitionKey !== options.partitionKey)
      },
    },
  }

  assert.equal(await clearPlatformSession(platform), 'cleared')
  assert.deepEqual(
    cookies.map(cookie => cookie.partitionKey),
    [otherSite]
  )
})
