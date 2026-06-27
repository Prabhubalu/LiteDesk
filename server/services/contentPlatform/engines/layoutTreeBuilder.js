'use strict';

const { CONTENT_COMPONENT_TYPES } = require('../../../constants/contentComponentRegistry');
const { resolvePageConfig } = require('./layoutEngine');
const { getBindingText } = require('./componentResolver');
const { buildComponentLeafBlock } = require('./componentLeafBlocks');
const {
  resolveRowLayoutCss,
  resolveColumnLayoutCss,
  mapChildBlocks
} = require('./rowColumnLayout');

const LAYOUT_MODES = {
  FLOW: 'flow',
  ABSOLUTE: 'absolute'
};

const MM_TO_PX = 96 / 25.4;

function mmToPx(mm) {
  return Math.round((Number(mm) || 0) * MM_TO_PX);
}

function resolveMarginsPx(pageConfig) {
  const margins = pageConfig?.margins || { top: 12, right: 12, bottom: 12, left: 12 };
  return {
    top: mmToPx(margins.top),
    right: mmToPx(margins.right),
    bottom: mmToPx(margins.bottom),
    left: mmToPx(margins.left)
  };
}

function styleObjectToCss(style = {}) {
  const typography = style.typography || {};
  const spacing = style.spacing || {};
  const rules = [];

  if (typography.fontSize) rules.push(`font-size:${typography.fontSize}px`);
  if (typography.fontWeight) rules.push(`font-weight:${typography.fontWeight}`);
  if (typography.fontFamily) rules.push(`font-family:${typography.fontFamily}`);
  if (typography.color) rules.push(`color:${typography.color}`);
  if (typography.textAlign) rules.push(`text-align:${typography.textAlign}`);
  if (typography.lineHeight) rules.push(`line-height:${typography.lineHeight}`);
  if (spacing.marginTop != null) rules.push(`margin-top:${spacing.marginTop}px`);
  if (spacing.marginBottom != null) rules.push(`margin-bottom:${spacing.marginBottom}px`);
  if (spacing.paddingTop != null) rules.push(`padding-top:${spacing.paddingTop}px`);
  if (spacing.paddingBottom != null) rules.push(`padding-bottom:${spacing.paddingBottom}px`);
  if (style.backgroundColor) rules.push(`background-color:${style.backgroundColor}`);
  if (style.width) rules.push(`width:${style.width}`);
  if (style.display) rules.push(`display:${style.display}`);

  return rules.join(';');
}

function layoutToAbsoluteCss(layout = {}, marginsPx = { top: 0, left: 0 }, layoutOptions = {}) {
  const rules = ['position:absolute', 'box-sizing:border-box'];
  const contentHeightPx = Number(layoutOptions.contentHeightPx) || null;

  if (layoutOptions.widthPercent != null) {
    rules.push('left:0');
    rules.push(`width:${Number(layoutOptions.widthPercent)}%`);
  } else {
    if (layout.x != null) {
      const leftPx = Number(layout.x) - Number(marginsPx.left || 0);
      rules.push(`left:${Math.max(0, leftPx)}px`);
    }
    if (layout.width != null) rules.push(`width:${Number(layout.width)}px`);
  }

  let topPx = null;
  if (layout.y != null) {
    topPx = Number(layout.y) - Number(marginsPx.top || 0);
    rules.push(`top:${Math.max(0, topPx)}px`);
  }

  if (layout.height != null) {
    let heightPx = Math.max(32, Number(layout.height));
    if (contentHeightPx != null && topPx != null) {
      heightPx = Math.min(heightPx, Math.max(32, contentHeightPx - topPx));
    }
    rules.push(`min-height:${heightPx}px`);
  }

  if (layout.zIndex != null) rules.push(`z-index:${Number(layout.zIndex)}`);
  return rules.join(';');
}

function wrapAbsoluteBlock(block, component, absolute, marginsPx, widthOverride = null, layoutOptions = null) {
  if (!absolute || !block) return block;
  const layout = component?.layout || {};
  const hasPosition = typeof layout.x === 'number' || typeof layout.y === 'number';
  if (!hasPosition) return block;
  const effectiveLayout = widthOverride != null && !layoutOptions
    ? { ...layout, width: widthOverride }
    : layout;
  return {
    type: 'AbsoluteWrapper',
    style: layoutToAbsoluteCss(effectiveLayout, marginsPx, layoutOptions || {}),
    block
  };
}

function resolveTableUsesPercentWidth(bindings = {}) {
  if (Array.isArray(bindings.grid) && bindings.grid.length) {
    return true;
  }
  return bindings.widthUnit !== 'px';
}

function resolveLayoutMode(page) {
  const mode = page?.bindings?.layoutMode;
  if (mode === LAYOUT_MODES.FLOW || mode === LAYOUT_MODES.ABSOLUTE) return mode;

  const children = page?.children || [];
  const hasAbsolutePositions = children.some(
    (child) => typeof child?.layout?.x === 'number' || typeof child?.layout?.y === 'number'
  );
  if (hasAbsolutePositions) return LAYOUT_MODES.ABSOLUTE;
  return LAYOUT_MODES.FLOW;
}

function computeAbsoluteContentMinHeight(children, pageConfig) {
  const marginsPx = resolveMarginsPx(pageConfig);
  const contentAreaHeight = resolveContentHeightPx(pageConfig);
  let maxBottom = marginsPx.top;
  for (const child of children || []) {
    const y = Math.max(marginsPx.top, Number(child?.layout?.y) || marginsPx.top);
    const height = Number(child?.layout?.height) || 0;
    maxBottom = Math.max(maxBottom, y + height);
  }
  const fromBlocks = Math.max(0, maxBottom - marginsPx.top);
  return Math.max(contentAreaHeight, fromBlocks);
}

function resolveContentWidthPx(pageConfig) {
  const dimensions = pageConfig?.dimensions || { width: 210, height: 297 };
  const marginsPx = resolveMarginsPx(pageConfig);
  const pageWidthPx = mmToPx(dimensions.width);
  return Math.max(0, pageWidthPx - marginsPx.left - marginsPx.right);
}

function resolveContentHeightPx(pageConfig) {
  const dimensions = pageConfig?.dimensions || { width: 210, height: 297 };
  const marginsPx = resolveMarginsPx(pageConfig);
  const pageHeightPx = mmToPx(dimensions.height);
  return Math.max(0, pageHeightPx - marginsPx.top - marginsPx.bottom);
}

function normalizeColumnPercents(raw, colCount) {
  const source = Array.isArray(raw) ? raw.map((value) => Number(value) || 0) : [];
  while (source.length < colCount) source.push(0);
  const trimmed = source.slice(0, colCount);
  const total = trimmed.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (total <= 0) {
    const base = Math.floor((100 / colCount) * 100) / 100;
    const percents = Array.from({ length: colCount }, () => base);
    percents[colCount - 1] = Math.round((100 - base * (colCount - 1)) * 100) / 100;
    return percents;
  }
  return trimmed.map((value) => Math.round((Math.max(0, value) / total) * 10000) / 100);
}

function resolveTableColumnCount(component) {
  const bindings = component?.bindings || {};
  const resolved = component.resolvedTable || {};
  if (Array.isArray(bindings.grid?.[0]) && bindings.grid[0].length) {
    return bindings.grid[0].length;
  }
  if (Array.isArray(bindings.columns) && bindings.columns.length) {
    return bindings.columns.length;
  }
  if (Array.isArray(bindings.columnWidthPercents) && bindings.columnWidthPercents.length) {
    return bindings.columnWidthPercents.length;
  }
  return (resolved.columnWidths || []).length;
}

function resolveTableColumnWidthsPx(component, contentWidthPx) {
  const bindings = component?.bindings || {};
  const resolved = component.resolvedTable || {};
  const colCount = resolveTableColumnCount(component);
  if (!resolveTableUsesPercentWidth(bindings) && Array.isArray(resolved.columnWidths) && resolved.columnWidths.length) {
    return resolved.columnWidths;
  }
  const tablePercent = Math.max(10, Math.min(100, Number(bindings.tableWidthPercent) || 100));
  const tableWidthPx = contentWidthPx * tablePercent / 100;
  const percents = normalizeColumnPercents(bindings.columnWidthPercents, colCount);
  return percents.map((percent) => Math.max(48, Math.round(tableWidthPx * percent / 100)));
}

function resolveAbsoluteTableWrapperWidth(component, contentWidthPx) {
  const bindings = component?.bindings || {};
  const layout = component?.layout || {};
  const columnWidths = resolveTableColumnWidthsPx(component, contentWidthPx);
  const totalTableWidth = columnWidths.reduce(
    (sum, width) => sum + Math.max(48, Number(width) || 120),
    0
  );
  if (bindings.widthUnit === 'px') {
    return Math.max(Number(layout.width) || 0, totalTableWidth);
  }
  const tablePercent = Math.max(10, Math.min(100, Number(bindings.tableWidthPercent) || 100));
  const targetWidth = Math.round(contentWidthPx * tablePercent / 100);
  return Math.max(targetWidth, totalTableWidth);
}

function componentToBlock(component, {
  absolute = false,
  contentWidthPx = 0,
  contentHeightPx = 0,
  marginsPx = { top: 0, left: 0 }
} = {}) {
  const type = String(component?.type || '').trim();
  const style = styleObjectToCss(component.style || {});
  const bindings = component.bindings || {};

  switch (type) {
    case CONTENT_COMPONENT_TYPES.HEADING: {
      const level = bindings.level || 2;
      const text = bindings.text || bindings.content || component.name || '';
      return wrapAbsoluteBlock({
        type: 'Heading',
        tag: `h${Math.min(Math.max(Number(level) || 2, 1), 6)}`,
        html: text,
        style
      }, component, absolute, marginsPx, null, absolute ? { contentHeightPx } : null);
    }
    case CONTENT_COMPONENT_TYPES.PARAGRAPH:
      return wrapAbsoluteBlock({
        type: 'Paragraph',
        tag: 'p',
        html: bindings.text || bindings.content || getBindingText(component) || component.name || '',
        style
      }, component, absolute, marginsPx, null, absolute ? { contentHeightPx } : null);
    case CONTENT_COMPONENT_TYPES.LINK:
    case CONTENT_COMPONENT_TYPES.BUTTON:
    case CONTENT_COMPONENT_TYPES.LIST:
    case CONTENT_COMPONENT_TYPES.RICH_TEXT:
    case CONTENT_COMPONENT_TYPES.HTML:
    case CONTENT_COMPONENT_TYPES.VARIABLE:
    case CONTENT_COMPONENT_TYPES.FORMULA:
    case CONTENT_COMPONENT_TYPES.PAGE_NUMBER:
    case CONTENT_COMPONENT_TYPES.WATERMARK:
    case CONTENT_COMPONENT_TYPES.ICON:
    case CONTENT_COMPONENT_TYPES.QR_CODE:
    case CONTENT_COMPONENT_TYPES.BARCODE:
    case CONTENT_COMPONENT_TYPES.SIGNATURE:
    case CONTENT_COMPONENT_TYPES.RELATED_RECORDS:
    case CONTENT_COMPONENT_TYPES.TOTALS:
    case CONTENT_COMPONENT_TYPES.TAX_SUMMARY:
    case CONTENT_COMPONENT_TYPES.ADDRESS_BLOCK:
    case CONTENT_COMPONENT_TYPES.CONTACT_CARD:
    case CONTENT_COMPONENT_TYPES.ORGANIZATION_BLOCK:
    case CONTENT_COMPONENT_TYPES.SOCIAL_ICONS: {
      const leafBlock = buildComponentLeafBlock(component, style);
      if (!leafBlock) return null;
      return wrapAbsoluteBlock(leafBlock, component, absolute, marginsPx, null, absolute ? { contentHeightPx } : null);
    }
    case CONTENT_COMPONENT_TYPES.MERGE_TAG:
      return wrapAbsoluteBlock({
        type: 'Text',
        tag: 'span',
        html: component.resolvedText || bindings.fallback || '',
        style
      }, component, absolute, marginsPx, null, absolute ? { contentHeightPx } : null);
    case CONTENT_COMPONENT_TYPES.DIVIDER:
      return wrapAbsoluteBlock({
        type: 'Divider',
        tag: 'hr',
        html: '',
        style: [style, 'border:none;border-top:1px solid #d1d5db;'].filter(Boolean).join(';')
      }, component, absolute, marginsPx, null, absolute ? { contentHeightPx } : null);
    case CONTENT_COMPONENT_TYPES.SPACER:
      return wrapAbsoluteBlock({
        type: 'Spacer',
        tag: 'div',
        html: '&nbsp;',
        style: [style, `height:${bindings.height || 12}px;`].filter(Boolean).join(';')
      }, component, absolute, marginsPx, null, absolute ? { contentHeightPx } : null);
    case CONTENT_COMPONENT_TYPES.PAGE_BREAK:
      return { type: 'PageBreak', tag: 'div', html: '', style: 'break-after:page;' };
    case CONTENT_COMPONENT_TYPES.TABLE:
    case CONTENT_COMPONENT_TYPES.LINE_ITEM: {
      const tableStyleParts = [style, 'border-collapse:collapse', 'table-layout:fixed'];
      const usesPercentWidth = resolveTableUsesPercentWidth(bindings);
      const tablePercent = Math.max(10, Math.min(100, Number(bindings.tableWidthPercent) || 100));
      const colCount = resolveTableColumnCount(component);
      const columnWidthPercents = usesPercentWidth
        ? normalizeColumnPercents(bindings.columnWidthPercents, colCount)
        : null;
      const resolvedColumnWidths = resolveTableColumnWidthsPx(component, contentWidthPx);
      const columnWidths = resolvedColumnWidths.length
        ? resolvedColumnWidths
        : (component.resolvedTable?.columnWidths || []);
      const totalWidth = columnWidths.reduce((sum, width) => sum + Math.max(48, Number(width) || 120), 0);
      const hasExplicitWidth = /(?:^|;)\s*width\s*:/i.test(style);
      if (!hasExplicitWidth) {
        if (absolute && usesPercentWidth) {
          tableStyleParts.push('width:100%');
        } else if (totalWidth > 0) {
          tableStyleParts.push(`width:${totalWidth}px`);
        } else if (!absolute) {
          tableStyleParts.push('width:100%');
        }
      }
      const layoutOptions = absolute
        ? {
          contentHeightPx,
          ...(usesPercentWidth ? { widthPercent: tablePercent } : {})
        }
        : null;
      const widthOverride = absolute && !usesPercentWidth
        ? resolveAbsoluteTableWrapperWidth(component, contentWidthPx)
        : null;
      return wrapAbsoluteBlock({
        type: 'Table',
        headers: component.resolvedTable?.headers || [],
        headerCells: component.resolvedTable?.headerCells || [],
        rows: component.resolvedTable?.rows || [],
        gridRows: component.resolvedTable?.gridRows || [],
        footerCells: component.resolvedTable?.footerCells || [],
        columnWidths: layoutOptions ? [] : columnWidths,
        columnWidthPercents,
        style: tableStyleParts.filter(Boolean).join(';')
      }, component, absolute, marginsPx, widthOverride, layoutOptions);
    }
    case CONTENT_COMPONENT_TYPES.IMAGE:
    case CONTENT_COMPONENT_TYPES.LOGO: {
      const layout = component.layout || {};
      const sizeRules = [];
      if (!absolute) {
        if (layout.width) sizeRules.push(`width:${layout.width}px`);
        if (layout.height) sizeRules.push(`height:${layout.height}px`);
      }
      const sizeStyle = sizeRules.join(';');
      return wrapAbsoluteBlock({
        type: 'Image',
        src: bindings.src || bindings.url || '',
        alt: bindings.alt || component.name || 'Image',
        style: [style, sizeStyle].filter(Boolean).join(';')
      }, component, absolute, marginsPx, null, absolute ? { contentHeightPx } : null);
    }
    case CONTENT_COMPONENT_TYPES.ROW: {
      const blockOptions = { absolute, contentWidthPx, contentHeightPx, marginsPx, componentToBlock };
      return wrapAbsoluteBlock({
        type: 'Row',
        style: resolveRowLayoutCss(bindings, style),
        blocks: mapChildBlocks(component.children || [], blockOptions)
      }, component, absolute, marginsPx, null, absolute ? { contentHeightPx } : null);
    }
    case CONTENT_COMPONENT_TYPES.COLUMN: {
      const blockOptions = { absolute, contentWidthPx, contentHeightPx, marginsPx, componentToBlock };
      return wrapAbsoluteBlock({
        type: 'Column',
        style: resolveColumnLayoutCss(bindings, style),
        blocks: mapChildBlocks(component.children || [], blockOptions)
      }, component, absolute, marginsPx, null, absolute ? { contentHeightPx } : null);
    }
    case CONTENT_COMPONENT_TYPES.SECTION:
    case CONTENT_COMPONENT_TYPES.CONTAINER:
    case CONTENT_COMPONENT_TYPES.GRID:
    case CONTENT_COMPONENT_TYPES.FLEX:
    case CONTENT_COMPONENT_TYPES.HEADER:
    case CONTENT_COMPONENT_TYPES.FOOTER:
    case CONTENT_COMPONENT_TYPES.REPEATER:
    case CONTENT_COMPONENT_TYPES.LOOP:
    case CONTENT_COMPONENT_TYPES.CONDITIONAL_BLOCK:
    case CONTENT_COMPONENT_TYPES.PAGE:
      return {
        type: 'Container',
        blocks: flattenBlocks(component.children || [], { absolute, contentWidthPx, contentHeightPx, marginsPx })
      };
    default: {
      const leafBlock = buildComponentLeafBlock(component, style);
      if (leafBlock) {
        return wrapAbsoluteBlock(leafBlock, component, absolute, marginsPx, null, absolute ? { contentHeightPx } : null);
      }
      if (Array.isArray(component.children) && component.children.length) {
        return {
          type: 'Container',
          blocks: flattenBlocks(component.children, { absolute, contentWidthPx, contentHeightPx, marginsPx })
        };
      }
      return null;
    }
  }
}

function flattenBlocks(children, {
  absolute = false,
  contentWidthPx = 0,
  contentHeightPx = 0,
  marginsPx = { top: 0, left: 0 }
} = {}) {
  const blocks = [];
  for (const child of children || []) {
    const block = componentToBlock(child, { absolute, contentWidthPx, contentHeightPx, marginsPx });
    if (!block) continue;
    if (block.type === 'Container' && Array.isArray(block.blocks)) {
      blocks.push(...block.blocks);
    } else {
      blocks.push(block);
    }
  }
  return blocks;
}

/**
 * @param {object} params
 */
function buildLayoutTree(params) {
  const { template, resolvedRoot, theme = {} } = params;
  const pageConfig = resolvePageConfig(template);
  const contentWidthPx = resolveContentWidthPx(pageConfig);
  const contentHeightPx = resolveContentHeightPx(pageConfig);
  const marginsPx = resolveMarginsPx(pageConfig);
  const root = resolvedRoot?.type === CONTENT_COMPONENT_TYPES.PAGE
    ? resolvedRoot
    : resolvedRoot;

  const layoutMode = root?.type === CONTENT_COMPONENT_TYPES.PAGE
    ? resolveLayoutMode(root)
    : LAYOUT_MODES.FLOW;

  const pageChildren = root?.type === CONTENT_COMPONENT_TYPES.PAGE
    ? (root.children || [])
    : flattenBlocks([root].filter(Boolean), { absolute: false });

  const blocks = root?.type === CONTENT_COMPONENT_TYPES.PAGE
    ? flattenBlocks(pageChildren, { absolute: layoutMode === LAYOUT_MODES.ABSOLUTE, contentWidthPx, contentHeightPx, marginsPx })
    : flattenBlocks([root].filter(Boolean), { absolute: layoutMode === LAYOUT_MODES.ABSOLUTE, contentWidthPx, contentHeightPx, marginsPx });

  const contentMinHeightPx = layoutMode === LAYOUT_MODES.ABSOLUTE
    ? contentHeightPx
    : null;

  return {
    type: 'LayoutDocument',
    page: {
      ...pageConfig,
      layoutMode,
      contentMinHeightPx,
      contentHeightPx
    },
    theme: {
      primaryColor: theme.colors?.primary || '#4f46e5',
      textColor: theme.colors?.text || '#111827',
      fontFamily: theme.typography?.bodyFont || 'Arial, Helvetica, sans-serif'
    },
    header: theme.headers?.default || null,
    footer: theme.footers?.default || null,
    watermark: theme.watermark?.text || null,
    blocks
  };
}

module.exports = {
  buildLayoutTree,
  componentToBlock,
  flattenBlocks,
  styleObjectToCss,
  layoutToAbsoluteCss,
  resolveLayoutMode
};
