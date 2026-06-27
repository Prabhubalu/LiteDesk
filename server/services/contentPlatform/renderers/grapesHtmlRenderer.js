'use strict';

const { resolveMergeTagsInString } = require('../engines/mergeTagEngine');
const { resolvePageConfig } = require('../engines/layoutEngine');
const { resolveGrapesLineItemsInHtml } = require('./grapesLineItemResolver');
const { normalizeGrapesHtmlMergeTokens } = require('./grapesHtmlMergeNormalizer');
const { GRAPES_LAYOUT_GRID_CSS } = require('../../../constants/grapesLayoutGridCss');

const GRAPES_RENDER_RESET_CSS = `
  .builder-merge-chip,
  [data-merge-field="true"] {
    display: inline !important;
    padding: 0 !important;
    margin: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    background: transparent !important;
    color: inherit !important;
    font-family: inherit !important;
    font-size: inherit !important;
    line-height: inherit !important;
    font-weight: inherit !important;
  }
`;

/**
 * @param {object} params
 * @param {{ html?: string, css?: string }} params.definition
 * @param {object} params.template
 * @param {object} [params.theme]
 * @param {Record<string, unknown>} params.scope
 * @param {boolean} [params.lenient]
 */
function renderGrapesDefinitionToHtml({
  definition,
  template,
  theme = {},
  scope,
  lenient = false
}) {
  const issues = [];
  const templateModuleScope = String(template?.moduleScope || '').toLowerCase();
  const rawHtml = definition?.html || '';
  const normalizedHtml = normalizeGrapesHtmlMergeTokens(rawHtml);
  const htmlWithLineItems = resolveGrapesLineItemsInHtml(normalizedHtml, scope, templateModuleScope);
  const bodyHtml = resolveMergeTagsInString(htmlWithLineItems, scope, {
    lenient,
    collectIssues: issues
  });
  const componentCss = String(definition?.css || '').trim();
  const pageConfig = resolvePageConfig(template || {});
  const dimensions = pageConfig.dimensions || { width: 210, height: 297 };
  const margins = pageConfig.margins || { top: 12, right: 12, bottom: 12, left: 12 };

  const pageSizeCss = pageConfig.paperSize === 'Custom'
    ? `${dimensions.width}mm ${dimensions.height}mm`
    : `${pageConfig.paperSize || 'A4'} ${pageConfig.orientation || 'portrait'}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    @page {
      size: ${pageSizeCss};
      margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
    }
    html, body {
      margin: 0;
      padding: 0;
      color: ${theme.textColor || '#111827'};
      font-family: ${theme.fontFamily || 'Arial, Helvetica, sans-serif'};
      font-size: 12px;
      line-height: 1.45;
    }
    ${GRAPES_RENDER_RESET_CSS}
    /* arivu-layout-grid */
    ${GRAPES_LAYOUT_GRID_CSS}
    ${componentCss}
  </style>
</head>
<body>${bodyHtml}</body>
</html>`;

  return { html, issues };
}

module.exports = {
  renderGrapesDefinitionToHtml
};
