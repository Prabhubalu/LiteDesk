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
    console.error('[LiteDeskChat] Missing data-instance')
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
  btn.textContent = 'Chat'
  btn.style.position = 'fixed'
  btn.style.bottom = '20px'
  btn.style.zIndex = '2147483647'
  btn.style.padding = '10px 14px'
  btn.style.borderRadius = '999px'
  btn.style.border = '0'
  btn.style.cursor = 'pointer'
  btn.style.boxShadow = '0 10px 25px rgba(0,0,0,0.15)'
  btn.style.background = '#2563eb'
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
  frame.title = 'LiteDesk Live Chat'
  frame.style.position = 'fixed'
  frame.style.bottom = '80px'
  frame.style.zIndex = '2147483647'
  frame.style.width = '360px'
  frame.style.height = '520px'
  frame.style.border = '0'
  frame.style.borderRadius = '14px'
  frame.style.boxShadow = '0 20px 40px rgba(0,0,0,0.25)'
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

  document.body.appendChild(overlay)
  document.body.appendChild(frame)
  document.body.appendChild(btn)
})()

