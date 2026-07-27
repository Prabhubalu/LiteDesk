'use strict';

/**
 * ATIP Transformation Engine — rule-driven CRM ↔ Tally payload conversion.
 * Replaces hardcoded mappers as SoT; mappers remain as fallback adapters.
 */

const mappingEngine = require('./mappingEngine');

function toTallyDate(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function fromTallyDate(value) {
  if (!value) return null;
  const s = String(value).replace(/[^\d]/g, '');
  if (s.length === 8) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  return value;
}

function toTallyYesNo(value) {
  if (value === true || value === 1 || String(value).toLowerCase() === 'yes') return 'Yes';
  if (value === false || value === 0 || String(value).toLowerCase() === 'no') return 'No';
  return value;
}

function fromTallyYesNo(value) {
  const v = String(value || '').toLowerCase();
  if (v === 'yes' || v === 'y' || v === '1') return true;
  if (v === 'no' || v === 'n' || v === '0') return false;
  return value;
}

function getByPath(obj, path) {
  if (!obj || !path) return undefined;
  if (!path.includes('.')) return obj[path];
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function setByPath(obj, path, value) {
  if (!path.includes('.')) {
    obj[path] = value;
    return;
  }
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function applyTransform(value, transform = { type: 'direct' }, direction = 'toTally') {
  const type = transform?.type || 'direct';
  switch (type) {
    case 'date':
      return direction === 'toTally' ? toTallyDate(value) : fromTallyDate(value);
    case 'yesno':
    case 'boolean':
      return direction === 'toTally' ? toTallyYesNo(value) : fromTallyYesNo(value);
    case 'enum_map': {
      const map = transform.map || {};
      const key = String(value);
      if (direction === 'toTally') return map[key] ?? transform.default ?? value;
      const reverse = Object.fromEntries(Object.entries(map).map(([k, v]) => [String(v), k]));
      return reverse[key] ?? transform.default ?? value;
    }
    case 'concat': {
      // value should already be resolved; concat uses transform.parts from source in applyRules
      return value;
    }
    case 'number':
      return value == null || value === '' ? null : Number(value);
    case 'uppercase':
      return value == null ? value : String(value).toUpperCase();
    case 'lowercase':
      return value == null ? value : String(value).toLowerCase();
    case 'direct':
    default:
      return value;
  }
}

/**
 * Apply mapping rules to convert source object → target object.
 * direction: 'toTally' | 'fromTally'
 */
function applyRules({ source = {}, rules = [], direction = 'toTally' }) {
  const target = {};
  for (const rule of rules) {
    const srcField = direction === 'toTally' ? rule.targetField : rule.sourceField;
    const dstField = direction === 'toTally' ? rule.sourceField : rule.targetField;
    // Convention in mappingEngine: sourceField=tally, targetField=arivu
    const fromField = direction === 'toTally' ? rule.targetField : rule.sourceField;
    const toField = direction === 'toTally' ? rule.sourceField : rule.targetField;
    if (!fromField || !toField) continue;

    let value;
    if (rule.transform?.type === 'concat' && Array.isArray(rule.transform.parts)) {
      value = rule.transform.parts.map((p) => getByPath(source, p) ?? '').join(rule.transform.separator || ' ');
    } else {
      value = getByPath(source, fromField);
    }
    if (value === undefined) continue;
    const transformed = applyTransform(value, rule.transform, direction);
    setByPath(target, toField, transformed);
  }
  return target;
}

async function transformOutbound({ organizationId, companyGuid, entityType, arivuRecord }) {
  const rules = await mappingEngine.getRuntimeFieldRules({ organizationId, companyGuid, entityType });
  if (rules.length) {
    return {
      payload: applyRules({ source: arivuRecord, rules, direction: 'toTally' }),
      source: 'mapping_rules',
      ruleCount: rules.length,
    };
  }

  // Fallback: legacy hardcoded mapper
  const legacy = await tryLegacyMapper({ entityType, record: arivuRecord, direction: 'toTally' });
  return { payload: legacy || arivuRecord, source: legacy ? 'legacy_mapper' : 'passthrough', ruleCount: 0 };
}

async function transformInbound({ organizationId, companyGuid, entityType, tallyRecord }) {
  const rules = await mappingEngine.getRuntimeFieldRules({ organizationId, companyGuid, entityType });
  if (rules.length) {
    return {
      payload: applyRules({ source: tallyRecord, rules, direction: 'fromTally' }),
      source: 'mapping_rules',
      ruleCount: rules.length,
    };
  }
  const legacy = await tryLegacyMapper({ entityType, record: tallyRecord, direction: 'fromTally' });
  return { payload: legacy || tallyRecord, source: legacy ? 'legacy_mapper' : 'passthrough', ruleCount: 0 };
}

async function tryLegacyMapper({ entityType, record, direction }) {
  try {
    const map = {
      party: () => require('../mappers/partyMapper'),
      ledger: () => require('../mappers/partyMapper'),
      item: () => require('../mappers/stockItemMapper'),
      stock_item: () => require('../mappers/stockItemMapper'),
      godown: () => require('../mappers/godownMapper'),
      inventory_location: () => require('../mappers/godownMapper'),
      stock_group: () => require('../mappers/stockGroupMapper'),
      catalog_category: () => require('../mappers/stockGroupMapper'),
    };
    const loader = map[entityType];
    if (!loader) return null;
    const mapper = loader();
    if (direction === 'toTally' && typeof mapper.toTally === 'function') return mapper.toTally(record);
    if (direction === 'fromTally' && typeof mapper.fromTally === 'function') return mapper.fromTally(record);
  } catch {
    return null;
  }
  return null;
}

module.exports = {
  toTallyDate,
  fromTallyDate,
  toTallyYesNo,
  fromTallyYesNo,
  applyRules,
  applyTransform,
  transformOutbound,
  transformInbound,
  getByPath,
  setByPath,
};
