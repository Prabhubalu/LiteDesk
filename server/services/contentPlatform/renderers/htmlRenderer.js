'use strict';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildTableStyle(block) {
  const inline = String(block.style || '').trim();
  const parts = inline ? [inline] : [];
  const hasWidth = /(?:^|;)\s*width\s*:/i.test(inline);
  const columnWidths = Array.isArray(block.columnWidths) ? block.columnWidths : [];
  const totalWidth = tableTotalWidth(columnWidths);

  if (!hasWidth) {
    if (totalWidth > 0) {
      parts.push(`width:${totalWidth}px`);
    } else {
      parts.push('width:100%');
    }
  }

  parts.push('border-collapse:collapse', 'table-layout:fixed');
  return parts.join(';');
}

function renderTableColgroupPercents(columnWidthPercents) {
  if (!Array.isArray(columnWidthPercents) || !columnWidthPercents.length) return '';
  return columnWidthPercents
    .map((percent) => `<col style="width:${Number(percent) || 0}%;" />`)
    .join('');
}

function renderTableColgroup(columnWidths) {
  if (!Array.isArray(columnWidths) || !columnWidths.length) return '';
  const defaultWidth = 120;
  return columnWidths
    .map((width) => {
      const px = Math.max(48, Number(width) || defaultWidth);
      return `<col style="width:${px}px;" />`;
    })
    .join('');
}

function tableTotalWidth(columnWidths) {
  const defaultWidth = 120;
  if (!Array.isArray(columnWidths) || !columnWidths.length) return 0;
  return columnWidths.reduce((sum, width) => sum + Math.max(48, Number(width) || defaultWidth), 0);
}

function tableCellStyle(cell, { header = false, footer = false } = {}) {
  const align = cell?.align ? `text-align:${cell.align};` : 'text-align:left;';
  const rules = ['border:1px solid #d1d5db', 'padding:8px', 'vertical-align:top', 'word-wrap:break-word', align];
  const variant = String(cell?.variant || '').trim();
  if (variant === 'header' || header) {
    rules.push('background:#f9fafb', 'font-weight:600');
  } else if (variant === 'sectionHeader') {
    rules.push('background:#f3f4f6', 'font-weight:700');
  } else if (variant === 'total' || footer) {
    rules.push('font-weight:600');
  } else if (variant === 'subtotal') {
    rules.push('color:#6b7280', 'font-size:12px');
  } else if (header) {
    rules.push('background:#f9fafb', 'font-weight:600');
  }
  return rules.join(';');
}

function renderTableBlock(block) {
  const colgroup = Array.isArray(block.columnWidthPercents) && block.columnWidthPercents.length
    ? renderTableColgroupPercents(block.columnWidthPercents)
    : renderTableColgroup(block.columnWidths || []);

  if (Array.isArray(block.gridRows) && block.gridRows.length) {
    const bodyHtml = block.gridRows
      .map((row) => {
        const cells = (row || [])
          .filter((cell) => cell && !cell.skip)
          .map((cell) => {
            const colSpan = cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : '';
            const rowSpan = cell.rowSpan > 1 ? ` rowspan="${cell.rowSpan}"` : '';
            return `<td${colSpan}${rowSpan} style="${tableCellStyle(cell)}">${escapeHtml(cell.text)}</td>`;
          })
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');

    const tableStyle = buildTableStyle(block);
    return `<table class="ld-table" style="${tableStyle}">${colgroup ? `<colgroup>${colgroup}</colgroup>` : ''}<tbody>${bodyHtml}</tbody></table>`;
  }

  const headerCells = Array.isArray(block.headerCells) && block.headerCells.length
    ? block.headerCells
    : (block.headers || []).map((text) => ({ text, colSpan: 1, align: 'left' }));

  const headerHtml = headerCells
    .map((cell) => {
      const colSpan = cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : '';
      return `<th${colSpan} style="${tableCellStyle(cell, { header: true })}">${escapeHtml(cell.text)}</th>`;
    })
    .join('');

  const bodyHtml = (block.rows || [])
    .map((row) => {
      const cells = row
        .map((cell) => {
          const value = typeof cell === 'object' && cell !== null ? cell.text : cell;
          const style = typeof cell === 'object' && cell !== null
            ? tableCellStyle(cell)
            : tableCellStyle({ align: 'left' });
          return `<td style="${style}">${escapeHtml(value)}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const footerHtml = (block.footerCells || []).length
    ? `<tfoot><tr>${block.footerCells.map((cell) => {
        const colSpan = cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : '';
        return `<td${colSpan} style="${tableCellStyle(cell, { footer: true })}">${escapeHtml(cell.text)}</td>`;
      }).join('')}</tr></tfoot>`
    : '';

  const tableStyle = buildTableStyle(block);
  return `<table class="ld-table" style="${tableStyle}">${colgroup ? `<colgroup>${colgroup}</colgroup>` : ''}<thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody>${footerHtml}</table>`;
}

function renderBlock(block) {
  if (block.type === 'AbsoluteWrapper') {
    const inner = renderBlock(block.block);
    if (!inner) return '';
    return `<div class="ld-abs-block" style="${block.style}">${inner}</div>`;
  }

  switch (block.type) {
    case 'Heading':
    case 'Paragraph':
    case 'Text':
      return `<${block.tag} style="${block.style}">${block.html}</${block.tag}>`;
    case 'Link':
      return `<a href="${escapeHtml(block.href || '#')}" style="${block.style}">${block.html}</a>`;
    case 'List': {
      const tag = block.ordered ? 'ol' : 'ul';
      const items = (block.items || [])
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join('');
      return `<${tag} style="${block.style};margin:0 0 8px;padding-left:20px;">${items}</${tag}>`;
    }
    case 'ComponentPlaceholder':
      return `<div class="ld-component-placeholder" style="${block.style};border:1px dashed #d1d5db;border-radius:6px;padding:8px 12px;margin:8px 0;background:#f9fafb;"><div style="font-size:11px;font-weight:600;color:#374151;margin-bottom:4px;">${escapeHtml(block.label)}</div><div style="font-size:12px;color:#6b7280;">${escapeHtml(block.html)}</div></div>`;
    case 'WatermarkText':
      return `<div class="ld-watermark-component" style="${block.style};position:relative;text-align:center;font-size:48px;color:rgba(148,163,184,0.35);transform:rotate(-30deg);margin:24px 0;pointer-events:none;">${escapeHtml(block.html)}</div>`;
    case 'Divider':
      return `<hr style="${block.style}" />`;
    case 'Spacer':
      return `<div style="${block.style}"></div>`;
    case 'PageBreak':
      return '<div style="break-after:page;"></div>';
    case 'Image':
      if (!block.src) return '';
      return `<img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}" style="${block.style};max-width:100%;" />`;
    case 'Table':
      return renderTableBlock(block);
    case 'Row':
      return `<div class="ld-row" style="${block.style}">${(block.blocks || []).map(renderBlock).join('')}</div>`;
    case 'Column':
      return `<div class="ld-col" style="${block.style}">${(block.blocks || []).map(renderBlock).join('')}</div>`;
    default:
      return '';
  }
}

/**
 * @param {object} layoutTree
 */
function renderLayoutTreeToHtml(layoutTree) {
  const page = layoutTree.page || {};
  const dimensions = page.dimensions || { width: 210, height: 297 };
  const margins = page.margins || { top: 12, right: 12, bottom: 12, left: 12 };
  const theme = layoutTree.theme || {};
  const watermark = layoutTree.watermark
    ? `<div class="watermark">${escapeHtml(layoutTree.watermark)}</div>`
    : '';

  const blocksHtml = (layoutTree.blocks || []).map(renderBlock).join('\n');
  const headerHtml = layoutTree.header?.html
    ? `<header class="doc-header">${layoutTree.header.html}</header>`
    : '';
  const footerHtml = layoutTree.footer?.html
    ? `<footer class="doc-footer">${layoutTree.footer.html}</footer>`
    : '';

  const pageSizeCss = page.paperSize === 'Custom'
    ? `${dimensions.width}mm ${dimensions.height}mm`
    : `${page.paperSize || 'A4'} ${page.orientation || 'portrait'}`;

  const isAbsoluteLayout = page.layoutMode === 'absolute';
  const contentMinHeightPx = Number(page.contentMinHeightPx) || null;
  const contentHeightPx = Number(page.contentHeightPx) || null;
  const contentClass = isAbsoluteLayout ? 'content absolute-layout' : 'content';
  const contentStyleRules = [];
  if (isAbsoluteLayout) {
    if (contentMinHeightPx) contentStyleRules.push(`min-height:${contentMinHeightPx}px`);
    if (contentHeightPx) {
      contentStyleRules.push(`height:${contentHeightPx}px`);
      contentStyleRules.push('box-sizing:border-box');
      contentStyleRules.push('overflow:hidden');
    }
  }
  const contentStyle = contentStyleRules.length
    ? ` style="${contentStyleRules.join(';')};"`
    : '';

  return `<!DOCTYPE html>
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
    .page {
      position: relative;
      width: ${dimensions.width}mm;
      min-height: ${dimensions.height}mm;
      box-sizing: border-box;
      padding: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
    }
    .watermark {
      position: fixed;
      top: 45%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      font-size: 64px;
      color: rgba(148, 163, 184, 0.25);
      z-index: 0;
      pointer-events: none;
      white-space: nowrap;
    }
    .content {
      position: relative;
      z-index: 1;
    }
    .content.absolute-layout {
      width: 100%;
      box-sizing: border-box;
    }
    .ld-abs-block {
      overflow: visible;
    }
    h1, h2, h3, h4, h5, h6 {
      margin: 0 0 8px;
    }
    p {
      margin: 0 0 8px;
    }
    table {
      margin: 12px 0;
    }
    table.ld-table {
      border-collapse: collapse;
      table-layout: fixed;
    }
    .content:not(.absolute-layout) table.ld-table {
      max-width: 100%;
    }
    .content.absolute-layout table.ld-table {
      max-width: none;
    }
    .doc-header, .doc-footer {
      color: #6b7280;
      font-size: 11px;
    }
    .ld-row {
      width: 100%;
      box-sizing: border-box;
    }
    .ld-col {
      box-sizing: border-box;
      min-width: 0;
    }
  </style>
</head>
<body>
  ${watermark}
  <div class="page">
    ${headerHtml}
    <div class="${contentClass}"${contentStyle}>
      ${blocksHtml}
    </div>
    ${footerHtml}
  </div>
</body>
</html>`;
}

module.exports = {
  renderLayoutTreeToHtml,
  renderBlock,
  renderTableBlock,
  buildTableStyle,
  escapeHtml
};
