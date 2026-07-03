const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus, checkFeatureAccess } = require('../middleware/organizationMiddleware');
const { checkAnalyticsPermission } = require('../middleware/analyticsPermissionMiddleware');
const { ANALYTICS_MODULE_KEYS } = require('../permissions/analyticsPermissions');
const {
  listAnalyticsSnapshots,
  getAnalyticsSnapshot,
} = require('../controllers/analyticsScheduleController');

const router = express.Router();

router.use(protect);
router.use(organizationIsolation);
router.use(checkTrialStatus);
router.use(checkFeatureAccess('reports'));

router.get(
  '/',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'read'),
  listAnalyticsSnapshots
);

router.get(
  '/:id',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'read'),
  getAnalyticsSnapshot
);

module.exports = router;
