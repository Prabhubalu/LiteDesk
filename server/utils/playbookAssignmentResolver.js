'use strict';

const mongoose = require('mongoose');
const User = require('../models/User');
const Role = require('../models/Role');
const Group = require('../models/Group');

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveDealOwnerId(deal) {
  return deal?.assignedTo?._id || deal?.assignedTo || null;
}

function resolveStageOwnerFromDeal(deal, actorId) {
  const history = Array.isArray(deal?.stageHistory) ? deal.stageHistory : [];
  const currentStage = String(deal?.stage || '').trim();

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    const entryStage = String(entry?.stage || '').trim();
    if (entryStage === currentStage && entry?.changedBy) {
      return entry.changedBy._id || entry.changedBy;
    }
  }

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (entry?.changedBy) {
      return entry.changedBy._id || entry.changedBy;
    }
  }

  return actorId || null;
}

async function resolveSpecificUserAssignee(organizationId, targetId) {
  if (!targetId || !mongoose.Types.ObjectId.isValid(String(targetId))) {
    return null;
  }

  const user = await User.findOne({
    _id: targetId,
    organizationId,
    status: { $in: ['active', null] }
  }).select('_id').lean();

  return user?._id || null;
}

async function resolveRoleAssignee(organizationId, assignment, dealOwnerId) {
  let role = null;

  if (assignment?.targetId && mongoose.Types.ObjectId.isValid(String(assignment.targetId))) {
    role = await Role.findOne({
      _id: assignment.targetId,
      organizationId
    }).select('_id').lean();
  }

  const targetName = String(assignment?.targetName || '').trim();
  if (!role && targetName) {
    role = await Role.findOne({
      organizationId,
      name: { $regex: new RegExp(`^${escapeRegex(targetName)}$`, 'i') }
    }).select('_id').lean();
  }

  if (!role?._id) {
    return null;
  }

  if (dealOwnerId) {
    const owner = await User.findOne({
      _id: dealOwnerId,
      organizationId,
      roleId: role._id,
      status: { $in: ['active', null] }
    }).select('_id').lean();
    if (owner) {
      return owner._id;
    }
  }

  const user = await User.findOne({
    organizationId,
    roleId: role._id,
    status: { $in: ['active', null] }
  })
    .sort({ firstName: 1, lastName: 1, _id: 1 })
    .select('_id')
    .lean();

  return user?._id || null;
}

async function resolveTeamAssignee(organizationId, assignment, dealOwnerId) {
  let group = null;

  if (assignment?.targetId && mongoose.Types.ObjectId.isValid(String(assignment.targetId))) {
    group = await Group.findOne({
      _id: assignment.targetId,
      organizationId,
      isActive: true
    }).select('lead members').lean();
  }

  const targetName = String(assignment?.targetName || '').trim();
  if (!group && targetName) {
    group = await Group.findOne({
      organizationId,
      name: { $regex: new RegExp(`^${escapeRegex(targetName)}$`, 'i') },
      isActive: true
    }).select('lead members').lean();
  }

  if (!group) {
    return null;
  }

  const members = Array.isArray(group.members) ? group.members : [];
  if (dealOwnerId) {
    const ownerIdString = String(dealOwnerId);
    if (members.some((memberId) => String(memberId) === ownerIdString)) {
      return dealOwnerId;
    }
  }

  if (group.lead) {
    return group.lead;
  }

  return members[0] || null;
}

async function resolvePlaybookAssigneeId(deal, assignment, actorId = null) {
  const organizationId = deal?.organizationId;
  if (!organizationId) {
    return null;
  }

  const assignmentType = assignment?.type || 'deal_owner';
  const dealOwnerId = resolveDealOwnerId(deal);

  if (assignmentType === 'specific_user') {
    return resolveSpecificUserAssignee(organizationId, assignment?.targetId);
  }

  if (assignmentType === 'stage_owner') {
    const stageOwnerId = resolveStageOwnerFromDeal(deal, actorId);
    return stageOwnerId || dealOwnerId || actorId || null;
  }

  if (assignmentType === 'role') {
    const roleAssignee = await resolveRoleAssignee(organizationId, assignment, dealOwnerId);
    if (roleAssignee) {
      return roleAssignee;
    }
    return dealOwnerId || actorId || null;
  }

  if (assignmentType === 'team') {
    const teamAssignee = await resolveTeamAssignee(organizationId, assignment, dealOwnerId);
    if (teamAssignee) {
      return teamAssignee;
    }
    return dealOwnerId || actorId || null;
  }

  if (assignmentType === 'deal_owner') {
    return dealOwnerId || actorId || null;
  }

  return dealOwnerId || actorId || null;
}

module.exports = {
  escapeRegex,
  resolveDealOwnerId,
  resolveStageOwnerFromDeal,
  resolveSpecificUserAssignee,
  resolveRoleAssignee,
  resolveTeamAssignee,
  resolvePlaybookAssigneeId
};
