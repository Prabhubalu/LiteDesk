const InvoiceSection = require('../models/InvoiceSection');
const InvoiceLine = require('../models/InvoiceLine');
const { assertValidInvoiceSectionType } = require('../constants/invoiceSection');
const { isMongoObjectIdString } = require('../utils/isMongoObjectId');
const { writeInvoiceActivity } = require('../services/invoiceActivityService');
const { loadInvoiceOrThrow } = require('../services/invoiceManualService');
const {
  listInvoiceSections,
  getNextSectionOrder,
  recomputeInvoiceAndSectionTotals,
  countLinesInSection,
  ensureDefaultInvoiceSection
} = require('../services/invoiceSectionService');
const { INVOICE_STATUS_DEFAULT } = require('../constants/invoiceLifecycle');

function asNumber(value, { defaultValue = NaN } = {}) {
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
}

function assertDraftForSectionWrite(invoice) {
  if (String(invoice.status || '') !== INVOICE_STATUS_DEFAULT) {
    const err = new Error('Sections can only be edited while invoice is Draft.');
    err.code = 'INVOICE_NOT_DRAFT';
    err.details = { status: invoice.status };
    throw err;
  }
}

async function findSectionOrThrow({ organizationId, invoiceId, sectionId }) {
  const ref = String(sectionId || '').trim();
  let section = null;
  if (isMongoObjectIdString(ref)) {
    section = await InvoiceSection.findOne({ organizationId, invoiceId, _id: ref });
  }
  if (!section) {
    section = await InvoiceSection.findOne({ organizationId, invoiceId, invoiceSectionId: ref });
  }
  if (!section) {
    const err = new Error('Invoice section not found');
    err.code = 'SECTION_NOT_FOUND';
    throw err;
  }
  return section;
}

async function listSections(req, res) {
  try {
    const invoice = await loadInvoiceOrThrow({ organizationId: req.user.organizationId, invoiceRef: req.params.id });
    const sections = await listInvoiceSections({ organizationId: req.user.organizationId, invoiceId: invoice._id });
    return res.json({ success: true, data: sections });
  } catch (err) {
    return res.status(err?.code === 'NOT_FOUND' ? 404 : 500).json({
      success: false,
      message: err.message || 'Failed to list invoice sections',
      code: err?.code || 'UNKNOWN'
    });
  }
}

async function createSection(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const invoice = await loadInvoiceOrThrow({ organizationId, invoiceRef: req.params.id });
    assertDraftForSectionWrite(invoice);

    const sectionTitle = String(req.body?.sectionTitle || '').trim();
    if (!sectionTitle) {
      return res.status(400).json({ success: false, code: 'VALIDATION', message: 'sectionTitle is required' });
    }

    let sectionType;
    try {
      sectionType = assertValidInvoiceSectionType(req.body?.sectionType);
    } catch (e) {
      return res.status(400).json({ success: false, code: e.code || 'VALIDATION', message: e.message });
    }

    const sectionOrder =
      req.body?.sectionOrder !== undefined
        ? asNumber(req.body.sectionOrder, { defaultValue: NaN })
        : await getNextSectionOrder({ organizationId, invoiceId: invoice._id });

    const includeInInvoiceTotal =
      req.body?.includeInInvoiceTotal !== undefined
        ? req.body.includeInInvoiceTotal === true
        : sectionType !== 'optional';

    const section = await InvoiceSection.create({
      organizationId,
      invoiceId: invoice._id,
      sectionTitle,
      sectionDescription: req.body?.sectionDescription ? String(req.body.sectionDescription).trim() : null,
      sectionOrder,
      sectionType,
      includeInInvoiceTotal,
      lockedSnapshot: false
    });

    const { totals, sections } = await recomputeInvoiceAndSectionTotals({ organizationId, invoiceId: invoice._id });

    await writeInvoiceActivity({
      organizationId,
      invoiceId: invoice.invoiceId,
      userId: req.user._id,
      action: 'invoice_section_created',
      message: `Section added: ${section.sectionTitle}`,
      details: { invoiceNumber: invoice.invoiceNumber, invoiceSectionId: section.invoiceSectionId, totals }
    });

    return res.status(201).json({ success: true, data: { section, sections, totals } });
  } catch (err) {
    const status =
      err?.code === 'NOT_FOUND' ? 404 : err?.code === 'VALIDATION' || err?.code === 'INVOICE_NOT_DRAFT' ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to create invoice section',
      code: err?.code || 'UNKNOWN'
    });
  }
}

async function patchSection(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const invoice = await loadInvoiceOrThrow({ organizationId, invoiceRef: req.params.id });
    assertDraftForSectionWrite(invoice);

    const section = await findSectionOrThrow({
      organizationId,
      invoiceId: invoice._id,
      sectionId: req.params.sectionId
    });

    if (section.lockedSnapshot === true) {
      return res.status(400).json({ success: false, code: 'SECTION_LOCKED', message: 'Section is locked.' });
    }

    if (req.body?.sectionTitle !== undefined) {
      const title = String(req.body.sectionTitle || '').trim();
      if (!title) {
        return res.status(400).json({ success: false, code: 'VALIDATION', message: 'sectionTitle is required' });
      }
      section.sectionTitle = title;
    }
    if (req.body?.sectionDescription !== undefined) {
      section.sectionDescription = req.body.sectionDescription ? String(req.body.sectionDescription).trim() : null;
    }
    if (req.body?.sectionType !== undefined) {
      section.sectionType = assertValidInvoiceSectionType(req.body.sectionType);
    }
    if (req.body?.includeInInvoiceTotal !== undefined) {
      section.includeInInvoiceTotal = req.body.includeInInvoiceTotal === true;
    }
    if (req.body?.hiddenSection !== undefined) {
      section.hiddenSection = req.body.hiddenSection === true;
    }
    if (req.body?.sectionOrder !== undefined) {
      section.sectionOrder = asNumber(req.body.sectionOrder, { defaultValue: NaN });
    }

    await section.save();
    const { totals, sections } = await recomputeInvoiceAndSectionTotals({ organizationId, invoiceId: invoice._id });

    await writeInvoiceActivity({
      organizationId,
      invoiceId: invoice.invoiceId,
      userId: req.user._id,
      action: 'invoice_section_updated',
      message: `Section updated: ${section.sectionTitle}`,
      details: { invoiceNumber: invoice.invoiceNumber, invoiceSectionId: section.invoiceSectionId, totals }
    });

    return res.json({ success: true, data: { section, sections, totals } });
  } catch (err) {
    const status =
      err?.code === 'NOT_FOUND' || err?.code === 'SECTION_NOT_FOUND'
        ? 404
        : err?.code === 'VALIDATION' || err?.code === 'INVOICE_NOT_DRAFT' || err?.code === 'SECTION_LOCKED'
          ? 400
          : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to update invoice section',
      code: err?.code || 'UNKNOWN'
    });
  }
}

async function deleteSection(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const invoice = await loadInvoiceOrThrow({ organizationId, invoiceRef: req.params.id });
    assertDraftForSectionWrite(invoice);

    const section = await findSectionOrThrow({
      organizationId,
      invoiceId: invoice._id,
      sectionId: req.params.sectionId
    });

    if (section.lockedSnapshot === true) {
      return res.status(400).json({ success: false, code: 'SECTION_LOCKED', message: 'Section is locked.' });
    }

    const lineCount = await countLinesInSection({
      organizationId,
      invoiceId: invoice._id,
      sectionId: section._id
    });
    if (lineCount > 0) {
      return res.status(400).json({
        success: false,
        code: 'SECTION_HAS_LINES',
        message: 'Remove or move all lines before deleting this section.'
      });
    }

    const title = section.sectionTitle;
    await section.deleteOne();
    const { totals, sections } = await recomputeInvoiceAndSectionTotals({ organizationId, invoiceId: invoice._id });

    await writeInvoiceActivity({
      organizationId,
      invoiceId: invoice.invoiceId,
      userId: req.user._id,
      action: 'invoice_section_deleted',
      message: `Section removed: ${title}`,
      details: { invoiceNumber: invoice.invoiceNumber, totals }
    });

    return res.json({ success: true, data: { sections, totals } });
  } catch (err) {
    const status =
      err?.code === 'NOT_FOUND' || err?.code === 'SECTION_NOT_FOUND'
        ? 404
        : err?.code === 'VALIDATION' ||
            err?.code === 'INVOICE_NOT_DRAFT' ||
            err?.code === 'SECTION_HAS_LINES' ||
            err?.code === 'SECTION_LOCKED'
          ? 400
          : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to delete invoice section',
      code: err?.code || 'UNKNOWN'
    });
  }
}

module.exports = { listSections, createSection, patchSection, deleteSection, ensureDefaultInvoiceSection };
