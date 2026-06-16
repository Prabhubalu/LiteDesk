const mongoose = require('mongoose');
const Case = require('../models/Case');
const People = require('../models/People');
const Deal = require('../models/Deal');
const Task = require('../models/Task');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Event = require('../models/Event');
const Form = require('../models/Form');
const Item = require('../models/Item');

function getModelForModuleKey(moduleKey) {
  const key = String(moduleKey || '').toLowerCase();
  switch (key) {
    case 'people':
      return People;
    case 'organizations':
    case 'organization':
      return Organization;
    case 'deals':
    case 'deal':
      return Deal;
    case 'cases':
    case 'case':
      return Case;
    case 'tasks':
    case 'task':
      return Task;
    case 'events':
    case 'event':
      return Event;
    case 'forms':
    case 'form':
      return Form;
    case 'items':
    case 'item':
      return Item;
    default:
      return null;
  }
}

function buildTenantScopedQuery({ organizationId, moduleKey, recordId, Model }) {
  const query = mongoose.Types.ObjectId.isValid(recordId)
    ? { _id: recordId }
    : { _id: String(recordId) };
  const key = String(moduleKey || '').toLowerCase();

  if (key === 'organizations' || key === 'organization') {
    query.isTenant = false;
    return { query, requiresCreatedByTenantCheck: true };
  }

  if (organizationId) {
    query.organizationId = organizationId;
  }
  if (Model?.schema?.paths?.deletedAt) {
    query.deletedAt = null;
  }
  return { query, requiresCreatedByTenantCheck: false };
}

/**
 * Load a record for an assignment schedule job (tenant-scoped).
 * @param {import('mongoose').Document} job
 * @returns {Promise<import('mongoose').Document|null>}
 */
async function loadRecordForAssignmentJob(job) {
  const organizationId = job.organizationId;
  const recordId = job.recordId;
  const moduleKey = String(job.moduleKey || '').toLowerCase();

  if (!mongoose.Types.ObjectId.isValid(recordId)) return null;

  const Model = getModelForModuleKey(moduleKey);
  if (!Model) return null;

  const { query, requiresCreatedByTenantCheck } = buildTenantScopedQuery({
    organizationId,
    moduleKey,
    recordId,
    Model
  });

  const record = await Model.findOne(query);
  if (!record) return null;

  if (requiresCreatedByTenantCheck) {
    if (!record.createdBy || !organizationId) return null;
    const allowed = await User.exists({ _id: record.createdBy, organizationId });
    return allowed ? record : null;
  }

  return record;
}

module.exports = {
  loadRecordForAssignmentJob,
  getModelForModuleKey,
  buildTenantScopedQuery
};
