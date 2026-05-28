const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PDFDocument = require('pdfkit');
const Quote = require('../models/Quote');
const QuoteLine = require('../models/QuoteLine');
const QuoteDocumentModel = require('../models/QuoteDocument');
const { writeQuoteActivity } = require('../services/quoteActivityService');

function safeFilePart(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120) || 'quote';
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function formatMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '0.00';
  return x.toFixed(2);
}

function computeChecksum(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function renderQuotePdf({ quote, lines }) {
  return new Promise((resolve, reject) => {
    // bufferPages enables "Page X of Y" footers after content renders
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const currency = String(quote.currency || '').trim();
    const orgName = typeof quote.organizationRefId === 'object' ? quote.organizationRefId?.name : null;
    const contactName = typeof quote.contactId === 'object'
      ? [quote.contactId?.first_name, quote.contactId?.last_name].filter(Boolean).join(' ').trim()
      : null;

    const page = () => ({
      left: doc.page.margins.left,
      right: doc.page.width - doc.page.margins.right,
      top: doc.page.margins.top,
      bottom: doc.page.height - doc.page.margins.bottom,
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right
    });

    const money = (n) => `${formatMoney(n)}${currency ? ` ${currency}` : ''}`;

    const cols = () => {
      const p = page();
      const skuW = 92;
      const qtyW = 48;
      const unitW = 74;
      const totalW = 86;
      const nameW = Math.max(120, p.width - (skuW + qtyW + unitW + totalW));
      return {
        sku: { x: p.left, w: skuW },
        name: { x: p.left + skuW, w: nameW },
        qty: { x: p.left + skuW + nameW, w: qtyW },
        unit: { x: p.left + skuW + nameW + qtyW, w: unitW },
        total: { x: p.left + skuW + nameW + qtyW + unitW, w: totalW }
      };
    };

    function drawFooter(pageIndex, pageCount) {
      const p = page();
      doc.save();
      const footerY = p.bottom + 12;
      doc.strokeColor('#E5E7EB').moveTo(p.left, p.bottom + 4).lineTo(p.right, p.bottom + 4).stroke();
      doc.fillColor('#6B7280').fontSize(9);
      const leftText = `${quote.quoteNumber || 'Quote'} • Rev ${quote.revisionNumber || 1}`;
      const rightText = `Page ${pageIndex + 1} of ${pageCount}`;
      doc.text(leftText, p.left, footerY, { width: p.width - 90 });
      doc.text(rightText, p.right - 90, footerY, { width: 90, align: 'right' });
      doc.restore();
    }

    function drawHeader() {
      const p = page();
      doc.save();

      // Title
      doc.fillColor('#111111').fontSize(20).text('Quote', p.left, p.top, { width: p.width });

      // Meta
      doc.fillColor('#374151').fontSize(10);
      const top = p.top + 30;
      const leftColX = p.left;
      const rightColX = p.left + Math.min(320, Math.floor(p.width / 2));
      const quoteDateStr = quote.quoteDate ? new Date(quote.quoteDate).toLocaleDateString() : '—';
      const validUntilStr = quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : '—';

      doc.text(`Quote #: ${quote.quoteNumber || quote._id}`, leftColX, top);
      doc.text(`Revision: ${quote.revisionNumber || 1}`, leftColX, top + 14);
      doc.text(`Status: ${quote.status || 'Draft'}`, leftColX, top + 28);

      doc.text(`Quote Date: ${quoteDateStr}`, rightColX, top);
      doc.text(`Valid Until: ${validUntilStr}`, rightColX, top + 14);
      doc.text(`Currency: ${currency || '—'}`, rightColX, top + 28);

      doc.strokeColor('#E5E7EB').moveTo(p.left, top + 46).lineTo(p.right, top + 46).stroke();

      // Customer (best effort)
      doc.fillColor('#111111').fontSize(11);
      const partyTop = top + 58;
      if (orgName) doc.text(`Organization: ${orgName}`, p.left, partyTop, { width: p.width });
      if (contactName) doc.text(`Contact: ${contactName}`, p.left, partyTop + 14, { width: p.width });

      doc.restore();
      doc.y = partyTop + (orgName || contactName ? 36 : 10);
    }

    function drawTableHeader() {
      const p = page();
      const c = cols();
      const y = doc.y + 8;
      doc.save();
      doc.rect(p.left, y - 6, p.width, 20).fill('#F3F4F6');
      doc.fillColor('#4B5563').fontSize(9);
      doc.text('SKU', c.sku.x, y, { width: c.sku.w });
      doc.text('Name', c.name.x, y, { width: c.name.w });
      doc.text('Qty', c.qty.x, y, { width: c.qty.w, align: 'right' });
      doc.text('Unit', c.unit.x, y, { width: c.unit.w, align: 'right' });
      doc.text('Total', c.total.x, y, { width: c.total.w, align: 'right' });
      doc.restore();
      doc.y = y + 18;
    }

    function ensureRoom(minHeight) {
      const p = page();
      const footerReserve = 22; // space for footer line + text
      if (doc.y + minHeight <= p.bottom - footerReserve) return;
      doc.addPage();
      drawHeader();
      drawTableHeader();
    }

    function lineLabel(line) {
      const name = line.itemNameSnapshot || '—';
      if (line.lineType === 'bundle_component') {
        const optional = !!(line.bundleSnapshot && line.bundleSnapshot.optional === true);
        return `${optional ? '[Optional] ' : ''}${name}`;
      }
      return name;
    }

    function rowStyle(line) {
      const isBundleParent = line.lineType === 'bundle_parent';
      const isComponent = line.lineType === 'bundle_component';
      return { isBundleParent, isComponent };
    }

    function renderLineRow(line, zebraIndex) {
      const p = page();
      const c = cols();
      const { isBundleParent, isComponent } = rowStyle(line);
      const indent = isComponent ? 14 : 0;

      doc.fontSize(10);
      doc.fillColor('#111111');
      if (isBundleParent) doc.font('Helvetica-Bold');
      else doc.font('Helvetica');

      const sku = line.skuSnapshot || '—';
      const name = lineLabel(line);
      const qty = Number(line.quantity) || 0;
      const unit = Number(line.unitPriceSnapshot) || 0;
      const total = Number(line.lineTotal) || 0;

      const rowY = doc.y;
      const rowH = 18;

      // background zebra (subtle)
      if (zebraIndex % 2 === 1) {
        doc.save();
        doc.rect(p.left, rowY - 3, p.width, rowH).fill('#FAFAFB');
        doc.restore();
      }

      doc.fillColor('#111111');
      doc.text(sku, c.sku.x, rowY, { width: c.sku.w });
      doc.text(name, c.name.x + indent, rowY, { width: c.name.w - indent });
      doc.text(String(qty), c.qty.x, rowY, { width: c.qty.w, align: 'right' });
      doc.text(formatMoney(unit), c.unit.x, rowY, { width: c.unit.w, align: 'right' });
      doc.text(formatMoney(total), c.total.x, rowY, { width: c.total.w, align: 'right' });

      // if component, add a small vertical marker
      if (isComponent) {
        doc.save();
        doc.strokeColor('#D1D5DB').lineWidth(1);
        doc.moveTo(c.name.x + 6, rowY + 2).lineTo(c.name.x + 6, rowY + rowH - 6).stroke();
        doc.restore();
      }

      doc.font('Helvetica').fillColor('#111111');
      doc.y = rowY + rowH;
    }

    function drawTotalsBox() {
      ensureRoom(96);

      const p = page();
      doc.moveDown(0.4);

      // Totals box (fixed width prevents wrapping)
      const boxW = 240;
      const boxX = p.right - boxW;
      const startY = doc.y;
      const lineH = 16;

      doc.save();
      doc.rect(boxX, startY - 8, boxW, lineH * 3 + 18).fill('#F6F7FB');
      doc.restore();

      const labelW = 110;
      const valueW = boxW - labelW;

      doc.font('Helvetica').fontSize(11).fillColor('#111111');
      doc.text('Subtotal', boxX + 12, startY, { width: labelW - 12 });
      doc.text(money(quote.subtotal), boxX + labelW, startY, { width: valueW - 12, align: 'right' });

      doc.text('Tax', boxX + 12, startY + lineH, { width: labelW - 12 });
      doc.text(money(quote.taxTotal), boxX + labelW, startY + lineH, { width: valueW - 12, align: 'right' });

      doc.font('Helvetica-Bold').fontSize(12).fillColor('#000000');
      doc.text('Grand Total', boxX + 12, startY + lineH * 2, { width: labelW - 12 });
      doc.text(money(quote.grandTotal), boxX + labelW, startY + lineH * 2, { width: valueW - 12, align: 'right' });

      doc.font('Helvetica').fillColor('#111111');
      doc.y = startY + lineH * 3 + 18;
    }

    // --- Render ---
    drawHeader();

    doc.fillColor('#111111').fontSize(14).text('Lines', { align: 'left' });
    drawTableHeader();

    const visible = (Array.isArray(lines) ? lines : []).filter((l) => l && l.hiddenLine !== true);
    let zebra = 0;
    for (const l of visible) {
      ensureRoom(26);
      renderLineRow(l, zebra);
      zebra += 1;
    }

    drawTotalsBox();

    // Footers with total page count
    const range = doc.bufferedPageRange(); // { start: 0, count: n }
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      drawFooter(i, range.count);
    }

    doc.end();
  });
}

exports.listDocuments = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;
    const docs = await QuoteDocumentModel.find({ organizationId, quoteId })
      .sort({ versionNumber: -1, generatedAt: -1 })
      .lean();
    return res.json({ success: true, data: docs });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || 'Failed to list documents', code: 'UNKNOWN' });
  }
};

exports.generateDocument = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    const quote = await Quote.findOne({ _id: quoteId, organizationId })
      .populate({ path: 'ownerId', select: 'firstName lastName email username' })
      .populate({ path: 'organizationRefId', select: 'name' })
      .populate({ path: 'contactId', select: 'first_name last_name email phone mobile' })
      .lean();
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    const lines = await QuoteLine.find({ organizationId, quoteId }).sort({ lineOrder: 1, createdAt: 1 }).lean();
    const pdf = await renderQuotePdf({ quote, lines });
    const checksum = computeChecksum(pdf);

    const latest = await QuoteDocumentModel.find({ organizationId, quoteId, revisionNumber: quote.revisionNumber })
      .sort({ versionNumber: -1 })
      .limit(1)
      .select('versionNumber')
      .lean();
    const nextVersion = Math.max(0, Number(latest?.[0]?.versionNumber) || 0) + 1;

    const outDir = path.join(__dirname, '..', 'public', 'quote-documents', String(organizationId), String(quoteId));
    ensureDir(outDir);
    const filename = `${safeFilePart(quote.quoteNumber)}-rev${quote.revisionNumber}-v${nextVersion}.pdf`;
    const filePath = path.join(outDir, filename);
    fs.writeFileSync(filePath, pdf);

    const stat = fs.statSync(filePath);
    // IMPORTANT: client runs on Vite (:5173) and proxies /api/* to the server.
    // Serve PDFs under /api/quote-documents/* so browser doesn't route to the SPA.
    const publicPath = `/api/quote-documents/${String(organizationId)}/${String(quoteId)}/${filename}`;

    const docRow = await QuoteDocumentModel.create({
      organizationId,
      quoteId,
      quoteNumber: quote.quoteNumber,
      revisionNumber: quote.revisionNumber,
      versionNumber: nextVersion,
      templateId: 'default',
      checksum,
      generatedAt: new Date(),
      generatedBy: req.user._id,
      mimeType: 'application/pdf',
      storageProvider: 'local',
      filePath: publicPath,
      fileSizeBytes: stat.size,
      currency: quote.currency || 'USD',
      grandTotal: Number(quote.grandTotal) || 0,
      lineCount: (lines || []).filter((l) => l && l.hiddenLine !== true).length
    });

    await writeQuoteActivity({
      organizationId,
      quoteId,
      userId: req.user._id,
      action: 'quote_document_generated',
      message: 'Quote PDF generated',
      details: { revisionNumber: quote.revisionNumber, versionNumber: nextVersion, checksum }
    });

    return res.status(201).json({ success: true, data: docRow });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || 'Failed to generate document', code: 'UNKNOWN' });
  }
};

