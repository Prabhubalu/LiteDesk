'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const Organization = require('../../models/Organization');
const Task = require('../../models/Task');
const Item = require('../../models/Item');
const ModuleDefinition = require('../../models/ModuleDefinition');
const RecordActivity = require('../../models/RecordActivity');
const { bulkUpdateRecords } = require('../bulkUpdateService');

let mongoServer;
let organizationId;
let userId;

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  userId = new mongoose.Types.ObjectId();
  const org = await Organization.create({
    name: 'Bulk Update Test Org',
    assignedTo: userId,
    createdBy: userId,
  });
  organizationId = org._id;
});

test.after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

test('bulkUpdateRecords updates scalar fields for selected ids', async () => {
  await ModuleDefinition.create({
    organizationId,
    key: 'tasks',
    moduleKey: 'tasks',
    appKey: 'sales',
    label: 'Task',
    pluralLabel: 'Tasks',
    entityType: 'ACTIVITY',
    name: 'Tasks',
    type: 'system',
    enabled: true,
    fields: [
      { key: 'title', label: 'Title', dataType: 'Text', owner: 'org', editable: true },
      { key: 'priority', label: 'Priority', dataType: 'Picklist', owner: 'org', editable: true },
    ],
  });

  const task = await Task.create({
    organizationId,
    title: 'Before',
    priority: 'Low',
    assignedTo: userId,
    createdBy: userId,
  });

  const user = {
    _id: userId,
    organizationId,
    firstName: 'Phani',
    lastName: 'Varma',
    isOwner: true,
    role: 'admin',
    permissions: { tasks: { edit: true, view: true } },
  };

  const result = await bulkUpdateRecords({
    moduleKey: 'tasks',
    organizationId,
    user,
    ids: [String(task._id)],
    updates: { priority: 'High' },
  });

  assert.equal(result.updatedCount, 1);
  assert.equal(result.failedCount, 0);

  const refreshed = await Task.findById(task._id).lean();
  assert.equal(refreshed.priority, 'High');

  const logs = Array.isArray(refreshed.activityLogs) ? refreshed.activityLogs : [];
  const massEditLog = logs.find((l) => l?.details?.source === 'mass_edit' && l?.details?.field === 'priority');
  assert.ok(massEditLog, 'expected mass-edit activity log on task');
  assert.equal(massEditLog.details.from, 'Low');
  assert.equal(massEditLog.details.to, 'High');
  assert.equal(massEditLog.user, 'Phani Varma');
  assert.equal(String(massEditLog.userId), String(userId));
});

test('bulkUpdateRecords writes RecordActivity for items with mass_edit source', async () => {
  await ModuleDefinition.create({
    organizationId,
    key: 'items',
    moduleKey: 'items',
    appKey: 'sales',
    label: 'Item',
    pluralLabel: 'Items',
    entityType: 'CORE',
    name: 'Items',
    type: 'system',
    enabled: true,
    fields: [
      { key: 'item_name', label: 'Name', dataType: 'Text', owner: 'org', editable: true },
      { key: 'category', label: 'Category', dataType: 'Text', owner: 'org', editable: true },
    ],
  });

  const item = await Item.create({
    organizationId,
    item_name: 'SKU-1',
    item_type: 'Product',
    category: 'Draft Cat',
    assignedTo: userId,
    createdBy: userId,
  });

  const user = {
    _id: userId,
    organizationId,
    firstName: 'Phani',
    lastName: 'Varma',
    isOwner: true,
    role: 'admin',
    permissions: { items: { edit: true, view: true } },
  };

  const result = await bulkUpdateRecords({
    moduleKey: 'items',
    organizationId,
    user,
    ids: [String(item._id)],
    updates: { category: 'Active Cat' },
  });

  assert.equal(result.updatedCount, 1);

  const activities = await RecordActivity.find({
    organizationId,
    moduleKey: 'items',
  }).lean();

  const change = activities.find(
    (a) =>
      a.type === 'activity' &&
      a.details?.field === 'category' &&
      a.details?.source === 'mass_edit' &&
      String(a.recordId) === String(item._id)
  );
  assert.ok(change, 'expected RecordActivity mass-edit entry');
  assert.equal(change.details.from, 'Draft Cat');
  assert.equal(change.details.to, 'Active Cat');
  assert.equal(String(change.author), String(userId));
});

test('bulkUpdateRecords rejects denied lifecycle fields', async () => {
  const user = {
    _id: userId,
    organizationId,
    isOwner: true,
    role: 'admin',
    permissions: { deals: { edit: true, view: true } },
  };

  await assert.rejects(
    () => bulkUpdateRecords({
      moduleKey: 'deals',
      organizationId,
      user,
      ids: [new mongoose.Types.ObjectId().toString()],
      updates: { stage: 'Won' },
    }),
    (err) => err.code === 'BULK_UPDATE_FIELD_DENIED'
  );
});

test('bulkUpdateRecords rejects unsupported module', async () => {
  const user = {
    _id: userId,
    organizationId,
    isOwner: true,
    role: 'admin',
    permissions: { forms: { edit: true } },
  };

  await assert.rejects(
    () => bulkUpdateRecords({
      moduleKey: 'forms',
      organizationId,
      user,
      ids: [new mongoose.Types.ObjectId().toString()],
      updates: { name: 'X' },
    }),
    (err) => err.code === 'MODULE_BULK_UPDATE_UNSUPPORTED'
  );
});
