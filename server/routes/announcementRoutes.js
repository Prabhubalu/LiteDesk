'use strict';

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const { requireAddonEntitlement } = require('../middleware/requireAddonEntitlementMiddleware');
const { requireAnnouncementPermission } = require('../middleware/requireAnnouncementPermissionMiddleware');
const { ADDON_KEYS } = require('../constants/addonKeys');
const { isAddonEntitledForOrg } = require('../utils/addonAccessUtils');
const controller = require('../controllers/announcementController');
const announcementService = require('../services/announcementService');

router.use(protect);
router.use(organizationIsolation);

/** Runtime: org addon + platform system banners (trial/subscription) even without addon. */
async function loadRuntimeActive(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: 'Organization context required' });
    }
    const surface = String(req.query.surface || 'web_app').toLowerCase();
    const entitled = await isAddonEntitledForOrg(organizationId, ADDON_KEYS.ANNOUNCEMENTS);
    const data = entitled
      ? await announcementService.getActiveForUser({
        organizationId,
        user: req.user,
        surface: ['web_app', 'portal', 'mobile'].includes(surface) ? surface : 'web_app',
      })
      : await announcementService.getActivePlatformOnlyForUser({
        organizationId,
        user: req.user,
      });
    // Must not cache — dismiss/ack must take effect on the next fetch/refresh.
    res.set('Cache-Control', 'private, no-store');
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[announcementRoutes] runtime active failed', error);
    return res.json({ success: true, data: { banner: null, popover: null } });
  }
}

router.get('/runtime/active', loadRuntimeActive);
router.post('/runtime/:id/view', controller.recordView);
router.post('/runtime/:id/dismiss', controller.recordDismiss);
router.post('/runtime/:id/acknowledge', controller.recordAcknowledge);
router.post('/runtime/:id/cta/:ctaId/click', controller.recordCtaClick);

router.use(requireAddonEntitlement(ADDON_KEYS.ANNOUNCEMENTS));

router.get('/meta/audience-options', requireAnnouncementPermission('view'), controller.audienceOptions);
router.get('/analytics/summary', requireAnnouncementPermission('analytics'), controller.analyticsSummary);
router.get('/:id/analytics', requireAnnouncementPermission('analytics'), controller.analyticsOne);
router.get('/', requireAnnouncementPermission('view'), controller.list);
router.get('/:id', requireAnnouncementPermission('view'), controller.getOne);
router.post('/', requireAnnouncementPermission('manage'), controller.create);
router.put('/:id', requireAnnouncementPermission('manage'), controller.update);
router.post('/:id/duplicate', requireAnnouncementPermission('manage'), controller.duplicate);
router.delete('/:id', requireAnnouncementPermission('manage'), controller.remove);
router.post('/:id/publish', requireAnnouncementPermission('publish'), controller.publish);
router.post('/:id/pause', requireAnnouncementPermission('publish'), controller.pause);
router.post('/:id/resume', requireAnnouncementPermission('publish'), controller.resume);
router.post('/:id/archive', requireAnnouncementPermission('publish'), controller.archive);

module.exports = router;
