'use strict';

const TelephonyProviderConfig = require('../models/TelephonyProviderConfig');
const {
  createAdapter,
  listRegisteredProviders,
} = require('../services/telephony/telephonyProviderRegistry');

exports.listProviders = async (req, res) => {
  try {
    const rows = await TelephonyProviderConfig.find({
      organizationId: req.user.organizationId,
    })
      .select('-credentials.authToken -credentials.apiSecret -credentials.authTokenExotel')
      .lean();
    return res.json({
      success: true,
      data: rows,
      meta: { registered: listRegisteredProviders() },
    });
  } catch (err) {
    console.error('[telephonyProviderController] listProviders', err);
    return res.status(500).json({ success: false, message: 'Failed to list providers' });
  }
};

exports.upsertProvider = async (req, res) => {
  try {
    const providerKey = String(req.body?.providerKey || '').trim().toLowerCase();
    if (!providerKey) {
      return res.status(400).json({ success: false, message: 'providerKey is required' });
    }

    const credentials =
      req.body?.credentials && typeof req.body.credentials === 'object'
        ? req.body.credentials
        : {};
    const settings =
      req.body?.settings && typeof req.body.settings === 'object' ? req.body.settings : {};

    const externalAccountId =
      req.body?.externalAccountId ||
      credentials.accountSid ||
      credentials.authId ||
      null;

    if (req.body?.isActive === true) {
      await TelephonyProviderConfig.updateMany(
        { organizationId: req.user.organizationId, isActive: true },
        { $set: { isActive: false } }
      );
    }

    const row = await TelephonyProviderConfig.findOneAndUpdate(
      { organizationId: req.user.organizationId, providerKey },
      {
        $set: {
          enabled: req.body?.enabled !== false,
          isActive: req.body?.isActive === true,
          credentials,
          settings,
          webhookSecret: req.body?.webhookSecret || '',
          externalAccountId,
        },
      },
      { upsert: true, new: true }
    );

    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('[telephonyProviderController] upsertProvider', err);
    return res.status(500).json({ success: false, message: 'Failed to save provider' });
  }
};

exports.healthCheck = async (req, res) => {
  try {
    const providerKey = String(req.params.providerKey || '').trim().toLowerCase();
    const config = await TelephonyProviderConfig.findOne({
      organizationId: req.user.organizationId,
      providerKey,
    }).lean();
    if (!config) {
      return res.status(404).json({ success: false, message: 'Provider config not found' });
    }
    const adapter = createAdapter(providerKey, config);
    const data = await adapter.healthCheck();
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[telephonyProviderController] healthCheck', err);
    return res.status(500).json({ success: false, message: err.message || 'Health check failed' });
  }
};

exports.listPhoneNumbers = async (req, res) => {
  try {
    const config = await TelephonyProviderConfig.findOne({
      organizationId: req.user.organizationId,
      isActive: true,
    }).lean();
    if (!config) {
      return res.status(400).json({ success: false, message: 'No active provider' });
    }
    const adapter = createAdapter(config.providerKey, config);
    const data = await adapter.listPhoneNumbers({ limit: Number(req.query.limit) || 50 });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[telephonyProviderController] listPhoneNumbers', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to list numbers' });
  }
};
