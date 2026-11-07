import { createHmac, randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'

const [version, output] = process.argv.slice(2)
const { WEB_EXT_API_KEY: issuer, WEB_EXT_API_SECRET: secret } = process.env
const amoOrigin = 'https://addons.mozilla.org'

function authHeader() {
  const now = Math.floor(Date.now() / 1000)
  const encode = data => Buffer.from(JSON.stringify(data)).toString('base64url')
  const claims = encode({ iss: issuer, iat: now, exp: now + 60, jti: randomUUID() })
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${claims}`
  const signature = createHmac('sha256', secret).update(token).digest('base64url')
  return { Authorization: `JWT ${token}.${signature}` }
}

const detail = await fetch(
  `${amoOrigin}/api/v5/addons/addon/cose%40doocs.org/versions/${encodeURIComponent(version)}/`,
  { headers: authHeader(), signal: AbortSignal.timeout(30_000) }
)
if (detail.status === 404) process.exit(3)
if (!detail.ok) throw new Error(`AMO version lookup failed (HTTP ${detail.status})`)

const { file } = await detail.json()
if (file?.status === 'unreviewed' || file?.status === 'awaiting_review') process.exit(4)
if (file?.status !== 'public') throw new Error(`AMO version status: ${file?.status ?? 'unknown'}`)

const fileUrl = new URL(file.url)
if (fileUrl.origin !== amoOrigin) throw new Error('Unexpected AMO download host')
const xpi = await fetch(fileUrl, { headers: authHeader(), signal: AbortSignal.timeout(30_000) })
if (!xpi.ok) throw new Error(`AMO XPI download failed (HTTP ${xpi.status})`)
await writeFile(output, new Uint8Array(await xpi.arrayBuffer()))
