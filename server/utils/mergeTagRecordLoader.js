'use strict';

const mongoose = require('mongoose');
const People = require('../models/People');
const Event = require('../models/Event');
const Form = require('../models/Form');
const { loadCrmOrganizationById } = require('./crmOrganizationLoader');

function normalizeObjectId(value) {
  if (!value) return '';
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
}

function getMergeTagRecordModel(moduleKey) {
  const key = String(moduleKey || '').toLowerCase();
  switch (key) {
    case 'people':
      return People;
    case 'deals':
      return require('../models/Deal');
    case 'cases':
      return require('../models/Case');
    case 'quotes':
      return require('../models/Quote');
    case 'invoices':
      return require('../models/Invoice');
    case 'tasks':
      return require('../models/Task');
    case 'events':
      return Event;
    case 'forms':
      return Form;
    case 'items':
      return require('../models/Item');
    case 'documents':
      return require('../models/Document');
    default:
      return null;
  }
}

function appendTenantScope(query, organizationId, moduleKey, Model) {
  const key = String(moduleKey || '').toLowerCase();
  if (key !== 'organizations' && key !== 'organization' && organizationId) {
    query.organizationId = organizationId;
  }
  if (Model?.schema?.paths?.deletedAt) {
    query.deletedAt = null;
  }
  return query;
}

/**
 * Load a related module record for merge-tag scope.
 * @param {string} organizationId
 * @param {string} moduleKey
 * @param {unknown} recordRef
 */
async function loadMergeTagModuleRecord(organizationId, moduleKey, recordRef) {
  const key = String(moduleKey || '').trim().toLowerCase();
  if (!recordRef) return null;

  if (typeof recordRef === 'object' && recordRef._id && Object.keys(recordRef).length > 2) {
    return recordRef;
  }

  const recordId = normalizeObjectId(recordRef);
  if (!recordId || !mongoose.Types.ObjectId.isValid(recordId)) {
    return null;
  }

  if (key === 'organizations' || key === 'organization') {
    return loadCrmOrganizationById(organizationId, recordId);
  }

  const Model = getMergeTagRecordModel(key);
  if (!Model) return null;

  const objectId = mongoose.Types.ObjectId.isValid(recordId)
    ? new mongoose.Types.ObjectId(recordId)
    : recordId;

  const query = appendTenantScope({ _id: objectId }, organizationId, key, Model);
  return Model.findOne(query).lean();
}

module.exports = {
  getMergeTagRecordModel,
  loadMergeTagModuleRecord
};
