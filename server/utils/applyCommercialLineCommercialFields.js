/**
 * Shared draft commercial field application for Quote/SO/Invoice lines.
 * Applies discount inputs and taxIds (or re-applies taxes from snapshot).
 */

function asNumber(value, { defaultValue = NaN } = {}) {
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
}

/**
 * @param {object} line - mongoose doc or plain mutable line
 * @param {object} body
 * @param {{ organizationId: import('mongoose').Types.ObjectId|string, forceTaxRecompute?: boolean }} opts
 * @returns {Promise<{ discountTouched: boolean, taxTouched: boolean }>}
 */
async function applyCommercialLineDiscountAndTax(line, body = {}, opts = {}) {
  const { organizationId, forceTaxRecompute = false } = opts;
  let discountTouched = false;

  if (body.discountType !== undefined) {
    const raw = body.discountType;
    line.discountType = raw === null || raw === '' ? null : String(raw).trim();
    discountTouched = true;
  }
  if (body.discountValue !== undefined) {
    const v = asNumber(body.discountValue, { defaultValue: NaN });
    if (!Number.isFinite(v) || v < 0) {
      const err = new Error('discountValue must be >= 0');
      err.code = 'VALIDATION';
      throw err;
    }
    line.discountValue = v;
    discountTouched = true;
  }
  if (body.discountAmount !== undefined) {
    const a = asNumber(body.discountAmount, { defaultValue: NaN });
    if (!Number.isFinite(a) || a < 0) {
      const err = new Error('discountAmount must be >= 0');
      err.code = 'VALIDATION';
      throw err;
    }
    line.discountAmount = a;
    discountTouched = true;
  } else if (
    (body.discountType !== undefined || body.discountValue !== undefined) &&
    body.discountAmount === undefined
  ) {
    line.discountAmount = 0;
    discountTouched = true;
  }

  const {
    hydrateTaxIds,
    applyTaxesToLine,
    taxesFromSnapshot
  } = require('../services/commercialTaxApplicationService');

  let taxTouched = false;
  if (body.taxIds !== undefined) {
    const itemTaxes =
      Array.isArray(body.taxIds) && body.taxIds.length
        ? await hydrateTaxIds(organizationId, body.taxIds)
        : [];
    const applied = applyTaxesToLine(line, itemTaxes);
    line.taxSnapshot = applied.taxSnapshot;
    line.lineSubtotal = applied.lineSubtotal;
    line.lineTaxTotal = applied.lineTaxTotal;
    line.lineTotal = applied.lineTotal;
    taxTouched = true;
  } else if (discountTouched || forceTaxRecompute) {
    const applied = applyTaxesToLine(line, taxesFromSnapshot(line.taxSnapshot));
    line.taxSnapshot = applied.taxSnapshot;
    line.lineSubtotal = applied.lineSubtotal;
    line.lineTaxTotal = applied.lineTaxTotal;
    line.lineTotal = applied.lineTotal;
    taxTouched = true;
  }

  return { discountTouched, taxTouched };
}

/**
 * Normalize reorder rows for bulkWrite.
 * @param {unknown} orders
 * @param {{ lineIdField: string, parentIdField: string, parentId: unknown, organizationId: unknown }} cfg
 */
function normalizeLineReorderOpsOrThrow(orders, { lineIdField, parentIdField, parentId, organizationId }) {
  if (!Array.isArray(orders) || orders.length === 0) {
    const err = new Error('orders[] is required');
    err.code = 'VALIDATION';
    throw err;
  }

  const seen = new Set();
  const ops = [];
  for (const row of orders) {
    const id = row?.[lineIdField];
    if (!id) {
      const err = new Error(`Each order row requires ${lineIdField}`);
      err.code = 'VALIDATION';
      throw err;
    }
    if (seen.has(String(id))) {
      const err = new Error(`Duplicate ${lineIdField} in orders[]`);
      err.code = 'VALIDATION';
      throw err;
    }
    seen.add(String(id));

    const order = asNumber(row?.lineOrder, { defaultValue: NaN });
    if (!Number.isFinite(order)) {
      const err = new Error('lineOrder must be a number');
      err.code = 'VALIDATION';
      throw err;
    }

    ops.push({
      updateOne: {
        filter: { organizationId, [parentIdField]: parentId, [lineIdField]: String(id) },
        update: { $set: { lineOrder: order } }
      }
    });
  }

  return ops;
}

/**
 * Normalize section reorder rows for bulkWrite.
 */
function normalizeSectionReorderOpsOrThrow(orders, {
  sectionIdField,
  parentIdField,
  parentId,
  organizationId
}) {
  if (!Array.isArray(orders) || orders.length === 0) {
    const err = new Error('orders[] is required');
    err.code = 'VALIDATION';
    throw err;
  }

  const seen = new Set();
  const ops = [];
  for (const row of orders) {
    const id = row?.[sectionIdField];
    if (!id) {
      const err = new Error(`Each order row requires ${sectionIdField}`);
      err.code = 'VALIDATION';
      throw err;
    }
    if (seen.has(String(id))) {
      const err = new Error(`Duplicate ${sectionIdField} in orders[]`);
      err.code = 'VALIDATION';
      throw err;
    }
    seen.add(String(id));

    const order = asNumber(row?.sectionOrder, { defaultValue: NaN });
    if (!Number.isFinite(order)) {
      const err = new Error('sectionOrder must be a number');
      err.code = 'VALIDATION';
      throw err;
    }

    ops.push({
      updateOne: {
        filter: { organizationId, [parentIdField]: parentId, [sectionIdField]: String(id) },
        update: { $set: { sectionOrder: order } }
      }
    });
  }

  return ops;
}

function applyGlobalDiscountFields(doc, body = {}) {
  if (Object.prototype.hasOwnProperty.call(body, 'globalDiscountType')) {
    const raw = body.globalDiscountType;
    doc.globalDiscountType = raw === null || raw === '' ? null : String(raw).trim();
  }
  if (Object.prototype.hasOwnProperty.call(body, 'globalDiscountValue')) {
    const v = asNumber(body.globalDiscountValue, { defaultValue: NaN });
    if (!Number.isFinite(v) || v < 0) {
      const err = new Error('globalDiscountValue must be >= 0');
      err.code = 'VALIDATION';
      throw err;
    }
    doc.globalDiscountValue = v;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'globalDiscountAmount')) {
    const a = asNumber(body.globalDiscountAmount, { defaultValue: NaN });
    if (!Number.isFinite(a) || a < 0) {
      const err = new Error('globalDiscountAmount must be >= 0');
      err.code = 'VALIDATION';
      throw err;
    }
    doc.globalDiscountAmount = a;
  } else if (
    Object.prototype.hasOwnProperty.call(body, 'globalDiscountType') ||
    Object.prototype.hasOwnProperty.call(body, 'globalDiscountValue')
  ) {
    doc.globalDiscountAmount = 0;
  }
}

function applySectionDiscountFields(section, body = {}) {
  if (Object.prototype.hasOwnProperty.call(body, 'sectionDiscountType')) {
    const raw = body.sectionDiscountType;
    section.sectionDiscountType = raw === null || raw === '' ? null : String(raw).trim();
  }
  if (Object.prototype.hasOwnProperty.call(body, 'sectionDiscountValue')) {
    const v = asNumber(body.sectionDiscountValue, { defaultValue: NaN });
    if (!Number.isFinite(v) || v < 0) {
      const err = new Error('sectionDiscountValue must be >= 0');
      err.code = 'VALIDATION';
      throw err;
    }
    section.sectionDiscountValue = v;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'sectionDiscountAmount')) {
    const a = asNumber(body.sectionDiscountAmount, { defaultValue: NaN });
    if (!Number.isFinite(a) || a < 0) {
      const err = new Error('sectionDiscountAmount must be >= 0');
      err.code = 'VALIDATION';
      throw err;
    }
    section.sectionDiscountAmount = a;
  } else if (
    Object.prototype.hasOwnProperty.call(body, 'sectionDiscountType') ||
    Object.prototype.hasOwnProperty.call(body, 'sectionDiscountValue')
  ) {
    section.sectionDiscountAmount = 0;
  }
}

module.exports = {
  applyCommercialLineDiscountAndTax,
  normalizeLineReorderOpsOrThrow,
  normalizeSectionReorderOpsOrThrow,
  applyGlobalDiscountFields,
  applySectionDiscountFields,
  asNumber
};
