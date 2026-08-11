/**
 * Delivery Note service — outbound fulfillment from Sales Orders or direct.
 * Inventory deducts at configured inventoryPostStatus (default: dispatched).
 */

const { DeliveryNote, DeliveryNoteLine } = require('../models/DeliveryNote');
const SalesOrder = require('../models/SalesOrder');
const SalesOrderLine = require('../models/SalesOrderLine');
const Organization = require('../models/Organization');
const { postInventoryTransaction } = require('./inventoryTransactionService');
const { assertActiveLocation, resolveInventoryLocationUuid } = require('./inventoryLocationService');
const { consumeReservation } = require('./inventoryReservationService');
const { assertNoFulfillmentIssueForSoLine } = require('./inventoryStockIssueGuardService');
const {
  DN_STATUSES,
  DN_SOURCE_TYPES,
  DN_EDITABLE_STATUSES,
  DN_APPROVABLE_STATUSES,
  DN_PICKABLE_STATUSES,
  DN_PACKABLE_STATUSES,
  DN_DISPATCHABLE_STATUSES,
  DN_DELIVERABLE_STATUSES,
  DN_CANCELLABLE_STATUSES,
  DN_DEFAULT_INVENTORY_POST_STATUS,
  DN_INVENTORY_POST_STATUSES,
  DN_DELIVERY_METHODS
} = require('../constants/deliveryNoteLifecycle');

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

async function assertCustomerForDn(organizationId, customerId) {
  if (!customerId) throw validationError('Customer is required');
  const customer = await Organization.findOne({
    _id: customerId,
    deletedAt: null,
    isTenant: { $ne: true }
  })
    .select('_id types participations name email phone billingAddress shippingAddress currency')
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

function normalizeSourceType(raw) {
  const key = String(raw || DN_SOURCE_TYPES.DIRECT)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (key === 'sales_order' || key === 'salesorder' || key === 'so') {
    return DN_SOURCE_TYPES.SALES_ORDER;
  }
  return DN_SOURCE_TYPES.DIRECT;
}

function normalizeInventoryPostStatus(raw) {
  const key = String(raw || DN_DEFAULT_INVENTORY_POST_STATUS).toLowerCase();
  if (DN_INVENTORY_POST_STATUSES.includes(key)) return key;
  return DN_DEFAULT_INVENTORY_POST_STATUS;
}

function normalizeDeliveryMethod(raw) {
  if (raw == null || raw === '') return null;
  const key = String(raw).trim().toLowerCase().replace(/\s+/g, '_');
  if (DN_DELIVERY_METHODS.includes(key)) return key;
  if (key === 'handdelivery' || key === 'hand-delivery') return 'hand_delivery';
  return key;
}

function isEditableStatus(status) {
  return DN_EDITABLE_STATUSES.includes(String(status || '').toLowerCase());
}

function soPendingQty(soLine) {
  const ordered = Number(soLine.quantity) || 0;
  const fulfilled = Number(soLine.quantityFulfilled || soLine.quantityDelivered || 0);
  return Math.max(0, ordered - fulfilled);
}

/**
 * Eligible SO lines for a customer (optional SO id filters).
 */
async function listEligibleDeliverySources({
  organizationId,
  customerId,
  salesOrderIds = null
}) {
  if (!customerId) throw validationError('customerId is required');
  await assertCustomerForDn(organizationId, customerId);

  const soQuery = {
    organizationId,
    deletedAt: null,
    customerId
  };
  if (Array.isArray(salesOrderIds) && salesOrderIds.length) {
    soQuery._id = { $in: salesOrderIds };
  }

  const salesOrders = await SalesOrder.find(soQuery)
    .sort({ createdAt: -1 })
    .select(
      '_id salesOrderNumber orderTitle subject status customerId currency ownerId shipToAddressSnapshot billToAddressSnapshot contactPersonId'
    )
    .lean();
  if (!salesOrders.length) {
    return { salesOrders: [], lines: [] };
  }

  const soIds = salesOrders.map((o) => o._id);
  const soLines = await SalesOrderLine.find({
    organizationId,
    salesOrderId: { $in: soIds }
  }).lean();

  const eligibleLines = [];
  for (const soLine of soLines) {
    const ordered = Number(soLine.quantity) || 0;
    const previouslyDelivered = Number(soLine.quantityFulfilled || soLine.quantityDelivered || 0);
    const available = Math.max(0, ordered - previouslyDelivered);
    if (available <= 0) continue;
    const so = salesOrders.find((o) => String(o._id) === String(soLine.salesOrderId));
    eligibleLines.push({
      ...soLine,
      salesOrderNumber: so?.salesOrderNumber || null,
      quantityOrdered: ordered,
      quantityPreviouslyDelivered: previouslyDelivered,
      quantityAvailable: available,
      unitPrice: Number(soLine.unitPriceSnapshot ?? soLine.unitPrice ?? 0) || 0,
      customerId: so?.customerId || customerId
    });
  }

  const ordersOut = salesOrders
    .map((so) => {
      const lines = eligibleLines.filter((l) => String(l.salesOrderId) === String(so._id));
      if (!lines.length) return null;
      return {
        ...so,
        deliverableLineCount: lines.length,
        deliverableQuantityTotal: lines.reduce(
          (s, l) => s + Number(l.quantityAvailable || 0),
          0
        )
      };
    })
    .filter(Boolean);

  return { salesOrders: ordersOut, lines: eligibleLines };
}

async function resolveDeliveryLineInputs({ organizationId, customerId, payload }) {
  const inputLines = Array.isArray(payload.lines) ? payload.lines : [];
  const salesOrderIds = [
    ...(payload.salesOrderId ? [payload.salesOrderId] : []),
    ...(Array.isArray(payload.salesOrderIds) ? payload.salesOrderIds : [])
  ].filter(Boolean);

  const sourceType = normalizeSourceType(
    payload.sourceType ||
      (salesOrderIds.length || inputLines.some((l) => l.salesOrderLineId)
        ? DN_SOURCE_TYPES.SALES_ORDER
        : DN_SOURCE_TYPES.DIRECT)
  );

  if (sourceType === DN_SOURCE_TYPES.DIRECT) {
    if (!inputLines.length) {
      // Header-only create allowed (add lines later)
      return { sourceType, resolved: [] };
    }
    return {
      sourceType,
      resolved: inputLines.map((row) => {
        if (!row.variantId) throw validationError('variantId is required on direct delivery lines');
        const qty = Number(row.quantityDelivered ?? row.quantity ?? 0);
        if (!Number.isFinite(qty) || qty <= 0) {
          throw validationError('quantityDelivered must be > 0');
        }
        return {
          mode: 'direct',
          soLine: null,
          variantId: row.variantId,
          skuSnapshot: row.skuSnapshot || null,
          itemNameSnapshot: row.itemNameSnapshot || null,
          quantityOrdered: qty,
          quantityPreviouslyDelivered: 0,
          quantityAvailable: qty,
          quantityDelivered: qty,
          unitOfMeasure: row.unitOfMeasure || null,
          unitPrice: Number(row.unitPrice || 0) || 0,
          discountType: row.discountType || null,
          discountValue: Number(row.discountValue || 0) || 0,
          taxSnapshot: row.taxSnapshot || {},
          chargeSnapshot: row.chargeSnapshot || {},
          inventoryLocationId: row.inventoryLocationId || null,
          lineRemarks: row.lineRemarks || null
        };
      })
    };
  }

  // Sales-order source: explicit lines and/or SO selection
  const { lines: eligible } = await listEligibleDeliverySources({
    organizationId,
    customerId,
    salesOrderIds: salesOrderIds.length ? salesOrderIds : null
  });
  const bySoLineId = new Map(eligible.map((l) => [String(l._id), l]));

  if (inputLines.length) {
    return {
      sourceType,
      resolved: inputLines.map((row) => {
        const soLineId = row.salesOrderLineId || row._id;
        const soLine = bySoLineId.get(String(soLineId));
        if (!soLine) {
          throw validationError('Invalid or non-deliverable salesOrderLineId');
        }
        const available = soPendingQty(soLine);
        const qty =
          row.quantityDelivered != null
            ? Number(row.quantityDelivered)
            : available;
        return {
          mode: 'sales_order',
          soLine,
          quantityDelivered: qty,
          inventoryLocationId: row.inventoryLocationId || null,
          unitPrice: row.unitPrice != null ? Number(row.unitPrice) : null,
          lineRemarks: row.lineRemarks || null
        };
      })
    };
  }

  if (!salesOrderIds.length) {
    return { sourceType, resolved: [] };
  }

  return {
    sourceType,
    resolved: eligible.map((soLine) => ({
      mode: 'sales_order',
      soLine,
      quantityDelivered: soPendingQty(soLine),
      inventoryLocationId: null,
      unitPrice: null,
      lineRemarks: null
    }))
  };
}

async function buildDnLineDocs({
  organizationId,
  resolved,
  headerWarehouseId
}) {
  let subtotal = 0;
  const lineDocs = [];
  let order = 1;

  for (const row of resolved) {
    if (row.mode === 'direct') {
      const qty = Number(row.quantityDelivered);
      if (!Number.isFinite(qty) || qty <= 0) throw validationError('quantityDelivered must be > 0');
      const unitPrice = Number(row.unitPrice) || 0;
      const lineSubtotal = qty * unitPrice;
      subtotal += lineSubtotal;
      const locationId = row.inventoryLocationId || headerWarehouseId;
      if (!locationId) throw validationError('inventoryLocationId is required on delivery lines');
      await assertActiveLocation({ organizationId, inventoryLocationId: locationId });

      lineDocs.push({
        organizationId,
        lineOrder: order++,
        salesOrderId: null,
        salesOrderLineId: null,
        variantId: row.variantId,
        skuSnapshot: row.skuSnapshot,
        itemNameSnapshot: row.itemNameSnapshot,
        quantityOrdered: qty,
        quantityPreviouslyDelivered: 0,
        quantityAvailable: qty,
        quantityDelivered: qty,
        quantityPending: 0,
        unitOfMeasure: row.unitOfMeasure,
        unitPrice,
        discountType: row.discountType,
        discountValue: row.discountValue,
        taxSnapshot: row.taxSnapshot || {},
        chargeSnapshot: row.chargeSnapshot || {},
        lineSubtotal,
        lineTaxTotal: 0,
        lineTotal: lineSubtotal,
        inventoryLocationId: locationId,
        lineRemarks: row.lineRemarks || null
      });
      continue;
    }

    const soLine = row.soLine;
    const ordered = Number(soLine.quantity) || 0;
    const previouslyDelivered = Number(
      soLine.quantityFulfilled || soLine.quantityDelivered || 0
    );
    const available = Math.max(0, ordered - previouslyDelivered);
    const qty = Number(row.quantityDelivered);
    if (!Number.isFinite(qty) || qty <= 0) throw validationError('quantityDelivered must be > 0');
    if (qty > available) {
      throw validationError(
        `Cannot deliver more than available quantity for line (${qty} > ${available})`
      );
    }
    const unitPrice =
      row.unitPrice != null && Number.isFinite(Number(row.unitPrice))
        ? Number(row.unitPrice)
        : Number(soLine.unitPriceSnapshot ?? soLine.unitPrice ?? 0) || 0;
    const lineSubtotal = qty * unitPrice;
    subtotal += lineSubtotal;
    const locationId = row.inventoryLocationId || headerWarehouseId;
    if (!locationId) throw validationError('inventoryLocationId is required on delivery lines');
    await assertActiveLocation({ organizationId, inventoryLocationId: locationId });

    lineDocs.push({
      organizationId,
      lineOrder: order++,
      salesOrderId: soLine.salesOrderId,
      salesOrderLineId: soLine._id,
      variantId: soLine.variantId,
      skuSnapshot: soLine.skuSnapshot,
      itemNameSnapshot: soLine.itemNameSnapshot,
      quantityOrdered: ordered,
      quantityPreviouslyDelivered: previouslyDelivered,
      quantityAvailable: available,
      quantityDelivered: qty,
      quantityPending: available - qty,
      unitOfMeasure: soLine.unitOfMeasure,
      unitPrice,
      discountType: soLine.discountType || null,
      discountValue: Number(soLine.discountValue || 0) || 0,
      taxSnapshot: soLine.taxSnapshot || {},
      chargeSnapshot: soLine.chargeSnapshot || {},
      lineSubtotal,
      lineTaxTotal: 0,
      lineTotal: lineSubtotal,
      inventoryLocationId: locationId,
      lineRemarks: row.lineRemarks || null
    });
  }

  return { lineDocs, subtotal };
}

async function getDeliveryNote({ organizationId, id }) {
  const deliveryNote = await DeliveryNote.findOne({
    _id: id,
    organizationId,
    deletedAt: null
  })
    .populate({ path: 'customerId', select: 'name email phone types participations' })
    .populate({ path: 'contactPersonId', select: 'firstName lastName email phone name' })
    .populate({ path: 'ownerId', select: 'name firstName lastName email' })
    .populate({ path: 'warehouseId', select: 'name locationCode inventoryLocationId' })
    .populate({ path: 'salesOrderId', select: 'salesOrderNumber orderTitle subject status' })
    .populate({ path: 'createdBy', select: 'name firstName lastName email' })
    .populate({ path: 'modifiedBy', select: 'name firstName lastName email' })
    .lean();
  if (!deliveryNote) throw validationError('Delivery note not found', 'NOT_FOUND');
  const lines = await DeliveryNoteLine.find({ organizationId, deliveryNoteId: id })
    .sort({ lineOrder: 1 })
    .lean();
  return { deliveryNote, lines };
}

async function createDeliveryNote({ organizationId, userId, payload }) {
  let customerId = payload.customerId || null;
  const soIdsInput = [
    ...(payload.salesOrderId ? [payload.salesOrderId] : []),
    ...(Array.isArray(payload.salesOrderIds) ? payload.salesOrderIds : [])
  ].filter(Boolean);

  let seedOrder = null;
  if (!customerId && soIdsInput.length) {
    seedOrder = await SalesOrder.findOne({
      _id: soIdsInput[0],
      organizationId,
      deletedAt: null
    }).lean();
    if (!seedOrder) throw validationError('Sales order not found', 'NOT_FOUND');
    customerId = seedOrder.customerId;
  }
  if (!customerId) throw validationError('customerId is required');
  const customer = await assertCustomerForDn(organizationId, customerId);

  const subject = String(payload.subject || '').trim();
  if (!subject) throw validationError('subject is required');

  const warehouseId = payload.warehouseId || payload.inventoryLocationId || null;
  if (warehouseId) {
    await assertActiveLocation({ organizationId, inventoryLocationId: warehouseId });
  }

  const { sourceType, resolved } = await resolveDeliveryLineInputs({
    organizationId,
    customerId,
    payload: { ...payload, salesOrderIds: soIdsInput }
  });

  if (sourceType === DN_SOURCE_TYPES.SALES_ORDER && soIdsInput.length) {
    const orders = await SalesOrder.find({
      organizationId,
      _id: { $in: soIdsInput },
      deletedAt: null
    })
      .select('_id customerId')
      .lean();
    if (orders.length !== soIdsInput.length) {
      throw validationError('One or more sales orders not found');
    }
    for (const o of orders) {
      if (String(o.customerId) !== String(customerId)) {
        throw validationError('All sales orders must belong to the same customer');
      }
    }
  }

  let lineDocs = [];
  let subtotal = 0;
  if (resolved.length) {
    const built = await buildDnLineDocs({
      organizationId,
      resolved,
      headerWarehouseId: warehouseId
    });
    lineDocs = built.lineDocs;
    subtotal = built.subtotal;
  }

  const soIdsFromLines = [
    ...new Set(
      lineDocs.map((l) => (l.salesOrderId ? String(l.salesOrderId) : null)).filter(Boolean)
    )
  ];
  const salesOrderIds = soIdsFromLines.length
    ? soIdsFromLines
    : soIdsInput.map(String);

  if (!seedOrder && salesOrderIds.length) {
    seedOrder = await SalesOrder.findOne({
      _id: salesOrderIds[0],
      organizationId,
      deletedAt: null
    }).lean();
  }

  const deliveryNoteNumber = await nextDocNumber(organizationId, 'delivery_notes', 'DN');

  const dn = await DeliveryNote.create({
    organizationId,
    deliveryNoteNumber,
    subject,
    deliveryDate: payload.deliveryDate || new Date(),
    customerId,
    contactPersonId:
      payload.contactPersonId || seedOrder?.contactPersonId || null,
    ownerId: payload.ownerId || seedOrder?.ownerId || userId,
    sourceType,
    salesOrderId: salesOrderIds.length ? salesOrderIds[0] : null,
    salesOrderIds,
    invoiceId: payload.invoiceId || null,
    warehouseId,
    deliveryMethod: normalizeDeliveryMethod(payload.deliveryMethod),
    carrier: payload.carrier || null,
    trackingNumber: payload.trackingNumber || null,
    vehicleNumber: payload.vehicleNumber || null,
    driverDetails: payload.driverDetails || null,
    dispatchDate: payload.dispatchDate || null,
    expectedDeliveryDate: payload.expectedDeliveryDate || null,
    deliveryInstructions: payload.deliveryInstructions || null,
    deliveryAddress:
      payload.deliveryAddress ||
      payload.shippingAddress ||
      seedOrder?.shipToAddressSnapshot ||
      customer.shippingAddress ||
      null,
    contactPerson: payload.contactPerson || null,
    billingAddress:
      payload.billingAddress || seedOrder?.billToAddressSnapshot || customer.billingAddress || null,
    shippingAddress:
      payload.shippingAddress ||
      seedOrder?.shipToAddressSnapshot ||
      customer.shippingAddress ||
      null,
    email: payload.email || customer.email || null,
    mobile: payload.mobile || customer.phone || null,
    currency: payload.currency || seedOrder?.currency || customer.currency || 'USD',
    status: DN_STATUSES.DRAFT,
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
    for (const ld of lineDocs) ld.deliveryNoteId = dn._id;
    await DeliveryNoteLine.insertMany(lineDocs);
  }

  return getDeliveryNote({ organizationId, id: dn._id });
}

/**
 * Legacy MVP create: { salesOrderId, inventoryLocationId, lines? }.
 */
async function createDeliveryNoteLegacy({ organizationId, userId, payload }) {
  const salesOrderId = payload.salesOrderId;
  if (!salesOrderId) throw validationError('salesOrderId is required');
  const order = await SalesOrder.findOne({
    _id: salesOrderId,
    organizationId,
    deletedAt: null
  }).lean();
  if (!order) throw validationError('Sales order not found', 'NOT_FOUND');

  const subject =
    String(payload.subject || '').trim() ||
    `Delivery — ${order.salesOrderNumber || salesOrderId}`;

  return createDeliveryNote({
    organizationId,
    userId,
    payload: {
      ...payload,
      subject,
      customerId: order.customerId || payload.customerId,
      sourceType: DN_SOURCE_TYPES.SALES_ORDER,
      salesOrderId,
      salesOrderIds: [salesOrderId],
      warehouseId: payload.warehouseId || payload.inventoryLocationId,
      customerNotes: payload.notes
    }
  });
}

async function updateDeliveryNote({ organizationId, id, userId, payload }) {
  const dn = await DeliveryNote.findOne({ _id: id, organizationId, deletedAt: null });
  if (!dn) throw validationError('Delivery note not found', 'NOT_FOUND');
  if (!isEditableStatus(dn.status)) {
    throw validationError('Only draft delivery notes can be edited');
  }

  const allowed = [
    'subject',
    'deliveryDate',
    'contactPersonId',
    'ownerId',
    'warehouseId',
    'deliveryMethod',
    'carrier',
    'trackingNumber',
    'vehicleNumber',
    'driverDetails',
    'dispatchDate',
    'expectedDeliveryDate',
    'deliveryInstructions',
    'deliveryAddress',
    'contactPerson',
    'billingAddress',
    'shippingAddress',
    'email',
    'mobile',
    'currency',
    'customerNotes',
    'internalNotes',
    'notes',
    'inventoryPostStatus',
    'sourceType'
  ];
  for (const key of allowed) {
    if (payload[key] === undefined) continue;
    if (key === 'sourceType') {
      dn.sourceType = normalizeSourceType(payload.sourceType);
    } else if (key === 'inventoryPostStatus') {
      dn.inventoryPostStatus = normalizeInventoryPostStatus(payload.inventoryPostStatus);
    } else if (key === 'deliveryMethod') {
      dn.deliveryMethod = normalizeDeliveryMethod(payload.deliveryMethod);
    } else if (key === 'warehouseId' && payload.warehouseId) {
      await assertActiveLocation({
        organizationId,
        inventoryLocationId: payload.warehouseId
      });
      dn.warehouseId = payload.warehouseId;
    } else {
      dn[key] = payload[key];
    }
  }
  if (payload.subject !== undefined && !String(payload.subject || '').trim()) {
    throw validationError('subject is required');
  }
  dn.modifiedBy = userId;
  await dn.save();
  return getDeliveryNote({ organizationId, id });
}

async function recomputeHeaderTotals(organizationId, id, userId) {
  const dn = await DeliveryNote.findOne({ _id: id, organizationId, deletedAt: null });
  if (!dn) throw validationError('Delivery note not found', 'NOT_FOUND');
  const allLines = await DeliveryNoteLine.find({ organizationId, deliveryNoteId: id }).lean();
  const subtotal = allLines.reduce((s, l) => s + Number(l.lineTotal || 0), 0);
  dn.subtotal = subtotal;
  dn.grandTotal = subtotal + Number(dn.taxTotal || 0) + Number(dn.chargesTotal || 0);
  dn.modifiedBy = userId;
  await dn.save();
  return getDeliveryNote({ organizationId, id });
}

async function updateDeliveryNoteLine({ organizationId, id, lineId, userId, payload }) {
  const dn = await DeliveryNote.findOne({ _id: id, organizationId, deletedAt: null });
  if (!dn) throw validationError('Delivery note not found', 'NOT_FOUND');
  if (!isEditableStatus(dn.status)) {
    throw validationError('Only draft delivery notes can edit lines');
  }
  const line = await DeliveryNoteLine.findOne({
    _id: lineId,
    organizationId,
    deliveryNoteId: id
  });
  if (!line) throw validationError('Delivery note line not found', 'NOT_FOUND');

  if (payload.quantityDelivered !== undefined) {
    const qty = Number(payload.quantityDelivered);
    if (!Number.isFinite(qty) || qty <= 0) throw validationError('quantityDelivered must be > 0');
    if (line.salesOrderLineId) {
      const soLine = await SalesOrderLine.findOne({
        _id: line.salesOrderLineId,
        organizationId
      }).lean();
      if (!soLine) throw validationError('Source sales order line not found', 'NOT_FOUND');
      const available = soPendingQty(soLine);
      if (qty > available) {
        throw validationError('Cannot deliver more than available quantity');
      }
      line.quantityPreviouslyDelivered = Number(
        soLine.quantityFulfilled || soLine.quantityDelivered || 0
      );
      line.quantityOrdered = Number(soLine.quantity) || 0;
      line.quantityAvailable = available;
      line.quantityPending = available - qty;
    }
    line.quantityDelivered = qty;
    line.lineSubtotal = qty * Number(line.unitPrice || 0);
    line.lineTotal = line.lineSubtotal;
  }
  if (payload.unitPrice !== undefined) {
    line.unitPrice = Number(payload.unitPrice) || 0;
    line.lineSubtotal = Number(line.quantityDelivered) * Number(line.unitPrice);
    line.lineTotal = line.lineSubtotal;
  }
  if (payload.inventoryLocationId !== undefined) {
    await assertActiveLocation({
      organizationId,
      inventoryLocationId: payload.inventoryLocationId
    });
    line.inventoryLocationId = payload.inventoryLocationId;
  }
  if (payload.lineRemarks !== undefined) line.lineRemarks = payload.lineRemarks;
  await line.save();
  return recomputeHeaderTotals(organizationId, id, userId);
}

async function deleteDeliveryNoteLine({ organizationId, id, lineId, userId }) {
  const dn = await DeliveryNote.findOne({ _id: id, organizationId, deletedAt: null });
  if (!dn) throw validationError('Delivery note not found', 'NOT_FOUND');
  if (!isEditableStatus(dn.status)) {
    throw validationError('Only draft delivery notes can remove lines');
  }
  const result = await DeliveryNoteLine.deleteOne({
    _id: lineId,
    organizationId,
    deliveryNoteId: id
  });
  if (!result.deletedCount) throw validationError('Delivery note line not found', 'NOT_FOUND');
  return recomputeHeaderTotals(organizationId, id, userId);
}

async function addDeliveryNoteLinesFromSources({ organizationId, id, userId, payload }) {
  const dn = await DeliveryNote.findOne({ _id: id, organizationId, deletedAt: null });
  if (!dn) throw validationError('Delivery note not found', 'NOT_FOUND');
  if (!isEditableStatus(dn.status)) {
    throw validationError('Only draft delivery notes can add lines');
  }

  const { sourceType, resolved } = await resolveDeliveryLineInputs({
    organizationId,
    customerId: dn.customerId,
    payload: {
      ...payload,
      sourceType: payload.sourceType || DN_SOURCE_TYPES.SALES_ORDER
    }
  });
  if (!resolved.length) throw validationError('No deliverable quantities for selected sources');

  const existing = await DeliveryNoteLine.find({ organizationId, deliveryNoteId: id }).lean();
  const existingSoLineIds = new Set(
    existing.map((l) => (l.salesOrderLineId ? String(l.salesOrderLineId) : null)).filter(Boolean)
  );
  const filtered = resolved.filter((r) => {
    if (r.mode !== 'sales_order') return true;
    return !existingSoLineIds.has(String(r.soLine._id));
  });
  if (!filtered.length) throw validationError('No new deliverable lines to add');

  const maxOrder = existing.reduce((m, l) => Math.max(m, Number(l.lineOrder) || 0), 0);
  const { lineDocs, subtotal: addSub } = await buildDnLineDocs({
    organizationId,
    resolved: filtered,
    headerWarehouseId: dn.warehouseId
  });
  for (let i = 0; i < lineDocs.length; i++) {
    lineDocs[i].deliveryNoteId = dn._id;
    lineDocs[i].lineOrder = maxOrder + i + 1;
  }
  await DeliveryNoteLine.insertMany(lineDocs);

  const newSoIds = lineDocs
    .map((l) => (l.salesOrderId ? String(l.salesOrderId) : null))
    .filter(Boolean);
  const mergedSo = [
    ...new Set([...(dn.salesOrderIds || []).map(String), ...newSoIds, String(dn.salesOrderId || '')].filter(Boolean))
  ];
  dn.salesOrderIds = mergedSo;
  if (!dn.salesOrderId && mergedSo.length) dn.salesOrderId = mergedSo[0];
  dn.sourceType = sourceType;
  dn.subtotal = Number(dn.subtotal || 0) + addSub;
  dn.grandTotal = Number(dn.subtotal) + Number(dn.taxTotal || 0) + Number(dn.chargesTotal || 0);
  dn.modifiedBy = userId;
  await dn.save();
  return getDeliveryNote({ organizationId, id });
}

async function assertHasLines(organizationId, id) {
  const lineCount = await DeliveryNoteLine.countDocuments({
    organizationId,
    deliveryNoteId: id
  });
  if (!lineCount) throw validationError('Delivery note has no lines');
}

/**
 * Post inventory deduct + SO qty updates. Idempotent via inventoryPostedAt.
 */
async function postInventoryIfNeeded({ organizationId, userId, dn, lines, targetStatus }) {
  const postAt = normalizeInventoryPostStatus(
    dn.inventoryPostStatus || DN_DEFAULT_INVENTORY_POST_STATUS
  );
  if (String(targetStatus) !== postAt) return false;
  if (dn.inventoryPostedAt) return true;

  for (const line of lines) {
    if (line.salesOrderLineId) {
      await assertNoFulfillmentIssueForSoLine({
        organizationId,
        salesOrderLineId: line.salesOrderLineId
      });
      const soLine = await SalesOrderLine.findOne({
        _id: line.salesOrderLineId,
        organizationId
      }).lean();
      if (!soLine) throw validationError('Source sales order line missing');
      const available = soPendingQty(soLine);
      if (Number(line.quantityDelivered) > available) {
        throw validationError(
          `Deliver quantity exceeds available for ${line.itemNameSnapshot || line.skuSnapshot || 'line'}`
        );
      }
    }
  }

  const byLoc = new Map();
  for (const line of lines) {
    const locUuid = await resolveInventoryLocationUuid({
      organizationId,
      locationRef: line.inventoryLocationId
    });
    if (!byLoc.has(locUuid)) byLoc.set(locUuid, []);
    byLoc.get(locUuid).push({
      variantId: line.variantId,
      quantityDelta: -Number(line.quantityDelivered),
      entryType: 'fulfillment_deduct',
      lineId: String(line._id),
      sourceRef: {
        moduleKey: 'delivery_notes',
        recordId: String(dn._id),
        lineId: String(line._id)
      },
      _salesOrderLineId: line.salesOrderLineId,
      _qty: Number(line.quantityDelivered)
    });
  }

  for (const [loc, invLines] of byLoc) {
    const result = await postInventoryTransaction({
      organizationId,
      userId,
      transactionType: 'shipment',
      inventoryLocationId: loc,
      lines: invLines.map(({ _salesOrderLineId, _qty, ...rest }) => rest),
      sourceContext: 'delivery_note',
      sourceRef: { moduleKey: 'delivery_notes', recordId: String(dn._id), lineId: null },
      idempotent: true
    });

    if (!result.duplicate) {
      for (let i = 0; i < invLines.length; i += 1) {
        const meta = invLines[i];
        if (!meta._salesOrderLineId) continue;
        const ledgerEntryId = result.ledgerEntries?.[i]?.inventoryLedgerEntryId || null;
        await consumeReservation({
          organizationId,
          salesOrderLineId: meta._salesOrderLineId,
          variantId: meta.variantId,
          inventoryLocationId: loc,
          quantity: meta._qty,
          userId,
          ledgerEntryId
        });
      }
    }
  }

  for (const line of lines) {
    if (!line.salesOrderLineId) continue;
    await SalesOrderLine.updateOne(
      { _id: line.salesOrderLineId, organizationId },
      { $inc: { quantityFulfilled: Number(line.quantityDelivered) } }
    );
  }

  dn.inventoryPostedAt = new Date();
  if (!dn.dispatchDate && String(targetStatus) === DN_STATUSES.DISPATCHED) {
    dn.dispatchDate = new Date();
  }

  try {
    const { enqueueAfterDnConfirm } = require('./connectors/tally/tallyOutboxHooks');
    await enqueueAfterDnConfirm({ organizationId, deliveryNote: dn.toObject ? dn.toObject() : dn });
  } catch {
    // Non-blocking
  }

  return true;
}

async function transitionStatus({ organizationId, id, userId, nextStatus, allowedFrom }) {
  const dn = await DeliveryNote.findOne({ _id: id, organizationId, deletedAt: null });
  if (!dn) throw validationError('Delivery note not found', 'NOT_FOUND');

  if (String(dn.status) === nextStatus && dn.inventoryPostedAt) {
    return getDeliveryNote({ organizationId, id });
  }

  if (!allowedFrom.includes(String(dn.status))) {
    throw validationError(`Delivery note cannot move to ${nextStatus} from current status`);
  }

  await assertHasLines(organizationId, id);
  const lines = await DeliveryNoteLine.find({ organizationId, deliveryNoteId: id });

  await postInventoryIfNeeded({
    organizationId,
    userId,
    dn,
    lines,
    targetStatus: nextStatus
  });

  dn.status = nextStatus;
  dn.modifiedBy = userId;
  await dn.save();
  return getDeliveryNote({ organizationId, id });
}

async function approveDeliveryNote(args) {
  return transitionStatus({
    ...args,
    nextStatus: DN_STATUSES.APPROVED,
    allowedFrom: [...DN_APPROVABLE_STATUSES]
  });
}

async function markDeliveryNotePicked(args) {
  return transitionStatus({
    ...args,
    nextStatus: DN_STATUSES.PICKED,
    allowedFrom: [...DN_PICKABLE_STATUSES]
  });
}

async function markDeliveryNotePacked(args) {
  return transitionStatus({
    ...args,
    nextStatus: DN_STATUSES.PACKED,
    allowedFrom: [...DN_PACKABLE_STATUSES]
  });
}

async function markDeliveryNoteDispatched(args) {
  return transitionStatus({
    ...args,
    nextStatus: DN_STATUSES.DISPATCHED,
    allowedFrom: [...DN_DISPATCHABLE_STATUSES]
  });
}

async function markDeliveryNoteDelivered(args) {
  return transitionStatus({
    ...args,
    nextStatus: DN_STATUSES.DELIVERED,
    allowedFrom: [...DN_DELIVERABLE_STATUSES]
  });
}

/**
 * Legacy confirm: jump to configured inventory post status (default dispatched).
 */
async function confirmDeliveryNote({ organizationId, id, userId }) {
  const dn = await DeliveryNote.findOne({ _id: id, organizationId, deletedAt: null });
  if (!dn) throw validationError('Delivery note not found', 'NOT_FOUND');
  if (!['draft', 'ready_for_dispatch', 'approved', 'picked', 'packed'].includes(String(dn.status))) {
    throw validationError('Delivery note cannot be confirmed');
  }
  const target = normalizeInventoryPostStatus(dn.inventoryPostStatus);
  return transitionStatus({
    organizationId,
    id,
    userId,
    nextStatus: target,
    allowedFrom: [
      DN_STATUSES.DRAFT,
      DN_STATUSES.READY_FOR_DISPATCH,
      DN_STATUSES.APPROVED,
      DN_STATUSES.PICKED,
      DN_STATUSES.PACKED
    ]
  });
}

async function cancelDeliveryNote({ organizationId, id, userId }) {
  const dn = await DeliveryNote.findOne({ _id: id, organizationId, deletedAt: null });
  if (!dn) throw validationError('Delivery note not found', 'NOT_FOUND');
  if (!DN_CANCELLABLE_STATUSES.includes(String(dn.status))) {
    throw validationError('Only pre-dispatch delivery notes can be cancelled');
  }
  if (dn.inventoryPostedAt) {
    throw validationError('Cannot cancel after inventory has been posted');
  }
  dn.status = DN_STATUSES.CANCELLED;
  dn.modifiedBy = userId;
  await dn.save();
  return getDeliveryNote({ organizationId, id });
}

async function duplicateDeliveryNote({ organizationId, id, userId }) {
  const src = await getDeliveryNote({ organizationId, id });
  const dn = src.deliveryNote;
  return createDeliveryNote({
    organizationId,
    userId,
    payload: {
      subject: dn.subject ? `Copy of ${dn.subject}` : 'Delivery Note',
      customerId: dn.customerId?._id || dn.customerId,
      contactPersonId: dn.contactPersonId?._id || dn.contactPersonId,
      ownerId: userId,
      sourceType: dn.sourceType,
      salesOrderId: dn.salesOrderId?._id || dn.salesOrderId,
      salesOrderIds: dn.salesOrderIds || [],
      warehouseId: dn.warehouseId?._id || dn.warehouseId,
      currency: dn.currency,
      inventoryPostStatus: dn.inventoryPostStatus,
      deliveryMethod: dn.deliveryMethod,
      customerNotes: dn.customerNotes || dn.notes,
      internalNotes: dn.internalNotes,
      lines: (src.lines || []).map((l) =>
        l.salesOrderLineId
          ? {
              salesOrderLineId: l.salesOrderLineId,
              quantityDelivered: l.quantityDelivered,
              inventoryLocationId: l.inventoryLocationId,
              unitPrice: l.unitPrice
            }
          : {
              variantId: l.variantId,
              quantityDelivered: l.quantityDelivered,
              inventoryLocationId: l.inventoryLocationId,
              unitPrice: l.unitPrice,
              skuSnapshot: l.skuSnapshot,
              itemNameSnapshot: l.itemNameSnapshot
            }
      )
    }
  });
}

async function listDeliveryNotes({
  organizationId,
  limit = 50,
  page = 1,
  status = null,
  search = null,
  salesOrderId = null,
  sortBy = 'createdAt',
  sortOrder = 'desc'
}) {
  const q = { organizationId, deletedAt: null };
  if (salesOrderId) {
    q.$or = [{ salesOrderId }, { salesOrderIds: salesOrderId }];
  }
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
    const searchOr = [
      { deliveryNoteNumber: re },
      { subject: re },
      { trackingNumber: re }
    ];
    if (q.$or) {
      q.$and = [{ $or: q.$or }, { $or: searchOr }];
      delete q.$or;
    } else {
      q.$or = searchOr;
    }
  }

  const sort = { [sortBy || 'createdAt']: String(sortOrder).toLowerCase() === 'asc' ? 1 : -1 };
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));
  const skip = (pageNum - 1) * limitNum;

  const [data, total] = await Promise.all([
    DeliveryNote.find(q)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .populate({ path: 'customerId', select: 'name' })
      .populate({ path: 'ownerId', select: 'name firstName lastName email' })
      .lean(),
    DeliveryNote.countDocuments(q)
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

module.exports = {
  listEligibleDeliverySources,
  listDeliveryNotes,
  getDeliveryNote,
  createDeliveryNote,
  createDeliveryNoteLegacy,
  updateDeliveryNote,
  updateDeliveryNoteLine,
  deleteDeliveryNoteLine,
  addDeliveryNoteLinesFromSources,
  approveDeliveryNote,
  markDeliveryNotePicked,
  markDeliveryNotePacked,
  markDeliveryNoteDispatched,
  markDeliveryNoteDelivered,
  confirmDeliveryNote,
  cancelDeliveryNote,
  duplicateDeliveryNote,
  DeliveryNote,
  DeliveryNoteLine
};
