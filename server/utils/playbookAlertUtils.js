'use strict';

const mongoose = require('mongoose');
const User = require('../models/User');
const { computeTriggerDelayRunAt } = require('./playbookTriggerUtils');

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveAlertAnchorDate(actionState, playbookState) {
  if (actionState?.dueAt) {
    return new Date(actionState.dueAt);
  }
  if (playbookState?.startedAt) {
    return new Date(playbookState.startedAt);
  }
  return new Date();
}

function computeAlertRunAt(actionState, playbookState, offset = {}) {
  const anchor = resolveAlertAnchorDate(actionState, playbookState);
  return computeTriggerDelayRunAt(anchor, offset);
}

function mapAlertTypeToChannels(alertType) {
  const type = String(alertType || 'in_app').toLowerCase();
  if (type === 'email') {
    return ['IN_APP', 'EMAIL'];
  }
  if (type === 'sms') {
    return ['IN_APP', 'SMS'];
  }
  return ['IN_APP'];
}

async function resolvePlaybookAlertRecipientUsers(organizationId, recipients, deal) {
  if (!organizationId) {
    return [];
  }

  const tokens = Array.isArray(recipients) ? recipients : [];
  const resolved = new Map();

  for (const token of tokens) {
    const trimmed = String(token || '').trim();
    if (!trimmed) continue;

    let user = null;
    if (mongoose.Types.ObjectId.isValid(trimmed)) {
      user = await User.findOne({
        _id: trimmed,
        organizationId,
        status: { $in: ['active', null] }
      }).select('_id').lean();
    } else {
      user = await User.findOne({
        organizationId,
        status: { $in: ['active', null] },
        $or: [
          { email: { $regex: new RegExp(`^${escapeRegex(trimmed)}$`, 'i') } },
          { username: { $regex: new RegExp(`^${escapeRegex(trimmed)}$`, 'i') } }
        ]
      }).select('_id').lean();
    }

    if (user?._id) {
      resolved.set(String(user._id), user._id);
    }
  }

  if (resolved.size === 0 && deal?.ownerId) {
    const owner = await User.findOne({
      _id: deal.ownerId._id || deal.ownerId,
      organizationId,
      status: { $in: ['active', null] }
    }).select('_id').lean();
    if (owner?._id) {
      resolved.set(String(owner._id), owner._id);
    }
  }

  return Array.from(resolved.values());
}

module.exports = {
  resolveAlertAnchorDate,
  computeAlertRunAt,
  mapAlertTypeToChannels,
  resolvePlaybookAlertRecipientUsers
};
