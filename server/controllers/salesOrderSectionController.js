const SalesOrder = require('../models/SalesOrder');
const SalesOrderSection = require('../models/SalesOrderSection');
const { assertValidSalesOrderSectionType } = require('../constants/salesOrderSection');
const { isMongoObjectIdString } = require('../utils/isMongoObjectId');
const { writeSalesOrderActivity } = require('../services/salesOrderActivityService');
const {
  listSalesOrderSections,
  getNextSectionOrder,
  recomputeSalesOrderAndSectionTotals,
  countLinesInSection
} = require('../services/salesOrderSectionService');
const { SALES_ORDER_STATUS_DEFAULT } = require('../constants/salesOrderLifecycle');

function asNumber(value, { defaultValue = NaN } = {}) {
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
}

async function loadSalesOrderOrThrow({ organizationId, salesOrderRef }) {
  const ref = String(salesOrderRef || '').trim();
  const order =
    (await SalesOrder.findOne({ organizationId, salesOrderId: ref, deletedAt: null })) ||
    (await SalesOrder.findOne({ organizationId, _id: ref, deletedAt: null }));

  if (!order) {
    const err = new Error('Sales order not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  return order;
}

function assertDraftForSectionWrite(order) {
  if (String(order.status || '') !== SALES_ORDER_STATUS_DEFAULT) {
    const err = new Error('Sections can only be edited while sales order is Draft.');
    err.code = 'SALES_ORDER_NOT_DRAFT';
    err.details = { status: order.status };
    throw err;
  }
}

async function findSectionOrThrow({ organizationId, salesOrderId, sectionId }) {
  const ref = String(sectionId || '').trim();
  let section = null;
  if (isMongoObjectIdString(ref)) {
    section = await SalesOrderSection.findOne({ organizationId, salesOrderId, _id: ref });
  }
  if (!section) {
    section = await SalesOrderSection.findOne({ organizationId, salesOrderId, salesOrderSectionId: ref });
  }
  if (!section) {
    const err = new Error('Sales order section not found');
    err.code = 'SECTION_NOT_FOUND';
    throw err;
  }
  return section;
}

async function listSections(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const order = await loadSalesOrderOrThrow({ organizationId, salesOrderRef: req.params.id });
    const sections = await listSalesOrderSections({ organizationId, salesOrderId: order._id });
    return res.json({ success: true, data: sections });
  } catch (err) {
    const status = err?.code === 'NOT_FOUND' ? 404 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to list sales order sections',
      code: err?.code || 'UNKNOWN'
    });
  }
}

async function createSection(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const order = await loadSalesOrderOrThrow({ organizationId, salesOrderRef: req.params.id });
    assertDraftForSectionWrite(order);

    const sectionTitle = String(req.body?.sectionTitle || '').trim();
    if (!sectionTitle) {
      return res.status(400).json({ success: false, code: 'VALIDATION', message: 'sectionTitle is required' });
    }

    let sectionType;
    try {
      sectionType = assertValidSalesOrderSectionType(req.body?.sectionType);
    } catch (e) {
      return res.status(400).json({ success: false, code: e.code || 'VALIDATION', message: e.message });
    }

    const sectionOrder =
      req.body?.sectionOrder !== undefined
        ? asNumber(req.body.sectionOrder, { defaultValue: NaN })
        : await getNextSectionOrder({ organizationId, salesOrderId: order._id });

    if (!Number.isFinite(sectionOrder)) {
      return res.status(400).json({ success: false, code: 'VALIDATION', message: 'sectionOrder must be a number' });
    }

    const includeInOrderTotal =
      req.body?.includeInOrderTotal !== undefined ? req.body.includeInOrderTotal === true : sectionType !== 'optional';

    const section = await SalesOrderSection.create({
      organizationId,
      salesOrderId: order._id,
      sectionTitle,
      sectionDescription: req.body?.sectionDescription ? String(req.body.sectionDescription).trim() : null,
      sectionOrder,
      sectionType,
      includeInOrderTotal,
      sectionAcceptanceType: 'line_only',
      lockedSnapshot: false
    });

    const { totals, sections } = await recomputeSalesOrderAndSectionTotals({
      organizationId,
      salesOrderId: order._id
    });

    await writeSalesOrderActivity({
      organizationId,
      salesOrderId: order._id,
      userId: req.user._id,
      action: 'sales_order_section_created',
      message: `Section added: ${section.sectionTitle}`,
      details: { salesOrderSectionId: section.salesOrderSectionId, totals }
    });

    return res.status(201).json({
      success: true,
      data: { section, sections, totals }
    });
  } catch (err) {
    const status =
      err?.code === 'NOT_FOUND'
        ? 404
        : err?.code === 'VALIDATION' || err?.code === 'SALES_ORDER_NOT_DRAFT'
          ? 400
          : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to create sales order section',
      code: err?.code || 'UNKNOWN',
      details: err?.details || null
    });
  }
}

async function patchSection(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const order = await loadSalesOrderOrThrow({ organizationId, salesOrderRef: req.params.id });
    assertDraftForSectionWrite(order);

    const section = await findSectionOrThrow({
      organizationId,
      salesOrderId: order._id,
      sectionId: req.params.sectionId
    });

    if (section.lockedSnapshot === true) {
      return res.status(400).json({
        success: false,
        code: 'SECTION_LOCKED',
        message: 'Quote-sourced sections cannot be edited on this sales order.'
      });
    }

    if (req.body?.sectionTitle !== undefined) {
      const title = String(req.body.sectionTitle || '').trim();
      if (!title) {
        return res.status(400).json({ success: false, code: 'VALIDATION', message: 'sectionTitle is required' });
      }
      section.sectionTitle = title;
    }
    if (req.body?.sectionDescription !== undefined) {
      section.sectionDescription = req.body.sectionDescription
        ? String(req.body.sectionDescription).trim()
        : null;
    }
    if (req.body?.sectionType !== undefined) {
      try {
        section.sectionType = assertValidSalesOrderSectionType(req.body.sectionType);
      } catch (e) {
        return res.status(400).json({ success: false, code: e.code || 'VALIDATION', message: e.message });
      }
    }
    if (req.body?.includeInOrderTotal !== undefined) {
      section.includeInOrderTotal = req.body.includeInOrderTotal === true;
    }
    if (req.body?.hiddenSection !== undefined) {
      section.hiddenSection = req.body.hiddenSection === true;
    }
    if (req.body?.sectionOrder !== undefined) {
      const orderNum = asNumber(req.body.sectionOrder, { defaultValue: NaN });
      if (!Number.isFinite(orderNum)) {
        return res.status(400).json({ success: false, code: 'VALIDATION', message: 'sectionOrder must be a number' });
      }
      section.sectionOrder = orderNum;
    }

    await section.save();

    const { totals, sections } = await recomputeSalesOrderAndSectionTotals({
      organizationId,
      salesOrderId: order._id
    });

    await writeSalesOrderActivity({
      organizationId,
      salesOrderId: order._id,
      userId: req.user._id,
      action: 'sales_order_section_updated',
      message: `Section updated: ${section.sectionTitle}`,
      details: { salesOrderSectionId: section.salesOrderSectionId, totals }
    });

    return res.json({
      success: true,
      data: { section, sections, totals }
    });
  } catch (err) {
    const status =
      err?.code === 'NOT_FOUND' || err?.code === 'SECTION_NOT_FOUND'
        ? 404
        : err?.code === 'VALIDATION' || err?.code === 'SALES_ORDER_NOT_DRAFT'
          ? 400
          : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to update sales order section',
      code: err?.code || 'UNKNOWN',
      details: err?.details || null
    });
  }
}

async function deleteSection(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const order = await loadSalesOrderOrThrow({ organizationId, salesOrderRef: req.params.id });
    assertDraftForSectionWrite(order);

    const section = await findSectionOrThrow({
      organizationId,
      salesOrderId: order._id,
      sectionId: req.params.sectionId
    });

    if (section.lockedSnapshot === true) {
      return res.status(400).json({
        success: false,
        code: 'SECTION_LOCKED',
        message: 'Quote-sourced sections cannot be removed from this sales order.'
      });
    }

    const lineCount = await countLinesInSection({
      organizationId,
      salesOrderId: order._id,
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

    const { totals, sections } = await recomputeSalesOrderAndSectionTotals({
      organizationId,
      salesOrderId: order._id
    });

    await writeSalesOrderActivity({
      organizationId,
      salesOrderId: order._id,
      userId: req.user._id,
      action: 'sales_order_section_deleted',
      message: `Section removed: ${title}`,
      details: { totals }
    });

    return res.json({ success: true, data: { sections, totals } });
  } catch (err) {
    const status =
      err?.code === 'NOT_FOUND' || err?.code === 'SECTION_NOT_FOUND'
        ? 404
        : err?.code === 'VALIDATION' ||
            err?.code === 'SALES_ORDER_NOT_DRAFT' ||
            err?.code === 'SECTION_HAS_LINES' ||
            err?.code === 'SECTION_LOCKED'
          ? 400
          : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to delete sales order section',
      code: err?.code || 'UNKNOWN',
      details: err?.details || null
    });
  }
}

module.exports = {
  listSections,
  createSection,
  patchSection,
  deleteSection
};
