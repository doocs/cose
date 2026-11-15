// Use a script-free page on the site so logout can clear only its auth storage.
export function clearSspaiStorage() {
  const origin = 'https://sspai.com'
  const id = crypto.randomUUID()
  const frame = document.createElement('iframe')
  frame.hidden = true
  frame.src = origin + '/robots.txt'

  return new Promise(resolve => {
    const finish = cleared => {
      clearTimeout(timeout)
      clearInterval(retry)
      window.removeEventListener('message', onMessage)
      frame.remove()
      resolve(cleared)
    }
    const onMessage = event => {
      if (
        event.origin === origin &&
        event.source === frame.contentWindow &&
        event.data?.type === 'COSE_SSPAI_STORAGE_RESULT' &&
        event.data.id === id
      )
        finish(event.data.cleared === true)
    }
    const send = () => {
      frame.contentWindow?.postMessage({ type: 'COSE_CLEAR_SSPAI_STORAGE', id }, origin)
    }
    const timeout = setTimeout(() => finish(false), 6000)
    const retry = setInterval(send, 200)
    window.addEventListener('message', onMessage)
    frame.addEventListener('load', send)
    document.body.append(frame)
  })
}
