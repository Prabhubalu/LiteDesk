const People = require('../../models/People');
const Deal = require('../../models/Deal');
const Task = require('../../models/Task');
const Organization = require('../../models/Organization');
const User = require('../../models/User');
const { assignResolvedSource, stripClientSource } = require('../sourceResolver');
const {
  mapRowToPeopleImportPayload,
  buildPeopleCreatePayload,
  buildPeopleUpdateSet,
} = require('../../utils/peopleImportMapper');
const { IMPORT_MAX_STORED_ERRORS, IMPORT_MAX_STORED_RECORD_IDS } = require('./importConstants');
const { findImportDuplicate } = require('./importDuplicateQuery');

function createResultsAccumulator(total = 0) {
  return {
    total,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    createdIds: [],
    updatedIds: [],
    recordIdsTruncated: false,
  };
}

function isHexObjectId(value) {
  return typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value);
}

function normalizeAssigneeNameKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Build an org-scoped index so CSV assignee cells exported as
 * "First Last" / email / username / ObjectId can resolve to User ids.
 */
async function buildAssigneeLookup(organizationId) {
  const users = await User.find({ organizationId })
    .select('_id firstName lastName email username')
    .lean();

  const byId = new Map();
  const byEmail = new Map();
  const byUsername = new Map();
  const byName = new Map();

  for (const user of users) {
    const id = user._id;
    byId.set(String(id), id);

    if (user.email) {
      byEmail.set(String(user.email).trim().toLowerCase(), id);
    }
    if (user.username) {
      byUsername.set(String(user.username).trim().toLowerCase(), id);
    }

    const fullName = normalizeAssigneeNameKey(`${user.firstName || ''} ${user.lastName || ''}`);
    if (fullName) {
      const list = byName.get(fullName) || [];
      list.push(id);
      byName.set(fullName, list);
    }
  }

  return { byId, byEmail, byUsername, byName };
}

/**
 * @returns {{ id?: import('mongoose').Types.ObjectId, error?: string }}
 */
function resolveImportAssignee(rawValue, lookup, fallbackUserId) {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
    return { id: fallbackUserId };
  }

  const value = String(rawValue).trim();
  if (isHexObjectId(value)) {
    const id = lookup.byId.get(value);
    if (id) return { id };
    return { error: `Assigned user not found: ${value}` };
  }

  const lower = value.toLowerCase();
  if (lookup.byEmail.has(lower)) {
    return { id: lookup.byEmail.get(lower) };
  }
  if (lookup.byUsername.has(lower)) {
    return { id: lookup.byUsername.get(lower) };
  }

  const nameKey = normalizeAssigneeNameKey(value);
  const nameMatches = lookup.byName.get(nameKey);
  if (nameMatches?.length === 1) {
    return { id: nameMatches[0] };
  }
  if (nameMatches?.length > 1) {
    return { error: `Multiple users match assigned user "${value}"` };
  }

  return { error: `Assigned user not found: ${value}` };
}

function pushError(results, rowNumber, errorMessage) {
  if (results.errors.length < IMPORT_MAX_STORED_ERRORS) {
    results.errors.push({ row: rowNumber, error: errorMessage });
  }
}

function pushCreatedId(results, id) {
  if (results.createdIds.length < IMPORT_MAX_STORED_RECORD_IDS) {
    results.createdIds.push(id);
  } else {
    results.recordIdsTruncated = true;
  }
}

function pushUpdatedId(results, id) {
  if (results.updatedIds.length < IMPORT_MAX_STORED_RECORD_IDS) {
    results.updatedIds.push(id);
  } else {
    results.recordIdsTruncated = true;
  }
}

async function getTenantUserIds(organizationId) {
  const users = await User.find({ organizationId }).select('_id').lean();
  return users.map((user) => user._id);
}

async function buildCrmOrganizationQuery(organizationId) {
  const tenantUserIds = await getTenantUserIds(organizationId);
  return {
    isTenant: false,
    deletedAt: null,
    createdBy: { $in: tenantUserIds },
  };
}

async function buildOrganizationImportContext(userId) {
  const user = await User.findById(userId).select('firstName lastName username');
  const userName = user
    ? ((user.firstName || user.lastName)
      ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
      : user.username) || 'User'
    : 'User';
  return { userName };
}

async function processContactsRow(ctx) {
  const {
    row,
    fieldMapping,
    organizationId,
    userId,
    importHistoryId,
    updateExisting,
    shouldCheckDuplicates,
    duplicateCheckFields,
    results,
  } = ctx;

  const rawPayload = mapRowToPeopleImportPayload(row, fieldMapping);
  const contactData = buildPeopleCreatePayload(rawPayload, { organizationId, userId });

  if (shouldCheckDuplicates) {
    const match = await findImportDuplicate({
      module: 'contacts',
      row,
      fieldMapping,
      checkFields: duplicateCheckFields,
      organizationId,
    });
    if (match) {
      if (updateExisting) {
        const $set = buildPeopleUpdateSet(rawPayload, match.existing);
        await People.updateOne({ _id: match.existing._id }, { $set });
        results.updated += 1;
        pushUpdatedId(results, match.existing._id);
      } else {
        results.skipped += 1;
      }
      return;
    }
  }

  assignResolvedSource(contactData, 'import');
  if (importHistoryId) contactData.importHistoryId = importHistoryId;
  const newContact = await People.create(contactData);
  results.created += 1;
  pushCreatedId(results, newContact._id);
}

async function processDealsRow(ctx) {
  const {
    row,
    rowNumber,
    fieldMapping,
    organizationId,
    userId,
    importHistoryId,
    updateExisting,
    shouldCheckDuplicates,
    duplicateCheckFields,
    results,
    assigneeLookup,
  } = ctx;

  const dealData = { organizationId };
  let assignedRaw;

  Object.keys(fieldMapping).forEach((csvField) => {
    const dealField = fieldMapping[csvField];
    if (dealField && row[csvField]) {
      if (dealField === 'amount') {
        dealData[dealField] = parseFloat(String(row[csvField]).replace(/[^0-9.-]+/g, ''));
      } else if (dealField === 'expectedCloseDate') {
        dealData[dealField] = new Date(row[csvField]);
      } else if (dealField === 'assignedTo') {
        assignedRaw = row[csvField];
      } else {
        dealData[dealField] = row[csvField];
      }
    }
  });

  stripClientSource(dealData);

  if (!dealData.name) {
    results.failed += 1;
    pushError(results, rowNumber, 'Deal name is required');
    return;
  }

  const assigned = resolveImportAssignee(assignedRaw, assigneeLookup, userId);
  if (assigned.error) {
    results.failed += 1;
    pushError(results, rowNumber, assigned.error);
    return;
  }
  dealData.assignedTo = assigned.id;

  if (shouldCheckDuplicates) {
    const match = await findImportDuplicate({
      module: 'deals',
      row,
      fieldMapping,
      checkFields: duplicateCheckFields,
      organizationId,
    });
    if (match) {
      if (updateExisting) {
        await Deal.updateOne({ _id: match.existing._id }, dealData);
        results.updated += 1;
        pushUpdatedId(results, match.existing._id);
      } else {
        results.skipped += 1;
      }
      return;
    }
  }

  assignResolvedSource(dealData, 'import');
  if (importHistoryId) dealData.importHistoryId = importHistoryId;
  const newDeal = await Deal.create(dealData);
  results.created += 1;
  pushCreatedId(results, newDeal._id);
}

async function processTasksRow(ctx) {
  const {
    row,
    rowNumber,
    fieldMapping,
    organizationId,
    userId,
    importHistoryId,
    updateExisting,
    shouldCheckDuplicates,
    duplicateCheckFields,
    results,
    assigneeLookup,
  } = ctx;

  const taskData = { organizationId, createdBy: userId, assignedBy: userId };
  let assignedRaw;

  for (const [csvField, taskField] of Object.entries(fieldMapping)) {
    if (!taskField) continue;
    if (row[csvField] === undefined || row[csvField] === '') continue;
    if (taskField === 'dueDate') {
      taskData[taskField] = new Date(row[csvField]);
    } else if (taskField === 'timeEstimate' || taskField === 'estimatedHours') {
      taskData.estimatedHours = parseInt(row[csvField], 10) || 0;
    } else if (taskField === 'tags') {
      taskData[taskField] = String(row[csvField]).split(',').map((tag) => tag.trim()).filter(Boolean);
    } else if (taskField === 'assignedTo') {
      assignedRaw = row[csvField];
    } else {
      taskData[taskField] = row[csvField];
    }
  }

  if (!taskData.title) {
    results.failed += 1;
    pushError(results, rowNumber, 'Title is required');
    return;
  }

  const assigned = resolveImportAssignee(assignedRaw, assigneeLookup, userId);
  if (assigned.error) {
    results.failed += 1;
    pushError(results, rowNumber, assigned.error);
    return;
  }
  taskData.assignedTo = assigned.id;

  if (!taskData.status) taskData.status = 'todo';
  if (!taskData.priority) taskData.priority = 'medium';

  stripClientSource(taskData);

  if (shouldCheckDuplicates) {
    const match = await findImportDuplicate({
      module: 'tasks',
      row,
      fieldMapping,
      checkFields: duplicateCheckFields,
      organizationId,
    });
    if (match) {
      if (updateExisting) {
        await Task.findByIdAndUpdate(match.existing._id, taskData);
        results.updated += 1;
        pushUpdatedId(results, match.existing._id);
      } else {
        results.skipped += 1;
      }
      return;
    }
  }

  assignResolvedSource(taskData, 'import');
  if (importHistoryId) taskData.importHistoryId = importHistoryId;
  const newTask = await Task.create(taskData);
  results.created += 1;
  pushCreatedId(results, newTask._id);
}

async function processOrganizationsRow(ctx) {
  const {
    row,
    rowNumber,
    fieldMapping,
    organizationId,
    userId,
    importHistoryId,
    updateExisting,
    shouldCheckDuplicates,
    duplicateCheckFields,
    results,
    orgContext,
  } = ctx;

  const orgSkipFields = new Set([
    'createdby', 'modifiedby', 'createdat', 'updatedat', 'organizationid',
    'derivedstatus', 'deletedat', 'deletedby', 'deletionreason', 'importhistoryid',
    'activitylogs', 'source', 'istenant', 'legacyorganizationid',
  ]);
  const orgMultiValueFields = new Set(['types', 'tags', 'territory', 'distributionterritory']);
  const orgDateFields = new Set(['partnersince']);
  const orgNumberFields = new Set([
    'creditlimit', 'annualrevenue', 'numberofemployees', 'discountrate',
    'vendorrating', 'distributioncapacitymonthly',
  ]);

  const orgData = {
    isTenant: false,
    createdBy: userId,
    assignedTo: userId,
    activityLogs: [{
      user: orgContext.userName,
      userId,
      action: 'created this record',
      details: { type: 'create', source: 'import' },
      timestamp: new Date(),
    }],
  };

  Object.entries(fieldMapping).forEach(([csvField, orgField]) => {
    if (!orgField || row[csvField] === undefined || row[csvField] === '') return;
    const norm = String(orgField).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (orgSkipFields.has(norm)) return;

    const raw = row[csvField];
    if (orgMultiValueFields.has(norm)) {
      orgData[orgField] = String(raw).split(',').map((value) => value.trim()).filter(Boolean);
    } else if (orgDateFields.has(norm)) {
      orgData[orgField] = new Date(raw);
    } else if (orgNumberFields.has(norm)) {
      orgData[orgField] = parseFloat(String(raw).replace(/[^0-9.-]+/g, '')) || 0;
    } else {
      orgData[orgField] = String(raw).trim();
    }
  });

  stripClientSource(orgData);

  if (!orgData.name) {
    results.failed += 1;
    pushError(results, rowNumber, 'Organization name is required');
    return;
  }

  if (shouldCheckDuplicates) {
    const match = await findImportDuplicate({
      module: 'organizations',
      row,
      fieldMapping,
      checkFields: duplicateCheckFields,
      organizationId,
      crmBaseQuery: orgContext.crmBaseQuery,
    });
    if (match) {
      if (updateExisting) {
        const { activityLogs, createdBy, isTenant, ...updates } = orgData;
        await Organization.updateOne({ _id: match.existing._id }, updates);
        results.updated += 1;
        pushUpdatedId(results, match.existing._id);
      } else {
        results.skipped += 1;
      }
      return;
    }
  }

  assignResolvedSource(orgData, 'import');
  if (importHistoryId) orgData.importHistoryId = importHistoryId;
  const newOrg = await Organization.create(orgData);
  results.created += 1;
  pushCreatedId(results, newOrg._id);
}

const ROW_PROCESSORS = Object.freeze({
  contacts: processContactsRow,
  deals: processDealsRow,
  tasks: processTasksRow,
  organizations: processOrganizationsRow,
});

function getRowProcessor(module) {
  const processor = ROW_PROCESSORS[module];
  if (!processor) {
    throw new Error(`Unsupported import module: ${module}`);
  }
  return processor;
}

module.exports = {
  createResultsAccumulator,
  getRowProcessor,
  buildCrmOrganizationQuery,
  buildOrganizationImportContext,
  buildAssigneeLookup,
  resolveImportAssignee,
};
