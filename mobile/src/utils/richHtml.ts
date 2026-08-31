const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  's',
  'u',
  'a',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'blockquote',
  'img',
  'pre',
  'code',
  'span',
  'div'
])

const GLOBAL_ATTR = new Set(['class'])
const TAG_ATTR: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  img: new Set(['src', 'alt', 'title', 'width', 'height', 'data-width'])
}

const ALLOWED_IMAGE_WIDTHS = new Set(['25%', '50%', '75%', '100%'])

export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(String(value || ''))
}

function escapeText(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function isSafeHref(href: string): boolean {
  const trimmed = href.trim()
  if (!trimmed) return false
  if (/^(javascript|vbscript|data):/i.test(trimmed)) return false
  return /^(https?:|mailto:|tel:|\/|#)/i.test(trimmed)
}

function isSafeImageSrc(src: string): boolean {
  const trimmed = src.trim()
  if (!trimmed) return false
  if (/^(javascript|vbscript|data):/i.test(trimmed)) return false
  return /^(https?:|\/)/i.test(trimmed)
}

function unwrapElement(el: Element) {
  const parent = el.parentNode
  if (!parent) {
    el.remove()
    return
  }
  while (el.firstChild) parent.insertBefore(el.firstChild, el)
  parent.removeChild(el)
}

function cleanElement(el: Element) {
  const tag = el.tagName.toLowerCase()
  if (tag === 'script' || tag === 'style' || tag === 'iframe' || tag === 'object') {
    el.remove()
    return
  }

  if (!ALLOWED_TAGS.has(tag)) {
    const children = Array.from(el.childNodes)
    children.forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) cleanElement(child as Element)
    })
    unwrapElement(el)
    return
  }

  const allowed = new Set([...GLOBAL_ATTR, ...(TAG_ATTR[tag] || [])])
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase()
    if (name.startsWith('on') || !allowed.has(name)) {
      el.removeAttribute(attr.name)
    }
  }

  if (tag === 'a') {
    const href = (el.getAttribute('href') || '').trim()
    if (!isSafeHref(href)) {
      el.removeAttribute('href')
    } else if (!href.startsWith('#')) {
      el.setAttribute('target', '_blank')
      el.setAttribute('rel', 'noopener noreferrer')
    }
  }

  if (tag === 'img') {
    const src = (el.getAttribute('src') || '').trim()
    if (!isSafeImageSrc(src)) {
      el.remove()
      return
    }
    el.setAttribute('loading', 'lazy')
    if (!el.getAttribute('alt')) el.setAttribute('alt', '')
    const width = (el.getAttribute('data-width') || el.getAttribute('width') || '').trim()
    if (width && !ALLOWED_IMAGE_WIDTHS.has(width)) {
      el.removeAttribute('data-width')
      el.removeAttribute('width')
    } else if (width) {
      el.setAttribute('data-width', width)
      el.removeAttribute('width')
    }
  }

  Array.from(el.childNodes).forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE) cleanElement(child as Element)
    else if (child.nodeType === Node.COMMENT_NODE) child.parentNode?.removeChild(child)
  })
}

/** Allowlist sanitizer matching desktop `sanitizeRichDescriptionHtml`. */
export function sanitizeRichHtml(raw: string): string {
  const str = String(raw || '')
  if (!str.trim()) return ''

  if (!looksLikeHtml(str)) {
    return `<p>${escapeText(str).replace(/\n/g, '<br>')}</p>`
  }

  const doc = new DOMParser().parseFromString(str, 'text/html')
  const body = doc.body
  Array.from(body.childNodes).forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE) cleanElement(child as Element)
    else if (child.nodeType === Node.COMMENT_NODE) child.parentNode?.removeChild(child)
  })
  return body.innerHTML.trim()
}

const BLOCK_BREAK = new Set(['p', 'div', 'h1', 'h2', 'h3', 'blockquote', 'pre', 'tr', 'ul', 'ol'])

export function htmlToPlainText(raw: string): string {
  const str = String(raw || '')
  if (!str.trim()) return ''
  if (!looksLikeHtml(str)) return str.replace(/\r\n/g, '\n').trim()

  const doc = new DOMParser().parseFromString(str, 'text/html')
  const parts: string[] = []

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push((node.textContent || '').replace(/\s+/g, ' '))
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as Element
    const tag = el.tagName.toLowerCase()
    if (tag === 'br') {
      parts.push('\n')
      return
    }
    if (tag === 'li') parts.push('\n• ')
    Array.from(el.childNodes).forEach(walk)
    if (BLOCK_BREAK.has(tag) || tag === 'li') parts.push('\n\n')
  }

  walk(doc.body)
  return parts
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
