export const BUILDER_MERGE_CHIP_CLASS = 'builder-merge-chip';

const MERGE_TOKEN_PATTERN = /\{\{([^}]+)\}\}/g;

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

/**
 * @param {string} html
 */
export function mergeTokensToChipHtml(html) {
  const raw = String(html ?? '');
  if (!raw.includes('{{')) return raw;
  return raw.replace(MERGE_TOKEN_PATTERN, (_, path) => {
    const trimmed = String(path || '').trim();
    return `<span class="${BUILDER_MERGE_CHIP_CLASS}" contenteditable="false" data-merge-path="${escapeAttr(trimmed)}">${escapeAttr(trimmed)}</span>`;
  });
}

/**
 * @param {string} html
 */
export function chipHtmlToMergeTokens(html) {
  if (typeof document === 'undefined') return String(html ?? '');

  const template = document.createElement('template');
  template.innerHTML = String(html ?? '');

  template.content.querySelectorAll(`.${BUILDER_MERGE_CHIP_CLASS}`).forEach((element) => {
    const path = element.getAttribute('data-merge-path') || element.textContent || '';
    element.replaceWith(document.createTextNode(`{{${path.trim()}}}`));
  });

  return template.innerHTML;
}
