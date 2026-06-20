'use strict';

const mongoose = require('mongoose');
const RecordPresenceSession = require('../models/RecordPresenceSession');
const {
  PRESENCE_ACTIVITY_TYPES,
  PRESENCE_TTL_MS
} = require('../constants/recordPresence');

const USER_POPULATE = 'firstName lastName email username avatar';

const MODEL_BY_KEY = {
  deals: () => require('../models/Deal'),
  tasks: () => require('../models/Task'),
  cases: () => require('../models/Case'),
  people: () => require('../models/People'),
  organizations: () => require('../models/Organization'),
  events: () => require('../models/Event'),
  items: () => require('../models/Item'),
  responses: () => require('../models/FormResponse'),
  quotes: () => require('../models/Quote'),
  sales_orders: () => require('../models/SalesOrder'),
  documents: () => require('../models/Document'),
  forms: () => require('../models/Form'),
  invoices: () => require('../models/Invoice'),
  payments: () => require('../models/Payment')
};

function normalizeModuleKey(moduleKey) {
  return String(moduleKey || '').trim().toLowerCase();
}

function normalizeRecordId(recordId) {
  const id = String(recordId || '').trim();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error('Invalid record id');
  }
  return id;
}

async function assertRecordExists({ organizationId, moduleKey, recordId }) {
  const key = normalizeModuleKey(moduleKey);
  const id = normalizeRecordId(recordId);
  const getModel = MODEL_BY_KEY[key];
  if (!getModel) {
    throw new Error(`Presence is not supported for module: ${moduleKey}`);
  }

  const Model = getModel();

  if (key === 'organizations') {
    const { findTenantAccessibleCrmOrganization } = require('../utils/crmOrganizationAccess');
    const row = await findTenantAccessibleCrmOrganization(organizationId, id);
    if (!row) throw new Error('Record not found');
    return row;
  }

  const query = { _id: id, organizationId };
  if (Model.schema?.paths?.deletedAt) query.deletedAt = null;

  const row = await Model.findOne(query).select('_id').lean();
  if (!row) throw new Error('Record not found');
  return row;
}

async function listRecordPresence({ organizationId, moduleKey, recordId }) {
  const key = normalizeModuleKey(moduleKey);
  const id = normalizeRecordId(recordId);
  await assertRecordExists({ organizationId, moduleKey: key, recordId: id });

  const cutoff = new Date(Date.now() - PRESENCE_TTL_MS);
  await RecordPresenceSession.deleteMany({
    organizationId,
    moduleKey: key,
    recordId: id,
    lastSeenAt: { $lt: cutoff }
  });

  return RecordPresenceSession.find({
    organizationId,
    moduleKey: key,
    recordId: id,
    lastSeenAt: { $gte: cutoff }
  })
    .populate('userId', USER_POPULATE)
    .sort({ lastSeenAt: -1 })
    .lean();
}

async function heartbeatRecordPresence({
  organizationId,
  moduleKey,
  recordId,
  userId,
  activityType = 'viewing'
}) {
  const key = normalizeModuleKey(moduleKey);
  const id = normalizeRecordId(recordId);
  await assertRecordExists({ organizationId, moduleKey: key, recordId: id });

  const normalizedActivity = PRESENCE_ACTIVITY_TYPES.has(activityType) ? activityType : 'viewing';
  const now = new Date();

  const session = await RecordPresenceSession.findOneAndUpdate(
    { organizationId, moduleKey: key, recordId: id, userId },
    {
      $set: {
        activityType: normalizedActivity,
        lastSeenAt: now
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).populate('userId', USER_POPULATE);

  return session;
}

async function clearRecordPresence({ organizationId, moduleKey, recordId, userId }) {
  const key = normalizeModuleKey(moduleKey);
  const id = normalizeRecordId(recordId);
  await RecordPresenceSession.deleteOne({
    organizationId,
    moduleKey: key,
    recordId: id,
    userId
  });
}

async function getRecordPresenceSession({ organizationId, moduleKey, recordId, userId }) {
  const key = normalizeModuleKey(moduleKey);
  const id = normalizeRecordId(recordId);
  return RecordPresenceSession.findOne({
    organizationId,
    moduleKey: key,
    recordId: id,
    userId
  })
    .select('activityType')
    .lean();
}

module.exports = {
  listRecordPresence,
  heartbeatRecordPresence,
  clearRecordPresence,
  getRecordPresenceSession,
  assertRecordExists
};
