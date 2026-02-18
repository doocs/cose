// Offscreen document for making fetch requests with cookies
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OFFSCREEN_FETCH') {
    handleFetch(message.payload)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err => sendResponse({ success: false, error: err.message }))
    return true // keep channel open for async response
  }
})

async function handleFetch(payload) {
  const { url, method, headers, body } = payload
  const resp = await fetch(url, {
    method: method || 'POST',
    credentials: 'include',
    headers: headers || {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`)
  }
  return await resp.json()
}
