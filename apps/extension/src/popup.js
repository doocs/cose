import {
  connectionKey,
  substackDraftId,
  substackPermission,
  substackSite,
} from '@cose/core/src/platforms/substack.js'

import { wordPressPendingKey, wordPressPermission } from '@cose/core/src/platforms/wordpress.js'

import { showMcpSettings } from './mcp-popup.js'

if (chrome.runtime.getManifest().permissions.includes('alarms')) {
  showMcpSettings().catch(console.error)
}

// Popup script for COSE extension
document.getElementById('openOfficial').addEventListener('click', e => {
  e.preventDefault()
  chrome.tabs.create({ url: 'https://md.doocs.org' })
  window.close()
})

async function showWordPressPermission() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return
  const key = wordPressPendingKey(tab.id)
  const { [key]: pending } = await chrome.storage.session.get(key)
  if (!pending) return
  if (pending.expires < Date.now()) {
    await chrome.storage.session.remove(key)
    return
  }
  const permission = wordPressPermission(`https://${pending.host}/`)
  if (await chrome.permissions.contains(permission)) return

  const section = document.getElementById('wordpressPermission')
  const button = document.getElementById('allowWordPress')
  const status = document.getElementById('wordpressPermissionStatus')
  document.getElementById('wordpressHost').textContent = `WordPress · ${pending.host}`
  section.hidden = false
  button.addEventListener('click', async () => {
    button.disabled = true
    try {
      if (await chrome.permissions.request(permission)) {
        await chrome.storage.session.remove(key)
        window.close()
        return
      }
      status.textContent = '未授权 / Access not granted'
    } catch {
      status.textContent = '授权失败 / Could not request access'
    } finally {
      button.disabled = false
    }
  })
}

showWordPressPermission().catch(() => {})

const substackForm = document.getElementById('substackSettings')
const substackSiteInput = document.getElementById('substackSite')
const substackDraftInput = document.getElementById('substackDraft')
const substackStatus = document.getElementById('substackStatus')

chrome.storage.local
  .get(connectionKey)
  .then(({ [connectionKey]: connection }) => {
    if (!connection) return
    substackSiteInput.value = connection.site
    if (connection.draftId) {
      substackDraftInput.value = `${connection.site}/publish/post/${connection.draftId}`
    }
  })
  .catch(() => {})

substackForm.addEventListener('submit', async event => {
  event.preventDefault()
  const site = substackSite(substackSiteInput.value)
  const draftUrl = substackDraftInput.value.trim()
  const draftId = draftUrl && substackDraftId(draftUrl, site)
  if (!site || (draftUrl && !draftId)) {
    substackStatus.textContent = '请输入 Substack 出版物网址和同站草稿编辑链接'
    return
  }

  const button = substackForm.querySelector('button')
  button.disabled = true
  try {
    if (!(await chrome.permissions.request(substackPermission(site)))) {
      substackStatus.textContent = '未授权访问 Substack'
      return
    }
    await chrome.storage.local.set({ [connectionKey]: { site, ...(draftId && { draftId }) } })
    substackStatus.textContent = '已保存。请在 Doocs MD 的发布窗口选择 Substack。'
  } catch {
    substackStatus.textContent = '无法保存 Substack 设置'
  } finally {
    button.disabled = false
  }
})
