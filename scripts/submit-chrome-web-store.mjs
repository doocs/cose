import { readFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'

const { CWS_TOKEN, CWS_PUBLISHER_ID, CWS_EXTENSION_ID, CWS_ACTION, RELEASE_TAG } = process.env
const origin = 'https://chromewebstore.googleapis.com'
const item = `publishers/${encodeURIComponent(CWS_PUBLISHER_ID)}/items/${encodeURIComponent(CWS_EXTENSION_ID)}`

async function request(path, options) {
  const response = await fetch(origin + path, {
    ...options,
    headers: { ...options?.headers, Authorization: `Bearer ${CWS_TOKEN}` },
    signal: AbortSignal.timeout(30_000),
  })
  const result = await response.json()
  if (!response.ok) {
    throw new Error(
      `Chrome Web Store ${path.split(':').at(-1)}: HTTP ${response.status} (${result.error?.status ?? 'unknown'})`
    )
  }
  if (result.itemId !== CWS_EXTENSION_ID)
    throw new Error('Chrome Web Store returned the wrong item')
  return result
}

function versions(revision) {
  return revision?.distributionChannels?.map(channel => channel.crxVersion) ?? []
}

function versionKey(version) {
  const parts = version.split('.')
  if (
    parts.length > 4 ||
    parts.some(part => !/^(0|[1-9][0-9]{0,4})$/.test(part) || Number(part) > 65535)
  ) {
    throw new Error(`Invalid extension version ${version}`)
  }
  return Array.from({ length: 4 }, (_, index) => (parts[index] ?? '0').padStart(5, '0')).join('')
}

const fetchStatus = () => request(`/v2/${item}:fetchStatus`)
const status = await fetchStatus()
const submitted = status.submittedItemRevisionStatus
const publishedVersions = versions(status.publishedItemRevisionStatus)
const submittedVersions = versions(submitted)

if (CWS_ACTION === 'status') {
  console.log(
    JSON.stringify({
      publishedVersions,
      submittedVersions,
      submissionState: submitted?.state ?? null,
    })
  )
} else {
  const version = RELEASE_TAG.slice(1)
  const target = versionKey(version)
  const reviewing = ['PENDING_REVIEW', 'STAGED', 'PUBLISHED_TO_TESTERS'].includes(submitted?.state)
  if (
    publishedVersions.some(value => versionKey(value) >= target) ||
    (reviewing && submittedVersions.some(value => versionKey(value) >= target))
  ) {
    console.log(`Chrome Web Store already has version ${version} or newer published or submitted.`)
    process.exit(0)
  }
  if (reviewing || status.lastAsyncUploadState === 'IN_PROGRESS') {
    throw new Error(
      'Another Chrome Web Store revision is active. Check the dashboard before retrying.'
    )
  }
  if (status.takenDown || status.warned || submitted?.state === 'REJECTED') {
    throw new Error('Chrome Web Store requires attention. Check the dashboard before retrying.')
  }
  const upload = await request(`/upload/v2/${item}:upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/zip' },
    body: await readFile(`packages/cose-${version}-chromium.zip`),
  })
  let uploadState = upload.uploadState
  for (let poll = 0; uploadState === 'IN_PROGRESS' && poll < 12; poll++) {
    await delay(5_000)
    uploadState = (await fetchStatus()).lastAsyncUploadState
  }
  if (uploadState !== 'SUCCEEDED' || (upload.crxVersion && upload.crxVersion !== version)) {
    throw new Error(`Chrome Web Store upload did not confirm version ${version} (${uploadState})`)
  }
  const submission = await request(`/v2/${item}:publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publishType: 'DEFAULT_PUBLISH', blockOnWarnings: true }),
  })
  if (!['PENDING_REVIEW', 'PUBLISHED'].includes(submission.state)) {
    throw new Error(`Unexpected Chrome Web Store submission state: ${submission.state}`)
  }
  console.log(
    `Chrome Web Store ${version}: ${submission.state}. The store publishes automatically after approval.`
  )
}
