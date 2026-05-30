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
    rowNumber,
    fieldMapping,
    organizationId,
    userId,
    importHistoryId,
    updateExisting,
    shouldCheckDuplicates,
    results,
  } = ctx;

  const rawPayload = mapRowToPeopleImportPayload(row, fieldMapping);
  const contactData = buildPeopleCreatePayload(rawPayload, { organizationId, userId });

  if (shouldCheckDuplicates && contactData.email) {
    const existing = await People.findOne({ organizationId, email: contactData.email });
    if (existing) {
      if (updateExisting) {
        const $set = buildPeopleUpdateSet(rawPayload, existing);
        await People.updateOne({ _id: existing._id }, { $set });
        results.updated += 1;
        pushUpdatedId(results, existing._id);
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
    results,
  } = ctx;

  const dealData = { organizationId, ownerId: userId };

  Object.keys(fieldMapping).forEach((csvField) => {
    const dealField = fieldMapping[csvField];
    if (dealField && row[csvField]) {
      if (dealField === 'amount') {
        dealData[dealField] = parseFloat(String(row[csvField]).replace(/[^0-9.-]+/g, ''));
      } else if (dealField === 'expectedCloseDate') {
        dealData[dealField] = new Date(row[csvField]);
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

  if (shouldCheckDuplicates) {
    const existing = await Deal.findOne({ organizationId, name: dealData.name });
    if (existing) {
      if (updateExisting) {
        await Deal.updateOne({ _id: existing._id }, dealData);
        results.updated += 1;
        pushUpdatedId(results, existing._id);
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
    results,
  } = ctx;

  const taskData = { organizationId, createdBy: userId, assignedBy: userId };

  for (const [csvField, taskField] of Object.entries(fieldMapping)) {
    if (row[csvField] === undefined || row[csvField] === '') continue;
    if (taskField === 'dueDate') {
      taskData[taskField] = new Date(row[csvField]);
    } else if (taskField === 'timeEstimate') {
      taskData[taskField] = parseInt(row[csvField], 10) || 0;
    } else if (taskField === 'tags') {
      taskData[taskField] = String(row[csvField]).split(',').map((tag) => tag.trim());
    } else {
      taskData[taskField] = row[csvField];
    }
  }

  if (!taskData.title) {
    results.failed += 1;
    pushError(results, rowNumber, 'Title is required');
    return;
  }
  if (!taskData.assignedTo) taskData.assignedTo = userId;
  if (!taskData.status) taskData.status = 'todo';
  if (!taskData.priority) taskData.priority = 'medium';

  stripClientSource(taskData);

  if (shouldCheckDuplicates) {
    const existing = await Task.findOne({ organizationId, title: taskData.title });
    if (existing && updateExisting) {
      await Task.findByIdAndUpdate(existing._id, taskData);
      results.updated += 1;
      pushUpdatedId(results, existing._id);
    } else if (!existing) {
    assignResolvedSource(taskData, 'import');
    if (importHistoryId) taskData.importHistoryId = importHistoryId;
    const newTask = await Task.create(taskData);
      results.created += 1;
      pushCreatedId(results, newTask._id);
    } else {
      results.skipped += 1;
    }
    return;
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
    userId,
    importHistoryId,
    updateExisting,
    shouldCheckDuplicates,
    results,
    orgContext,
  } = ctx;

  const allowedOrgFields = new Set(['name', 'industry', 'website', 'phone', 'address']);
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

  Object.keys(fieldMapping).forEach((csvField) => {
    const orgField = fieldMapping[csvField];
    if (orgField && allowedOrgFields.has(orgField) && row[csvField]) {
      orgData[orgField] = String(row[csvField]).trim();
    }
  });

  stripClientSource(orgData);

  if (!orgData.name) {
    results.failed += 1;
    pushError(results, rowNumber, 'Organization name is required');
    return;
  }

  if (shouldCheckDuplicates) {
    const existing = await Organization.findOne({
      ...orgContext.crmBaseQuery,
      name: orgData.name,
    });
    if (existing) {
      if (updateExisting) {
        const { activityLogs, createdBy, isTenant, ...updates } = orgData;
        await Organization.updateOne({ _id: existing._id }, updates);
        results.updated += 1;
        pushUpdatedId(results, existing._id);
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
};
