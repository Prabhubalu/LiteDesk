;(function () {
  function getAttr(el, name, fallback) {
    var v = el.getAttribute(name)
    return v == null || v === '' ? fallback : v
  }

  var currentScript = document.currentScript
  if (!currentScript) {
    currentScript = document.querySelector('script[src*="/embed/chat.js"]')
  }
  if (!currentScript) return

  var instanceKey = getAttr(currentScript, 'data-instance', '')
  if (!instanceKey) {
    console.error('[ArivuChat] Missing data-instance')
    return
  }

  var position = getAttr(currentScript, 'data-position', 'right')
  var theme = getAttr(currentScript, 'data-theme', 'light')
  // Optional: when the API is hosted on a different origin (e.g. api.example.com),
  // specify data-api-origin="https://api.example.com" on the script tag.
  var apiOrigin = getAttr(currentScript, 'data-api-origin', '')

  var hostOrigin = currentScript.src.split('/embed/chat.js')[0]
  var effectiveApiOrigin = apiOrigin || hostOrigin
  var widgetUrl =
    hostOrigin +
    '/embed/chat/widget.html' +
    '#instanceKey=' +
    encodeURIComponent(instanceKey) +
    '&theme=' +
    encodeURIComponent(theme) +
    '&apiOrigin=' +
    encodeURIComponent(effectiveApiOrigin)

  var btn = document.createElement('button')
  btn.type = 'button'
  btn.setAttribute('aria-label', 'Open chat')
  btn.innerHTML =
    '<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;">' +
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M8 10h8M8 14h5" stroke="white" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M12 3c5.1 0 9 3.6 9 8.1 0 2.2-1 4.2-2.6 5.7-.2.2-.4.6-.4 1l.2 2.5-2.6-1.2c-.5-.2-1-.2-1.5 0-1.1.4-2.3.6-3.5.6-5.1 0-9-3.6-9-8.1S6.9 3 12 3z" fill="white" fill-opacity="0.18"/>' +
    '<path d="M12 4c4.6 0 8 3.2 8 7.1 0 1.9-.9 3.7-2.3 5-.4.4-.6 1-.6 1.6l.1 1.2-1.3-.6c-.8-.4-1.7-.4-2.5-.1-1 .3-2 .5-3.1.5-4.6 0-8-3.2-8-7.1S7.4 4 12 4z" stroke="white" stroke-opacity="0.55" stroke-width="1.2"/>' +
    '</svg>' +
    '</span>'
  btn.style.position = 'fixed'
  btn.style.bottom = '20px'
  btn.style.zIndex = '2147483647'
  btn.style.width = '56px'
  btn.style.height = '56px'
  btn.style.padding = '0'
  btn.style.borderRadius = '999px'
  btn.style.border = '0'
  btn.style.cursor = 'pointer'
  btn.style.boxShadow = '0 10px 25px rgba(0,0,0,0.15)'
  btn.style.background = 'linear-gradient(135deg, #2563eb, #7f56d9)'
  btn.style.color = '#fff'
  btn.style.font = '600 14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  if (position === 'left') btn.style.left = '20px'
  else btn.style.right = '20px'

  var overlay = document.createElement('div')
  overlay.style.position = 'fixed'
  overlay.style.inset = '0'
  overlay.style.background = 'rgba(0,0,0,0.35)'
  overlay.style.zIndex = '2147483646'
  overlay.style.display = 'none'

  var frame = document.createElement('iframe')
  frame.src = widgetUrl
  frame.title = 'Arivu Live Chat'
  frame.style.position = 'fixed'
  frame.style.bottom = '92px'
  frame.style.zIndex = '2147483647'
  // Slightly larger widget by default, but keep it within viewport.
  frame.style.width = '420px'
  frame.style.height = '640px'
  frame.style.maxWidth = 'calc(100vw - 40px)'
  frame.style.maxHeight = 'calc(100vh - 140px)'
  frame.style.border = '0'
  frame.style.borderRadius = '14px'
  frame.style.boxShadow = '0 20px 40px rgba(2,6,23,0.25)'
  frame.style.display = 'none'
  if (position === 'left') frame.style.left = '20px'
  else frame.style.right = '20px'

  function open() {
    overlay.style.display = 'block'
    frame.style.display = 'block'
  }
  function close() {
    overlay.style.display = 'none'
    frame.style.display = 'none'
  }

  btn.addEventListener('click', function () {
    if (frame.style.display === 'none') open()
    else close()
  })
  overlay.addEventListener('click', close)
  window.addEventListener('message', function (e) {
    if (!e || !e.data) return
    if (e.data === 'litedesk_chat_close') close()
  })

  function getPageContext() {
    return {
      type: 'litedesk_chat_page_context',
      pageUrl: window.location.href,
      referrerUrl: document.referrer || '',
      language: (navigator.language || '').trim(),
    }
  }

  function postPageContextToFrame() {
    if (!frame.contentWindow) return
    try {
      frame.contentWindow.postMessage(getPageContext(), '*')
    } catch (_) {}
  }

  frame.addEventListener('load', postPageContextToFrame)

  var lastTrackedUrl = window.location.href
  window.addEventListener('popstate', function () {
    lastTrackedUrl = window.location.href
    postPageContextToFrame()
  })
  window.addEventListener('hashchange', function () {
    lastTrackedUrl = window.location.href
    postPageContextToFrame()
  })
  setInterval(function () {
    if (window.location.href !== lastTrackedUrl) {
      lastTrackedUrl = window.location.href
      postPageContextToFrame()
    }
  }, 1000)

  document.body.appendChild(overlay)
  document.body.appendChild(frame)
  document.body.appendChild(btn)
})()

