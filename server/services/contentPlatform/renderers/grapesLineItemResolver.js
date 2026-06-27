'use strict';

const { createLineItemBindings, normalizeLineItemColumns } = require('../../../constants/lineItemDefaults');
const { normalizeCurrencyDisplayMode } = require('../../../utils/currencyFormat');
const { resolveLineItemTable } = require('../engines/lineItemResolver');
const { resolveMergeTagsInString } = require('../engines/mergeTagEngine');
const { renderTableBlock } = require('./htmlRenderer');

const LINE_ITEM_BLOCK_PATTERN = /<div\b(?=[^>]*\bdata-line-item=["']true["'])(?=[^>]*\bdata-line-item-bindings=["']([^"']*)["'])[^>]*>([\s\S]*?)<\/div>/gi;
const ROW_PATTERN = /<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi;

function decodeHtmlEntities(value) {
  return String(value ?? '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function parseLineItemBindingsAttr(raw, templateModuleScope = '') {
  if (!raw) return createLineItemBindings({ moduleScope: templateModuleScope });
  try {
    const decoded = decodeURIComponent(decodeHtmlEntities(raw));
    const parsed = JSON.parse(decoded);
    const base = createLineItemBindings({ moduleScope: templateModuleScope });
    const currencyDisplay = parsed.currencyDisplay === 'symbol' || parsed.currencyDisplay === 'code'
      ? parsed.currencyDisplay
      : undefined;
    return {
      ...base,
      ...parsed,
      moduleScope: String(parsed.moduleScope || templateModuleScope || base.moduleScope || ''),
      columns: normalizeLineItemColumns(parsed.columns || base.columns),
      ...(currencyDisplay ? { currencyDisplay } : {})
    };
  } catch {
    return createLineItemBindings({ moduleScope: templateModuleScope });
  }
}

function parseRowKind(attrs) {
  const match = /data-line-item-row=["']([^"']+)["']/i.exec(String(attrs || ''));
  return match ? match[1] : 'static';
}

function resolveRowHtml(rowHtml, scope, options = {}) {
  const resolved = resolveMergeTagsInString(rowHtml, scope, { lenient: options.lenient !== false });
  return String(resolved).replace(/\n/g, '<br>');
}

function parseTableRows(tableHtml) {
  const tbodyMatch = /<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i.exec(String(tableHtml || ''));
  if (!tbodyMatch) return [];

  const rows = [];
  let match;
  ROW_PATTERN.lastIndex = 0;
  while ((match = ROW_PATTERN.exec(tbodyMatch[1])) !== null) {
    rows.push({
      attrs: match[1] || '',
      inner: match[2] || '',
      kind: parseRowKind(match[1] || '')
    });
  }
  return rows;
}

function lineBelongsToSection(line, section, sectionIdField) {
  const lineSectionId = line?.[sectionIdField]
    || line?.quoteSectionId
    || line?.invoiceSectionId
    || line?.salesOrderSectionId
    || '';
  return String(lineSectionId || '') === String(section?._id || section?.id || '');
}

function scopeForLineItemBlock(scope, bindings) {
  const templateDisplay = normalizeCurrencyDisplayMode(scope?.parameters?.currencyDisplay);
  const blockDisplay = bindings?.currencyDisplay === 'symbol' || bindings?.currencyDisplay === 'code'
    ? bindings.currencyDisplay
    : templateDisplay;
  const parameters = {
    ...(scope?.parameters && typeof scope.parameters === 'object' ? scope.parameters : {}),
    currencyDisplay: blockDisplay
  };
  return { ...scope, parameters };
}

function expandLineItemTableHtml(tableHtml, bindings, scope, options = {}) {
  const blockScope = scopeForLineItemBlock(scope, bindings);
  if (!String(tableHtml || '').includes('data-line-item-row="line"')) {
    return null;
  }

  const rows = parseTableRows(tableHtml);
  if (!rows.length) return null;

  const lineTemplate = rows.find((row) => row.kind === 'line');
  if (!lineTemplate) return null;

  const showSections = bindings.showSections !== false;
  const showSectionTotals = bindings.showSectionTotals !== false;
  const moduleScope = String(bindings.moduleScope || blockScope.recordModuleKey || '').toLowerCase();
  const sectionIdField = moduleScope === 'invoices'
    ? 'invoiceSectionId'
    : moduleScope === 'sales_orders'
      ? 'salesOrderSectionId'
      : 'quoteSectionId';

  const lines = Array.isArray(blockScope.lines) ? blockScope.lines.filter((line) => line && line.hiddenLine !== true) : [];
  const sections = Array.isArray(blockScope.sections)
    ? blockScope.sections.filter((section) => section && section.hiddenSection !== true)
    : [];

  const sectionTemplate = rows.find((row) => row.kind === 'section');
  const sectionTotalTemplate = rows.find((row) => row.kind === 'section-total');
  const documentTotalTemplates = rows.filter((row) => row.kind === 'document-total');

  const output = [];

  for (const row of rows) {
    if (row.kind === 'static') {
      output.push(resolveRowHtml(`<tr${row.attrs}>${row.inner}</tr>`, blockScope, options));
    }
  }

  const emitLine = (line) => {
    const lineScope = { ...blockScope, ...line, line, item: line };
    output.push(resolveRowHtml(`<tr${lineTemplate.attrs}>${lineTemplate.inner}</tr>`, lineScope, options));
  };

  if (showSections && sections.length) {
    for (const section of sections) {
      if (sectionTemplate) {
        output.push(resolveRowHtml(
          `<tr${sectionTemplate.attrs}>${sectionTemplate.inner}</tr>`,
          { ...blockScope, section },
          options
        ));
      }

      for (const line of lines) {
        if (lineBelongsToSection(line, section, sectionIdField)) {
          emitLine(line);
        }
      }

      if (showSectionTotals && sectionTotalTemplate) {
        output.push(resolveRowHtml(
          `<tr${sectionTotalTemplate.attrs}>${sectionTotalTemplate.inner}</tr>`,
          { ...blockScope, section },
          options
        ));
      }
    }

    const assigned = new Set(sections.map((section) => String(section._id || section.id || '')));
    const orphans = lines.filter((line) => {
      const lineSectionId = line[sectionIdField] || line.quoteSectionId || line.invoiceSectionId || '';
      return !lineSectionId || !assigned.has(String(lineSectionId));
    });
    for (const line of orphans) {
      emitLine(line);
    }
  } else {
    for (const line of lines) {
      emitLine(line);
    }
  }

  for (const row of documentTotalTemplates) {
    output.push(resolveRowHtml(`<tr${row.attrs}>${row.inner}</tr>`, blockScope, options));
  }

  const openMatch = String(tableHtml).match(/^<table\b[^>]*>/i);
  const colgroupMatch = String(tableHtml).match(/<colgroup[\s\S]*?<\/colgroup>/i);
  const openTag = openMatch ? openMatch[0] : '<table>';
  const colgroup = colgroupMatch ? colgroupMatch[0] : '';

  return `${openTag}${colgroup}<tbody>${output.join('')}</tbody></table>`;
}

function renderBindingsFallbackTable(bindings, scope, options, moduleScope) {
  const blockScope = scopeForLineItemBlock(scope, bindings);
  const component = { bindings };
  resolveLineItemTable(component, blockScope, { lenient: options.lenient !== false });
  const resolved = component.resolvedTable || {};
  const widthPercent = Math.max(10, Math.min(100, Number(bindings.tableWidthPercent) || 100));
  return renderTableBlock({
    gridRows: resolved.gridRows || [],
    columnWidths: resolved.columnWidths || [],
    columnWidthPercents: resolved.columnWidthPercents || [],
    style: `width:${widthPercent}%;max-width:100%;`
  });
}

/**
 * Expand line-item tables from saved template rows + runtime scope.
 * @param {string} html
 * @param {Record<string, unknown>} scope
 * @param {string} [templateModuleScope]
 */
function resolveGrapesLineItemsInHtml(html, scope, templateModuleScope = '', options = {}) {
  const source = String(html || '');
  if (!source.includes('data-line-item')) return source;

  const moduleScope = String(
    templateModuleScope || scope.recordModuleKey || ''
  ).toLowerCase();

  return source.replace(LINE_ITEM_BLOCK_PATTERN, (match, bindingsRaw, inner) => {
    const bindings = parseLineItemBindingsAttr(bindingsRaw, moduleScope);
    if (!bindings.moduleScope && moduleScope) {
      bindings.moduleScope = moduleScope;
    }

    const tableMatch = String(inner).match(/<table\b[\s\S]*?<\/table>/i);
    const tableHtml = tableMatch ? tableMatch[0] : '';
    const expanded = tableHtml
      ? expandLineItemTableHtml(tableHtml, bindings, scope, options)
      : null;
    const nextTable = expanded || renderBindingsFallbackTable(bindings, scope, options, moduleScope);

    const openTagEnd = match.indexOf('>');
    if (openTagEnd < 0) return match;
    const openTag = match.slice(0, openTagEnd + 1);
    return `${openTag}${nextTable}</div>`;
  });
}

module.exports = {
  parseLineItemBindingsAttr,
  expandLineItemTableHtml,
  resolveGrapesLineItemsInHtml
};
