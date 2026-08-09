'use strict';

const mongoose = require('mongoose');
const TelephonyCampaign = require('../../models/TelephonyCampaign');
const TelephonyCampaignLog = require('../../models/TelephonyCampaignLog');
const { placeOutboundCall } = require('./callManager');
const telephonySSEHub = require('./telephonySSEHub');

const { MODES, STATUSES } = TelephonyCampaign;

function getListEntries(campaign) {
  const ref = campaign.listRef;
  if (!ref) return [];
  if (Array.isArray(ref)) return ref;
  if (Array.isArray(ref.entries)) return ref.entries;
  if (Array.isArray(ref.phoneNumbers)) {
    return ref.phoneNumbers.map((p) => (typeof p === 'string' ? { phoneNumber: p } : p));
  }
  return [];
}

async function listCampaigns(organizationId) {
  return TelephonyCampaign.find({ organizationId }).sort({ updatedAt: -1 }).lean();
}

async function getCampaign(organizationId, campaignId) {
  if (!mongoose.Types.ObjectId.isValid(campaignId)) return null;
  return TelephonyCampaign.findOne({ _id: campaignId, organizationId }).lean();
}

async function createCampaign(organizationId, payload = {}) {
  const name = String(payload.name || '').trim();
  if (!name) {
    const err = new Error('name is required');
    err.statusCode = 400;
    throw err;
  }
  return TelephonyCampaign.create({
    organizationId,
    name,
    mode: MODES.includes(payload.mode) ? payload.mode : 'preview',
    status: 'draft',
    listRef: payload.listRef || null,
    maxAttempts: Number(payload.maxAttempts) || 3,
    retryMinutes: Number(payload.retryMinutes) || 30,
    amdEnabled: payload.amdEnabled === true,
    fromNumber: payload.fromNumber || null,
    agentUserId: payload.agentUserId || null,
    stats: { dialed: 0, connected: 0, failed: 0 },
  });
}

async function updateCampaign(organizationId, campaignId, payload = {}) {
  const row = await TelephonyCampaign.findOne({ _id: campaignId, organizationId });
  if (!row) {
    const err = new Error('Campaign not found');
    err.statusCode = 404;
    throw err;
  }
  if (payload.name != null) row.name = String(payload.name).trim();
  if (MODES.includes(payload.mode)) row.mode = payload.mode;
  if (payload.listRef !== undefined) row.listRef = payload.listRef;
  if (payload.maxAttempts != null) row.maxAttempts = Number(payload.maxAttempts) || 3;
  if (payload.retryMinutes != null) row.retryMinutes = Number(payload.retryMinutes) || 30;
  if (payload.amdEnabled != null) row.amdEnabled = payload.amdEnabled === true;
  if (payload.fromNumber !== undefined) row.fromNumber = payload.fromNumber;
  if (payload.agentUserId !== undefined) row.agentUserId = payload.agentUserId;
  await row.save();
  return row;
}

async function startCampaign(organizationId, campaignId) {
  const row = await TelephonyCampaign.findOne({ _id: campaignId, organizationId });
  if (!row) {
    const err = new Error('Campaign not found');
    err.statusCode = 404;
    throw err;
  }
  row.status = 'running';
  await row.save();
  telephonySSEHub.publishToOrg(organizationId, {
    type: 'CampaignProgress',
    campaignId: String(row._id),
    status: 'running',
  });
  return row;
}

async function pauseCampaign(organizationId, campaignId) {
  const row = await TelephonyCampaign.findOne({ _id: campaignId, organizationId });
  if (!row) {
    const err = new Error('Campaign not found');
    err.statusCode = 404;
    throw err;
  }
  row.status = 'paused';
  await row.save();
  telephonySSEHub.publishToOrg(organizationId, {
    type: 'CampaignProgress',
    campaignId: String(row._id),
    status: 'paused',
  });
  return row;
}

async function resumeCampaign(organizationId, campaignId) {
  return startCampaign(organizationId, campaignId);
}

/**
 * Dial next number for preview/power modes.
 */
async function dialNext(organizationId, campaignId, { agentUserId = null } = {}) {
  const campaign = await TelephonyCampaign.findOne({ _id: campaignId, organizationId });
  if (!campaign) {
    const err = new Error('Campaign not found');
    err.statusCode = 404;
    throw err;
  }
  if (campaign.status !== 'running') {
    const err = new Error('Campaign is not running');
    err.statusCode = 400;
    throw err;
  }
  if (!['preview', 'power'].includes(campaign.mode)) {
    const err = new Error('dialNext supports preview and power modes only');
    err.statusCode = 400;
    throw err;
  }

  const entries = getListEntries(campaign);
  const logs = await TelephonyCampaignLog.find({ organizationId, campaignId }).lean();
  const attemptMap = new Map();
  for (const log of logs) {
    const key = String(log.phoneNumber);
    attemptMap.set(key, Math.max(attemptMap.get(key) || 0, log.attempt || 0));
  }

  let nextEntry = null;
  for (const entry of entries) {
    const phone = String(entry.phoneNumber || entry.phone || '').trim();
    if (!phone) continue;
    const attempts = attemptMap.get(phone) || 0;
    if (attempts < (campaign.maxAttempts || 3)) {
      nextEntry = { phoneNumber: phone, attempt: attempts + 1 };
      break;
    }
  }

  if (!nextEntry) {
    campaign.status = 'completed';
    await campaign.save();
    telephonySSEHub.publishToOrg(organizationId, {
      type: 'CampaignProgress',
      campaignId: String(campaign._id),
      status: 'completed',
    });
    return { done: true, call: null };
  }

  const call = await placeOutboundCall({
    organizationId,
    to: nextEntry.phoneNumber,
    from: campaign.fromNumber,
    agentUserId: agentUserId || campaign.agentUserId,
    campaignId: campaign._id,
  });

  await TelephonyCampaignLog.create({
    organizationId,
    campaignId: campaign._id,
    phoneNumber: nextEntry.phoneNumber,
    attempt: nextEntry.attempt,
    outcome: 'dialed',
    callId: call._id,
  });

  const stats = campaign.stats || {};
  stats.dialed = (Number(stats.dialed) || 0) + 1;
  campaign.stats = stats;
  await campaign.save();

  telephonySSEHub.publishToOrg(organizationId, {
    type: 'CampaignProgress',
    campaignId: String(campaign._id),
    dialed: stats.dialed,
    phoneNumber: nextEntry.phoneNumber,
  });

  return { done: false, call, phoneNumber: nextEntry.phoneNumber };
}

module.exports = {
  MODES,
  STATUSES,
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  startCampaign,
  pauseCampaign,
  resumeCampaign,
  dialNext,
};
