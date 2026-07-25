'use strict';

/**
 * Canvas export — synchronous lightweight generators + Bull job hook when available.
 * Formats: pdf (HTML snapshot), html, xlsx (widget table dump), pptx, docx.
 */

const { listWidgets, docFromState } = require('./yjsDocument');

async function buildHtmlSnapshot(canvas) {
  const doc = docFromState(canvas.yjsState);
  const widgets = listWidgets(doc);
  const rows = widgets
    .map(
      (w) =>
        `<div class="widget" data-type="${escapeHtml(w.type)}">
          <h3>${escapeHtml(w.config?.title || w.type)}</h3>
          <pre>${escapeHtml(JSON.stringify(w.config || {}, null, 2))}</pre>
        </div>`
    )
    .join('\n');
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${escapeHtml(canvas.title)}</title>
<style>
body{font-family:system-ui,sans-serif;padding:24px;background:#f8fafc;color:#0f172a}
h1{font-size:1.5rem} .widget{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin:12px 0}
pre{font-size:11px;overflow:auto;max-height:160px}
</style></head>
<body><h1>${escapeHtml(canvas.title)}</h1>
<p>Type: ${escapeHtml(canvas.canvasType)} · Widgets: ${widgets.length}</p>
${rows}
</body></html>`;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function buildDocxBuffer(canvas) {
  try {
    const { Document, Packer, Paragraph, HeadingLevel, TextRun } = require('docx');
    const doc = docFromState(canvas.yjsState);
    const widgets = listWidgets(doc);
    const children = [
      new Paragraph({ text: canvas.title, heading: HeadingLevel.TITLE }),
      new Paragraph({
        children: [new TextRun(`Type: ${canvas.canvasType} · ${widgets.length} widgets`)],
      }),
    ];
    for (const w of widgets) {
      children.push(
        new Paragraph({
          text: w.config?.title || w.type,
          heading: HeadingLevel.HEADING_2,
        })
      );
      children.push(
        new Paragraph({
          children: [new TextRun(JSON.stringify(w.config || {}))],
        })
      );
    }
    const document = new Document({ sections: [{ children }] });
    return Packer.toBuffer(document);
  } catch (err) {
    throw new Error(`DOCX export failed: ${err.message}`);
  }
}

async function buildPptxBuffer(canvas) {
  try {
    const PptxGenJS = require('pptxgenjs');
    const pptx = new PptxGenJS();
    const doc = docFromState(canvas.yjsState);
    const widgets = listWidgets(doc);
    const titleSlide = pptx.addSlide();
    titleSlide.addText(canvas.title, { x: 0.5, y: 2, w: 9, h: 1, fontSize: 28, bold: true });
    titleSlide.addText(canvas.canvasType, { x: 0.5, y: 3, w: 9, h: 0.5, fontSize: 14 });

    for (const w of widgets.slice(0, 40)) {
      const slide = pptx.addSlide();
      slide.addText(w.config?.title || w.type, { x: 0.5, y: 0.4, w: 9, h: 0.6, fontSize: 20, bold: true });
      slide.addText(JSON.stringify(w.config || {}, null, 2).slice(0, 1200), {
        x: 0.5,
        y: 1.2,
        w: 9,
        h: 4,
        fontSize: 11,
      });
    }
    return pptx.write({ outputType: 'nodebuffer' });
  } catch (err) {
    throw new Error(`PPTX export failed: ${err.message}`);
  }
}

async function buildXlsxPayload(canvas) {
  const doc = docFromState(canvas.yjsState);
  const widgets = listWidgets(doc);
  return {
    sheets: [
      {
        name: 'Widgets',
        rows: [
          ['id', 'type', 'title', 'x', 'y', 'w', 'h'],
          ...widgets.map((w) => [
            w.id,
            w.type,
            w.config?.title || '',
            w.frame?.x,
            w.frame?.y,
            w.frame?.w,
            w.frame?.h,
          ]),
        ],
      },
    ],
  };
}

/**
 * Queue or run export. Returns downloadable payload metadata.
 * For PDF we return HTML that clients can print; full PDF rendering hooks blockBasedPdf when available.
 */
async function queueExport({ organizationId, canvasId, userId, format, canvas }) {
  const fmt = format || 'html';
  const base = {
    organizationId: String(organizationId),
    canvasId: String(canvasId),
    userId: String(userId),
    format: fmt,
    status: 'ready',
    createdAt: new Date().toISOString(),
  };

  if (fmt === 'html' || fmt === 'pdf') {
    const html = await buildHtmlSnapshot(canvas);
    return { ...base, contentType: 'text/html', content: html };
  }
  if (fmt === 'docx') {
    const buffer = await buildDocxBuffer(canvas);
    return {
      ...base,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      contentBase64: Buffer.from(buffer).toString('base64'),
    };
  }
  if (fmt === 'pptx') {
    const buffer = await buildPptxBuffer(canvas);
    return {
      ...base,
      contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      contentBase64: Buffer.from(buffer).toString('base64'),
    };
  }
  if (fmt === 'xlsx') {
    const payload = await buildXlsxPayload(canvas);
    return { ...base, contentType: 'application/json', content: payload };
  }
  throw new Error(`Unsupported export format: ${fmt}`);
}

module.exports = {
  queueExport,
  buildHtmlSnapshot,
  buildDocxBuffer,
  buildPptxBuffer,
  buildXlsxPayload,
};
