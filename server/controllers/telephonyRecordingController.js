'use strict';

const TelephonyRecording = require('../models/TelephonyRecording');
const { createAdapter } = require('../services/telephony/telephonyProviderRegistry');
const TelephonyProviderConfig = require('../models/TelephonyProviderConfig');

exports.listRecordings = async (req, res) => {
  try {
    const filter = { organizationId: req.user.organizationId };
    if (req.query.callId) filter.callId = req.query.callId;
    const rows = await TelephonyRecording.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(req.query.limit) || 50, 200))
      .lean();
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[telephonyRecordingController] listRecordings', err);
    return res.status(500).json({ success: false, message: 'Failed to list recordings' });
  }
};

exports.getRecording = async (req, res) => {
  try {
    const row = await TelephonyRecording.findOne({
      _id: req.params.recordingId,
      organizationId: req.user.organizationId,
    }).lean();
    if (!row) {
      return res.status(404).json({ success: false, message: 'Recording not found' });
    }
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('[telephonyRecordingController] getRecording', err);
    return res.status(500).json({ success: false, message: 'Failed to load recording' });
  }
};

exports.downloadRecording = async (req, res) => {
  try {
    const row = await TelephonyRecording.findOne({
      _id: req.params.recordingId,
      organizationId: req.user.organizationId,
    }).lean();
    if (!row) {
      return res.status(404).json({ success: false, message: 'Recording not found' });
    }

    if (row.storageKey && /^https?:\/\//i.test(row.storageKey)) {
      return res.json({
        success: true,
        data: { url: row.storageKey, recordingId: String(row._id) },
      });
    }

    if (row.providerRecordingSid) {
      const config = await TelephonyProviderConfig.findOne({
        organizationId: req.user.organizationId,
        providerKey: row.providerKey,
      }).lean();
      if (config) {
        const adapter = createAdapter(row.providerKey, config);
        const meta = await adapter.getRecording(row.providerRecordingSid);
        return res.json({ success: true, data: { recording: row, provider: meta } });
      }
    }

    return res.status(404).json({ success: false, message: 'Recording media not available' });
  } catch (err) {
    console.error('[telephonyRecordingController] downloadRecording', err);
    return res.status(500).json({ success: false, message: 'Failed to download recording' });
  }
};
