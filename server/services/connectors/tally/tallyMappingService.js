'use strict';

/**
 * Tally Mapping Center — accept / link / ignore / create + system deny-list + auto-match.
 */

const ConnectorExternalObject = require('../../../models/ConnectorExternalObject');
const Organization = require('../../../models/Organization');
const Item = require('../../../models/Item');
const ItemVariant = require('../../../models/ItemVariant');
const InventoryLocation = require('../../../models/InventoryLocation');
const Invoice = require('../../../models/Invoice');
const InventoryAdjustment = require('../../../models/InventoryAdjustment');
const { CONNECTOR_KEYS, CONNECTOR_DIRECTIONS } = require('../connectorConstants');
const partyMapper = require('./mappers/partyMapper');
const stockItemMapper = require('./mappers/stockItemMapper');
const godownMapper = require('./mappers/godownMapper');
const { TALLY_DEFAULT_SETTINGS } = require('../../../constants/tallyAddonConstants');
const { INVOICE_STATUS_DEFAULT } = require('../../../constants/invoiceLifecycle');
const { ensureDefaultInvoiceSection } = require('../../invoiceSectionService');

const SYSTEM_LEDGER_NAMES = new Set(
  [
    'profit & loss a/c',
    'profit and loss a/c',
    'cash',
    'cash-in-hand',
    'bank accounts',
    'primary',
    'sales accounts',
    'purchase accounts',
    'duties & taxes',
    'current assets',
    'current liabilities',
    'branch / divisions',
    'capital account',
    'suspense a/c',
  ].map((s) => s.toLowerCase())
);

const IGNORE_ENTITY_TYPES = new Set([
  'voucher_type',
  'tax_unit',
  'cost_category',
  'cost_centre',
  'currency',
  'attendance_type',
  'gst_classification',
  'group',
  'unit',
  'stock_group',
  'stock_category',
  'batch',
]);

function normalizeName(value) {
  return String(value || '')
    .replace(/^\.\s*/, '')
    .trim()
    .toLowerCase();
}

function isSystemLedgerName(name) {
  const n = normalizeName(name);
  if (!n) return false;
  if (SYSTEM_LEDGER_NAMES.has(n)) return true;
  if (n.startsWith('primary cost')) return true;
  if (n.includes('profit & loss') || n.includes('profit and loss')) return true;
  return false;
}

function shouldAutoIgnore({ entityType, name }) {
  const et = String(entityType || '').toLowerCase();
  if (IGNORE_ENTITY_TYPES.has(et)) return true;
  if ((et === 'party' || et === 'ledger') && isSystemLedgerName(name)) return true;
  return false;
}

function mappingStatusOf(row) {
  if (!row) return 'unknown';
  if (row.metadata?.ignored) return 'ignored';
  if (String(row.arivuId || '').startsWith('pending:')) return 'pending';
  return 'linked';
}

function displayNameFromRow(row) {
  const p = row?.metadata?.remotePayload || {};
  return p.name || p.NAME || p.itemName || p.voucherNumber || row?.externalId || '—';
}

async function listExternalObjects({
  organizationId,
  companyGuid = null,
  entityType = null,
  status = 'all',
  q = '',
  limit = 100,
  skip = 0,
} = {}) {
  const filter = {
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY,
  };
  if (companyGuid) filter.companyGuid = companyGuid;
  if (entityType) filter.entityType = entityType;

  if (status === 'pending') {
    filter.arivuId = { $regex: /^pending:/ };
    filter['metadata.ignored'] = { $ne: true };
  } else if (status === 'linked') {
    filter.arivuId = { $not: { $regex: /^pending:/ } };
    filter['metadata.ignored'] = { $ne: true };
  } else if (status === 'ignored') {
    filter['metadata.ignored'] = true;
  }

  if (q) {
    const escaped = String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { externalId: { $regex: escaped, $options: 'i' } },
      { arivuId: { $regex: escaped, $options: 'i' } },
      { 'metadata.remotePayload.name': { $regex: escaped, $options: 'i' } },
    ];
  }

  const [rows, total] = await Promise.all([
    ConnectorExternalObject.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    ConnectorExternalObject.countDocuments(filter),
  ]);

  return {
    rows: rows.map((r) => ({
      ...r,
      mappingStatus: mappingStatusOf(r),
      displayName: displayNameFromRow(r),
    })),
    total,
    limit,
    skip,
    hasMore: skip + rows.length < total,
  };
}

async function ignoreExternalObject({ organizationId, externalObjectId, reason = 'user_ignored' } = {}) {
  const row = await ConnectorExternalObject.findOne({
    _id: externalObjectId,
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY,
  });
  if (!row) {
    const err = new Error('External object not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  row.metadata = {
    ...(row.metadata || {}),
    ignored: true,
    ignoredAt: new Date().toISOString(),
    ignoreReason: reason,
  };
  await row.save();
  return row;
}

async function linkExternalObject({
  organizationId,
  externalObjectId,
  arivuId,
  createdBy = null,
} = {}) {
  const row = await ConnectorExternalObject.findOne({
    _id: externalObjectId,
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY,
  });
  if (!row) {
    const err = new Error('External object not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (!arivuId) {
    const err = new Error('arivuId required');
    err.code = 'VALIDATION';
    throw err;
  }

  row.arivuId = String(arivuId);
  row.lastDirection = CONNECTOR_DIRECTIONS.BIDIRECTIONAL;
  row.lastSyncedAt = new Date();
  row.metadata = {
    ...(row.metadata || {}),
    ignored: false,
    linkedAt: new Date().toISOString(),
    linkedBy: createdBy ? String(createdBy) : null,
  };
  await row.save();
  return row;
}

async function materializeParty({ organizationId, payload, createdBy }) {
  const patch = partyMapper.fromTally(payload || {});
  const name = patch.name || payload?.name;
  if (!name) throw new Error('Party name required');

  const existing = await Organization.findOne({
    isTenant: false,
    name: new RegExp(`^${String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
  }).lean();
  if (existing) return existing;

  const doc = await Organization.create({
    name,
    isTenant: false,
    gstin: patch.gstin || undefined,
    phone: patch.phone || undefined,
    address: patch.address || undefined,
    website: patch.website || undefined,
    taxId: patch.taxId || undefined,
    types: patch.types?.length ? patch.types : ['Customer'],
    createdBy: createdBy || undefined,
    assignedTo: createdBy || undefined,
  });
  return doc.toObject ? doc.toObject() : doc;
}

async function materializeItem({ organizationId, payload }) {
  const patch = stockItemMapper.fromTally(payload || {});
  const itemName = patch.itemName || patch.variant_code || payload?.name;
  if (!itemName) throw new Error('Item name required');

  let item = await Item.findOne({
    organizationId,
    item_name: new RegExp(`^${String(itemName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
  });
  if (!item) {
    item = await Item.create({
      organizationId,
      item_name: itemName,
      item_type: 'Product',
      category: patch.parentGroup || undefined,
      unit_of_measure: patch.unit_of_measure || 'Nos',
    });
  }

  let variant = await ItemVariant.findOne({
    organizationId,
    itemId: item._id,
    variant_code: patch.variant_code || itemName,
  });
  if (!variant) {
    variant = await ItemVariant.create({
      organizationId,
      itemId: item._id,
      variant_code: patch.variant_code || itemName,
      unit_of_measure: patch.unit_of_measure || 'Nos',
      selling_price: patch.selling_price || 0,
      cost_price: 0,
      barcode: patch.barcode || undefined,
      hsnSac: patch.hsnSac || undefined,
      gstRatePercent: patch.gstRatePercent != null ? patch.gstRatePercent : undefined,
      is_default: true,
      tax_type: patch.gstRatePercent != null ? 'GST' : 'None',
      tax_percentage: patch.gstRatePercent || 0,
    });
    if (!item.defaultVariantId) {
      item.defaultVariantId = variant._id;
      await item.save();
    }
  }
  return { item, variant };
}

async function materializeGodown({ organizationId, payload }) {
  const patch = godownMapper.fromTally(payload || {});
  const name = patch.name || payload?.name;
  if (!name) throw new Error('Godown name required');
  const locationCode = String(name)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'GODOWN';

  let loc = await InventoryLocation.findOne({
    organizationId,
    $or: [{ name: new RegExp(`^${String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }, { locationCode }],
  });
  if (!loc) {
    const crypto = require('crypto');
    loc = await InventoryLocation.create({
      organizationId,
      inventoryLocationId: `tally-godown-${crypto.randomBytes(6).toString('hex')}`,
      name,
      locationCode,
      description: patch.description || undefined,
      locationType: 'warehouse',
    });
  }
  return loc;
}

function classifyVoucherKind(entityType, payload = {}) {
  const et = String(entityType || '').toLowerCase();
  if (et === 'credit_note' || et === 'debit_note' || et === 'stock_journal') return et;
  const vt = String(payload.voucherType || payload.VOUCHERTYPENAME || payload.name || '')
    .trim()
    .toLowerCase();
  if (vt.includes('credit')) return 'credit_note';
  if (vt.includes('debit')) return 'debit_note';
  if (vt.includes('stock journal') || vt.includes('stockjournal')) return 'stock_journal';
  return 'voucher';
}

async function materializeVoucherDraft({
  organizationId,
  entityType,
  payload,
  externalId,
  createdBy = null,
} = {}) {
  const kind = classifyVoucherKind(entityType, payload);
  const title =
    payload?.voucherNumber ||
    payload?.VOUCHERNUMBER ||
    payload?.name ||
    externalId ||
    'Tally voucher';

  if (kind === 'credit_note' || kind === 'debit_note') {
    if (!createdBy) {
      const err = new Error('createdBy required to materialize voucher draft');
      err.code = 'VALIDATION';
      throw err;
    }
    const invoice = await Invoice.create({
      organizationId,
      invoiceTitle: `Tally ${kind === 'credit_note' ? 'CN' : 'DN'}: ${title}`,
      invoiceType: kind,
      invoiceDate: payload?.date ? new Date(payload.date) : new Date(),
      status: INVOICE_STATUS_DEFAULT,
      currency: payload?.currency || 'INR',
      assignedTo: createdBy,
      organizationRefId: null,
      sourceType: 'api',
      sourceContext: 'tally_inbound_draft',
      sourceRef: {
        moduleKey: 'tally',
        recordId: String(externalId || ''),
      },
      customFields: {
        tallyExternalId: String(externalId || ''),
        tallyVoucherType: payload?.voucherType || null,
        tallyImport: true,
      },
      createdBy: createdBy || null,
      modifiedBy: createdBy || null,
    });
    await ensureDefaultInvoiceSection({ organizationId, invoiceId: invoice._id });
    return {
      entityType: kind,
      draft: true,
      record: invoice.toObject ? invoice.toObject() : invoice,
      arivuId: String(invoice._id),
    };
  }

  if (kind === 'stock_journal') {
    const { getDefaultLocation } = require('../../inventoryLocationService');
    const location = await getDefaultLocation(organizationId, createdBy);
    const adj = await InventoryAdjustment.create({
      organizationId,
      inventoryLocationId: location.inventoryLocationId,
      reasonCode: 'correction',
      status: 'draft',
      lines: [],
      notes: `Tally stock journal draft: ${title}`,
      createdBy: createdBy || null,
    });
    return {
      entityType: 'stock_journal',
      draft: true,
      record: adj.toObject ? adj.toObject() : adj,
      arivuId: String(adj._id),
    };
  }

  const allowDrafts = process.env.TALLY_INBOUND_VOUCHER_DRAFTS === '1';
  if (!allowDrafts) {
    const err = new Error(
      'Sales/purchase voucher Create is disabled (SoT arivu_to_tally). Credit/debit notes and stock journals Create without this flag. Set TALLY_INBOUND_VOUCHER_DRAFTS=1 for generic voucher stubs, or use Ignore/Link.'
    );
    err.code = 'UNSUPPORTED';
    throw err;
  }
  if (!createdBy) {
    const err = new Error('createdBy required to materialize voucher draft');
    err.code = 'VALIDATION';
    throw err;
  }
  const invoice = await Invoice.create({
    organizationId,
    invoiceTitle: `Tally voucher: ${title}`,
    invoiceType: 'standard',
    invoiceDate: payload?.date ? new Date(payload.date) : new Date(),
    status: INVOICE_STATUS_DEFAULT,
    currency: payload?.currency || 'INR',
    assignedTo: createdBy,
    sourceType: 'api',
    sourceContext: 'tally_inbound_draft',
    sourceRef: { moduleKey: 'tally', recordId: String(externalId || '') },
    customFields: {
      tallyExternalId: String(externalId || ''),
      tallyVoucherType: payload?.voucherType || null,
      tallyImport: true,
    },
    createdBy,
    modifiedBy: createdBy,
  });
  await ensureDefaultInvoiceSection({ organizationId, invoiceId: invoice._id });
  return {
    entityType: 'voucher',
    draft: true,
    record: invoice.toObject ? invoice.toObject() : invoice,
    arivuId: String(invoice._id),
  };
}

async function createFromExternal({
  organizationId,
  externalObjectId,
  createdBy = null,
} = {}) {
  const row = await ConnectorExternalObject.findOne({
    _id: externalObjectId,
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY,
  });
  if (!row) {
    const err = new Error('External object not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const payload = row.metadata?.remotePayload || { name: displayNameFromRow(row) };
  const et = String(row.entityType || '').toLowerCase();
  let arivuId = null;
  let created = null;

  if (et === 'party' || et === 'ledger') {
    const org = await materializeParty({ organizationId, payload, createdBy });
    arivuId = String(org._id);
    created = { entityType: 'party', record: org };
  } else if (et === 'item') {
    const { variant, item } = await materializeItem({ organizationId, payload });
    arivuId = String(variant._id);
    created = { entityType: 'item', record: variant, item };
  } else if (et === 'godown') {
    const loc = await materializeGodown({ organizationId, payload });
    arivuId = String(loc._id);
    created = { entityType: 'godown', record: loc };
  } else if (et === 'voucher' || et === 'credit_note' || et === 'debit_note' || et === 'stock_journal') {
    const draft = await materializeVoucherDraft({
      organizationId,
      entityType: et,
      payload,
      externalId: row.externalId,
      createdBy,
    });
    arivuId = draft.arivuId;
    created = draft;
  } else {
    const err = new Error(`Create not supported for entityType=${et}. Use Ignore or Link.`);
    err.code = 'UNSUPPORTED';
    throw err;
  }

  row.arivuId = arivuId;
  row.lastDirection = CONNECTOR_DIRECTIONS.INBOUND;
  row.lastSyncedAt = new Date();
  row.metadata = {
    ...(row.metadata || {}),
    ignored: false,
    createdInArivuAt: new Date().toISOString(),
    createdBy: createdBy ? String(createdBy) : null,
  };
  await row.save();
  return { row, created };
}

/**
 * After inbound pending upsert — auto-ignore system objects or auto-link by name ≥ confidence.
 */
async function postProcessInboundRow({
  organizationId,
  row,
  name,
  entityType,
  companyGuid = null,
} = {}) {
  if (!row) return { action: 'none' };

  if (shouldAutoIgnore({ entityType, name })) {
    row.metadata = {
      ...(row.metadata || {}),
      ignored: true,
      ignoredAt: new Date().toISOString(),
      ignoreReason: 'system_or_config_master',
    };
    await row.save();
    return { action: 'ignored' };
  }

  if (!String(row.arivuId || '').startsWith('pending:')) {
    return { action: 'already_linked' };
  }

  const et = String(entityType || row.entityType || '').toLowerCase();
  const threshold = TALLY_DEFAULT_SETTINGS.autoApproveMappingConfidence || 0.95;
  const needle = normalizeName(name);
  if (!needle || needle.length < 2) return { action: 'pending' };

  let matchId = null;
  if (et === 'party' || et === 'ledger') {
    const org = await Organization.findOne({
      isTenant: false,
      name: new RegExp(`^${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    })
      .select('_id name')
      .lean();
    if (org) matchId = String(org._id);
  } else if (et === 'item') {
    const variant = await ItemVariant.findOne({
      organizationId,
      variant_code: new RegExp(`^${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    })
      .select('_id')
      .lean();
    if (variant) matchId = String(variant._id);
    else {
      const item = await Item.findOne({
        organizationId,
        item_name: new RegExp(`^${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      })
        .select('defaultVariantId')
        .lean();
      if (item?.defaultVariantId) matchId = String(item.defaultVariantId);
    }
  } else if (et === 'godown') {
    const loc = await InventoryLocation.findOne({
      organizationId,
      name: new RegExp(`^${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    })
      .select('_id')
      .lean();
    if (loc) matchId = String(loc._id);
  }

  // Exact name match ≈ confidence 1.0
  if (matchId && threshold <= 1) {
    row.arivuId = matchId;
    row.companyGuid = companyGuid || row.companyGuid;
    row.lastDirection = CONNECTOR_DIRECTIONS.BIDIRECTIONAL;
    row.metadata = {
      ...(row.metadata || {}),
      ignored: false,
      autoLinkedAt: new Date().toISOString(),
      autoLinkConfidence: 1,
    };
    await row.save();
    return { action: 'auto_linked', arivuId: matchId };
  }

  return { action: 'pending' };
}

module.exports = {
  listExternalObjects,
  ignoreExternalObject,
  linkExternalObject,
  createFromExternal,
  postProcessInboundRow,
  shouldAutoIgnore,
  isSystemLedgerName,
  mappingStatusOf,
  displayNameFromRow,
  SYSTEM_LEDGER_NAMES,
  IGNORE_ENTITY_TYPES,
};
