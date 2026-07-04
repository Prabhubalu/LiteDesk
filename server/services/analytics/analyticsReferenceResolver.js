const mongoose = require('mongoose');
const User = require('../../models/User');
const Organization = require('../../models/Organization');
const { loadModuleFields } = require('./analyticsFieldAccess');
const { parseQualifiedField } = require('./analyticsJoinPipeline');

const USER_REFERENCE_FIELD_KEYS = new Set([
  'assignedto',
  'createdby',
  'updatedby',
  'modifiedby',
  'ownerid',
  'submittedby',
]);

function extractObjectId(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof mongoose.Types.ObjectId) return String(value);
  if (typeof value === 'object' && value._id) return extractObjectId(value._id);
  const str = String(value).trim();
  if (!mongoose.Types.ObjectId.isValid(str)) return null;
  const normalized = String(new mongoose.Types.ObjectId(str));
  return normalized === str ? str : null;
}

function formatUserDisplayName(user) {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    user.username ||
    user.email ||
    String(user._id)
  );
}

function isUserReferenceField(fieldDef, columnKey) {
  const parsed = parseQualifiedField(columnKey);
  const fieldKey = String(parsed.field || columnKey || '').toLowerCase();
  if (USER_REFERENCE_FIELD_KEYS.has(fieldKey)) return true;

  const dataType = String(fieldDef?.dataType || fieldDef?.type || '').toLowerCase();
  if (dataType.includes('user')) return true;
  if (String(fieldDef?.filterType || '').toLowerCase() === 'user') return true;
  if (String(fieldDef?.lookupSettings?.targetModule || '').toLowerCase() === 'users') {
    return true;
  }
  return false;
}

function isOrganizationReferenceField(fieldDef, columnKey) {
  const parsed = parseQualifiedField(columnKey);
  const fieldKey = String(parsed.field || columnKey || '').toLowerCase();
  if (fieldKey === 'organization' || fieldKey === 'accountid' || fieldKey === 'organizationrefid') {
    return true;
  }
  const dataType = String(fieldDef?.dataType || fieldDef?.type || '').toLowerCase();
  if (dataType.includes('organization') || dataType.includes('account')) return true;
  if (String(fieldDef?.lookupSettings?.targetModule || '').toLowerCase() === 'organizations') {
    return true;
  }
  return false;
}

function normalizeColumnKey(column) {
  if (typeof column === 'string') return column;
  return String(column?.key || '');
}

async function loadFieldDefsByKey(organizationId, moduleKey, cache) {
  const normalized = String(moduleKey || '').toLowerCase();
  if (cache.has(normalized)) return cache.get(normalized);
  const { fields } = await loadModuleFields(organizationId, normalized);
  const byKey = new Map(
    (fields || []).map((field) => [String(field.key || '').toLowerCase(), field]),
  );
  cache.set(normalized, byKey);
  return byKey;
}

async function resolveReferenceDisplayValues(result, report, organizationId) {
  const rows = Array.isArray(result?.rows) ? result.rows : [];
  const columns = Array.isArray(result?.columns) ? result.columns : [];
  if (!rows.length || !columns.length || !organizationId) return result;

  const primaryModule = String(report?.primaryModule || '').toLowerCase();
  const fieldDefCache = new Map();
  const userColumnKeys = [];
  const organizationColumnKeys = [];

  for (const column of columns) {
    const columnKey = normalizeColumnKey(column);
    if (!columnKey) continue;

    const parsed = parseQualifiedField(columnKey);
    const moduleKey = parsed.module || primaryModule;
    const fieldDefs = await loadFieldDefsByKey(organizationId, moduleKey, fieldDefCache);
    const fieldDef = fieldDefs.get(String(parsed.field || '').toLowerCase());

    if (isUserReferenceField(fieldDef, columnKey)) {
      userColumnKeys.push(columnKey);
    } else if (isOrganizationReferenceField(fieldDef, columnKey)) {
      organizationColumnKeys.push(columnKey);
    }
  }

  let resolvedRows = rows;
  let resolvedColumns = columns;

  if (userColumnKeys.length) {
    const userIds = new Set();
    for (const row of resolvedRows) {
      for (const key of userColumnKeys) {
        const id = extractObjectId(row[key]);
        if (id) userIds.add(id);
      }
    }

    if (userIds.size) {
      const objectIds = [...userIds]
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));

      const users = objectIds.length
        ? await User.find({
            _id: { $in: objectIds },
            organizationId,
          })
            .select('firstName lastName username email')
            .lean()
        : [];

      const nameById = new Map(
        users.map((user) => [String(user._id), formatUserDisplayName(user)]),
      );

      resolvedRows = resolvedRows.map((row) => {
        const next = { ...row };
        for (const key of userColumnKeys) {
          const id = extractObjectId(row[key]);
          if (id && nameById.has(id)) {
            next[key] = nameById.get(id);
          }
        }
        return next;
      });

      const userColumnSet = new Set(userColumnKeys);
      resolvedColumns = resolvedColumns.map((column) => {
        const columnKey = normalizeColumnKey(column);
        if (!userColumnSet.has(columnKey)) return column;
        if (typeof column === 'string') {
          return { key: column, label: column, type: 'user', moduleKey: primaryModule };
        }
        return { ...column, type: 'user' };
      });
    }
  }

  if (organizationColumnKeys.length) {
    const orgIds = new Set();
    for (const row of resolvedRows) {
      for (const key of organizationColumnKeys) {
        const id = extractObjectId(row[key]);
        if (id) orgIds.add(id);
      }
    }

    if (orgIds.size) {
      const objectIds = [...orgIds]
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));

      const organizations = objectIds.length
        ? await Organization.find({
            _id: { $in: objectIds },
            isTenant: { $ne: true },
          })
            .select('name')
            .lean()
        : [];

      const nameById = new Map(
        organizations.map((org) => [String(org._id), org.name || String(org._id)]),
      );

      resolvedRows = resolvedRows.map((row) => {
        const next = { ...row };
        for (const key of organizationColumnKeys) {
          const id = extractObjectId(row[key]);
          if (id && nameById.has(id)) {
            next[key] = nameById.get(id);
          }
        }
        return next;
      });
    }
  }

  if (
    userColumnKeys.length === 0 &&
    organizationColumnKeys.length === 0
  ) {
    return result;
  }

  return {
    ...result,
    rows: resolvedRows,
    columns: resolvedColumns,
  };
}

module.exports = {
  USER_REFERENCE_FIELD_KEYS,
  extractObjectId,
  isUserReferenceField,
  isOrganizationReferenceField,
  formatUserDisplayName,
  resolveReferenceDisplayValues,
};
