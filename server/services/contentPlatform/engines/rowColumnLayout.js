'use strict';

const GRID_COLUMNS = 12;

function normalizeColumnSpan(raw) {
  const span = Math.round(Number(raw) || GRID_COLUMNS);
  return Math.min(GRID_COLUMNS, Math.max(1, span));
}

function normalizeRowGap(raw) {
  const gap = Math.round(Number(raw) || 8);
  return Math.min(48, Math.max(0, gap));
}

function resolveRowGapPx(bindings = {}) {
  return normalizeRowGap(bindings.gap);
}

function resolveRowLayoutCss(bindings = {}, styleCss = '') {
  const gap = resolveRowGapPx(bindings);
  const parts = [
    styleCss,
    'display:grid',
    'grid-template-columns:repeat(12,minmax(0,1fr))',
    'width:100%',
    gap ? `gap:${gap}px` : ''
  ].filter(Boolean);
  return parts.join(';');
}

function resolveColumnLayoutCss(bindings = {}, styleCss = '') {
  const span = normalizeColumnSpan(bindings.span);
  const parts = [
    styleCss,
    `grid-column:span ${span}`,
    'min-width:0',
    'align-self:stretch'
  ].filter(Boolean);
  return parts.join(';');
}

function mapChildBlocks(children, options) {
  const { componentToBlock } = options;
  const blocks = [];
  for (const child of children || []) {
    const block = componentToBlock(child, options);
    if (block) blocks.push(block);
  }
  return blocks;
}

module.exports = {
  GRID_COLUMNS,
  normalizeColumnSpan,
  normalizeRowGap,
  resolveRowGapPx,
  resolveRowLayoutCss,
  resolveColumnLayoutCss,
  mapChildBlocks
};
