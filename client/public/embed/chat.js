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
  // Vercel hosts the SPA + static embed assets; long-lived EventSource through
  // Vercel rewrites is unreliable. Prefer the API host for embed REST + SSE.
  var inferredApiOrigin = ''
  try {
    var hostName = new URL(hostOrigin).hostname.toLowerCase()
    if (
      hostName === 'app.arivusystems.com' ||
      hostName.endsWith('.app.arivusystems.com')
    ) {
      inferredApiOrigin = 'https://api.arivusystems.com'
    }
  } catch (_) {}
  var effectiveApiOrigin = apiOrigin || inferredApiOrigin || hostOrigin
  var widgetUrl =
    hostOrigin +
    '/embed/chat/widget.html' +
    '#instanceKey=' +
    encodeURIComponent(instanceKey) +
    '&theme=' +
    encodeURIComponent(theme) +
    '&apiOrigin=' +
    encodeURIComponent(effectiveApiOrigin)

  var LAUNCHER_BG = '#312e81'
  var isLeft = position === 'left'
  var promptVisible = false
  var promptAnimTimer = null
  var unreadCount = 0
  var audioContext = null
  var isOpen = false

  var styleEl = document.createElement('style')
  styleEl.textContent =
    '@keyframes arivuChatPromptIn{' +
    '0%{opacity:0;transform:translateX(var(--arivu-prompt-from,12px)) scale(.45);}' +
    '100%{opacity:1;transform:translateX(0) scale(1);}' +
    '}' +
    '@keyframes arivuChatPromptOut{' +
    '0%{opacity:1;transform:translateX(0) scale(1);}' +
    '100%{opacity:0;transform:translateX(var(--arivu-prompt-from,12px)) scale(.45);}' +
    '}' +
    '@keyframes arivuChatIconFloat{' +
    '0%,100%{transform:translateY(0);}' +
    '50%{transform:translateY(-1px);}' +
    '}' +
    '@keyframes arivuChatDot{' +
    '0%,80%,100%{opacity:.35;}' +
    '40%{opacity:1;}' +
    '}' +
    '@keyframes arivuChatRing{' +
    '0%{transform:scale(.85);opacity:.4;}' +
    '70%{transform:scale(1.4);opacity:0;}' +
    '100%{transform:scale(1.4);opacity:0;}' +
    '}' +
    '@keyframes arivuChatBadgePulse{' +
    '0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(34,197,94,.35);}' +
    '50%{transform:scale(1.06);box-shadow:0 0 0 4px rgba(34,197,94,0);}' +
    '}' +
    '@keyframes arivuChatBtnIdle{' +
    '0%,100%{box-shadow:0 10px 24px rgba(15,23,42,.22);transform:scale(1);}' +
    '50%{box-shadow:0 12px 28px rgba(15,23,42,.28);transform:scale(1.02);}' +
    '}' +
    '[data-arivu-chat-launcher] .arivu-fab{position:relative;overflow:visible;}' +
    '[data-arivu-chat-launcher] .arivu-fab-ring{' +
    'position:absolute;inset:0;border-radius:999px;border:2px solid rgba(49,46,129,.3);' +
    'pointer-events:none;animation:arivuChatRing 2.4s cubic-bezier(.22,1,.36,1) infinite;' +
    '}' +
    '[data-arivu-chat-launcher] .arivu-fab-icon{' +
    'display:flex;align-items:center;justify-content:center;width:100%;height:100%;' +
    'animation:arivuChatIconFloat 2.8s ease-in-out infinite;' +
    '}' +
    '[data-arivu-chat-launcher] .arivu-fab-bubble{' +
    'display:block;width:28px;height:28px;overflow:visible;' +
    '}' +
    '[data-arivu-chat-launcher] .arivu-fab-dot{' +
    'animation:arivuChatDot 1.2s ease-in-out infinite;' +
    '}' +
    '[data-arivu-chat-launcher] .arivu-fab-dot:nth-of-type(1){animation-delay:0s;}' +
    '[data-arivu-chat-launcher] .arivu-fab-dot:nth-of-type(2){animation-delay:.2s;}' +
    '[data-arivu-chat-launcher] .arivu-fab-dot:nth-of-type(3){animation-delay:.4s;}' +
    '[data-arivu-chat-launcher] .arivu-fab-badge{' +
    'position:absolute;right:-2px;top:-2px;min-width:18px;height:18px;padding:0 5px;border-radius:999px;' +
    'background:#ef4444;border:2px solid #fff;box-sizing:border-box;' +
    'color:#fff;font:700 11px/14px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;' +
    'display:none;align-items:center;justify-content:center;' +
    'animation:arivuChatBadgePulse 2s ease-in-out infinite;' +
    '}' +
    '[data-arivu-chat-launcher] .arivu-fab-badge[data-show="1"]{display:inline-flex;}' +
    '[data-arivu-chat-launcher] .arivu-fab-idle{' +
    'animation:arivuChatBtnIdle 2.8s ease-in-out infinite;' +
    '}' +
    '[data-arivu-chat-launcher] .arivu-fab-face{' +
    'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
    'transition:opacity 220ms ease,transform 320ms cubic-bezier(.22,1,.36,1);' +
    '}' +
    '[data-arivu-chat-launcher] .arivu-fab-face-chat{opacity:1;transform:scale(1) rotate(0deg);}' +
    '[data-arivu-chat-launcher] .arivu-fab-face-close{' +
    'opacity:0;transform:scale(.6) rotate(-45deg);pointer-events:none;' +
    '}' +
    '[data-arivu-chat-launcher][data-open="1"] .arivu-fab-face-chat{' +
    'opacity:0;transform:scale(.6) rotate(45deg);' +
    '}' +
    '[data-arivu-chat-launcher][data-open="1"] .arivu-fab-face-close{' +
    'opacity:1;transform:scale(1) rotate(0deg);' +
    '}' +
    '[data-arivu-chat-launcher][data-open="1"] .arivu-fab-ring,' +
    '[data-arivu-chat-launcher][data-open="1"] .arivu-fab-idle,' +
    '[data-arivu-chat-launcher][data-open="1"] .arivu-fab-icon,' +
    '[data-arivu-chat-launcher][data-open="1"] .arivu-fab-dot,' +
    '[data-arivu-chat-launcher][data-open="1"] .arivu-fab-badge{' +
    'animation:none;' +
    '}' +
    '@media (prefers-reduced-motion:reduce){' +
    '[data-arivu-chat-launcher] .arivu-fab-ring,' +
    '[data-arivu-chat-launcher] .arivu-fab-idle,' +
    '[data-arivu-chat-launcher] .arivu-fab-icon,' +
    '[data-arivu-chat-launcher] .arivu-fab-dot,' +
    '[data-arivu-chat-launcher] .arivu-fab-badge{animation:none!important;}' +
    '}'
  document.head.appendChild(styleEl)

  var launcher = document.createElement('div')
  launcher.setAttribute('data-arivu-chat-launcher', '1')
  launcher.style.position = 'fixed'
  launcher.style.bottom = '20px'
  launcher.style.zIndex = '2147483647'
  launcher.style.display = 'flex'
  launcher.style.alignItems = 'center'
  launcher.style.gap = '10px'
  launcher.style.flexDirection = isLeft ? 'row-reverse' : 'row'
  if (isLeft) launcher.style.left = '20px'
  else launcher.style.right = '20px'

  var prompt = document.createElement('button')
  prompt.type = 'button'
  prompt.setAttribute('aria-label', 'Open chat')
  prompt.innerHTML =
    '<span style="display:block;font:700 14px/1.3 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#2d3748;">Hi there! &#x1F44B;</span>' +
    '<span style="display:block;margin-top:2px;font:400 13px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#718096;">How can we help you today?</span>'
  prompt.style.position = 'relative'
  prompt.style.margin = '0'
  prompt.style.padding = '12px 16px'
  prompt.style.border = '0'
  prompt.style.borderRadius = '16px'
  prompt.style.background = '#fff'
  prompt.style.boxShadow = '0 8px 24px rgba(15,23,42,0.12)'
  prompt.style.cursor = 'pointer'
  prompt.style.textAlign = 'left'
  prompt.style.maxWidth = '220px'
  prompt.style.appearance = 'none'
  prompt.style.webkitAppearance = 'none'
  prompt.style.transformOrigin = isLeft ? 'left center' : 'right center'
  prompt.style.setProperty('--arivu-prompt-from', isLeft ? '-18px' : '18px')
  prompt.style.opacity = '0'
  prompt.style.pointerEvents = 'none'
  prompt.style.visibility = 'hidden'
  prompt.style.willChange = 'transform, opacity'

  var promptTail = document.createElement('span')
  promptTail.setAttribute('aria-hidden', 'true')
  promptTail.style.position = 'absolute'
  promptTail.style.top = '50%'
  promptTail.style.width = '10px'
  promptTail.style.height = '10px'
  promptTail.style.background = '#fff'
  promptTail.style.transform = 'translateY(-50%) rotate(45deg)'
  promptTail.style.boxShadow = isLeft
    ? '-2px 2px 4px rgba(15,23,42,0.06)'
    : '2px -2px 4px rgba(15,23,42,0.06)'
  if (isLeft) {
    promptTail.style.left = '-4px'
  } else {
    promptTail.style.right = '-4px'
  }
  prompt.appendChild(promptTail)

  function clearPromptAnimTimer() {
    if (promptAnimTimer) {
      clearTimeout(promptAnimTimer)
      promptAnimTimer = null
    }
  }

  function showPrompt(delayMs) {
    clearPromptAnimTimer()
    promptAnimTimer = setTimeout(function () {
      promptVisible = true
      prompt.style.visibility = 'visible'
      prompt.style.pointerEvents = 'auto'
      prompt.style.animation = 'arivuChatPromptIn 420ms cubic-bezier(0.22, 1, 0.36, 1) forwards'
    }, delayMs == null ? 0 : delayMs)
  }

  function hidePrompt(immediate) {
    clearPromptAnimTimer()
    if (!promptVisible && prompt.style.visibility === 'hidden') return
    promptVisible = false
    prompt.style.pointerEvents = 'none'
    if (immediate) {
      prompt.style.animation = 'none'
      prompt.style.opacity = '0'
      prompt.style.visibility = 'hidden'
      return
    }
    prompt.style.animation = 'arivuChatPromptOut 280ms cubic-bezier(0.4, 0, 0.2, 1) forwards'
    promptAnimTimer = setTimeout(function () {
      prompt.style.visibility = 'hidden'
      prompt.style.opacity = '0'
      prompt.style.animation = 'none'
    }, 280)
  }

  var btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'arivu-fab arivu-fab-idle'
  btn.setAttribute('aria-label', 'Open chat')
  btn.innerHTML =
    '<span class="arivu-fab-ring" aria-hidden="true"></span>' +
    '<span class="arivu-fab-face arivu-fab-face-chat" aria-hidden="true">' +
    '<span class="arivu-fab-icon">' +
    '<svg class="arivu-fab-bubble" width="28" height="28" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path fill="#fff" d="M12 6h20a10 10 0 0 1 10 10v12a10 10 0 0 1-10 10H22.2L13 44.5c-.7.4-1.5-.2-1.3-1L13.2 38H12A10 10 0 0 1 2 28V16A10 10 0 0 1 12 6z"/>' +
    '<circle class="arivu-fab-dot" cx="16" cy="22" r="2.6" fill="' +
    LAUNCHER_BG +
    '"/>' +
    '<circle class="arivu-fab-dot" cx="24" cy="22" r="2.6" fill="' +
    LAUNCHER_BG +
    '"/>' +
    '<circle class="arivu-fab-dot" cx="32" cy="22" r="2.6" fill="' +
    LAUNCHER_BG +
    '"/>' +
    '</svg>' +
    '</span>' +
    '<span class="arivu-fab-badge" aria-hidden="true"></span>' +
    '</span>' +
    '<span class="arivu-fab-face arivu-fab-face-close" aria-hidden="true">' +
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>' +
    '</svg>' +
    '</span>'
  var badgeEl = btn.querySelector('.arivu-fab-badge')

  function setUnreadCount(n) {
    unreadCount = Math.max(0, Number(n) || 0)
    if (!badgeEl) return
    if (unreadCount <= 0) {
      badgeEl.removeAttribute('data-show')
      badgeEl.textContent = ''
      return
    }
    badgeEl.setAttribute('data-show', '1')
    badgeEl.textContent = unreadCount > 9 ? '9+' : String(unreadCount)
  }

  function playAgentMessageSound() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return
      if (!audioContext) audioContext = new Ctx()
      var ctx = audioContext
      if (ctx.state === 'suspended') {
        ctx.resume().catch(function () {})
      }
      var now = ctx.currentTime
      var gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45)
      gain.connect(ctx.destination)
      function playTone(freq, start, duration) {
        var osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, start)
        osc.connect(gain)
        osc.start(start)
        osc.stop(start + duration)
      }
      playTone(880, now + 0.02, 0.12)
      playTone(1174, now + 0.16, 0.14)
    } catch (_) {}
  }

  function onAgentMessage() {
    playAgentMessageSound()
    if (!isOpen) setUnreadCount(unreadCount + 1)
  }

  btn.style.position = 'relative'
  btn.style.flex = '0 0 auto'
  btn.style.width = '60px'
  btn.style.height = '60px'
  btn.style.padding = '0'
  btn.style.borderRadius = '999px'
  btn.style.border = '0'
  btn.style.cursor = 'pointer'
  btn.style.background = LAUNCHER_BG
  btn.style.boxShadow = '0 10px 24px rgba(15,23,42,0.22)'
  btn.style.color = '#fff'
  btn.style.appearance = 'none'
  btn.style.webkitAppearance = 'none'
  btn.style.overflow = 'visible'
  btn.style.transition = 'transform 180ms ease, box-shadow 180ms ease'

  launcher.appendChild(prompt)
  launcher.appendChild(btn)

  var overlay = document.createElement('div')
  overlay.style.position = 'fixed'
  overlay.style.inset = '0'
  overlay.style.background = 'transparent'
  overlay.style.zIndex = '2147483646'
  overlay.style.display = 'none'

  var frame = document.createElement('iframe')
  frame.src = widgetUrl
  frame.title = 'Arivu Live Chat'
  frame.style.position = 'fixed'
  frame.style.bottom = '92px'
  frame.style.zIndex = '2147483647'
  // Cap height so the widget never dominates short viewports.
  frame.style.width = '420px'
  frame.style.maxWidth = 'calc(100vw - 32px)'
  frame.style.maxHeight = 'min(560px, calc(100vh - 168px))'

  function preferredChatHeight() {
    var vh = window.innerHeight || 800
    // FAB (~60) + gaps (~108) + top breathing room
    var byMargin = vh - 168
    var byRatio = Math.round(vh * 0.68)
    var max = Math.min(560, byMargin, byRatio)
    return Math.max(300, max)
  }

  function setFrameHeight() {
    var max = preferredChatHeight()
    frame.style.height = max + 'px'
    frame.style.maxHeight = max + 'px'
  }
  setFrameHeight()
  frame.style.border = '0'
  frame.style.borderRadius = '24px'
  frame.style.overflow = 'hidden'
  frame.style.boxShadow = '0 22px 50px rgba(15,23,42,0.22)'
  frame.style.display = 'none'
  frame.style.transformOrigin = isLeft ? 'bottom left' : 'bottom right'
  frame.style.opacity = '0'
  frame.style.transform = 'translateY(18px) scale(0.92)'
  frame.style.transition = 'opacity 280ms cubic-bezier(0.22, 1, 0.36, 1), transform 320ms cubic-bezier(0.22, 1, 0.36, 1)'
  if (position === 'left') frame.style.left = '20px'
  else frame.style.right = '20px'

  function open() {
    isOpen = true
    setUnreadCount(0)
    setFrameHeight()
    overlay.style.display = 'block'
    frame.style.display = 'block'
    // Force reflow so the open transition runs.
    void frame.offsetWidth
    frame.style.opacity = '1'
    frame.style.transform = 'translateY(0) scale(1)'
    launcher.setAttribute('data-open', '1')
    btn.setAttribute('aria-label', 'Close chat')
    btn.classList.remove('arivu-fab-idle')
    hidePrompt(false)
  }
  function close() {
    isOpen = false
    frame.style.opacity = '0'
    frame.style.transform = 'translateY(18px) scale(0.92)'
    setTimeout(function () {
      overlay.style.display = 'none'
      frame.style.display = 'none'
    }, 240)
    launcher.removeAttribute('data-open')
    btn.setAttribute('aria-label', 'Open chat')
    btn.classList.add('arivu-fab-idle')
    showPrompt(180)
  }

  function toggle() {
    if (frame.style.display === 'none') open()
    else close()
  }
  btn.addEventListener('click', toggle)
  prompt.addEventListener('click', function () {
    open()
  })
  overlay.addEventListener('click', close)
  window.addEventListener('message', function (e) {
    if (!e || !e.data) return
    if (e.data === 'litedesk_chat_close') close()
    if (e.data && e.data.type === 'litedesk_chat_resize') {
      setFrameHeight()
    }
    if (e.data && e.data.type === 'litedesk_chat_agent_message') {
      onAgentMessage()
    }
  })

  window.addEventListener('resize', function () {
    if (!isOpen) return
    setFrameHeight()
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
  document.body.appendChild(launcher)
  showPrompt(600)
})()

