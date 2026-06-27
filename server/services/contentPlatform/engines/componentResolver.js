'use strict';

const { CONTENT_COMPONENT_TYPES } = require('../../../constants/contentComponentRegistry');
const { resolveMergeTagsInString, resolveMergeExpression } = require('./mergeTagEngine');
const { resolveLineItemTable } = require('./lineItemResolver');

function cloneComponent(component) {
  return JSON.parse(JSON.stringify(component));
}

function getBindingText(component) {
  const bindings = component?.bindings || {};
  return bindings.text || bindings.content || bindings.value || '';
}

function resolveComponentNode(component, scope, options = {}) {
  if (!component || typeof component !== 'object') return null;

  const type = String(component.type || '').trim();
  const issues = options.collectIssues || null;
  const resolved = cloneComponent(component);

  if (type === CONTENT_COMPONENT_TYPES.REPEATER) {
    return resolveRepeater(resolved, scope, options);
  }

  if (type === CONTENT_COMPONENT_TYPES.LOOP) {
    return resolveRepeater(resolved, scope, options);
  }

  if (type === CONTENT_COMPONENT_TYPES.TABLE) {
    return resolveTable(resolved, scope, options);
  }

  if (type === CONTENT_COMPONENT_TYPES.LINE_ITEM) {
    return resolveLineItemTable(resolved, scope, options);
  }

  if (type === CONTENT_COMPONENT_TYPES.MERGE_TAG) {
    const path = resolved.bindings?.path || resolved.bindings?.mergeTag || '';
    const format = resolved.bindings?.format || '';
    const expression = format ? `${path}|${format}` : path;
    const result = resolveMergeExpression(scope, expression);
    if (!result.resolved) {
      issues?.push({
        severity: options.lenient ? 'warning' : 'error',
        code: 'MERGE_TAG_UNRESOLVED',
        message: `Merge tag could not be resolved: ${path}`,
        path,
        componentId: resolved.id
      });
      const token = format ? `{{${path}|${format}}}` : `{{${path}}}`;
      resolved.resolvedText = options.lenient
        ? token
        : (resolved.bindings?.fallback || '');
    } else {
      resolved.resolvedText = result.value ?? resolved.bindings?.fallback ?? '';
    }
    return resolved;
  }

  const textFields = ['text', 'content', 'value', 'label', 'title', 'html', 'href', 'format', 'expression', 'name', 'condition', 'collection', 'relation'];
  for (const field of textFields) {
    if (typeof resolved.bindings?.[field] === 'string') {
      resolved.bindings[field] = resolveMergeTagsInString(resolved.bindings[field], scope, {
        collectIssues: issues,
        lenient: options.lenient
      });
    }
  }

  if (typeof resolved.style?.content === 'string') {
    resolved.style.content = resolveMergeTagsInString(resolved.style.content, scope, {
      collectIssues: issues,
      lenient: options.lenient
    });
  }

  if (Array.isArray(resolved.children)) {
    resolved.children = resolved.children
      .map((child) => resolveComponentNode(child, scope, options))
      .filter(Boolean);
  }

  return resolved;
}

function resolveCollection(scope, collectionPath) {
  const path = String(collectionPath || 'lines').trim();
  if (!path) return [];
  const { value } = require('./mergeTagEngine').resolvePath(scope, path);
  return Array.isArray(value) ? value : [];
}

function resolveRepeater(component, scope, options) {
  const collectionPath = component.bindings?.collection || 'lines';
  const itemAlias = component.bindings?.itemAlias || 'item';
  const items = resolveCollection(scope, collectionPath);
  const templateChildren = Array.isArray(component.children) ? component.children : [];

  if (!items.length) {
    component.children = [];
    component.resolvedItems = [];
    return component;
  }

  const expandedChildren = [];
  const resolvedItems = [];

  items.forEach((item, index) => {
    const itemScope = {
      ...scope,
      [itemAlias]: item,
      item,
      itemIndex: index
    };
    resolvedItems.push(item);

    templateChildren.forEach((child) => {
      expandedChildren.push(resolveComponentNode(cloneComponent(child), itemScope, options));
    });
  });

  component.children = expandedChildren.filter(Boolean);
  component.resolvedItems = resolvedItems;
  return component;
}

function resolveGridRowCells(rowCells, scope, options) {
  const issues = options.collectIssues || null;
  return (rowCells || []).map((cell) => {
    if (cell?.skip) return { skip: true };
    const text = resolveMergeTagsInString(String(cell?.text || ''), scope, {
      collectIssues: issues,
      lenient: options.lenient
    });
    return {
      text,
      align: cell?.align || 'left',
      colSpan: Math.max(1, Number(cell?.colSpan) || 1),
      rowSpan: Math.max(1, Number(cell?.rowSpan) || 1),
      skip: false
    };
  });
}

const LINE_MERGE_TAG_PATTERN = /\{\{\s*lines\./i;

function rowContainsLineMergeTags(row) {
  return Array.isArray(row) && row.some((cell) => LINE_MERGE_TAG_PATTERN.test(String(cell?.text || '')));
}

function detectRepeatRowIndex(grid, explicitIndex) {
  if (typeof explicitIndex === 'number' && explicitIndex >= 0) {
    return explicitIndex;
  }
  const index = (grid || []).findIndex((row) => rowContainsLineMergeTags(row));
  return index >= 0 ? index : null;
}

function resolveGridTable(component, scope, options) {
  const bindings = component.bindings || {};
  const grid = Array.isArray(bindings.grid) ? bindings.grid : [];
  const columnWidths = Array.isArray(bindings.columnWidths) ? bindings.columnWidths : [];
  const repeatRowIndex = detectRepeatRowIndex(grid, bindings.repeatRowIndex);
  const collectionPath = bindings.collection || 'lines';
  const items = resolveCollection(scope, collectionPath);

  const gridRows = [];

  for (let rowIndex = 0; rowIndex < grid.length; rowIndex += 1) {
    if (rowIndex === repeatRowIndex) {
      if (items.length) {
        for (const item of items) {
          const rowScope = { ...scope, ...item, item, line: item };
          gridRows.push(resolveGridRowCells(grid[rowIndex], rowScope, options));
        }
      } else {
        gridRows.push(resolveGridRowCells(grid[rowIndex], scope, options));
      }
      continue;
    }
    gridRows.push(resolveGridRowCells(grid[rowIndex], scope, options));
  }

  component.resolvedTable = {
    gridRows,
    columnWidths: columnWidths.map((width) => Math.max(48, Number(width) || 120)),
    headers: [],
    headerCells: [],
    rows: [],
    footerCells: []
  };
  return component;
}

function resolveTable(component, scope, options) {
  const bindings = component.bindings || {};
  if (Array.isArray(bindings.grid) && bindings.grid.length) {
    return resolveGridTable(component, scope, options);
  }

  const columns = Array.isArray(bindings.columns) ? bindings.columns : [];
  const collectionPath = bindings.collection || 'lines';
  const items = resolveCollection(scope, collectionPath);
  const issues = options.collectIssues || null;

  const headerCells = [];
  const headerLabels = [];
  columns.forEach((column) => {
    headerLabels.push(String(column.header || ''));
    if (column.headerSkip) return;
    headerCells.push({
      text: String(column.header || ''),
      colSpan: Math.max(1, Number(column.colSpan) || 1),
      align: column.align || 'left',
      width: column.width || null
    });
  });

  const rows = items.map((item) => {
    const rowScope = { ...scope, ...item, item, line: item };
    return columns.map((column) => {
      const path = column.path || '';
      const format = column.format || '';
      const expression = format && format !== 'text' ? `${path}|${format}` : path;
      const result = resolveMergeExpression(rowScope, expression);
      if (!result.resolved && path) {
        issues?.push({
          severity: options.lenient ? 'warning' : 'error',
          code: 'MERGE_TAG_UNRESOLVED',
          message: `Table column could not be resolved: ${path}`,
          path,
          componentId: component.id
        });
      }
      if (result.resolved) return { text: result.value, align: column.align || 'left', width: column.width || null };
      if (options.lenient && path) return { text: `{{${path}}}`, align: column.align || 'left', width: column.width || null };
      return { text: column.fallback || '', align: column.align || 'left', width: column.width || null };
    });
  });

  let footerCells = [];
  if (bindings.showFooter && Array.isArray(bindings.footerRow)) {
    bindings.footerRow.forEach((cell, index) => {
      if (cell?.skip) return;
      const path = cell?.path || '';
      const format = cell?.format || '';
      let text = String(cell?.text || '');
      if (path) {
        const expression = format && format !== 'text' ? `${path}|${format}` : path;
        const result = resolveMergeExpression(scope, expression);
        if (result.resolved) text = result.value;
        else if (options.lenient) text = `{{${path}}}`;
        else text = cell?.fallback || '';
      }
      footerCells.push({
        text,
        colSpan: Math.max(1, Number(cell?.colSpan) || 1),
        align: cell?.align || 'left'
      });
    });
  }

  component.resolvedTable = {
    headers: headerLabels,
    headerCells,
    rows,
    footerCells,
    columnWidths: columns.map((column) => column.width || 120)
  };
  return component;
}

/**
 * @param {object} rootComponent
 * @param {Record<string, unknown>} scope
 * @param {{ collectIssues?: Array<object> }} [options]
 */
function resolveComponentTree(rootComponent, scope, options = {}) {
  const collectIssues = [];
  const resolvedRoot = resolveComponentNode(rootComponent, scope, {
    ...options,
    collectIssues
  });

  return {
    root: resolvedRoot,
    issues: collectIssues
  };
}

module.exports = {
  resolveComponentTree,
  resolveComponentNode,
  getBindingText
};
