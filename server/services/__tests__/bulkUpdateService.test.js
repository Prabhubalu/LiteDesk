'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const Organization = require('../../models/Organization');
const Task = require('../../models/Task');
const ModuleDefinition = require('../../models/ModuleDefinition');
const { bulkUpdateRecords } = require('../bulkUpdateService');

let mongoServer;
let organizationId;
let userId;

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  const org = await Organization.create({ name: 'Bulk Update Test Org' });
  organizationId = org._id;
  userId = new mongoose.Types.ObjectId();
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
