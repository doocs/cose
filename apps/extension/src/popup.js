import { clearPlatformSession, platformSessions } from './platform-sessions.js'
import { wordPressPendingKey, wordPressPermission } from '@cose/core/src/platforms/wordpress.js'

import { logoutConfirmation, logoutMessages } from './logout-messages.js'
import { showMcpSettings } from './mcp-popup.js'
import { clearSspaiStorage } from './sspai-storage.js'

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
  document.getElementById('wordpressHost').textContent =
    `${pending.platform ?? 'WordPress'} · ${pending.host}`
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

const platformSelect = document.getElementById('sessionPlatform')
const clearSessionButton = document.getElementById('clearSession')
const clearSessionStatus = document.getElementById('clearSessionStatus')

const locale = new URLSearchParams(location.search).get('lang') || chrome.i18n.getUILanguage()
const messages = logoutMessages(locale)
document.getElementById('sessionSummary').textContent = messages.summary
document.getElementById('sessionHelp').textContent = messages.help
document.getElementById('sessionLabel').textContent = messages.label
platformSelect.options[0].textContent = messages.placeholder

for (const [index, platform] of platformSessions.entries()) {
  platformSelect.add(new Option(platform.name, String(index)))
}

platformSelect.addEventListener('change', () => {
  clearSessionButton.disabled = !platformSelect.value
  clearSessionStatus.textContent = ''
})

clearSessionButton.addEventListener('click', async () => {
  if (!platformSelect.value) return
  const platform = platformSessions[Number(platformSelect.value)]
  if (!platform) return
  if (!window.confirm(logoutConfirmation(platform, locale))) {
    return
  }

  clearSessionButton.disabled = true
  platformSelect.disabled = true
  try {
    clearSessionStatus.textContent =
      messages[await clearPlatformSession(platform, clearSspaiStorage)]
  } catch {
    clearSessionStatus.textContent = messages.failed
  } finally {
    platformSelect.disabled = false
    clearSessionButton.disabled = false
  }
})
