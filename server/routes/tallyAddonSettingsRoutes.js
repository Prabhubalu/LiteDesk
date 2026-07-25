'use strict';

const express = require('express');
const TenantAddonConfiguration = require('../models/TenantAddonConfiguration');
const { ADDON_KEYS } = require('../constants/addonKeys');
const { TALLY_DEFAULT_SETTINGS } = require('../constants/tallyAddonConstants');
const { requireAddonEntitlement } = require('../middleware/requireAddonEntitlementMiddleware');

const router = express.Router();

router.use(requireAddonEntitlement(ADDON_KEYS.TALLY));

function canEditAddonSettings(req) {
  const settings = req.user?.permissions?.settings || {};
  return Boolean(settings.edit || settings.manageBilling);
}

router.get('/', async (req, res) => {
  try {
    const config = await TenantAddonConfiguration.findOne({
      organizationId: req.user.organizationId,
      addonKey: ADDON_KEYS.TALLY,
    }).lean();

    return res.json({
      success: true,
      data: {
        enabled: config?.enabled !== false,
        settings: {
          ...TALLY_DEFAULT_SETTINGS,
          ...(config?.settings || {}),
        },
      },
    });
  } catch (error) {
    console.error('[tallyAddonSettings] GET', error);
    return res.status(500).json({ success: false, message: 'Failed to load Tally settings' });
  }
});

router.put('/', async (req, res) => {
  try {
    if (!canEditAddonSettings(req)) {
      return res.status(403).json({ success: false, message: 'Settings edit permission required' });
    }

    const patch = req.body?.settings && typeof req.body.settings === 'object'
      ? req.body.settings
      : (req.body || {});

    let config = await TenantAddonConfiguration.findOne({
      organizationId: req.user.organizationId,
      addonKey: ADDON_KEYS.TALLY,
    });

    if (!config) {
      config = await TenantAddonConfiguration.create({
        organizationId: req.user.organizationId,
        addonKey: ADDON_KEYS.TALLY,
        enabled: true,
        settings: { ...TALLY_DEFAULT_SETTINGS, ...patch },
        installedBy: req.user._id,
        installedAt: new Date(),
      });
    } else {
      config.settings = {
        ...TALLY_DEFAULT_SETTINGS,
        ...(config.settings || {}),
        ...patch,
      };
      await config.save();
    }

    return res.json({
      success: true,
      data: {
        enabled: config.enabled !== false,
        settings: config.settings,
      },
    });
  } catch (error) {
    console.error('[tallyAddonSettings] PUT', error);
    return res.status(500).json({ success: false, message: 'Failed to update Tally settings' });
  }
});

module.exports = router;
