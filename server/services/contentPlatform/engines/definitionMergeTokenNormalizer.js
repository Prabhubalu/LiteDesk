'use strict';

const MERGE_CHIP_PATTERN =
  /<span[^>]*class="[^"]*builder-merge-chip[^"]*"[^>]*data-merge-path="([^"]+)"[^>]*>[\s\S]*?<\/span>/gi;

const MERGE_CHIP_PATTERN_ALT =
  /<span[^>]*data-merge-path="([^"]+)"[^>]*class="[^"]*builder-merge-chip[^"]*"[^>]*>[\s\S]*?<\/span>/gi;

/**
 * @param {string} value
 */
function normalizeBindingText(value) {
  if (typeof value !== 'string' || !value.includes('merge')) return value;
  return value
    .replace(MERGE_CHIP_PATTERN, (_, path) => `{{${String(path || '').trim()}}}`)
    .replace(MERGE_CHIP_PATTERN_ALT, (_, path) => `{{${String(path || '').trim()}}}`);
}

/**
 * @param {object | null | undefined} component
 */
function normalizeDefinitionMergeTokens(component) {
  if (!component || typeof component !== 'object') return component;

  const next = { ...component };
  const bindings = next.bindings && typeof next.bindings === 'object'
    ? { ...next.bindings }
    : null;

  if (bindings) {
    for (const field of ['text', 'content', 'value', 'label', 'title']) {
      if (typeof bindings[field] === 'string') {
        bindings[field] = normalizeBindingText(bindings[field]);
      }
    }

    if (Array.isArray(bindings.grid)) {
      bindings.grid = bindings.grid.map((row) =>
        (Array.isArray(row) ? row : []).map((cell) => {
          if (!cell || typeof cell !== 'object') return cell;
          if (typeof cell.text !== 'string') return cell;
          return {
            ...cell,
            text: normalizeBindingText(cell.text)
          };
        })
      );
    }

    next.bindings = bindings;
  }

  if (Array.isArray(next.children)) {
    next.children = next.children.map((child) => normalizeDefinitionMergeTokens(child));
  }

  return next;
}

module.exports = {
  normalizeBindingText,
  normalizeDefinitionMergeTokens
};
