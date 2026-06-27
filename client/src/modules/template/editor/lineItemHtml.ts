import {
  buildLineItemTemplateGrid,
  createLineItemBindings,
  type LineItemBindings,
  type LineItemTemplateRow,
  normalizeLineItemColumnList,
  resolveLineItemLayoutColumns,
  visibleLineItemColumns
} from '@/constants/lineItemDefaults';
import type { TableGridCell } from '@/utils/builderTableGridModel';

const MERGE_CHIP_STYLE =
  'display:inline-block;padding:2px 6px;border-radius:4px;background:#eef2ff;color:#4338ca;font-family:monospace;font-size:13px;';

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function parseLineItemBindings(
  raw: string | undefined,
  moduleScope = ''
): LineItemBindings {
  if (!raw) return createLineItemBindings(moduleScope);
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<LineItemBindings>;
    const base = createLineItemBindings(moduleScope);
    return {
      ...base,
      ...parsed,
      columns: normalizeLineItemColumnList(parsed.columns ?? base.columns),
      moduleScope: String(parsed.moduleScope || moduleScope || base.moduleScope || '')
    };
  } catch {
    return createLineItemBindings(moduleScope);
  }
}

export function encodeLineItemBindings(bindings: Partial<LineItemBindings>): string {
  return encodeURIComponent(JSON.stringify(bindings));
}

export function mergeChip(path: string): string {
  const token = path.startsWith('{{') ? path : `{{${path}}}`;
  const inner = token.startsWith('{{') && token.endsWith('}}') ? token.slice(2, -2) : path;
  return `<span data-merge-field="true" data-gjs-type="text" style="${MERGE_CHIP_STYLE}">{{${inner}}}</span>`;
}

function cellStyle(cell: TableGridCell, isHeader: boolean): string {
  const parts = ['border:1px solid #e5e5e5', 'padding:8px', 'vertical-align:top'];
  if (cell.align === 'right') parts.push('text-align:right');
  else if (cell.align === 'center') parts.push('text-align:center');
  else parts.push('text-align:left');
  if (isHeader) {
    parts.push('font-weight:600', 'background:#fafafa');
  } else if (cell.colSpan > 1 && cell.format !== 'currency') {
    parts.push('font-weight:600', 'background:#fafafa');
  } else if (cell.format === 'currency' && cell.align === 'right') {
    parts.push('font-weight:600');
  }
  return parts.join(';');
}

function lineMergeToken(path: string, format?: string): string {
  const trimmed = String(path || '').trim();
  if (!trimmed) return '';
  if (format === 'currency' && !trimmed.includes('|')) {
    return `${trimmed}|currency`;
  }
  return trimmed;
}

function cellInnerHtml(cell: TableGridCell): string {
  const text = String(cell.text || '');
  const lines = text.split(/\n+/).map((part) => part.trim()).filter(Boolean);
  if (lines.length > 1) {
    return lines
      .map((part) => {
        if (part.startsWith('line.')) {
          return mergeChip(lineMergeToken(part, cell.format));
        }
        if (part.startsWith('{{') && part.endsWith('}}')) {
          return mergeChip(part.slice(2, -2));
        }
        return escapeHtml(part);
      })
      .join('<br>');
  }

  if (text.startsWith('line.')) return mergeChip(lineMergeToken(text, cell.format));
  if (text.startsWith('{{') && text.endsWith('}}')) return mergeChip(text.slice(2, -2));
  return escapeHtml(text);
}

function rowToHtml(row: LineItemTemplateRow): string {
  const isHeader = row.kind === 'header';
  const tag = isHeader ? 'th' : 'td';
  const rowAttr = row.kind === 'header' ? '' : ` data-line-item-row="${row.kind}"`;
  const cells = row.cells
    .filter((cell) => !cell.skip)
    .map((cell) => {
      const colspan = cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : '';
      return `<${tag}${colspan} style="${cellStyle(cell, isHeader)}">${cellInnerHtml(cell)}</${tag}>`;
    })
    .join('');
  return `<tr${rowAttr}>${cells}</tr>`;
}

export function buildLineItemTableHtml(bindings: Partial<LineItemBindings>): string {
  const resolved = {
    ...createLineItemBindings(bindings.moduleScope || ''),
    ...bindings,
    columns: normalizeLineItemColumnList(bindings.columns)
  };
  const visible = visibleLineItemColumns(resolved.columns);
  const layout = resolveLineItemLayoutColumns(resolved.columns);
  const rows = buildLineItemTemplateGrid(resolved);
  const storedPercents = Array.isArray(resolved.columnWidthPercents)
    && resolved.columnWidthPercents.length === visible.length
    ? resolved.columnWidthPercents
    : layout.columnWidthPercents;
  const widthPercent = Math.max(10, Math.min(100, Number(resolved.tableWidthPercent) || 100));
  const colgroup = storedPercents.map((pct) => `<col style="width:${pct}%">`).join('');
  const bodyRows = rows.map((row) => rowToHtml(row)).join('');

  return `<table data-line-item-table="true" data-col-widths="${storedPercents.join(',')}" style="width:${widthPercent}%;max-width:100%;table-layout:fixed;border-collapse:collapse;"><colgroup>${colgroup}</colgroup><tbody>${bodyRows}</tbody></table>`;
}

export function buildLineItemBlockHtml(moduleScope = '', bindings?: Partial<LineItemBindings>): string {
  const resolved = {
    ...createLineItemBindings(moduleScope),
    ...bindings,
    moduleScope: moduleScope || bindings?.moduleScope || ''
  };
  const encoded = encodeLineItemBindings(resolved);
  const tableHtml = buildLineItemTableHtml(resolved);
  return `<div data-gjs-type="arivu-line-item" data-line-item="true" data-line-item-bindings="${encoded}" class="arivu-line-item-block" style="width:100%;">${tableHtml}</div>`;
}
