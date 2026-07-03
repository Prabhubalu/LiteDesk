const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus, checkFeatureAccess } = require('../middleware/organizationMiddleware');
const { checkAnalyticsPermission } = require('../middleware/analyticsPermissionMiddleware');
const { ANALYTICS_MODULE_KEYS } = require('../permissions/analyticsPermissions');
const {
  listAnalyticsAlerts,
  getAnalyticsAlert,
  createAnalyticsAlert,
  updateAnalyticsAlert,
  deleteAnalyticsAlert,
  pauseAnalyticsAlert,
  resumeAnalyticsAlert,
} = require('../controllers/analyticsAlertController');

const router = express.Router();

router.use(protect);
router.use(organizationIsolation);
router.use(checkTrialStatus);
router.use(checkFeatureAccess('reports'));

router
  .route('/')
  .get(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'read'), listAnalyticsAlerts)
  .post(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'execute'), createAnalyticsAlert);

router
  .route('/:id')
  .get(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'read'), getAnalyticsAlert)
  .put(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'execute'), updateAnalyticsAlert)
  .delete(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'execute'), deleteAnalyticsAlert);

router.post(
  '/:id/pause',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'execute'),
  pauseAnalyticsAlert
);

router.post(
  '/:id/resume',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'execute'),
  resumeAnalyticsAlert
);

module.exports = router;
