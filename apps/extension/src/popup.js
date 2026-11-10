import { wordPressPendingKey, wordPressPermission } from '@cose/core/src/platforms/wordpress.js'

if (chrome.runtime.getManifest().permissions.includes('alarms')) {
  document.getElementById('mcpEntry').hidden = false
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
