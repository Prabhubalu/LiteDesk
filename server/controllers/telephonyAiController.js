'use strict';

const telephonyAiService = require('../services/telephony/telephonyAiService');
const { enqueueTelephonyJob } = require('../services/telephony/telephonyQueueService');
const TelephonyTranscript = require('../models/TelephonyTranscript');
const TelephonySummary = require('../models/TelephonySummary');

exports.requestTranscript = async (req, res) => {
  try {
    const callId = req.params.callId || req.body?.callId;
    enqueueTelephonyJob('generateTranscript', {
      organizationId: String(req.user.organizationId),
      callId: String(callId),
      recordingId: req.body?.recordingId ? String(req.body.recordingId) : null,
    });
    return res.json({ success: true, data: { queued: true } });
  } catch (err) {
    console.error('[telephonyAiController] requestTranscript', err);
    return res.status(500).json({ success: false, message: 'Failed to queue transcript' });
  }
};

exports.requestSummary = async (req, res) => {
  try {
    const callId = req.params.callId || req.body?.callId;
    enqueueTelephonyJob('generateSummary', {
      organizationId: String(req.user.organizationId),
      callId: String(callId),
      transcriptId: req.body?.transcriptId ? String(req.body.transcriptId) : null,
    });
    return res.json({ success: true, data: { queued: true } });
  } catch (err) {
    console.error('[telephonyAiController] requestSummary', err);
    return res.status(500).json({ success: false, message: 'Failed to queue summary' });
  }
};

exports.getTranscript = async (req, res) => {
  try {
    const data = await TelephonyTranscript.findOne({
      organizationId: req.user.organizationId,
      callId: req.params.callId,
    }).lean();
    if (!data) return res.status(404).json({ success: false, message: 'Transcript not found' });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[telephonyAiController] getTranscript', err);
    return res.status(500).json({ success: false, message: 'Failed to load transcript' });
  }
};

exports.getSummary = async (req, res) => {
  try {
    const data = await TelephonySummary.findOne({
      organizationId: req.user.organizationId,
      callId: req.params.callId,
    }).lean();
    if (!data) return res.status(404).json({ success: false, message: 'Summary not found' });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[telephonyAiController] getSummary', err);
    return res.status(500).json({ success: false, message: 'Failed to load summary' });
  }
};

exports.generateNow = async (req, res) => {
  try {
    const callId = req.params.callId;
    const transcript = await telephonyAiService.generateTranscript({
      organizationId: req.user.organizationId,
      callId,
    });
    const summary = await telephonyAiService.generateSummary({
      organizationId: req.user.organizationId,
      callId,
    });
    return res.json({ success: true, data: { transcript, summary } });
  } catch (err) {
    console.error('[telephonyAiController] generateNow', err);
    return res.status(500).json({ success: false, message: 'AI generation failed' });
  }
};
