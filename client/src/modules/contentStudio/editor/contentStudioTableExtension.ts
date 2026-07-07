import { mergeAttributes } from '@tiptap/core';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { renderTableCellDomAttrs, renderTableRowDomAttrs } from './tableAttributes';

function parseColwidthAttribute(element: HTMLElement): number[] | null {
  const raw = element.getAttribute('data-colwidth') || element.getAttribute('colwidth');
  if (!raw) return null;
  const widths = raw.split(',').map((value) => Number.parseInt(value, 10)).filter((n) => Number.isFinite(n));
  return widths.length ? widths : null;
}

const colwidthAttribute = {
  default: null,
  parseHTML: (element: HTMLElement) => parseColwidthAttribute(element),
  renderHTML: (attributes: { colwidth?: number[] | null }) => {
    if (!attributes.colwidth?.length) return {};
    return { 'data-colwidth': attributes.colwidth.join(',') };
  },
};

function contentStudioCellAttributes() {
  return {
    textColor: {
      default: null,
      parseHTML: (element: HTMLElement) => element.style.color || element.getAttribute('data-text-color') || null,
    },
    backgroundColor: {
      default: null,
      parseHTML: (element: HTMLElement) =>
        element.style.backgroundColor || element.getAttribute('data-background-color') || null,
    },
    textAlign: {
      default: null,
      parseHTML: (element: HTMLElement) => element.style.textAlign || element.getAttribute('data-text-align') || null,
    },
    fontSize: {
      default: null,
      parseHTML: (element: HTMLElement) => element.style.fontSize || element.getAttribute('data-font-size') || null,
    },
    lineHeight: {
      default: null,
      parseHTML: (element: HTMLElement) =>
        element.style.lineHeight || element.getAttribute('data-line-height') || null,
    },
  };
}

export const ContentStudioTable = Table.configure({
  resizable: true,
  cellMinWidth: 80,
  lastColumnResizable: true,
  HTMLAttributes: {
    class: 'content-table',
    'data-content-table': '',
  },
}).extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      tableWidth: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-table-width') || element.style.width || null,
        renderHTML: (attributes) => {
          if (!attributes.tableWidth) return {};
          return {
            'data-table-width': String(attributes.tableWidth),
            style: `width:${String(attributes.tableWidth)}`,
          };
        },
      },
    };
  },
});

export const ContentStudioTableRow = TableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.style.backgroundColor || element.getAttribute('data-row-background') || null,
      },
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['tr', mergeAttributes(HTMLAttributes, renderTableRowDomAttrs(node.attrs)), 0];
  },
});

export const ContentStudioTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      colwidth: colwidthAttribute,
      ...contentStudioCellAttributes(),
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'td',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, renderTableCellDomAttrs(node.attrs)),
      0,
    ];
  },
}).configure({
  HTMLAttributes: {
    class: 'content-table-cell',
  },
});

export const ContentStudioTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      colwidth: colwidthAttribute,
      ...contentStudioCellAttributes(),
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'th',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, renderTableCellDomAttrs(node.attrs)),
      0,
    ];
  },
}).configure({
  HTMLAttributes: {
    class: 'content-table-cell',
  },
});
