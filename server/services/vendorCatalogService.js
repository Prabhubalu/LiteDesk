/**
 * Vendor Catalog service — vendor–variant supply links + PO pricing reference.
 */

const mongoose = require('mongoose');
const VendorCatalogEntry = require('../models/VendorCatalogEntry');
const ItemVariant = require('../models/ItemVariant');
const Item = require('../models/Item');
const Organization = require('../models/Organization');
const { CATALOG_SELLABLE_LIFECYCLE_STATES } = require('../constants/catalogLifecycle');

function validationError(message, code = 'VALIDATION') {
  const err = new Error(message);
  err.code = code;
  return err;
}

function normalizeStatus(raw, fallback = 'Active') {
  const s = String(raw || fallback).trim();
  if (s.toLowerCase() === 'inactive') return 'Inactive';
  return 'Active';
}

function mapEntry(doc, item, variant) {
  if (!doc) return null;
  const row = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  return {
    ...row,
    id: String(row._id),
    itemName: item?.item_name || null,
    itemCode: item?.item_code || null,
    variantCode: variant?.variant_code || null,
    barcode: variant?.barcode || null
  };
}

async function assertVendorOrg(organizationId, vendorId) {
  if (!vendorId) throw validationError('vendorId is required');
  // CRM orgs are not nested under tenant via organizationId; isolate via catalog rows on tenant.
  const vendor = await Organization.findOne({
    _id: vendorId,
    deletedAt: null,
    isTenant: { $ne: true }
  })
    .select('_id types participations name')
    .lean();
  if (!vendor) throw validationError('Vendor organization not found', 'NOT_FOUND');
  const types = Array.isArray(vendor.types)
    ? vendor.types.map((t) => String(t || '').toLowerCase())
    : [];
  const invRole = String(vendor.participations?.INVENTORY?.role || '').toLowerCase();
  if (!types.includes('vendor') && invRole !== 'vendor') {
    throw validationError('Organization must have Vendor participation type');
  }
  return vendor;
}

async function hydrateVariant(organizationId, variantId) {
  const variant = await ItemVariant.findOne({ _id: variantId, organizationId }).lean();
  if (!variant) throw validationError('Variant not found', 'NOT_FOUND');
  const item = await Item.findOne({
    _id: variant.itemId,
    organizationId,
    deletedAt: null
  })
    .select('item_name item_code unit_of_measure')
    .lean();
  if (!item) throw validationError('Item not found', 'NOT_FOUND');
  return { variant, item };
}

function normalizeEntryInput(row) {
  if (!row || typeof row !== 'object') return null;
  const variantId = row.variantId || row.variant_id || row._id;
  if (!variantId) return null;
  const minRaw = row.minOrderQty ?? row.min_order_qty ?? row.minimumOrderQuantity;
  const leadRaw = row.leadTimeDays ?? row.lead_time_days ?? row.leadTime;
  return {
    variantId: String(variantId),
    vendorItemCode:
      row.vendorItemCode != null && String(row.vendorItemCode).trim() !== ''
        ? String(row.vendorItemCode).trim()
        : null,
    vendorItemName:
      row.vendorItemName != null && String(row.vendorItemName).trim() !== ''
        ? String(row.vendorItemName).trim()
        : null,
    purchasePrice: Math.max(0, Number(row.purchasePrice) || 0),
    currency:
      row.currency != null && String(row.currency).trim()
        ? String(row.currency).trim().toUpperCase()
        : null,
    preferredVendor: row.preferredVendor === true || row.preferred_vendor === true,
    minOrderQty:
      minRaw != null && minRaw !== '' && Number.isFinite(Number(minRaw))
        ? Math.max(0, Number(minRaw))
        : null,
    leadTimeDays:
      leadRaw != null && leadRaw !== '' && Number.isFinite(Number(leadRaw))
        ? Math.max(0, Number(leadRaw))
        : null,
    remarks:
      row.remarks != null && String(row.remarks).trim() !== ''
        ? String(row.remarks).trim()
        : null,
    status: normalizeStatus(row.status, 'Active'),
    customFields:
      row.customFields && typeof row.customFields === 'object' && !Array.isArray(row.customFields)
        ? row.customFields
        : {}
  };
}

async function listEntries({
  organizationId,
  vendorId,
  status = null,
  includeInactive = true
}) {
  await assertVendorOrg(organizationId, vendorId);
  const q = { organizationId, vendorId };
  if (status) {
    q.status = normalizeStatus(status);
  } else if (!includeInactive) {
    q.status = 'Active';
  }

  const rows = await VendorCatalogEntry.find(q).sort({ updatedAt: -1 }).lean();
  if (!rows.length) return [];

  const variantIds = [...new Set(rows.map((r) => String(r.variantId)))];
  const itemIds = [...new Set(rows.map((r) => String(r.itemId)))];
  const [variants, items] = await Promise.all([
    ItemVariant.find({ organizationId, _id: { $in: variantIds } }).lean(),
    Item.find({ organizationId, _id: { $in: itemIds }, deletedAt: null })
      .select('item_name item_code')
      .lean()
  ]);
  const variantById = new Map(variants.map((v) => [String(v._id), v]));
  const itemById = new Map(items.map((i) => [String(i._id), i]));

  return rows.map((r) =>
    mapEntry(r, itemById.get(String(r.itemId)), variantById.get(String(r.variantId)))
  );
}

async function getEntryByVariant({ organizationId, vendorId, variantId, activeOnly = false }) {
  const q = { organizationId, vendorId, variantId };
  if (activeOnly) q.status = 'Active';
  return VendorCatalogEntry.findOne(q).lean();
}

/**
 * Replace full catalog for a vendor (create/edit org surface).
 * Empty array clears catalog.
 */
async function replaceEntries({
  organizationId,
  vendorId,
  entries,
  userId,
  expectedRevision = null
}) {
  await assertVendorOrg(organizationId, vendorId);

  const orgOid = toObjectId(organizationId);
  const vendorOid = toObjectId(vendorId);
  if (!orgOid || !vendorOid) {
    throw validationError('Invalid organizationId or vendorId');
  }

  // Optimistic concurrency: reject replace if catalog changed since client loaded it
  if (expectedRevision != null && String(expectedRevision).trim() !== '') {
    const expectedMs = Date.parse(String(expectedRevision));
    if (Number.isFinite(expectedMs)) {
      const latest = await VendorCatalogEntry.findOne({
        organizationId: orgOid,
        vendorId: vendorOid
      })
        .sort({ updatedAt: -1 })
        .select('updatedAt')
        .lean();
      if (latest?.updatedAt) {
        const serverMs = new Date(latest.updatedAt).getTime();
        if (serverMs > expectedMs + 50) {
          throw validationError(
            'Vendor catalog was updated elsewhere. Reload and try again.',
            'CONFLICT'
          );
        }
      }
    }
  }

  const input = Array.isArray(entries) ? entries : [];
  const normalized = [];
  const seen = new Set();

  for (const raw of input) {
    const row = normalizeEntryInput(raw);
    if (!row) continue;
    if (seen.has(row.variantId)) {
      throw validationError('Duplicate catalog item: same variant listed more than once');
    }
    seen.add(row.variantId);
    const variantOid = toObjectId(row.variantId);
    if (!variantOid) throw validationError(`Invalid variantId: ${row.variantId}`);
    const { variant, item } = await hydrateVariant(organizationId, variantOid);
    normalized.push({
      organizationId: orgOid,
      vendorId: vendorOid,
      variantId: variantOid,
      itemId: item._id,
      vendorItemCode: row.vendorItemCode,
      vendorItemName: row.vendorItemName,
      purchasePrice:
        row.purchasePrice > 0
          ? row.purchasePrice
          : Math.max(0, Number(variant.cost_price) || 0),
      currency: row.currency || String(variant.currency || 'USD').toUpperCase(),
      preferredVendor: row.preferredVendor === true,
      minOrderQty: row.minOrderQty,
      leadTimeDays: row.leadTimeDays,
      remarks: row.remarks,
      status: row.status,
      customFields: row.customFields || {},
      modifiedBy: userId || null
    });
  }

  // Preserve system last-purchase fields across full replace
  const existing = await VendorCatalogEntry.find({
    organizationId: orgOid,
    vendorId: vendorOid
  }).lean();
  const lastByVariant = new Map(
    existing.map((e) => [
      String(e.variantId),
      {
        lastPurchasePrice: e.lastPurchasePrice ?? null,
        lastPurchaseDate: e.lastPurchaseDate ?? null,
        createdBy: e.createdBy || userId || null
      }
    ])
  );

  await VendorCatalogEntry.deleteMany({ organizationId: orgOid, vendorId: vendorOid });

  if (normalized.length) {
    const docs = normalized.map((n) => {
      const prev = lastByVariant.get(String(n.variantId));
      return {
        ...n,
        lastPurchasePrice: prev?.lastPurchasePrice ?? null,
        lastPurchaseDate: prev?.lastPurchaseDate ?? null,
        createdBy: prev?.createdBy || userId || null
      };
    });
    await VendorCatalogEntry.insertMany(docs, { ordered: true });
  }

  return listEntries({ organizationId: orgOid, vendorId: vendorOid, includeInactive: true });
}

/**
 * Resolve sellable variants for CSV import: match by variant_code or item_code (default variant).
 * Rows: { itemCode?, variantCode?, vendorItemCode?, vendorItemName?, purchasePrice?, currency?, status? }
 */
async function resolveImportRows({ organizationId, rows }) {
  const input = Array.isArray(rows) ? rows : [];
  const resolved = [];
  const errors = [];

  for (let i = 0; i < input.length; i += 1) {
    const raw = input[i] || {};
    const lineNo = i + 1;
    const variantCode = String(raw.variantCode || raw.variant_code || '').trim();
    const itemCode = String(raw.itemCode || raw.item_code || '').trim();
    if (!variantCode && !itemCode) {
      errors.push({ line: lineNo, message: 'itemCode or variantCode required' });
      continue;
    }

    let variant = null;
    if (variantCode) {
      variant = await ItemVariant.findOne({
        organizationId,
        variant_code: variantCode
      }).lean();
    }
    if (!variant && itemCode) {
      const item = await Item.findOne({
        organizationId,
        deletedAt: null,
        item_code: itemCode
      })
        .select('_id')
        .lean();
      if (item) {
        variant = await ItemVariant.findOne({
          organizationId,
          itemId: item._id,
          is_default: true
        }).lean();
        if (!variant) {
          variant = await ItemVariant.findOne({
            organizationId,
            itemId: item._id
          })
            .sort({ is_default: -1, createdAt: 1 })
            .lean();
        }
      }
    }
    if (!variant) {
      errors.push({
        line: lineNo,
        message: `No variant for ${variantCode || itemCode}`
      });
      continue;
    }

    const row = normalizeEntryInput({
      variantId: variant._id,
      vendorItemCode: raw.vendorItemCode || raw.vendor_item_code,
      vendorItemName: raw.vendorItemName || raw.vendor_item_name,
      purchasePrice: raw.purchasePrice ?? raw.purchase_price ?? 0,
      currency: raw.currency,
      preferredVendor: raw.preferredVendor ?? raw.preferred_vendor,
      minOrderQty: raw.minOrderQty ?? raw.min_order_qty ?? raw.moq,
      leadTimeDays: raw.leadTimeDays ?? raw.lead_time_days ?? raw.leadTime,
      remarks: raw.remarks,
      status: raw.status
    });
    if (!row) {
      errors.push({ line: lineNo, message: 'Invalid row' });
      continue;
    }
    resolved.push(row);
  }

  return { resolved, errors };
}

function toObjectId(id) {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  const s = String(id);
  if (!mongoose.Types.ObjectId.isValid(s)) return null;
  return new mongoose.Types.ObjectId(s);
}

async function upsertEntry({ organizationId, vendorId, payload, userId }) {
  await assertVendorOrg(organizationId, vendorId);
  const row = normalizeEntryInput(payload);
  if (!row) throw validationError('variantId is required');
  const { variant, item } = await hydrateVariant(organizationId, row.variantId);
  const currency = row.currency || String(variant.currency || 'USD').toUpperCase();
  const purchasePrice =
    row.purchasePrice > 0
      ? row.purchasePrice
      : Math.max(0, Number(payload?.purchasePrice ?? variant.cost_price) || 0);

  const updated = await VendorCatalogEntry.findOneAndUpdate(
    { organizationId, vendorId, variantId: row.variantId },
    {
      $set: {
        itemId: item._id,
        vendorItemCode: row.vendorItemCode,
        vendorItemName: row.vendorItemName,
        purchasePrice,
        currency,
        preferredVendor: row.preferredVendor === true,
        minOrderQty: row.minOrderQty,
        leadTimeDays: row.leadTimeDays,
        remarks: row.remarks,
        status: row.status,
        customFields: row.customFields || {},
        modifiedBy: userId || null
      },
      $setOnInsert: {
        organizationId,
        vendorId,
        variantId: row.variantId,
        lastPurchasePrice: null,
        lastPurchaseDate: null,
        createdBy: userId || null
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return mapEntry(updated, item, variant);
}

async function deleteEntry({ organizationId, vendorId, entryId }) {
  await assertVendorOrg(organizationId, vendorId);
  const deleted = await VendorCatalogEntry.findOneAndDelete({
    _id: entryId,
    organizationId,
    vendorId
  });
  if (!deleted) throw validationError('Catalog entry not found', 'NOT_FOUND');
  return { ok: true };
}

/**
 * Search sellable variants for PO picker.
 * scope=linked (default): Active catalog only
 * scope=all: all sellable variants, with linked flag + catalog pricing when present
 */
async function searchVariantsForVendor({
  organizationId,
  vendorId,
  q = '',
  scope = 'linked',
  limit = 25
}) {
  await assertVendorOrg(organizationId, vendorId);
  const cap = Math.min(Math.max(Number(limit) || 25, 1), 50);
  const mode = String(scope || 'linked').toLowerCase() === 'all' ? 'all' : 'linked';
  const trimmedQ = String(q || '').trim();

  const catalogRows = await VendorCatalogEntry.find({ organizationId, vendorId }).lean();
  const catalogByVariant = new Map(catalogRows.map((r) => [String(r.variantId), r]));
  const activeLinkedIds = catalogRows
    .filter((r) => r.status === 'Active')
    .map((r) => r.variantId);

  if (mode === 'linked' && !activeLinkedIds.length) return [];

  const activeItemIds = await Item.distinct('_id', { organizationId, deletedAt: null });
  if (!activeItemIds.length) return [];

  const filter = {
    organizationId,
    itemId: { $in: activeItemIds }
  };

  // Linked vendor catalog = procurement source of truth. Do not require sales "sellable"
  // lifecycle (items kept only for purchasing / inactive sales stay visible when linked).
  if (mode === 'all') {
    filter.lifecycle_state = { $in: CATALOG_SELLABLE_LIFECYCLE_STATES };
  }

  if (mode === 'linked') {
    filter._id = { $in: activeLinkedIds };
  }

  if (trimmedQ) {
    const regex = new RegExp(trimmedQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const nameItems = await Item.find({
      organizationId,
      deletedAt: null,
      $or: [{ item_name: regex }, { item_code: regex }]
    })
      .select('_id')
      .limit(100)
      .lean();
    const nameItemIds = nameItems.map((i) => i._id);

    const catalogCodeMatchIds = catalogRows
      .filter(
        (r) =>
          (r.vendorItemCode && regex.test(r.vendorItemCode)) ||
          (r.vendorItemName && regex.test(r.vendorItemName))
      )
      .map((r) => r.variantId);

    filter.$or = [
      { variant_code: regex },
      { barcode: regex },
      ...(nameItemIds.length ? [{ itemId: { $in: nameItemIds } }] : []),
      ...(catalogCodeMatchIds.length ? [{ _id: { $in: catalogCodeMatchIds } }] : [])
    ];
  }

  const variants = await ItemVariant.find(filter)
    .sort({ is_default: -1, variant_code: 1 })
    .limit(cap)
    .lean();

  if (!variants.length) return [];

  const itemIds = [...new Set(variants.map((v) => String(v.itemId)))];
  const items = await Item.find({
    organizationId,
    _id: { $in: itemIds },
    deletedAt: null
  })
    .select('item_name item_code item_type')
    .lean();
  const itemById = new Map(items.map((i) => [String(i._id), i]));

  return variants
    .filter((v) => itemById.has(String(v.itemId)))
    .map((v) => {
      const item = itemById.get(String(v.itemId));
      const cat = catalogByVariant.get(String(v._id));
      const linked = !!cat;
      const purchasePrice = linked
        ? Number(cat.purchasePrice) || 0
        : Math.max(0, Number(v.cost_price) || 0);
      return {
        _id: v._id,
        variant_code: v.variant_code,
        item_id: v.itemId,
        item_name: item?.item_name || null,
        item_code: item?.item_code || null,
        item_type: item?.item_type || null,
        currency: (cat?.currency || v.currency || 'USD').toUpperCase(),
        is_default: v.is_default,
        linked,
        catalogStatus: cat?.status || null,
        vendorItemCode: cat?.vendorItemCode || null,
        vendorItemName: cat?.vendorItemName || null,
        purchase_price: purchasePrice,
        unitPrice: purchasePrice,
        /** Align with commercial picker which reads selling_price for display. */
        selling_price: purchasePrice,
        last_purchase_price: cat?.lastPurchasePrice ?? null,
        last_purchase_date: cat?.lastPurchaseDate ?? null,
        preferred_vendor: cat?.preferredVendor === true,
        min_order_qty: cat?.minOrderQty ?? null,
        lead_time_days: cat?.leadTimeDays ?? null,
        remarks: cat?.remarks ?? null
      };
    });
}

/**
 * System hook: after RN verified / inventory updated, stamp last purchase fields.
 */
async function recordPurchasesFromReceipt({
  organizationId,
  vendorId,
  lines,
  purchaseDate,
  userId
}) {
  if (!vendorId || !Array.isArray(lines) || !lines.length) return;
  const when = purchaseDate ? new Date(purchaseDate) : new Date();

  for (const line of lines) {
    const variantId = line.variantId;
    if (!variantId) continue;
    const accepted = Number(line.quantityAccepted ?? line.quantityReceived ?? 0);
    if (!(accepted > 0)) continue;
    const unitPrice = Number(line.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) continue;

    let entry = await VendorCatalogEntry.findOne({ organizationId, vendorId, variantId });
    if (!entry) {
      try {
        const { variant, item } = await hydrateVariant(organizationId, variantId);
        entry = await VendorCatalogEntry.create({
          organizationId,
          vendorId,
          variantId,
          itemId: item._id,
          purchasePrice: unitPrice,
          currency: String(variant.currency || 'USD').toUpperCase(),
          status: 'Active',
          lastPurchasePrice: unitPrice,
          lastPurchaseDate: when,
          createdBy: userId || null,
          modifiedBy: userId || null
        });
      } catch {
        continue;
      }
    } else {
      const prevDate = entry.lastPurchaseDate ? new Date(entry.lastPurchaseDate) : null;
      if (!prevDate || when >= prevDate) {
        entry.lastPurchasePrice = unitPrice;
        entry.lastPurchaseDate = when;
        entry.modifiedBy = userId || null;
        await entry.save();
      }
    }
  }
}

/**
 * System hook: after Purchase Return inventory posted, stamp return metrics.
 */
async function recordReturnsFromPurchaseReturn({
  organizationId,
  vendorId,
  lines,
  returnDate,
  userId
}) {
  if (!vendorId || !Array.isArray(lines) || !lines.length) return;
  const when = returnDate ? new Date(returnDate) : new Date();

  for (const line of lines) {
    const variantId = line.variantId;
    if (!variantId) continue;
    const qty = Number(line.quantityReturned || 0);
    if (!(qty > 0)) continue;

    let entry = await VendorCatalogEntry.findOne({ organizationId, vendorId, variantId });
    if (!entry) {
      try {
        const { variant, item } = await hydrateVariant(organizationId, variantId);
        entry = await VendorCatalogEntry.create({
          organizationId,
          vendorId,
          variantId,
          itemId: item._id,
          purchasePrice: Number(line.unitPrice) || 0,
          currency: String(variant.currency || 'USD').toUpperCase(),
          status: 'Active',
          lastReturnDate: when,
          returnCount: 1,
          createdBy: userId || null,
          modifiedBy: userId || null
        });
      } catch {
        continue;
      }
    } else {
      entry.returnCount = Number(entry.returnCount || 0) + 1;
      const prevDate = entry.lastReturnDate ? new Date(entry.lastReturnDate) : null;
      if (!prevDate || when >= prevDate) {
        entry.lastReturnDate = when;
      }
      entry.modifiedBy = userId || null;
      await entry.save();
    }
  }
}

async function catalogRevisionForVendor({ organizationId, vendorId }) {
  const latest = await VendorCatalogEntry.findOne({ organizationId, vendorId })
    .sort({ updatedAt: -1 })
    .select('updatedAt')
    .lean();
  return latest?.updatedAt ? new Date(latest.updatedAt).toISOString() : null;
}

module.exports = {
  listEntries,
  getEntryByVariant,
  replaceEntries,
  upsertEntry,
  deleteEntry,
  searchVariantsForVendor,
  recordPurchasesFromReceipt,
  recordReturnsFromPurchaseReturn,
  resolveImportRows,
  catalogRevisionForVendor
};
