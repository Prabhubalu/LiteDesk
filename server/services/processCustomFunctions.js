'use strict';

/**
 * Whitelisted process custom functions.
 * Never eval user-supplied code — register handlers here only.
 *
 * Each entry: { key, label, description, run(ctx, args) => Promise<{ok, ...}> }
 */

const mongoose = require('mongoose');
const { getModelForModuleKey } = require('../utils/assignmentRecordLoader');
const { createLogger } = require('./automationLogger');

const log = createLogger('processCustomFunctions');

const ENTITY_TO_MODULE_KEY = {
  people: 'people',
  organization: 'organizations',
  deal: 'deals',
  quote: 'quotes',
  task: 'tasks',
  event: 'events',
  case: 'cases'
};

function normalizeModuleKey(raw) {
  const key = String(raw || '').trim().toLowerCase();
  return ENTITY_TO_MODULE_KEY[key] || key;
}

function ensureDataBag(ctx) {
  if (!ctx.dataBag || typeof ctx.dataBag !== 'object') ctx.dataBag = {};
  return ctx.dataBag;
}

async function noop(_ctx, _args) {
  return { ok: true, result: null };
}

async function logContext(ctx, args) {
  const summary = {
    organizationId: ctx.organizationId ? String(ctx.organizationId) : null,
    entityType: ctx.entityType || null,
    entityId: ctx.entityId ? String(ctx.entityId) : null,
    executionId: ctx.executionId || null,
    args
  };
  log.info('custom_function_log_context', summary);
  return { ok: true, result: summary };
}

async function mergeDataBag(ctx, args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return { ok: false, error: 'merge_data_bag requires a JSON object in args' };
  }
  const bag = ensureDataBag(ctx);
  Object.assign(bag, args);
  return { ok: true, result: { keys: Object.keys(args) } };
}

/**
 * Touch current record updatedAt (and optional fieldValues from args).
 */
async function touchCurrentRecord(ctx, args) {
  const moduleKey = normalizeModuleKey(args?.moduleKey || ctx.entityType);
  const recordId = args?.recordId || ctx.entityId;
  if (!moduleKey || !recordId) {
    return { ok: false, error: 'touch_current_record requires module/entity and record id' };
  }
  if (!ctx.organizationId) {
    return { ok: false, error: 'touch_current_record requires organizationId' };
  }

  const Model = getModelForModuleKey(moduleKey);
  if (!Model) {
    return { ok: false, error: `touch_current_record: unsupported module "${moduleKey}"` };
  }

  const $set = { updatedAt: new Date() };
  if (args?.fieldValues && typeof args.fieldValues === 'object' && !Array.isArray(args.fieldValues)) {
    Object.assign($set, args.fieldValues);
  }

  try {
    const query = {
      _id: new mongoose.Types.ObjectId(recordId),
      organizationId: new mongoose.Types.ObjectId(ctx.organizationId)
    };
    if (Model.schema?.paths?.deletedAt) query.deletedAt = null;
    const updated = await Model.findOneAndUpdate(query, { $set }, { new: true }).lean();
    if (!updated) return { ok: false, error: 'touch_current_record: record not found' };
    return { ok: true, result: { recordId: String(updated._id), moduleKey } };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

/**
 * Copy a dataBag value to another key (simple transform helper).
 * args: { from, to }
 */
async function copyVariable(ctx, args) {
  const from = args?.from != null ? String(args.from).trim() : '';
  const to = args?.to != null ? String(args.to).trim() : '';
  if (!from || !to) return { ok: false, error: 'copy_variable requires from and to' };
  const bag = ensureDataBag(ctx);
  bag[to] = bag[from];
  return { ok: true, result: { from, to, value: bag[to] } };
}

async function clearVariable(ctx, args) {
  const name = args?.name != null ? String(args.name).trim() : '';
  if (!name) return { ok: false, error: 'clear_variable requires name' };
  const bag = ensureDataBag(ctx);
  delete bag[name];
  return { ok: true, result: { name } };
}

async function incrementVariable(ctx, args) {
  const name = args?.name != null ? String(args.name).trim() : '';
  if (!name) return { ok: false, error: 'increment_variable requires name' };
  const by = Number(args?.by != null ? args.by : 1);
  if (!Number.isFinite(by)) return { ok: false, error: 'increment_variable: by must be a number' };
  const bag = ensureDataBag(ctx);
  const current = Number(bag[name] ?? 0);
  if (!Number.isFinite(current)) {
    return { ok: false, error: `increment_variable: dataBag.${name} is not numeric` };
  }
  bag[name] = current + by;
  return { ok: true, result: { name, value: bag[name] } };
}

async function nowIso(ctx, args) {
  const name = args?.name != null ? String(args.name).trim() : 'now';
  const bag = ensureDataBag(ctx);
  const value = new Date().toISOString();
  bag[name] = value;
  return { ok: true, result: { name, value } };
}

/**
 * Load the triggering record into dataBag[as].
 * args: { as?: string, moduleKey?: string, recordId?: string }
 */
async function loadCurrentRecord(ctx, args) {
  const moduleKey = normalizeModuleKey(args?.moduleKey || ctx.entityType);
  const recordId = args?.recordId || ctx.entityId;
  const as = args?.as != null ? String(args.as).trim() : 'currentRecord';
  if (!moduleKey || !recordId) {
    return { ok: false, error: 'load_current_record requires module and record id' };
  }
  if (!ctx.organizationId) {
    return { ok: false, error: 'load_current_record requires organizationId' };
  }
  const Model = getModelForModuleKey(moduleKey);
  if (!Model) {
    return { ok: false, error: `load_current_record: unsupported module "${moduleKey}"` };
  }
  try {
    const query = {
      _id: new mongoose.Types.ObjectId(recordId),
      organizationId: new mongoose.Types.ObjectId(ctx.organizationId)
    };
    if (Model.schema?.paths?.deletedAt) query.deletedAt = null;
    const doc = await Model.findOne(query).lean();
    if (!doc) return { ok: false, error: 'load_current_record: record not found' };
    const bag = ensureDataBag(ctx);
    bag[as] = doc;
    return { ok: true, result: { as, moduleKey, recordId: String(doc._id) } };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

/**
 * Pick a field from a dataBag object into another variable.
 * args: { from, field, to }
 */
async function pickField(ctx, args) {
  const from = args?.from != null ? String(args.from).trim() : '';
  const field = args?.field != null ? String(args.field).trim() : '';
  const to = args?.to != null ? String(args.to).trim() : '';
  if (!from || !field || !to) {
    return { ok: false, error: 'pick_field requires from, field, and to' };
  }
  const bag = ensureDataBag(ctx);
  const source = bag[from];
  if (!source || typeof source !== 'object') {
    return { ok: false, error: `pick_field: dataBag.${from} is not an object` };
  }
  bag[to] = source[field];
  return { ok: true, result: { from, field, to, value: bag[to] } };
}

const REGISTRY = {
  noop: {
    key: 'noop',
    label: 'No-op',
    description: 'Does nothing (useful for testing).',
    run: noop
  },
  log_context: {
    key: 'log_context',
    label: 'Log context',
    description: 'Writes process context to automation logs.',
    run: logContext
  },
  merge_data_bag: {
    key: 'merge_data_bag',
    label: 'Merge into data bag',
    description: 'Merges JSON args into the process data bag.',
    run: mergeDataBag
  },
  copy_variable: {
    key: 'copy_variable',
    label: 'Copy variable',
    description: 'Copies dataBag[from] → dataBag[to]. Pass args: {"from":"a","to":"b"}.',
    run: copyVariable
  },
  clear_variable: {
    key: 'clear_variable',
    label: 'Clear variable',
    description: 'Deletes dataBag[name]. Pass args: {"name":"myVar"}.',
    run: clearVariable
  },
  increment_variable: {
    key: 'increment_variable',
    label: 'Increment variable',
    description: 'Adds to a numeric dataBag value. Pass args: {"name":"n","by":1}.',
    run: incrementVariable
  },
  now_iso: {
    key: 'now_iso',
    label: 'Set now (ISO)',
    description: 'Stores current UTC timestamp. Pass args: {"name":"now"}.',
    run: nowIso
  },
  load_current_record: {
    key: 'load_current_record',
    label: 'Load current record',
    description: 'Loads the triggering record into dataBag. Pass args: {"as":"currentRecord"}.',
    run: loadCurrentRecord
  },
  pick_field: {
    key: 'pick_field',
    label: 'Pick field',
    description: 'Copies object.field into another variable. Pass args: {"from":"currentRecord","field":"status","to":"status"}.',
    run: pickField
  },
  touch_current_record: {
    key: 'touch_current_record',
    label: 'Touch current record',
    description: 'Updates updatedAt on the current record. Optional args.fieldValues to set fields.',
    run: touchCurrentRecord
  }
};

function listCustomFunctions() {
  return Object.values(REGISTRY).map(({ key, label, description }) => ({
    key,
    label,
    description
  }));
}

function getCustomFunctionOptions() {
  return listCustomFunctions().map((f) => ({
    value: f.key,
    label: `${f.label} (${f.key})`
  }));
}

/**
 * @param {string} functionKey
 * @param {Object} ctx - process/automation action context (includes dataBag)
 * @param {Object} [args] - parsed JSON args from designer
 */
async function runCustomFunction(functionKey, ctx, args = {}) {
  const key = String(functionKey || '').trim();
  if (!key) return { ok: false, error: 'custom_function requires functionKey' };
  const entry = REGISTRY[key];
  if (!entry) {
    return {
      ok: false,
      error: `Unknown custom function "${key}". Allowed: ${Object.keys(REGISTRY).join(', ')}`
    };
  }
  try {
    const result = await entry.run(ctx || {}, args && typeof args === 'object' ? args : {});
    if (result && result.ok === false) return result;
    return { ok: true, functionKey: key, ...(result || {}) };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

module.exports = {
  REGISTRY,
  listCustomFunctions,
  getCustomFunctionOptions,
  runCustomFunction
};
