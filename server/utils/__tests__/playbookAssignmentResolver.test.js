'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const crypto = require('crypto');

const Organization = require('../../models/Organization');
const User = require('../../models/User');
const Role = require('../../models/Role');
const Group = require('../../models/Group');
const {
  resolveStageOwnerFromDeal,
  resolvePlaybookAssigneeId
} = require('../playbookAssignmentResolver');

let mongoServer;

async function seedOrg() {
  const suffix = crypto.randomUUID().slice(0, 8);
  return Organization.create({
    name: `Playbook Assign Org ${suffix}`,
    slug: `pb-assign-${suffix}`,
    isTenant: true,
    isActive: true
  });
}

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test('resolveStageOwnerFromDeal uses current stage history changedBy', () => {
  const stageOwnerId = new mongoose.Types.ObjectId();
  const deal = {
    stage: 'Qualification',
    stageHistory: [
      { stage: 'New', changedBy: new mongoose.Types.ObjectId() },
      { stage: 'Qualification', changedBy: stageOwnerId }
    ]
  };

  assert.equal(String(resolveStageOwnerFromDeal(deal, null)), String(stageOwnerId));
});

test('resolvePlaybookAssigneeId resolves deal_owner and specific_user', async () => {
  const org = await seedOrg();
  const dealOwner = await User.create({
    organizationId: org._id,
    username: `owner-${Date.now()}`,
    email: `owner-${Date.now()}@example.com`,
    password: 'test-password-1',
    firstName: 'Deal',
    lastName: 'Owner'
  });
  const specificUser = await User.create({
    organizationId: org._id,
    username: `specific-${Date.now()}`,
    email: `specific-${Date.now()}@example.com`,
    password: 'test-password-2',
    firstName: 'Specific',
    lastName: 'User'
  });

  const deal = {
    organizationId: org._id,
    ownerId: dealOwner._id,
    stage: 'Qualification'
  };

  const dealOwnerAssignee = await resolvePlaybookAssigneeId(deal, { type: 'deal_owner' });
  assert.equal(String(dealOwnerAssignee), String(dealOwner._id));

  const specificAssignee = await resolvePlaybookAssigneeId(deal, {
    type: 'specific_user',
    targetId: specificUser._id
  });
  assert.equal(String(specificAssignee), String(specificUser._id));
});

test('resolvePlaybookAssigneeId resolves role by name and prefers deal owner in role', async () => {
  const org = await seedOrg();
  const role = await Role.create({
    organizationId: org._id,
    name: 'Sales Rep',
    permissions: {}
  });
  const dealOwner = await User.create({
    organizationId: org._id,
    username: `role-owner-${Date.now()}`,
    email: `role-owner-${Date.now()}@example.com`,
    password: 'test-password-3',
    roleId: role._id,
    firstName: 'Role',
    lastName: 'Owner'
  });
  await User.create({
    organizationId: org._id,
    username: `role-other-${Date.now()}`,
    email: `role-other-${Date.now()}@example.com`,
    password: 'test-password-4',
    roleId: role._id,
    firstName: 'Other',
    lastName: 'Rep'
  });

  const deal = {
    organizationId: org._id,
    ownerId: dealOwner._id,
    stage: 'Qualification'
  };

  const assignee = await resolvePlaybookAssigneeId(deal, {
    type: 'role',
    targetName: 'Sales Rep'
  });
  assert.equal(String(assignee), String(dealOwner._id));
});

test('resolvePlaybookAssigneeId resolves team by name using lead', async () => {
  const org = await seedOrg();
  const lead = await User.create({
    organizationId: org._id,
    username: `team-lead-${Date.now()}`,
    email: `team-lead-${Date.now()}@example.com`,
    password: 'test-password-5',
    firstName: 'Team',
    lastName: 'Lead'
  });
  const member = await User.create({
    organizationId: org._id,
    username: `team-member-${Date.now()}`,
    email: `team-member-${Date.now()}@example.com`,
    password: 'test-password-6',
    firstName: 'Team',
    lastName: 'Member'
  });
  await Group.create({
    organizationId: org._id,
    name: 'Solutions',
    lead: lead._id,
    members: [member._id]
  });

  const deal = {
    organizationId: org._id,
    ownerId: new mongoose.Types.ObjectId(),
    stage: 'Qualification'
  };

  const assignee = await resolvePlaybookAssigneeId(deal, {
    type: 'team',
    targetName: 'Solutions'
  });
  assert.equal(String(assignee), String(lead._id));
});

test('resolvePlaybookAssigneeId resolves stage_owner from stage history', async () => {
  const org = await seedOrg();
  const stageOwner = new mongoose.Types.ObjectId();
  const deal = {
    organizationId: org._id,
    ownerId: new mongoose.Types.ObjectId(),
    stage: 'Proposal',
    stageHistory: [
      { stage: 'Qualification', changedBy: new mongoose.Types.ObjectId() },
      { stage: 'Proposal', changedBy: stageOwner }
    ]
  };

  const assignee = await resolvePlaybookAssigneeId(deal, { type: 'stage_owner' });
  assert.equal(String(assignee), String(stageOwner));
});
