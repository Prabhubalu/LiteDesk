/**
 * Normalize tenant People module definitions toward canonical `sales_type` (virtual SALES role).
 * Legacy saved configs used field key `type` for the same semantics.
 */

const {
  ensurePeopleParticipationStatusFields,
  normalizeParticipationFieldContext,
} = require('./peopleModuleFieldDefaults');

/** Canonical key for field dedup: matches moduleController.fieldKeyCanonical */
function fieldKeyCanonical(k) {
  return String(k || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/-/g, '');
}

function dedupeFieldsByKey(fields) {
  if (!Array.isArray(fields)) return fields;
  const byCanonical = new Map();
  for (const f of fields) {
    const k = fieldKeyCanonical(f?.key);
    if (!k) continue;
    const existing = byCanonical.get(k);
    if (!existing || ((f.key || '').indexOf(' ') === -1 && (existing.key || '').indexOf(' ') !== -1)) {
      byCanonical.set(k, f);
    }
  }
  return Array.from(byCanonical.values());
}

/** Platform defaults for virtual sales_type (aligned with moduleController.getPeopleVirtualBaseFields). */
function getDefaultSalesTypeModuleField() {
  return {
    key: 'sales_type',
    label: 'Type',
    dataType: 'Picklist',
    keyField: false,
    required: false,
    options: ['Lead', 'Contact'],
    defaultValue: null,
    visibility: { list: true, detail: true },
    owner: 'platform',
    context: 'sales',
    isVirtual: true,
    appKey: 'SALES',
    filterable: true,
    filterType: 'multi-select',
    filterPriority: 2,
    dependencies: [],
    validations: [],
    lookupSettings: null,
    index: false,
    placeholder: '',
    order: 0,
  };
}

/**
 * - Drops legacy `type` when `sales_type` already exists.
 * - Renames lone `type` → `sales_type` with virtual SALES defaults.
 */
function normalizePeopleModuleFields(fields) {
  if (!Array.isArray(fields)) return fields;
  const keyNorm = (f) => fieldKeyCanonical(f?.key);
  const typeIdx = fields.findIndex((f) => keyNorm(f) === 'type');
  let out;
  if (typeIdx === -1) {
    out = dedupeFieldsByKey(fields);
  } else {
    const hasSalesType = fields.some((f, i) => i !== typeIdx && keyNorm(f) === 'salestype');
    out = fields.map((f) => ({ ...f }));
    if (hasSalesType) {
      out.splice(typeIdx, 1);
    } else {
      const baseVirtual = getDefaultSalesTypeModuleField();
      const typeField = { ...out[typeIdx] };
      out[typeIdx] = {
        ...baseVirtual,
        ...typeField,
        key: 'sales_type',
        label: typeField.label || baseVirtual.label,
        isVirtual: true,
        appKey: 'SALES',
        context: normalizeParticipationFieldContext(typeField).context || baseVirtual.context,
        owner: typeField.owner || baseVirtual.owner,
        dataType: typeField.dataType || baseVirtual.dataType,
      };
    }
    out = dedupeFieldsByKey(out);
  }
  return ensurePeopleParticipationStatusFields(out);
}

function migratePeopleQuickCreateKeys(quickCreate) {
  if (!Array.isArray(quickCreate)) return quickCreate;
  const mapped = quickCreate.map((k) => {
    const s = String(k ?? '').trim();
    return s.toLowerCase() === 'type' ? 'sales_type' : s;
  });
  const seen = new Set();
  return mapped.filter((k) => {
    const low = String(k).toLowerCase();
    if (!low || seen.has(low)) return false;
    seen.add(low);
    return true;
  });
}

function migratePeopleQuickCreateLayoutKeys(layout) {
  if (!layout || typeof layout !== 'object' || !Array.isArray(layout.rows)) return layout;
  return {
    ...layout,
    rows: layout.rows.map((r) => {
      if (!r || !Array.isArray(r.cols)) return r;
      return {
        ...r,
        cols: r.cols.map((c) => {
          if (!c) return c;
          const fk = String(c.fieldKey ?? '').trim();
          if (fk.toLowerCase() === 'type') {
            return { ...c, fieldKey: 'sales_type' };
          }
          return { ...c };
        }),
      };
    }),
  };
}

module.exports = {
  normalizePeopleModuleFields,
  migratePeopleQuickCreateKeys,
  migratePeopleQuickCreateLayoutKeys,
  fieldKeyCanonical,
  dedupeFieldsByKey,
};
