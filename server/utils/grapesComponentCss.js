'use strict';

const LAYOUT_GRID_CSS_MARKER = 'arivu-layout-grid';

/** Strip document-level CSS re-exported from the builder HTML tab before PDF render. */
function filterGrapesComponentCss(css) {
  let source = String(css || '').trim();
  if (!source) return '';

  source = source.replace(/@page\s*\{[\s\S]*?\}/gi, '');
  source = source.replace(/html\s*,\s*body\s*\{[\s\S]*?\}/gi, '');
  source = source.replace(
    /\.builder-merge-chip\s*,\s*\[data-merge-field="true"\]\s*\{[\s\S]*?\}/gi,
    ''
  );

  if (source.includes(LAYOUT_GRID_CSS_MARKER)) {
    const markerComment = `/* ${LAYOUT_GRID_CSS_MARKER} */`;
    const markerIndex = source.indexOf(markerComment);
    if (markerIndex >= 0) {
      source = source.slice(0, markerIndex).trim();
    }
  }

  return source.replace(/<\/style/gi, '<\\/style').replace(/\n{3,}/g, '\n\n').trim();
}

module.exports = {
  filterGrapesComponentCss
};
