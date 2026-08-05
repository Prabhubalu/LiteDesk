/**
 * Writes activity log entries to RecordActivity for modules that use the generic
 * activity API (people, organizations, events, items, etc.). Used so the
 * ModuleRecordPage Activity panel shows "Updates" when records are edited.
 */
const RecordActivity = require('../models/RecordActivity');
const { getSalesParticipationValues } = require('./getSalesParticipationValues');
const mongoose = require('mongoose');

const SYSTEM_KEYS = new Set([
  '_id', '__v', 'organizationId', 'createdAt', 'updatedAt', 'createdBy', 'modifiedBy',
  'deletedAt', 'deletedBy', 'deletionReason', 'customFields', 'auditHistory'
]);

/** User-reference fields common on event (and similar) records */
const EVENT_USER_REF_FIELDS = new Set([
  'assignedTo',
  'auditorId',
  'reviewerId',
  'correctiveOwnerId'
]);
const EVENT_USER_ARRAY_FIELDS = new Set(['attendees']);
const EVENT_ORG_REF_FIELDS = new Set(['relatedToId']);

/**
 * Prefer a human name from a populated user/org-like document.
 * @param {*} value
 * @returns {string|null}
 */
function humanNameFromObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const person = [value.firstName, value.lastName].filter(Boolean).join(' ').trim();
  if (person) return person;
  if (typeof value.username === 'string' && value.username.trim()) return value.username.trim();
  if (typeof value.email === 'string' && value.email.trim()) return value.email.trim();
  if (typeof value.name === 'string' && value.name.trim()) return value.name.trim();
  const peopleName = [value.first_name, value.last_name].filter(Boolean).join(' ').trim();
  if (peopleName) return peopleName;
  return null;
}

/**
 * Format a value for display in an activity log (from/to).
 * @param {*} value
 * @param {number} maxLength
 * @returns {string}
 */
function formatValueForLog(value, maxLength = 200) {
  if (value === undefined || value === null) return 'Empty';
  if (typeof value === 'string') return value.trim() || 'Empty';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (mongoose.Types.ObjectId.isValid(value) && String(value).length === 24) return '[Reference]';
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      if (value.length === 0) return 'Empty';
      const parts = value.map((item) => formatValueForLog(item, maxLength));
      const joined = parts.join(', ');
      return joined.length <= maxLength ? joined : joined.slice(0, maxLength) + '…';
    }
    const human = humanNameFromObject(value);
    if (human) return human;
    const str = JSON.stringify(value);
    return str.length <= maxLength ? str : str.slice(0, maxLength) + '…';
  }
  return String(value);
}

/**
 * Short human summary of participations.* for activity logs (not raw JSON).
 * @param {*} participations
 * @returns {string}
 */
function summarizeParticipationsForLog(participations) {
  if (participations === undefined || participations === null) return 'Empty';
  if (typeof participations !== 'object' || Array.isArray(participations)) {
    return formatValueForLog(participations);
  }
  const parts = [];
  const sales = getSalesParticipationValues({ participations });
  if (sales.role || sales.lead_status || sales.contact_status) {
    const bits = [
      sales.role || null,
      sales.lead_status ? `Lead status: ${sales.lead_status}` : null,
      sales.contact_status ? `Contact status: ${sales.contact_status}` : null
    ].filter(Boolean);
    parts.push(bits.length ? `Sales — ${bits.join(', ')}` : 'Sales');
  }
  const hd = participations.HELPDESK;
  if (hd && String(hd.role || '').trim()) {
    parts.push(`Helpdesk — ${String(hd.role).trim()}`);
  }
  return parts.length > 0 ? parts.join('; ') : 'Empty';
}

/**
 * Get display label for a field key from module definition or humanize the key.
 * @param {string} fieldKey
 * @param {Array<{ key?: string, name?: string, label?: string }>} [fields]
 * @returns {string}
 */
function getFieldLabel(fieldKey, fields) {
  if (Array.isArray(fields)) {
    const f = fields.find((x) => (x.key || x.name || '').toString() === fieldKey);
    if (f && (f.label || f.name || f.key)) return String(f.label || f.name || f.key).trim();
  }
  return fieldKey
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

/**
 * @param {*} value
 * @returns {mongoose.Types.ObjectId|null}
 */
function extractObjectIdRef(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'object' && !Array.isArray(value) && value._id != null) {
    const id = value._id;
    if (mongoose.Types.ObjectId.isValid(id) && String(id).length === 24) {
      return new mongoose.Types.ObjectId(id);
    }
    return null;
  }
  if (mongoose.Types.ObjectId.isValid(value) && String(value).length === 24) {
    return new mongoose.Types.ObjectId(value);
  }
  return null;
}

/**
 * Resolve CRM organization (isTenant: false) names visible to this tenant.
 * Matches organization list scoping (createdBy ∈ tenant users).
 * @param {Set<string>|string[]} idStrings
 * @param {mongoose.Types.ObjectId} tenantOrganizationId
 * @returns {Promise<Map<string, string>>}
 */
async function resolveCrmOrganizationNames(idStrings, tenantOrganizationId) {
  const map = new Map();
  if (!tenantOrganizationId || !idStrings || (idStrings.size !== undefined && idStrings.size === 0)) {
    return map;
  }
  const arr = idStrings instanceof Set ? [...idStrings] : idStrings;
  const ids = arr.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id));
  if (ids.length === 0) return map;

  const User = require('../models/User');
  const Organization = require('../models/Organization');
  const tenantUserIds = await User.find({ organizationId: tenantOrganizationId }).select('_id').lean();
  const userIds = tenantUserIds.map((u) => u._id);
  if (userIds.length === 0) return map;

  const orgs = await Organization.find({
    _id: { $in: ids },
    isTenant: false,
    createdBy: { $in: userIds }
  })
    .select('name')
    .lean();

  for (const o of orgs) {
    map.set(o._id.toString(), (o.name && String(o.name).trim()) || '—');
  }
  return map;
}

/**
 * Resolve tenant user names for user-reference fields in activity logs.
 * @param {Set<string>|string[]} idStrings
 * @param {mongoose.Types.ObjectId} tenantOrganizationId
 * @returns {Promise<Map<string, string>>}
 */
async function resolveTenantUserNames(idStrings, tenantOrganizationId) {
  const map = new Map();
  if (!tenantOrganizationId || !idStrings || (idStrings.size !== undefined && idStrings.size === 0)) {
    return map;
  }
  const arr = idStrings instanceof Set ? [...idStrings] : idStrings;
  const ids = arr.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id));
  if (ids.length === 0) return map;

  const User = require('../models/User');
  const users = await User.find({ _id: { $in: ids }, organizationId: tenantOrganizationId })
    .select('firstName lastName username email')
    .lean();
  for (const u of users) {
    const name =
      [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
      u.username ||
      u.email ||
      u._id.toString();
    map.set(u._id.toString(), name);
  }
  return map;
}

/**
 * @param {*} value
 * @param {Map<string, string>} nameMap
 * @returns {string}
 */
function formatPeopleOrganizationForLog(value, nameMap) {
  if (value === undefined || value === null || value === '') return 'Empty';
  if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
    const n = value.name;
    if (typeof n === 'string' && n.trim()) return n.trim();
  }
  const id = extractObjectIdRef(value);
  if (!id) return formatValueForLog(value);
  const key = id.toString();
  if (nameMap && nameMap.has(key)) return nameMap.get(key);
  return formatValueForLog(id);
}

/**
 * @param {*} value
 * @param {Map<string, string>} nameMap
 * @returns {string}
 */
function formatCaseUserRefForLog(value, nameMap) {
  if (value === undefined || value === null || value === '') return 'Empty';
  if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
    const fn = value.firstName;
    const ln = value.lastName;
    const combined = [fn, ln].filter(Boolean).join(' ').trim();
    if (combined) return combined;
  }
  const id = extractObjectIdRef(value);
  if (!id) return formatValueForLog(value);
  const key = id.toString();
  if (nameMap && nameMap.has(key)) return nameMap.get(key);
  return '[Reference]';
}

/**
 * @param {*} value
 * @param {Map<string, string>} nameMap
 * @returns {string}
 */
function formatUserRefForLog(value, nameMap) {
  if (value === undefined || value === null || value === '') return 'Empty';
  if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
    const fn = value.firstName;
    const ln = value.lastName;
    const combined = [fn, ln].filter(Boolean).join(' ').trim();
    if (combined) return combined;
    if (typeof value.username === 'string' && value.username.trim()) return value.username.trim();
    if (typeof value.email === 'string' && value.email.trim()) return value.email.trim();
  }
  const id = extractObjectIdRef(value);
  if (!id) return formatValueForLog(value);
  const key = id.toString();
  if (nameMap && nameMap.has(key)) return nameMap.get(key);
  return '[Reference]';
}

/**
 * @param {*} value
 * @param {Map<string, string>} nameMap
 * @returns {string}
 */
function formatCaseContactRefForLog(value, nameMap) {
  if (value === undefined || value === null || value === '') return 'Empty';
  if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
    if (typeof value.name === 'string' && value.name.trim()) return value.name.trim();
    const parts = [value.first_name, value.last_name].filter(Boolean);
    if (parts.length) return parts.join(' ').trim();
  }
  const id = extractObjectIdRef(value);
  if (!id) return formatValueForLog(value);
  const key = id.toString();
  if (nameMap && nameMap.has(key)) return nameMap.get(key);
  return '[Reference]';
}

/**
 * Append a single activity log entry to RecordActivity.
 * @param {{
 *   organizationId: mongoose.Types.ObjectId,
 *   moduleKey: string,
 *   recordId: string | mongoose.Types.ObjectId,
 *   authorId: mongoose.Types.ObjectId,
 *   action: string,
 *   message?: string,
 *   details?: Record<string, any>
 * }} params
 * @returns {Promise<import('../models/RecordActivity')>}
 */
async function appendRecordActivityLog({ organizationId, moduleKey, recordId, authorId, action, message = '', details = {} }) {
  const doc = await RecordActivity.create({
    organizationId,
    moduleKey: String(moduleKey).trim().toLowerCase(),
    recordId: String(recordId),
    type: 'activity',
    action: String(action || 'updated').trim(),
    message: String(message).trim(),
    details: details && typeof details === 'object' ? details : {},
    author: authorId
  });
  return doc;
}

/**
 * Build field-change log entries and append them to RecordActivity.
 * Skips system keys and fields where from === to.
 * @param {{
 *   organizationId: mongoose.Types.ObjectId,
 *   moduleKey: string,
 *   recordId: string | mongoose.Types.ObjectId,
 *   authorId: mongoose.Types.ObjectId,
 *   previous: Record<string, any>,
 *   updated: Record<string, any>,
 *   updateDataKeys?: string[],
 *   fieldLabels?: Array<{ key?: string, name?: string, label?: string }>
 * }} params
 * @returns {Promise<number>} Number of entries created
 */
async function appendFieldChangeLogs({
  organizationId,
  moduleKey,
  recordId,
  authorId,
  previous,
  updated,
  updateDataKeys,
  fieldLabels
}) {
  const keys = Array.isArray(updateDataKeys) && updateDataKeys.length > 0
    ? updateDataKeys
    : Object.keys(updated || {}).filter((k) => !SYSTEM_KEYS.has(k));
  const prev = previous || {};
  const mod = String(moduleKey || '').toLowerCase();

  const orgIdsToResolve = new Set();
  if (mod === 'people') {
    for (const fieldKey of keys) {
      if (SYSTEM_KEYS.has(fieldKey) || fieldKey !== 'organization') continue;
      const fromId = extractObjectIdRef(prev[fieldKey]);
      const toId = extractObjectIdRef(updated[fieldKey]);
      if (fromId) orgIdsToResolve.add(fromId.toString());
      if (toId) orgIdsToResolve.add(toId.toString());
    }
  }
  const crmOrgNameMap =
    orgIdsToResolve.size > 0 ? await resolveCrmOrganizationNames(orgIdsToResolve, organizationId) : new Map();
  let peopleUserNameMap = new Map();
  if (mod === 'people') {
    const peopleUserIds = new Set();
    for (const fieldKey of keys) {
      if (SYSTEM_KEYS.has(fieldKey) || fieldKey !== 'assignedTo') continue;
      const fromId = extractObjectIdRef(prev[fieldKey]);
      const toId = extractObjectIdRef(updated[fieldKey]);
      if (fromId) peopleUserIds.add(fromId.toString());
      if (toId) peopleUserIds.add(toId.toString());
    }
    if (peopleUserIds.size > 0) {
      peopleUserNameMap = await resolveTenantUserNames(peopleUserIds, organizationId);
    }
  }

  let eventUserNameMap = new Map();
  let eventOrgNameMap = new Map();
  if (mod === 'events') {
    const eventUserIds = new Set();
    const eventOrgIds = new Set();
    for (const fieldKey of keys) {
      if (SYSTEM_KEYS.has(fieldKey)) continue;
      if (EVENT_USER_REF_FIELDS.has(fieldKey)) {
        for (const val of [prev[fieldKey], updated[fieldKey]]) {
          const id = extractObjectIdRef(val);
          if (id) eventUserIds.add(id.toString());
        }
      } else if (EVENT_USER_ARRAY_FIELDS.has(fieldKey)) {
        for (const val of [prev[fieldKey], updated[fieldKey]]) {
          const list = Array.isArray(val) ? val : val != null && val !== '' ? [val] : [];
          for (const item of list) {
            const id = extractObjectIdRef(item);
            if (id) eventUserIds.add(id.toString());
          }
        }
      } else if (EVENT_ORG_REF_FIELDS.has(fieldKey)) {
        for (const val of [prev[fieldKey], updated[fieldKey]]) {
          const id = extractObjectIdRef(val);
          if (id) eventOrgIds.add(id.toString());
        }
      }
    }
    if (eventUserIds.size > 0) {
      eventUserNameMap = await resolveTenantUserNames(eventUserIds, organizationId);
    }
    if (eventOrgIds.size > 0) {
      eventOrgNameMap = await resolveCrmOrganizationNames(eventOrgIds, organizationId);
    }
  }

  let caseUserNameMap = new Map();
  let caseContactNameMap = new Map();
  let caseCrmOrgNameMap = new Map();
  if (mod === 'cases') {
    const caseUserIds = new Set();
    const caseContactIds = new Set();
    const caseOrgIds = new Set();
    for (const fieldKey of keys) {
      if (SYSTEM_KEYS.has(fieldKey)) continue;
      if (fieldKey === 'assignedTo') {
        for (const val of [prev[fieldKey], updated[fieldKey]]) {
          const id = extractObjectIdRef(val);
          if (id) caseUserIds.add(id.toString());
        }
      } else if (fieldKey === 'contactId') {
        for (const val of [prev[fieldKey], updated[fieldKey]]) {
          const id = extractObjectIdRef(val);
          if (id) caseContactIds.add(id.toString());
        }
      } else if (fieldKey === 'organizationRefId') {
        for (const val of [prev[fieldKey], updated[fieldKey]]) {
          const id = extractObjectIdRef(val);
          if (id) caseOrgIds.add(id.toString());
        }
      }
    }
    if (caseUserIds.size > 0) {
      const User = require('../models/User');
      const uids = [...caseUserIds]
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));
      const users = await User.find({ _id: { $in: uids }, organizationId })
        .select('firstName lastName username email')
        .lean();
      caseUserNameMap = new Map(
        users.map((u) => {
          const name =
            [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.username || u.email || u._id.toString();
          return [u._id.toString(), name];
        })
      );
    }
    if (caseContactIds.size > 0) {
      const People = require('../models/People');
      const pids = [...caseContactIds]
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));
      const people = await People.find({
        _id: { $in: pids },
        organizationId,
        deletedAt: null
      })
        .select('first_name last_name name')
        .lean();
      caseContactNameMap = new Map(
        people.map((p) => {
          const name =
            (p.name && String(p.name).trim()) ||
            [p.first_name, p.last_name].filter(Boolean).join(' ').trim() ||
            p._id.toString();
          return [p._id.toString(), name];
        })
      );
    }
    if (caseOrgIds.size > 0) {
      caseCrmOrgNameMap = await resolveCrmOrganizationNames(caseOrgIds, organizationId);
    }
  }

  const entries = [];

  for (const fieldKey of keys) {
    if (SYSTEM_KEYS.has(fieldKey)) continue;
    const fromVal = prev[fieldKey];
    const toVal = updated[fieldKey];
    let fromStr;
    let toStr;
    let fieldLabel;
    if (fieldKey === 'participations') {
      fromStr = summarizeParticipationsForLog(fromVal);
      toStr = summarizeParticipationsForLog(toVal);
      fieldLabel = 'App participation';
    } else if (mod === 'people' && fieldKey === 'assignedTo') {
      fromStr = formatUserRefForLog(fromVal, peopleUserNameMap);
      toStr = formatUserRefForLog(toVal, peopleUserNameMap);
      fieldLabel = getFieldLabel(fieldKey, fieldLabels);
    } else if (mod === 'people' && fieldKey === 'organization') {
      fromStr = formatPeopleOrganizationForLog(fromVal, crmOrgNameMap);
      toStr = formatPeopleOrganizationForLog(toVal, crmOrgNameMap);
      fieldLabel = getFieldLabel(fieldKey, fieldLabels);
    } else if (mod === 'cases' && fieldKey === 'assignedTo') {
      fromStr = formatCaseUserRefForLog(fromVal, caseUserNameMap);
      toStr = formatCaseUserRefForLog(toVal, caseUserNameMap);
      fieldLabel = getFieldLabel(fieldKey, fieldLabels);
    } else if (mod === 'cases' && fieldKey === 'contactId') {
      fromStr = formatCaseContactRefForLog(fromVal, caseContactNameMap);
      toStr = formatCaseContactRefForLog(toVal, caseContactNameMap);
      fieldLabel = getFieldLabel(fieldKey, fieldLabels);
    } else if (mod === 'cases' && fieldKey === 'organizationRefId') {
      fromStr = formatPeopleOrganizationForLog(fromVal, caseCrmOrgNameMap);
      toStr = formatPeopleOrganizationForLog(toVal, caseCrmOrgNameMap);
      fieldLabel = getFieldLabel(fieldKey, fieldLabels);
    } else if (mod === 'events' && EVENT_USER_REF_FIELDS.has(fieldKey)) {
      fromStr = formatUserRefForLog(fromVal, eventUserNameMap);
      toStr = formatUserRefForLog(toVal, eventUserNameMap);
      fieldLabel = getFieldLabel(fieldKey, fieldLabels);
    } else if (mod === 'events' && EVENT_USER_ARRAY_FIELDS.has(fieldKey)) {
      const formatList = (val) => {
        if (val === undefined || val === null || val === '') return 'Empty';
        const list = Array.isArray(val) ? val : [val];
        if (list.length === 0) return 'Empty';
        return list.map((item) => formatUserRefForLog(item, eventUserNameMap)).join(', ');
      };
      fromStr = formatList(fromVal);
      toStr = formatList(toVal);
      fieldLabel = getFieldLabel(fieldKey, fieldLabels);
    } else if (mod === 'events' && EVENT_ORG_REF_FIELDS.has(fieldKey)) {
      fromStr = formatPeopleOrganizationForLog(fromVal, eventOrgNameMap);
      toStr = formatPeopleOrganizationForLog(toVal, eventOrgNameMap);
      fieldLabel = getFieldLabel(fieldKey, fieldLabels);
    } else {
      fromStr = formatValueForLog(fromVal);
      toStr = formatValueForLog(toVal);
      fieldLabel = getFieldLabel(fieldKey, fieldLabels);
    }
    if (fromStr === toStr) continue;

    const action = fieldKey === 'status' || fieldKey === 'stage' || fieldKey === 'lead_status' || fieldKey === 'contact_status'
      ? 'status_changed'
      : fieldKey === 'participations'
        ? 'participation_changed'
        : 'field_changed';

    entries.push({
      organizationId,
      moduleKey: String(moduleKey).trim().toLowerCase(),
      recordId: mongoose.Types.ObjectId.isValid(recordId) ? new mongoose.Types.ObjectId(recordId) : recordId,
      type: 'activity',
      action,
      message: '',
      details: {
        field: fieldKey,
        fieldLabel,
        from: fromStr,
        to: toStr
      },
      author: authorId
    });
  }

  if (entries.length === 0) return 0;
  await RecordActivity.insertMany(entries);
  return entries.length;
}

module.exports = {
  appendRecordActivityLog,
  appendFieldChangeLogs,
  formatValueForLog,
  summarizeParticipationsForLog,
  getFieldLabel,
  SYSTEM_KEYS
};
