'use strict';

const callManager = require('../services/telephony/callManager');
const telephonySearchService = require('../services/telephony/telephonySearchService');
const telephonySSEHub = require('../services/telephony/telephonySSEHub');
const { getProviderForOrganization } = require('../services/telephony/telephonyProviderRegistry');

exports.listCalls = async (req, res) => {
  try {
    const data = await callManager.listCalls(req.user.organizationId, {
      limit: req.query.limit,
      skip: req.query.skip,
      status: req.query.status,
      agentUserId: req.query.agentUserId,
    });
    return res.json({ success: true, data: data.rows, meta: { total: data.total } });
  } catch (err) {
    console.error('[telephonyCallController] listCalls', err);
    return res.status(500).json({ success: false, message: 'Failed to list calls' });
  }
};

exports.searchCalls = async (req, res) => {
  try {
    const data = await telephonySearchService.searchCalls(req.user.organizationId, {
      q: req.query.q,
      phone: req.query.phone,
      providerCallSid: req.query.providerCallSid,
      disposition: req.query.disposition,
      agentUserId: req.query.agentUserId,
      status: req.query.status,
      limit: req.query.limit,
      skip: req.query.skip,
    });
    return res.json({ success: true, data: data.rows, meta: { total: data.total } });
  } catch (err) {
    console.error('[telephonyCallController] searchCalls', err);
    return res.status(500).json({ success: false, message: 'Failed to search calls' });
  }
};

exports.getCall = async (req, res) => {
  try {
    const data = await callManager.getCall(req.user.organizationId, req.params.callId);
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[telephonyCallController] getCall', err);
    return res.status(500).json({ success: false, message: 'Failed to load call' });
  }
};

exports.placeCall = async (req, res) => {
  try {
    const call = await callManager.placeOutboundCall({
      organizationId: req.user.organizationId,
      to: req.body?.to,
      from: req.body?.from,
      agentUserId: req.user._id,
      url: req.body?.url,
      statusCallback: req.body?.statusCallback,
      linkedCaseId: req.body?.linkedCaseId,
    });
    return res.status(201).json({ success: true, data: call });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[telephonyCallController] placeCall', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to place call' });
  }
};

exports.hangUp = async (req, res) => {
  try {
    const call = await callManager.hangUp({
      organizationId: req.user.organizationId,
      callId: req.params.callId,
    });
    return res.json({ success: true, data: call });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[telephonyCallController] hangUp', err);
    return res.status(500).json({ success: false, message: 'Failed to hang up' });
  }
};

exports.mute = async (req, res) => {
  try {
    const call = await callManager.mute({
      organizationId: req.user.organizationId,
      callId: req.params.callId,
    });
    return res.json({ success: true, data: call });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[telephonyCallController] mute', err);
    return res.status(500).json({ success: false, message: 'Failed to mute' });
  }
};

exports.hold = async (req, res) => {
  try {
    const call = await callManager.hold({
      organizationId: req.user.organizationId,
      callId: req.params.callId,
      resume: req.body?.resume === true,
    });
    return res.json({ success: true, data: call });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[telephonyCallController] hold', err);
    return res.status(500).json({ success: false, message: 'Failed to hold' });
  }
};

exports.transfer = async (req, res) => {
  try {
    const call = await callManager.transfer({
      organizationId: req.user.organizationId,
      callId: req.params.callId,
      to: req.body?.to,
    });
    return res.json({ success: true, data: call });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[telephonyCallController] transfer', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to transfer' });
  }
};

exports.attachNotes = async (req, res) => {
  try {
    const note = await callManager.attachNotes({
      organizationId: req.user.organizationId,
      callId: req.params.callId,
      userId: req.user._id,
      notes: req.body?.notes,
      disposition: req.body?.disposition,
      followUpDate: req.body?.followUpDate,
      nextAction: req.body?.nextAction,
    });
    return res.status(201).json({ success: true, data: note });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[telephonyCallController] attachNotes', err);
    return res.status(500).json({ success: false, message: 'Failed to attach notes' });
  }
};

exports.createClientToken = async (req, res) => {
  try {
    const adapter = await getProviderForOrganization(req.user.organizationId);
    if (!adapter) {
      return res.status(400).json({ success: false, message: 'No active telephony provider' });
    }
    const data = await adapter.createClientToken({
      identity: String(req.user._id),
      ttlSeconds: req.body?.ttlSeconds,
    });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[telephonyCallController] createClientToken', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to create token' });
  }
};

exports.streamEvents = async (req, res) => {
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
    res.write('event: connected\ndata: {}\n\n');
    telephonySSEHub.subscribe(res, req.user._id, req.user.organizationId);
  } catch (err) {
    console.error('[telephonyCallController] streamEvents', err);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: 'Failed to open stream' });
    }
  }
};
