/**
 * Delivery Return service — reverse logistics from Delivery Note / Invoice sources.
 * Mirrors purchase-return patterns with sales-side statuses and stock restore.
 */

const { DeliveryReturn, DeliveryReturnLine } = require('../models/DeliveryReturn');
const SalesOrder = require('../models/SalesOrder');
const SalesOrderLine = require('../models/SalesOrderLine');
const Invoice = require('../models/Invoice');
const InvoiceLine = require('../models/InvoiceLine');
const Organization = require('../models/Organization');
const { postInventoryTransaction } = require('./inventoryTransactionService');
const { assertActiveLocation, resolveInventoryLocationUuid } = require('./inventoryLocationService');
const {
  DR_STATUSES,
  DR_SOURCE_DN_STATUSES,
  DR_RETURN_TYPES,
  DR_SOURCE_TYPES,
  DR_EDITABLE_STATUSES,
  DR_APPROVABLE_STATUSES,
  DR_RECEIVABLE_STATUSES,
  DR_INSPECTABLE_STATUSES,
  DR_RESTOCKABLE_STATUSES,
  DR_CANCELLABLE_STATUSES,
  DR_DEFAULT_INVENTORY_POST_STATUS
} = require('../constants/deliveryReturnLifecycle');

function validationError(message, code = 'VALIDATION') {
  const err = new Error(message);
  err.code = code;
  return err;
}

function isCustomerOrganization(org) {
  if (!org) return false;
  const types = Array.isArray(org.types)
    ? org.types.map((t) => String(t || '').toLowerCase())
    : [];
  if (types.includes('customer')) return true;
  const role =
    org.participations?.SALES?.role ||
    org.participations?.sales?.role ||
    org.participations?.INVENTORY?.role;
  return String(role || '').toLowerCase() === 'customer';
}

async function assertCustomerForDr(organizationId, customerId) {
  if (!customerId) throw validationError('Customer is required');
  const customer = await Organization.findOne({
    _id: customerId,
    deletedAt: null,
    isTenant: { $ne: true }
  })
    .select('_id types participations name email phone billingAddress shippingAddress')
    .lean();
  if (!customer) throw validationError('Customer organization not found', 'NOT_FOUND');
  if (!isCustomerOrganization(customer)) {
    throw validationError('Organization must have Customer participation type');
  }
  return customer;
}

async function nextDocNumber(organizationId, moduleKey, prefix) {
  const { allocateDocumentNumber } = require('./moduleNumberingService');
  return allocateDocumentNumber(organizationId, moduleKey, prefix, 4);
}

function getDnModels() {
  return require('../models/DeliveryNote');
}

function returnableQtyFromDnLine(dnLine) {
  return Math.max(
    0,
    Number(dnLine.quantityDelivered || 0) - Number(dnLine.quantityReturned || 0)
  );
}

function normalizeReturnType(raw) {
  if (raw == null || raw === '') return 'customer_return';
  const key = String(raw).trim().toLowerCase().replace(/\s+/g, '_');
  if (DR_RETURN_TYPES.includes(key)) return key;
  return 'customer_return';
}

function normalizeSourceType(raw) {
  const key = String(raw || DR_SOURCE_TYPES.DELIVERY_NOTE)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (key === 'invoice' || key === DR_SOURCE_TYPES.INVOICE) return DR_SOURCE_TYPES.INVOICE;
  return DR_SOURCE_TYPES.DELIVERY_NOTE;
}

function normalizeInventoryPostStatus(raw) {
  const key = String(raw || DR_DEFAULT_INVENTORY_POST_STATUS).toLowerCase();
  if (
    [DR_STATUSES.RECEIVED, DR_STATUSES.INSPECTED, DR_STATUSES.RESTOCKED].includes(key)
  ) {
    return key;
  }
  return DR_DEFAULT_INVENTORY_POST_STATUS;
}

function isEditableStatus(status) {
  return DR_EDITABLE_STATUSES.includes(String(status || '').toLowerCase());
}

/**
 * Eligible delivered DN lines for a customer (optional DN / Invoice filters).
 */
async function listEligibleReturnSources({
  organizationId,
  customerId,
  deliveryNoteIds = null,
  invoiceIds = null
}) {
  if (!customerId) throw validationError('customerId is required');
  await assertCustomerForDr(organizationId, customerId);

  const { DeliveryNote, DeliveryNoteLine } = getDnModels();

  const dnQuery = {
    organizationId,
    deletedAt: null,
    customerId,
    $or: [
      { inventoryPostedAt: { $ne: null } },
      { status: { $in: [...DR_SOURCE_DN_STATUSES] } }
    ]
  };

  if (Array.isArray(deliveryNoteIds) && deliveryNoteIds.length) {
    dnQuery._id = { $in: deliveryNoteIds };
  }

  if (Array.isArray(invoiceIds) && invoiceIds.length) {
    // Invoice path: DNs linked by invoiceId, or via sales orders on those invoices
    const invoices = await Invoice.find({
      organizationId,
      _id: { $in: invoiceIds },
      deletedAt: null
    })
      .select('_id salesOrderId customerId')
      .lean();
    if (!invoices.length) {
      return { deliveryNotes: [], invoices: [], lines: [] };
    }
    const invSoIds = invoices
      .map((i) => (i.salesOrderId ? String(i.salesOrderId) : null))
      .filter(Boolean);
    dnQuery.$or = [
      { invoiceId: { $in: invoiceIds } },
      ...(invSoIds.length ? [{ salesOrderId: { $in: invSoIds } }] : [])
    ];
  }

  const deliveryNotes = await DeliveryNote.find(dnQuery).sort({ deliveryDate: -1 }).lean();
  if (!deliveryNotes.length) {
    return { deliveryNotes: [], invoices: [], lines: [] };
  }

  const dnIds = deliveryNotes.map((d) => d._id);
  const dnLines = await DeliveryNoteLine.find({
    organizationId,
    deliveryNoteId: { $in: dnIds }
  }).lean();

  const soLineIds = [
    ...new Set(
      dnLines.map((l) => (l.salesOrderLineId ? String(l.salesOrderLineId) : null)).filter(Boolean)
    )
  ];
  const soLines = soLineIds.length
    ? await SalesOrderLine.find({ organizationId, _id: { $in: soLineIds } }).lean()
    : [];
  const soLineById = new Map(soLines.map((l) => [String(l._id), l]));

  const eligibleLines = [];
  for (const line of dnLines) {
    const returnable = returnableQtyFromDnLine(line);
    if (returnable <= 0) continue;
    const dn = deliveryNotes.find((d) => String(d._id) === String(line.deliveryNoteId));
    const soLine = line.salesOrderLineId
      ? soLineById.get(String(line.salesOrderLineId))
      : null;
    eligibleLines.push({
      ...line,
      quantityReturnable: returnable,
      deliveryNoteNumber: dn?.deliveryNoteNumber || null,
      salesOrderId: dn?.salesOrderId || null,
      invoiceId: dn?.invoiceId || null,
      customerId: dn?.customerId || customerId,
      unitPrice:
        Number(soLine?.unitPriceSnapshot ?? soLine?.unitPrice ?? 0) || 0,
      taxSnapshot: soLine?.taxSnapshot || {},
      chargeSnapshot: soLine?.chargeSnapshot || {}
    });
  }

  const invoiceIdSet = [
    ...new Set(
      deliveryNotes
        .map((d) => (d.invoiceId ? String(d.invoiceId) : null))
        .filter(Boolean)
    )
  ];
  const invoices =
    invoiceIdSet.length > 0
      ? await Invoice.find({
          organizationId,
          deletedAt: null,
          _id: { $in: invoiceIdSet }
        })
          .select('_id invoiceNumber subject status customerId grandTotal invoiceDate')
          .lean()
      : Array.isArray(invoiceIds) && invoiceIds.length
        ? await Invoice.find({
            organizationId,
            deletedAt: null,
            _id: { $in: invoiceIds }
          })
            .select('_id invoiceNumber subject status customerId grandTotal invoiceDate')
            .lean()
        : [];

  const notesOut = deliveryNotes
    .map((dn) => {
      const lines = eligibleLines.filter((l) => String(l.deliveryNoteId) === String(dn._id));
      if (!lines.length) return null;
      return {
        ...dn,
        returnableLineCount: lines.length,
        returnableQuantityTotal: lines.reduce(
          (s, l) => s + Number(l.quantityReturnable || 0),
          0
        )
      };
    })
    .filter(Boolean);

  const invOut = invoices
    .map((inv) => {
      const lines = eligibleLines.filter(
        (l) =>
          String(l.invoiceId || '') === String(inv._id) ||
          (Array.isArray(invoiceIds) &&
            invoiceIds.some((id) => String(id) === String(inv._id)))
      );
      // When filtering by invoiceIds without DN.invoiceId, attribute all eligible lines to those invoices
      const attributed =
        lines.length > 0
          ? lines
          : Array.isArray(invoiceIds) && invoiceIds.map(String).includes(String(inv._id))
            ? eligibleLines
            : [];
      if (!attributed.length) return null;
      return {
        ...inv,
        returnableLineCount: attributed.length,
        returnableQuantityTotal: attributed.reduce(
          (s, l) => s + Number(l.quantityReturnable || 0),
          0
        )
      };
    })
    .filter(Boolean);

  return { deliveryNotes: notesOut, invoices: invOut, lines: eligibleLines };
}

async function resolveReturnLineInputs({ organizationId, customerId, payload }) {
  const inputLines = Array.isArray(payload.lines) ? payload.lines : [];
  const deliveryNoteIds = [
    ...(payload.deliveryNoteId ? [payload.deliveryNoteId] : []),
    ...(Array.isArray(payload.deliveryNoteIds) ? payload.deliveryNoteIds : [])
  ].filter(Boolean);
  const invoiceIds = [
    ...(payload.invoiceId ? [payload.invoiceId] : []),
    ...(Array.isArray(payload.invoiceIds) ? payload.invoiceIds : [])
  ].filter(Boolean);

  if (!inputLines.length && !deliveryNoteIds.length && !invoiceIds.length) {
    throw validationError(
      'Provide return lines, deliveryNoteId(s), or invoiceId(s) with returnable delivered stock'
    );
  }

  const { lines: eligible } = await listEligibleReturnSources({
    organizationId,
    customerId,
    deliveryNoteIds: deliveryNoteIds.length ? deliveryNoteIds : null,
    invoiceIds: invoiceIds.length ? invoiceIds : null
  });
  const byDnLineId = new Map(eligible.map((l) => [String(l._id), l]));

  if (inputLines.length) {
    return inputLines.map((row) => {
      const dnLineId = row.deliveryNoteLineId || row._id;
      const dnLine = byDnLineId.get(String(dnLineId));
      if (!dnLine) {
        throw validationError('Invalid or non-returnable deliveryNoteLineId');
      }
      const qty =
        row.quantityReturned != null
          ? Number(row.quantityReturned)
          : Number(dnLine.quantityReturnable);
      return {
        dnLine,
        quantityReturned: qty,
        returnReason: row.returnReason || payload.returnReason || 'customer_rejection',
        returnCondition: row.returnCondition || 'good',
        inventoryLocationId: row.inventoryLocationId || null,
        unitPrice: row.unitPrice != null ? Number(row.unitPrice) : null
      };
    });
  }

  return eligible.map((dnLine) => ({
    dnLine,
    quantityReturned: Number(dnLine.quantityReturnable),
    returnReason: payload.returnReason || 'customer_rejection',
    returnCondition: 'good',
    inventoryLocationId: null,
    unitPrice: null
  }));
}

async function buildDrLineDocs({ organizationId, resolved, headerReturnWarehouseId }) {
  let subtotal = 0;
  const lineDocs = [];
  let order = 1;
  for (const row of resolved) {
    const dnLine = row.dnLine;
    const returnable = returnableQtyFromDnLine(dnLine);
    const qty = Number(row.quantityReturned);
    if (!Number.isFinite(qty) || qty <= 0) throw validationError('quantityReturned must be > 0');
    if (qty > returnable) {
      throw validationError(
        `Cannot return more than available delivered quantity for line (${qty} > ${returnable})`
      );
    }
    if (!row.returnReason) throw validationError('Line returnReason is required');
    const unitPrice =
      row.unitPrice != null && Number.isFinite(Number(row.unitPrice))
        ? Number(row.unitPrice)
        : Number(dnLine.unitPrice) || 0;
    const lineSubtotal = qty * unitPrice;
    subtotal += lineSubtotal;
    const locationId =
      row.inventoryLocationId || dnLine.inventoryLocationId || headerReturnWarehouseId;
    if (!locationId) throw validationError('inventoryLocationId is required on return lines');

    lineDocs.push({
      organizationId,
      lineOrder: order++,
      deliveryNoteId: dnLine.deliveryNoteId,
      deliveryNoteLineId: dnLine._id,
      salesOrderId: dnLine.salesOrderId || null,
      salesOrderLineId: dnLine.salesOrderLineId || null,
      invoiceId: dnLine.invoiceId || null,
      invoiceLineId: null,
      variantId: dnLine.variantId,
      skuSnapshot: dnLine.skuSnapshot,
      itemNameSnapshot: dnLine.itemNameSnapshot,
      quantityDelivered: dnLine.quantityDelivered,
      quantityReturnable: returnable,
      quantityReturned: qty,
      unitOfMeasure: dnLine.unitOfMeasure,
      unitPrice,
      returnReason: row.returnReason,
      returnCondition: String(row.returnCondition || 'good').toLowerCase(),
      taxSnapshot: dnLine.taxSnapshot || {},
      chargeSnapshot: dnLine.chargeSnapshot || {},
      lineSubtotal,
      lineTaxTotal: 0,
      lineTotal: lineSubtotal,
      inventoryLocationId: locationId,
      remarks: null
    });
  }
  return { lineDocs, subtotal };
}

async function getDeliveryReturn({ organizationId, id }) {
  const deliveryReturn = await DeliveryReturn.findOne({
    _id: id,
    organizationId,
    deletedAt: null
  })
    .populate({ path: 'customerId', select: 'name email phone types participations' })
    .populate({ path: 'contactPersonId', select: 'firstName lastName email phone name' })
    .populate({ path: 'ownerId', select: 'name firstName lastName email' })
    .populate({ path: 'returnWarehouseId', select: 'name locationCode inventoryLocationId' })
    .populate({ path: 'createdBy', select: 'name firstName lastName email' })
    .populate({ path: 'modifiedBy', select: 'name firstName lastName email' })
    .lean();
  if (!deliveryReturn) throw validationError('Delivery return not found', 'NOT_FOUND');
  const lines = await DeliveryReturnLine.find({ organizationId, deliveryReturnId: id })
    .sort({ lineOrder: 1 })
    .lean();
  return { deliveryReturn, lines };
}

async function createDeliveryReturn({ organizationId, userId, payload }) {
  let customerId = payload.customerId || null;
  if (!customerId && payload.deliveryNoteId) {
    const { DeliveryNote } = getDnModels();
    const dn = await DeliveryNote.findOne({
      _id: payload.deliveryNoteId,
      organizationId,
      deletedAt: null
    }).lean();
    if (!dn) throw validationError('Delivery note not found', 'NOT_FOUND');
    customerId = dn.customerId;
  }
  if (!customerId) throw validationError('customerId is required');
  const customer = await assertCustomerForDr(organizationId, customerId);

  const subject = String(payload.subject || '').trim();
  if (!subject) throw validationError('subject is required');

  const returnWarehouseId = payload.returnWarehouseId || null;
  if (returnWarehouseId) {
    await assertActiveLocation({ organizationId, inventoryLocationId: returnWarehouseId });
  }

  const hasLineInput =
    (Array.isArray(payload.lines) && payload.lines.length > 0) ||
    payload.deliveryNoteId ||
    (Array.isArray(payload.deliveryNoteIds) && payload.deliveryNoteIds.length) ||
    payload.invoiceId ||
    (Array.isArray(payload.invoiceIds) && payload.invoiceIds.length);

  let lineDocs = [];
  let subtotal = 0;
  if (hasLineInput) {
    const resolved = await resolveReturnLineInputs({ organizationId, customerId, payload });
    if (!resolved.length) throw validationError('No returnable quantities for selected sources');
    const built = await buildDrLineDocs({
      organizationId,
      resolved,
      headerReturnWarehouseId: returnWarehouseId
    });
    lineDocs = built.lineDocs;
    subtotal = built.subtotal;
  }

  const deliveryReturnNumber = await nextDocNumber(organizationId, 'delivery_returns', 'DR');
  const dnIds = [...new Set(lineDocs.map((l) => String(l.deliveryNoteId)))];
  const invIds = [
    ...new Set(lineDocs.map((l) => (l.invoiceId ? String(l.invoiceId) : null)).filter(Boolean))
  ];
  const soIds = [
    ...new Set(
      lineDocs.map((l) => (l.salesOrderId ? String(l.salesOrderId) : null)).filter(Boolean)
    )
  ];

  const sourceType = normalizeSourceType(
    payload.sourceType ||
      (Array.isArray(payload.invoiceIds) && payload.invoiceIds.length
        ? DR_SOURCE_TYPES.INVOICE
        : DR_SOURCE_TYPES.DELIVERY_NOTE)
  );

  const dr = await DeliveryReturn.create({
    organizationId,
    deliveryReturnNumber,
    subject,
    returnDate: payload.returnDate || new Date(),
    customerId,
    contactPersonId: payload.contactPersonId || null,
    ownerId: payload.ownerId || userId,
    sourceType,
    deliveryNoteId: dnIds.length === 1 ? dnIds[0] : payload.deliveryNoteId || null,
    invoiceId: invIds.length === 1 ? invIds[0] : payload.invoiceId || null,
    salesOrderId: soIds.length === 1 ? soIds[0] : null,
    returnType: normalizeReturnType(payload.returnType),
    returnReason: payload.returnReason || null,
    customerReference: payload.customerReference || null,
    returnWarehouseId,
    billingAddress: payload.billingAddress || customer.billingAddress || null,
    shippingAddress: payload.shippingAddress || customer.shippingAddress || null,
    email: payload.email || customer.email || null,
    mobile: payload.mobile || customer.phone || null,
    currency: payload.currency || 'USD',
    status: DR_STATUSES.DRAFT,
    inventoryPostStatus: normalizeInventoryPostStatus(payload.inventoryPostStatus),
    customerNotes: payload.customerNotes || payload.notes || null,
    internalNotes: payload.internalNotes || null,
    notes: payload.notes || payload.customerNotes || null,
    subtotal,
    taxTotal: 0,
    chargesTotal: 0,
    grandTotal: subtotal,
    createdBy: userId,
    modifiedBy: userId
  });

  if (lineDocs.length) {
    for (const ld of lineDocs) ld.deliveryReturnId = dr._id;
    await DeliveryReturnLine.insertMany(lineDocs);
  }
  return getDeliveryReturn({ organizationId, id: dr._id });
}

async function updateDeliveryReturn({ organizationId, id, userId, payload }) {
  const dr = await DeliveryReturn.findOne({ _id: id, organizationId, deletedAt: null });
  if (!dr) throw validationError('Delivery return not found', 'NOT_FOUND');
  if (!isEditableStatus(dr.status)) {
    throw validationError('Only draft delivery returns can be edited');
  }

  const allowed = [
    'subject',
    'returnDate',
    'contactPersonId',
    'ownerId',
    'returnType',
    'returnReason',
    'customerReference',
    'returnWarehouseId',
    'currency',
    'customerNotes',
    'internalNotes',
    'notes',
    'billingAddress',
    'shippingAddress',
    'email',
    'mobile',
    'inventoryPostStatus',
    'sourceType'
  ];
  for (const key of allowed) {
    if (payload[key] === undefined) continue;
    if (key === 'returnType') {
      dr.returnType = normalizeReturnType(payload.returnType);
    } else if (key === 'sourceType') {
      dr.sourceType = normalizeSourceType(payload.sourceType);
    } else if (key === 'inventoryPostStatus') {
      dr.inventoryPostStatus = normalizeInventoryPostStatus(payload.inventoryPostStatus);
    } else if (key === 'returnWarehouseId' && payload.returnWarehouseId) {
      await assertActiveLocation({
        organizationId,
        inventoryLocationId: payload.returnWarehouseId
      });
      dr.returnWarehouseId = payload.returnWarehouseId;
    } else {
      dr[key] = payload[key];
    }
  }
  if (payload.subject !== undefined && !String(payload.subject || '').trim()) {
    throw validationError('subject is required');
  }
  dr.modifiedBy = userId;
  await dr.save();
  return getDeliveryReturn({ organizationId, id });
}

async function recomputeHeaderTotals(organizationId, id, userId) {
  const dr = await DeliveryReturn.findOne({ _id: id, organizationId, deletedAt: null });
  if (!dr) throw validationError('Delivery return not found', 'NOT_FOUND');
  const allLines = await DeliveryReturnLine.find({ organizationId, deliveryReturnId: id }).lean();
  const subtotal = allLines.reduce((s, l) => s + Number(l.lineTotal || 0), 0);
  dr.subtotal = subtotal;
  dr.grandTotal = subtotal + Number(dr.taxTotal || 0) + Number(dr.chargesTotal || 0);
  dr.modifiedBy = userId;
  await dr.save();
  return getDeliveryReturn({ organizationId, id });
}

async function updateDeliveryReturnLine({ organizationId, id, lineId, userId, payload }) {
  const dr = await DeliveryReturn.findOne({ _id: id, organizationId, deletedAt: null });
  if (!dr) throw validationError('Delivery return not found', 'NOT_FOUND');
  if (!isEditableStatus(dr.status)) {
    throw validationError('Only draft delivery returns can edit lines');
  }
  const line = await DeliveryReturnLine.findOne({
    _id: lineId,
    organizationId,
    deliveryReturnId: id
  });
  if (!line) throw validationError('Delivery return line not found', 'NOT_FOUND');

  const { DeliveryNoteLine } = getDnModels();
  const dnLine = await DeliveryNoteLine.findOne({
    _id: line.deliveryNoteLineId,
    organizationId
  }).lean();
  if (!dnLine) throw validationError('Source delivery note line not found', 'NOT_FOUND');

  if (payload.quantityReturned !== undefined) {
    const qty = Number(payload.quantityReturned);
    const returnable = returnableQtyFromDnLine(dnLine);
    if (!Number.isFinite(qty) || qty <= 0) throw validationError('quantityReturned must be > 0');
    if (qty > returnable) {
      throw validationError('Cannot return more than available delivered quantity');
    }
    line.quantityReturned = qty;
    line.quantityReturnable = returnable;
    line.lineSubtotal = qty * Number(line.unitPrice || 0);
    line.lineTotal = line.lineSubtotal;
  }
  if (payload.returnReason !== undefined) {
    if (!String(payload.returnReason || '').trim()) {
      throw validationError('returnReason is required');
    }
    line.returnReason = payload.returnReason;
  }
  if (payload.returnCondition !== undefined) {
    line.returnCondition = String(payload.returnCondition || 'good').toLowerCase();
  }
  if (payload.unitPrice !== undefined) {
    line.unitPrice = Number(payload.unitPrice) || 0;
    line.lineSubtotal = Number(line.quantityReturned) * Number(line.unitPrice);
    line.lineTotal = line.lineSubtotal;
  }
  await line.save();
  return recomputeHeaderTotals(organizationId, id, userId);
}

async function deleteDeliveryReturnLine({ organizationId, id, lineId, userId }) {
  const dr = await DeliveryReturn.findOne({ _id: id, organizationId, deletedAt: null });
  if (!dr) throw validationError('Delivery return not found', 'NOT_FOUND');
  if (!isEditableStatus(dr.status)) {
    throw validationError('Only draft delivery returns can remove lines');
  }
  const result = await DeliveryReturnLine.deleteOne({
    _id: lineId,
    organizationId,
    deliveryReturnId: id
  });
  if (!result.deletedCount) throw validationError('Delivery return line not found', 'NOT_FOUND');
  return recomputeHeaderTotals(organizationId, id, userId);
}

async function addDeliveryReturnLinesFromSources({ organizationId, id, userId, payload }) {
  const dr = await DeliveryReturn.findOne({ _id: id, organizationId, deletedAt: null });
  if (!dr) throw validationError('Delivery return not found', 'NOT_FOUND');
  if (!isEditableStatus(dr.status)) {
    throw validationError('Only draft delivery returns can add lines');
  }

  const resolved = await resolveReturnLineInputs({
    organizationId,
    customerId: dr.customerId,
    payload: {
      ...payload,
      returnReason: payload.returnReason || dr.returnReason || 'customer_rejection'
    }
  });
  const existing = await DeliveryReturnLine.find({ organizationId, deliveryReturnId: id }).lean();
  const existingDnLineIds = new Set(existing.map((l) => String(l.deliveryNoteLineId)));
  const filtered = resolved.filter((r) => !existingDnLineIds.has(String(r.dnLine._id)));
  if (!filtered.length) throw validationError('No new returnable lines to add');

  const maxOrder = existing.reduce((m, l) => Math.max(m, Number(l.lineOrder) || 0), 0);
  const { lineDocs, subtotal: addSub } = await buildDrLineDocs({
    organizationId,
    resolved: filtered,
    headerReturnWarehouseId: dr.returnWarehouseId
  });
  for (let i = 0; i < lineDocs.length; i++) {
    lineDocs[i].deliveryReturnId = dr._id;
    lineDocs[i].lineOrder = maxOrder + i + 1;
  }
  await DeliveryReturnLine.insertMany(lineDocs);
  dr.subtotal = Number(dr.subtotal || 0) + addSub;
  dr.grandTotal = Number(dr.subtotal) + Number(dr.taxTotal || 0) + Number(dr.chargesTotal || 0);
  dr.modifiedBy = userId;
  await dr.save();
  return getDeliveryReturn({ organizationId, id });
}

async function assertHasLines(organizationId, id) {
  const lineCount = await DeliveryReturnLine.countDocuments({
    organizationId,
    deliveryReturnId: id
  });
  if (!lineCount) throw validationError('Delivery return has no lines');
}

/**
 * Post inventory restore + DN/Invoice/SO qty updates. Idempotent via inventoryPostedAt.
 */
async function postInventoryIfNeeded({ organizationId, userId, dr, lines, targetStatus }) {
  const postAt = normalizeInventoryPostStatus(
    dr.inventoryPostStatus || DR_DEFAULT_INVENTORY_POST_STATUS
  );
  if (String(targetStatus) !== postAt) return false;
  if (dr.inventoryPostedAt) return true;

  // Re-validate returnable against live DN state
  const { DeliveryNoteLine } = getDnModels();
  for (const line of lines) {
    const dnLine = await DeliveryNoteLine.findOne({
      _id: line.deliveryNoteLineId,
      organizationId
    }).lean();
    if (!dnLine) throw validationError('Source delivery note line missing');
    const returnable = returnableQtyFromDnLine(dnLine);
    if (Number(line.quantityReturned) > returnable) {
      throw validationError(
        `Return quantity exceeds available for ${line.itemNameSnapshot || line.skuSnapshot || 'line'}`
      );
    }
  }

  // Restock only good-condition lines
  const restoreLines = lines.filter(
    (l) => String(l.returnCondition || 'good').toLowerCase() === 'good'
  );

  if (restoreLines.length) {
    const byLocation = new Map();
    for (const line of restoreLines) {
      const loc = String(line.inventoryLocationId);
      if (!byLocation.has(loc)) byLocation.set(loc, []);
      byLocation.get(loc).push({
        variantId: line.variantId,
        quantityDelta: Number(line.quantityReturned),
        entryType: 'fulfillment_restore',
        unitCostSnapshot: line.unitPrice,
        lineId: String(line._id),
        sourceRef: {
          moduleKey: 'delivery_returns',
          recordId: String(dr._id),
          lineId: String(line._id)
        }
      });
    }

    for (const [loc, invLines] of byLocation.entries()) {
      const locUuid = await resolveInventoryLocationUuid({
        organizationId,
        locationRef: loc
      });
      await postInventoryTransaction({
        organizationId,
        userId,
        transactionType: 'return',
        inventoryLocationId: locUuid,
        lines: invLines,
        sourceContext: 'delivery_return',
        sourceRef: {
          moduleKey: 'delivery_returns',
          recordId: String(dr._id),
          lineId: null
        },
        idempotent: true
      });
    }
  }

  for (const line of lines) {
    await DeliveryNoteLine.updateOne(
      { _id: line.deliveryNoteLineId, organizationId },
      { $inc: { quantityReturned: Number(line.quantityReturned) } }
    );
    if (line.salesOrderLineId) {
      const soLine = await SalesOrderLine.findOne({
        _id: line.salesOrderLineId,
        organizationId
      });
      if (soLine) {
        const qty = Number(line.quantityReturned) || 0;
        soLine.quantityReturned = Number(soLine.quantityReturned || 0) + qty;
        soLine.quantityFulfilled = Math.max(0, Number(soLine.quantityFulfilled || 0) - qty);
        await soLine.save();
      }
    }
    if (line.invoiceLineId) {
      await InvoiceLine.updateOne(
        { _id: line.invoiceLineId, organizationId },
        { $inc: { quantityReturned: Number(line.quantityReturned) } }
      );
    } else if (line.invoiceId && line.variantId) {
      // Best-effort: match invoice line by variant when no explicit link
      await InvoiceLine.updateOne(
        {
          organizationId,
          invoiceId: line.invoiceId,
          variantId: line.variantId
        },
        { $inc: { quantityReturned: Number(line.quantityReturned) } }
      );
    }
  }

  // Customer return statistics (lightweight)
  try {
    await Organization.updateOne(
      { _id: dr.customerId, deletedAt: null },
      {
        $set: {
          'customFields.lastDeliveryReturnDate': dr.returnDate || new Date()
        },
        $inc: { 'customFields.deliveryReturnCount': 1 }
      }
    );
  } catch {
    // non-blocking
  }

  dr.inventoryPostedAt = new Date();
  return true;
}

async function transitionStatus({ organizationId, id, userId, nextStatus, allowedFrom }) {
  const dr = await DeliveryReturn.findOne({ _id: id, organizationId, deletedAt: null });
  if (!dr) throw validationError('Delivery return not found', 'NOT_FOUND');

  if (String(dr.status) === nextStatus && dr.inventoryPostedAt) {
    return getDeliveryReturn({ organizationId, id });
  }

  if (!allowedFrom.includes(String(dr.status))) {
    throw validationError(`Delivery return cannot move to ${nextStatus} from current status`);
  }

  await assertHasLines(organizationId, id);
  const lines = await DeliveryReturnLine.find({ organizationId, deliveryReturnId: id });

  await postInventoryIfNeeded({
    organizationId,
    userId,
    dr,
    lines,
    targetStatus: nextStatus
  });

  dr.status = nextStatus;
  dr.modifiedBy = userId;
  await dr.save();
  return getDeliveryReturn({ organizationId, id });
}

async function approveDeliveryReturn({ organizationId, id, userId }) {
  return transitionStatus({
    organizationId,
    id,
    userId,
    nextStatus: DR_STATUSES.APPROVED,
    allowedFrom: [...DR_APPROVABLE_STATUSES]
  });
}

async function markDeliveryReturnReceived({ organizationId, id, userId }) {
  return transitionStatus({
    organizationId,
    id,
    userId,
    nextStatus: DR_STATUSES.RECEIVED,
    allowedFrom: [...DR_RECEIVABLE_STATUSES]
  });
}

async function markDeliveryReturnInspected({ organizationId, id, userId }) {
  return transitionStatus({
    organizationId,
    id,
    userId,
    nextStatus: DR_STATUSES.INSPECTED,
    allowedFrom: [...DR_INSPECTABLE_STATUSES, ...DR_RECEIVABLE_STATUSES]
  });
}

async function markDeliveryReturnRestocked({ organizationId, id, userId }) {
  return transitionStatus({
    organizationId,
    id,
    userId,
    nextStatus: DR_STATUSES.RESTOCKED,
    allowedFrom: [...DR_RESTOCKABLE_STATUSES]
  });
}

async function cancelDeliveryReturn({ organizationId, id, userId }) {
  const dr = await DeliveryReturn.findOne({ _id: id, organizationId, deletedAt: null });
  if (!dr) throw validationError('Delivery return not found', 'NOT_FOUND');
  if (!DR_CANCELLABLE_STATUSES.includes(String(dr.status))) {
    throw validationError('Only pre-restock delivery returns can be cancelled');
  }
  if (dr.inventoryPostedAt) {
    throw validationError('Cannot cancel after inventory has been posted');
  }
  dr.status = DR_STATUSES.CANCELLED;
  dr.modifiedBy = userId;
  await dr.save();
  return getDeliveryReturn({ organizationId, id });
}

async function duplicateDeliveryReturn({ organizationId, id, userId }) {
  const src = await getDeliveryReturn({ organizationId, id });
  const dr = src.deliveryReturn;
  return createDeliveryReturn({
    organizationId,
    userId,
    payload: {
      subject: dr.subject ? `Copy of ${dr.subject}` : 'Delivery Return',
      customerId: dr.customerId?._id || dr.customerId,
      contactPersonId: dr.contactPersonId?._id || dr.contactPersonId,
      ownerId: userId,
      sourceType: dr.sourceType,
      returnType: dr.returnType,
      returnReason: dr.returnReason,
      customerReference: dr.customerReference,
      returnWarehouseId: dr.returnWarehouseId?._id || dr.returnWarehouseId,
      currency: dr.currency,
      inventoryPostStatus: dr.inventoryPostStatus,
      customerNotes: dr.customerNotes || dr.notes,
      internalNotes: dr.internalNotes,
      lines: (src.lines || []).map((l) => ({
        deliveryNoteLineId: l.deliveryNoteLineId,
        quantityReturned: l.quantityReturned,
        returnReason: l.returnReason,
        returnCondition: l.returnCondition,
        inventoryLocationId: l.inventoryLocationId
      }))
    }
  });
}

async function listDeliveryReturns({
  organizationId,
  limit = 50,
  page = 1,
  status = null,
  search = null,
  sortBy = 'createdAt',
  sortOrder = 'desc'
}) {
  const q = { organizationId, deletedAt: null };
  if (status) {
    const statuses = String(status)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (statuses.length === 1) q.status = statuses[0];
    else if (statuses.length > 1) q.status = { $in: statuses };
  }
  if (search) {
    const re = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    q.$or = [{ deliveryReturnNumber: re }, { subject: re }, { customerReference: re }];
  }

  const sort = { [sortBy || 'createdAt']: String(sortOrder).toLowerCase() === 'asc' ? 1 : -1 };
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));
  const skip = (pageNum - 1) * limitNum;

  const [data, total] = await Promise.all([
    DeliveryReturn.find(q)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .populate({ path: 'customerId', select: 'name' })
      .populate({ path: 'ownerId', select: 'name firstName lastName email' })
      .lean(),
    DeliveryReturn.countDocuments(q)
  ]);

  return {
    data,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum) || 1
    }
  };
}

// ─── Legacy wrappers (old fulfillmentDocsService callers) ───────────────────

async function createDeliveryReturnLegacy({ organizationId, userId, payload }) {
  // Old UI sent deliveryNoteId + lines without subject — synthesize a subject
  const subject =
    String(payload.subject || '').trim() ||
    `Delivery Return — ${new Date().toISOString().slice(0, 10)}`;
  return createDeliveryReturn({
    organizationId,
    userId,
    payload: {
      ...payload,
      subject,
      returnWarehouseId: payload.returnWarehouseId || payload.returnLocationId,
      customerNotes: payload.notes
    }
  });
}

/**
 * Legacy "approve" posted inventory immediately. Map to restock for old callers.
 */
async function approveDeliveryReturnLegacy({ organizationId, id, userId }) {
  return markDeliveryReturnRestocked({ organizationId, id, userId });
}

module.exports = {
  returnableQtyFromDnLine,
  listEligibleReturnSources,
  listDeliveryReturns,
  getDeliveryReturn,
  createDeliveryReturn,
  updateDeliveryReturn,
  updateDeliveryReturnLine,
  deleteDeliveryReturnLine,
  addDeliveryReturnLinesFromSources,
  approveDeliveryReturn,
  markDeliveryReturnReceived,
  markDeliveryReturnInspected,
  markDeliveryReturnRestocked,
  cancelDeliveryReturn,
  duplicateDeliveryReturn,
  createDeliveryReturnLegacy,
  approveDeliveryReturnLegacy,
  DeliveryReturn,
  DeliveryReturnLine
};
