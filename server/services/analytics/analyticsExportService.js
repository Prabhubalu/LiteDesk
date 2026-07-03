/**
 * CSV, XLSX, and PDF export for analytics report results.
 */

function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  const str = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function resultToCsv(result) {
  const columns = result?.columns || [];
  const rows = result?.rows || [];

  const headers = columns.map((col) => col.label || col.key);
  const keys = columns.map((col) => col.key);

  const lines = [headers.map(escapeCsvCell).join(',')];

  for (const row of rows) {
    lines.push(keys.map((key) => escapeCsvCell(row[key])).join(','));
  }

  return lines.join('\n');
}

async function resultToXlsxBuffer(result, sheetName = 'Report') {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));

  const columns = result?.columns || [];
  const rows = result?.rows || [];

  sheet.addRow(columns.map((col) => col.label || col.key));
  for (const row of rows) {
    sheet.addRow(columns.map((col) => row[col.key] ?? ''));
  }

  sheet.getRow(1).font = { bold: true };
  return workbook.xlsx.writeBuffer();
}

async function resultToXlsxWorkbook(resultsBySheet) {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();

  for (const entry of resultsBySheet) {
    const sheet = workbook.addWorksheet(String(entry.sheetName || 'Sheet').slice(0, 31));
    const columns = entry.result?.columns || [];
    const rows = entry.result?.rows || [];
    sheet.addRow(columns.map((col) => col.label || col.key));
    for (const row of rows) {
      sheet.addRow(columns.map((col) => row[col.key] ?? ''));
    }
    sheet.getRow(1).font = { bold: true };
  }

  return workbook.xlsx.writeBuffer();
}

async function resultToPdfBuffer(result, title = 'Analytics Report') {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
  const chunks = [];

  return new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text(title, { align: 'left' });
    doc.moveDown(0.5);

    const columns = result?.columns || [];
    const rows = result?.rows || [];
    const keys = columns.map((col) => col.key);
    const headers = columns.map((col) => col.label || col.key);

    doc.fontSize(9);
    const colWidth = Math.max(60, (doc.page.width - 80) / Math.max(headers.length, 1));

    let y = doc.y;
    headers.forEach((header, index) => {
      doc.text(String(header).slice(0, 24), 40 + index * colWidth, y, {
        width: colWidth - 4,
        continued: false,
      });
    });
    y += 14;
    doc.moveTo(40, y).lineTo(doc.page.width - 40, y).stroke();
    y += 6;

    const maxRows = Math.min(rows.length, 40);
    for (let rowIndex = 0; rowIndex < maxRows; rowIndex += 1) {
      const row = rows[rowIndex];
      if (y > doc.page.height - 50) {
        doc.addPage({ layout: 'landscape' });
        y = 40;
      }
      keys.forEach((key, index) => {
        const value = row[key];
        const text = value instanceof Date ? value.toISOString() : String(value ?? '');
        doc.text(text.slice(0, 32), 40 + index * colWidth, y, { width: colWidth - 4 });
      });
      y += 12;
    }

    if (rows.length > maxRows) {
      doc.moveDown();
      doc.text(`… ${rows.length - maxRows} more rows not shown`, 40, y);
    }

    doc.end();
  });
}

function contentTypeForFormat(format) {
  const normalized = String(format || 'csv').toLowerCase();
  if (normalized === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (normalized === 'pdf') return 'application/pdf';
  return 'text/csv; charset=utf-8';
}

function fileExtensionForFormat(format) {
  const normalized = String(format || 'csv').toLowerCase();
  if (normalized === 'xlsx') return 'xlsx';
  if (normalized === 'pdf') return 'pdf';
  return 'csv';
}

async function renderExportPayload(result, format, options = {}) {
  const normalized = String(format || 'csv').toLowerCase();
  if (normalized === 'xlsx') {
    return resultToXlsxBuffer(result, options.title || 'Report');
  }
  if (normalized === 'pdf') {
    return resultToPdfBuffer(result, options.title || 'Analytics Report');
  }
  return resultToCsv(result);
}

module.exports = {
  escapeCsvCell,
  resultToCsv,
  resultToXlsxBuffer,
  resultToXlsxWorkbook,
  resultToPdfBuffer,
  contentTypeForFormat,
  fileExtensionForFormat,
  renderExportPayload,
};
