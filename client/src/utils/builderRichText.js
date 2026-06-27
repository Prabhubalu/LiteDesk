const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR']);

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ALLOWED_TAG_PATTERN = /<\/?(?:b|strong|i|em|u|br)\b[^>]*>/i;
const HTML_ENTITY_PATTERN = /&(?:#\d+|#x[\da-f]+|[a-z]+);/i;

/**
 * @param {string} text
 */
export function plainTextToEditorHtml(text) {
  const raw = String(text ?? '');
  if (!raw) return '';
  if (/<[a-z][\s\S]*>/i.test(raw)) return sanitizeRichTextHtml(raw);
  return escapeHtml(raw).replace(/\n/g, '<br>');
}

/**
 * Convert stored binding text back into editor HTML without re-escaping entities.
 * @param {string} text
 */
export function bindingTextToEditorHtml(text) {
  const raw = String(text ?? '');
  if (!raw) return '';
  if (ALLOWED_TAG_PATTERN.test(raw) || HTML_ENTITY_PATTERN.test(raw)) {
    return sanitizeRichTextHtml(raw);
  }
  return escapeHtml(raw).replace(/\n/g, '<br>');
}

/**
 * @param {string} html
 */
export function sanitizeRichTextHtml(html) {
  if (typeof document === 'undefined') return String(html ?? '').replace(/<[^>]+>/g, '');

  const template = document.createElement('template');
  template.innerHTML = String(html ?? '');

  function walk(node) {
    const children = [...node.childNodes];
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = /** @type {Element} */ (child);
        if (!ALLOWED_TAGS.has(el.tagName)) {
          const fragment = document.createDocumentFragment();
          while (el.firstChild) fragment.appendChild(el.firstChild);
          el.replaceWith(fragment);
          walk(fragment);
          continue;
        }
        while (el.attributes.length > 0) {
          el.removeAttribute(el.attributes[0].name);
        }
        walk(el);
      }
    }
  }

  walk(template.content);
  return template.innerHTML
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .trim();
}

/**
 * @param {HTMLElement} el
 */
export function readEditorHtml(el) {
  if (!el) return '';
  return sanitizeRichTextHtml(el.innerHTML);
}

/**
 * @param {HTMLElement} el
 * @param {string} command
 * @param {string} [value]
 */
export function execEditorCommand(el, command, value) {
  if (!el) return;
  el.focus();
  document.execCommand(command, false, value);
}

/**
 * Insert plain text at the current selection inside a contenteditable element.
 * @param {HTMLElement} el
 * @param {string} text
 * @returns {boolean}
 */
export function insertTextAtContentEditable(el, text) {
  if (!el) return false;
  el.focus();
  if (typeof document.execCommand === 'function') {
    return document.execCommand('insertText', false, String(text ?? ''));
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    el.textContent = `${el.textContent || ''}${text ?? ''}`;
    return true;
  }

  const range = selection.getRangeAt(0);
  if (!el.contains(range.commonAncestorContainer)) {
    el.textContent = `${el.textContent || ''}${text ?? ''}`;
    return true;
  }

  range.deleteContents();
  range.insertNode(document.createTextNode(String(text ?? '')));
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}
