import { readFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'

const { EDGE_API_KEY, EDGE_CLIENT_ID, EDGE_PRODUCT_ID, RELEASE_TAG } = process.env
const api = 'https://api.addons.microsoftedge.microsoft.com'
const product = `/v1/products/${encodeURIComponent(EDGE_PRODUCT_ID)}/submissions`
const extensionId = 'lgjcbaepfacbaelnojpbfehnifdhajfh'

function versionKey(version) {
  if (
    typeof version !== 'string' ||
    !/^(0|[1-9][0-9]{0,4})(\.(0|[1-9][0-9]{0,4})){0,3}$/.test(version)
  ) {
    throw new Error('Invalid Edge extension version')
  }
  const parts = version.split('.')
  if (parts.some(part => Number(part) > 65535)) throw new Error('Invalid Edge extension version')
  return Array.from({ length: 4 }, (_, index) => (parts[index] ?? '0').padStart(5, '0')).join('')
}

async function request(path, options) {
  const response = await fetch(api + path, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `ApiKey ${EDGE_API_KEY}`,
      'X-ClientID': EDGE_CLIENT_ID,
    },
    redirect: 'error',
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok)
    throw new Error(`Edge Add-ons ${options?.method ?? 'GET'}: HTTP ${response.status}`)
  return response
}

async function startOperation(path, contentType, body) {
  const response = await request(path, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body,
  })
  const id = response.headers.get('Location')?.split('/').filter(Boolean).at(-1)
  if (response.status !== 202 || !id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error('Edge Add-ons did not return an operation ID')
  }
  console.log(`Edge Add-ons operation: ${id}`)
  return id
}

async function waitForOperation(path, id, label, attempts) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const { status, errorCode } = await (await request(`${path}/operations/${id}`)).json()
    if (status === 'Succeeded') return true
    if (status !== 'InProgress') {
      const code =
        typeof errorCode === 'string' && /^[a-zA-Z0-9_-]+$/.test(errorCode) ? errorCode : 'unknown'
      throw new Error(
        `Edge Add-ons ${label} failed (${code}, operation ${id}). Check Partner Center before retrying.`
      )
    }
    if (attempt + 1 < attempts) await delay(3_000)
  }
  return false
}

if (!EDGE_API_KEY || !EDGE_CLIENT_ID || !EDGE_PRODUCT_ID) {
  throw new Error(
    'Configure EDGE_PRODUCT_ID and EDGE_CLIENT_ID as secrets or variables and EDGE_API_KEY as a secret'
  )
}
if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(EDGE_PRODUCT_ID)) {
  throw new Error('EDGE_PRODUCT_ID must be the Partner Center product GUID')
}
if (!RELEASE_TAG?.startsWith('v')) throw new Error('Missing Edge release tag')
const version = RELEASE_TAG.slice(1)
const target = versionKey(version)

// The public listing lets an already published version be skipped on retries.
const listing = await fetch(
  `https://microsoftedge.microsoft.com/addons/getproductdetailsbycrxid/${extensionId}`,
  { signal: AbortSignal.timeout(20_000) }
)
if (!listing.ok) throw new Error(`Could not check the Edge listing (HTTP ${listing.status})`)
const { crxId, version: publishedVersion } = await listing.json()
if (crxId !== extensionId) throw new Error('Edge Add-ons returned the wrong listing')
if (versionKey(publishedVersion) >= target) {
  console.log(
    `Edge Add-ons already has version ${publishedVersion} published. Skipping ${version}.`
  )
} else {
  const draft = `${product}/draft/package`
  const zip = await readFile(`packages/cose-${version}-chromium.zip`)
  const upload = await startOperation(draft, 'application/zip', zip)
  if (!(await waitForOperation(draft, upload, 'upload', 12))) {
    throw new Error(
      `Edge Add-ons upload ${upload} is still processing. Check Partner Center before retrying.`
    )
  }

  const submission = await startOperation(product, 'text/plain', `COSE ${RELEASE_TAG}`)
  if (await waitForOperation(product, submission, 'submission', 4)) {
    console.log(`Edge Add-ons created the review submission for COSE ${version}.`)
  } else {
    console.log(
      `Edge Add-ons is processing submission ${submission}. Check its status in Partner Center.`
    )
  }
}
