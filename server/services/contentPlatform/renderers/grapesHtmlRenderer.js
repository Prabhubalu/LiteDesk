'use strict';

const { resolveMergeTagsInString } = require('../engines/mergeTagEngine');
const { resolvePageConfig } = require('../engines/layoutEngine');
const { resolveGrapesLineItemsInHtml } = require('./grapesLineItemResolver');
const { normalizeGrapesHtmlMergeTokens } = require('./grapesHtmlMergeNormalizer');
const {
  normalizeImportedEmailHtml,
  ensureEmailCssCentersMaxWidthCards
} = require('../emailHtmlPrepareService');
const { GRAPES_LAYOUT_GRID_CSS } = require('../../../constants/grapesLayoutGridCss');
const { DEFAULT_PAGE_MARGINS_MM } = require('../../../constants/contentPaperSizes');
const { filterGrapesComponentCss } = require('../../../utils/grapesComponentCss');
const { resolveGrapesEmailSource } = require('../../../constants/grapesTemplateDefinition');

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

  [data-text-block="true"],
  [data-paragraph="true"],
  [data-heading="true"],
  [data-address-block="true"],
  [data-organization-block="true"],
  p,
  div[data-gjs-type="text"] {
    display: block;
  }

  br {
    line-height: 1.5;
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
  const isEmail = String(template?.outputFormat || '').toLowerCase() === 'email';
  const emailSource = isEmail
    ? resolveGrapesEmailSource(definition)
    : { html: String(definition?.html || ''), css: String(definition?.css || '') };
  const rawHtml = emailSource.html;
  const mergeNormalized = normalizeGrapesHtmlMergeTokens(rawHtml);
  const normalizedHtml = isEmail
    ? normalizeImportedEmailHtml(mergeNormalized)
    : mergeNormalized;
  const htmlWithLineItems = resolveGrapesLineItemsInHtml(normalizedHtml, scope, templateModuleScope);
  const bodyHtml = resolveMergeTagsInString(htmlWithLineItems, scope, {
    lenient,
    collectIssues: issues
  });
  const componentCss = (() => {
    const filtered = filterGrapesComponentCss(String(emailSource.css || '').trim());
    return isEmail ? ensureEmailCssCentersMaxWidthCards(filtered) : filtered;
  })();
  const pageConfig = resolvePageConfig(template || {});
  const dimensions = pageConfig.dimensions || { width: 210, height: 297 };
  const margins = pageConfig.margins || DEFAULT_PAGE_MARGINS_MM;

  const pageSizeCss = pageConfig.paperSize === 'Custom'
    ? `${dimensions.width}mm ${dimensions.height}mm`
    : `${pageConfig.paperSize || 'A4'} ${pageConfig.orientation || 'portrait'}`;

  const layoutCss = isEmail
    ? ''
    : `/* arivu-layout-grid */\n    ${GRAPES_LAYOUT_GRID_CSS}`;

  const pageRules = isEmail
    ? ''
    : `@page {
      size: ${pageSizeCss};
      margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
    }`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    ${pageRules}
    html, body {
      margin: 0;
      padding: 0;
      color: ${theme.textColor || '#111827'};
      font-family: ${theme.fontFamily || 'Arial, Helvetica, sans-serif'};
      font-size: 12px;
      line-height: 1.45;
    }
    ${GRAPES_RENDER_RESET_CSS}
    ${layoutCss}
    ${componentCss}
  </style>
</head>
<body align="center" style="margin:0;padding:0;width:100% !important;-webkit-text-size-adjust:100%;">${
    isEmail ? `<center style="width:100%;">${bodyHtml}</center>` : bodyHtml
  }</body>
</html>`;

  return { html, issues };
}

module.exports = {
  renderGrapesDefinitionToHtml
};
