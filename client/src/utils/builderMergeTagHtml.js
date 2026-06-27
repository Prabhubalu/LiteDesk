export const BUILDER_MERGE_CHIP_CLASS = 'builder-merge-chip';

const MERGE_TOKEN_PATTERN = /\{\{([^}]+)\}\}/g;

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function mergePathFromElement(element) {
  const attrPath = element.getAttribute('data-merge-path');
  if (attrPath) return attrPath.trim();

  const text = String(element.textContent || '').trim();
  const match = text.match(/^\{\{\s*([^}]+?)\s*\}\}$/);
  return match?.[1]?.trim() || text.replace(/[{}]/g, '').trim();
}

function mergeChipMarkup(path) {
  const trimmed = String(path || '').trim();
  return `<span class="${BUILDER_MERGE_CHIP_CLASS}" contenteditable="false" data-merge-path="${escapeAttr(trimmed)}">${escapeAttr(trimmed)}</span>`;
}

/**
 * @param {string} html
 */
export function mergeTokensToChipHtml(html) {
  const raw = String(html ?? '');
  const withBreaks = raw.includes('\n') ? raw.replace(/\n/g, '<br>') : raw;
  if (!withBreaks.includes('{{')) return withBreaks;
  return withBreaks.replace(MERGE_TOKEN_PATTERN, (_, path) => {
    const trimmed = String(path || '').trim();
    return mergeChipMarkup(trimmed);
  });
}

/**
 * Normalize editable cell HTML to stored merge-token text (preserves line breaks).
 * @param {string} html
 */
export function normalizeCellMergeTokenHtml(html) {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .trim();
}

/**
 * @param {string} html
 */
export function chipHtmlToMergeTokens(html) {
  if (typeof document === 'undefined') {
    return normalizeCellMergeTokenHtml(html);
  }

  const template = document.createElement('template');
  template.innerHTML = String(html ?? '');

  template.content
    .querySelectorAll(`.${BUILDER_MERGE_CHIP_CLASS}, [data-merge-field="true"], [data-merge-path]`)
    .forEach((element) => {
      const path = mergePathFromElement(element);
      element.replaceWith(document.createTextNode(`{{${path}}}`));
    });

  return normalizeCellMergeTokenHtml(template.innerHTML);
}
