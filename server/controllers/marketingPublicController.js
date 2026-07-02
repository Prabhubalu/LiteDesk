'use strict';

const {
  getPreferenceCenterPayload,
  updatePreferencesFromToken
} = require('../services/marketing/marketingSubscriptionService');

function clientMeta(req) {
  return {
    ip: req.ip || req.headers['x-forwarded-for'] || null,
    userAgent: req.headers['user-agent'] || null
  };
}

/**
 * GET /api/public/marketing/preferences/:token
 */
exports.getPreferenceCenter = async (req, res, next) => {
  try {
    const data = await getPreferenceCenterPayload(req.params.token);
    return res.json({ success: true, data });
  } catch (err) {
    if (err instanceof Error && /invalid|expired/i.test(err.message)) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return next(err);
  }
};

/**
 * PUT /api/public/marketing/preferences/:token
 */
exports.updatePreferenceCenter = async (req, res, next) => {
  try {
    const data = await updatePreferencesFromToken(req.params.token, req.body || {}, clientMeta(req));
    return res.json({ success: true, data });
  } catch (err) {
    if (err instanceof Error && /invalid|expired/i.test(err.message)) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return next(err);
  }
};

/**
 * POST /api/public/marketing/unsubscribe
 */
exports.unsubscribe = async (req, res, next) => {
  try {
    const token = String(req.body?.token || req.params?.token || '').trim();
    if (!token) {
      return res.status(400).json({ success: false, message: 'token is required' });
    }

    const data = await updatePreferencesFromToken(
      token,
      { unsubscribeAll: true, source: 'unsubscribe_link' },
      clientMeta(req)
    );
    return res.json({ success: true, data });
  } catch (err) {
    if (err instanceof Error && /invalid|expired/i.test(err.message)) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return next(err);
  }
};

/**
 * POST /api/public/marketing/preferences/:token/unsubscribe
 */
exports.unsubscribeByToken = async (req, res, next) => {
  try {
    const data = await updatePreferencesFromToken(
      req.params.token,
      { unsubscribeAll: true, source: 'unsubscribe_link' },
      clientMeta(req)
    );
    return res.json({ success: true, data });
  } catch (err) {
    if (err instanceof Error && /invalid|expired/i.test(err.message)) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return next(err);
  }
};
