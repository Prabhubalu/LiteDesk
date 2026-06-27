import type { Editor } from 'grapesjs';
import { resolveInsertTarget } from './printArea';
import { buildLineItemBlockHtml } from './lineItemHtml';
import { getLineItemTemplateModuleScope } from './lineItemComponent';

const mergeStyle =
  'display:inline-block;padding:2px 6px;border-radius:4px;background:#eef2ff;color:#4338ca;font-family:monospace;font-size:13px;';

function merge(path: string): string {
  return `<span data-merge-field="true" data-gjs-type="text" style="${mergeStyle}">{{${path}}}</span>`;
}

/** Arivu-specific blocks layered on official GrapesJS plugins. */
export function registerArivuBlocks(editor: Editor): void {
  const bm = editor.BlockManager;
  const category = 'Arivu';

  bm.add('merge-field', {
    label: 'Merge Field',
    category,
    content: merge('Organization.name'),
    activate: true,
    select: true
  });

  bm.add('table', {
    label: 'Table',
    category,
    content:
      '<table data-col-widths="50,50" style="width:100%;max-width:100%;table-layout:fixed;border-collapse:collapse;"><colgroup><col style="width:50%"><col style="width:50%"></colgroup><thead><tr><th style="border:1px solid #e5e5e5;padding:8px;text-align:left;">Column</th><th style="border:1px solid #e5e5e5;padding:8px;text-align:left;">Column</th></tr></thead><tbody><tr><td style="border:1px solid #e5e5e5;padding:8px;">Cell</td><td style="border:1px solid #e5e5e5;padding:8px;">Cell</td></tr></tbody></table>',
    activate: true,
    select: true
  });

  bm.add('line-item', {
    label: 'Line Item',
    category,
    content: buildLineItemBlockHtml(),
    activate: true,
    select: true
  });

  bm.add('totals', {
    label: 'Totals',
    category,
    content: `<div data-totals="true" style="max-width:280px;margin-left:auto;padding:12px;border:1px solid #e5e5e5;"><div style="display:flex;justify-content:space-between;padding:4px 0;"><span>Subtotal</span>${merge('Quote.subtotal')}</div><div style="display:flex;justify-content:space-between;padding:4px 0;font-weight:700;"><span>Total</span>${merge('Quote.grandTotal')}</div></div>`,
    activate: true,
    select: true
  });

  bm.add('address-block', {
    label: 'Address',
    category,
    content: `<div data-address-block="true" style="line-height:1.5;font-size:14px;">${merge('Organization.name')}<br/>${merge('Organization.address')}</div>`,
    activate: true,
    select: true
  });

  bm.add('organization-block', {
    label: 'Organization',
    category,
    content: `<div data-organization-block="true" style="padding:12px;"><strong>${merge('Organization.name')}</strong><br/>${merge('Organization.website')}</div>`,
    activate: true,
    select: true
  });

  bm.add('conditional-block', {
    label: 'Conditional',
    category,
    content:
      '<div data-conditional="true" data-condition="{{Record.status}} == \'Draft\'" style="padding:12px;border:1px dashed #f59e0b;background:#fffbeb;">Conditional content</div>',
    activate: true,
    select: true
  });

  bm.add('loop', {
    label: 'Loop',
    category,
    content: `<div data-loop="true" data-collection="lines" style="padding:8px;border:1px dashed #8b5cf6;background:#faf5ff;"><div style="padding:6px 0;">${merge('line.name')}</div></div>`,
    activate: true,
    select: true
  });

  bm.add('page-break', {
    label: 'Page Break',
    category,
    content: '<div data-page-break="true" style="height:1px;page-break-after:always;"></div>',
    activate: true,
    select: true
  });

  bm.add('page-number', {
    label: 'Page Number',
    category,
    content: merge('System.pageNumber'),
    activate: true,
    select: true
  });
}

export function addBlockToCanvas(editor: Editor, blockId: string): void {
  const block = editor.BlockManager.get(blockId);
  if (!block) return;

  let content = block.get('content');
  if (!content) return;
  if (blockId === 'line-item') {
    content = buildLineItemBlockHtml(getLineItemTemplateModuleScope());
  }

  const dropTarget = resolveInsertTarget(editor);
  if (!dropTarget) return;

  dropTarget.append(content);
}
