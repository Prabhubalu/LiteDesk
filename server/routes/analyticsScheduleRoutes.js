const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus, checkFeatureAccess } = require('../middleware/organizationMiddleware');
const { checkAnalyticsPermission } = require('../middleware/analyticsPermissionMiddleware');
const { ANALYTICS_MODULE_KEYS } = require('../permissions/analyticsPermissions');
const {
  listAnalyticsSchedules,
  getAnalyticsSchedule,
  createAnalyticsSchedule,
  updateAnalyticsSchedule,
  deleteAnalyticsSchedule,
  pauseAnalyticsSchedule,
  resumeAnalyticsSchedule,
  runAnalyticsScheduleNow,
  listAnalyticsSnapshots,
  getAnalyticsSnapshot,
} = require('../controllers/analyticsScheduleController');

const router = express.Router();

router.use(protect);
router.use(organizationIsolation);
router.use(checkTrialStatus);
router.use(checkFeatureAccess('reports'));

router
  .route('/')
  .get(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'read'), listAnalyticsSchedules)
  .post(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'schedule'), createAnalyticsSchedule);

router
  .route('/:id')
  .get(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'read'), getAnalyticsSchedule)
  .put(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'schedule'), updateAnalyticsSchedule)
  .delete(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'schedule'), deleteAnalyticsSchedule);

router.post(
  '/:id/run-now',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'schedule'),
  runAnalyticsScheduleNow
);

router.post(
  '/:id/pause',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'schedule'),
  pauseAnalyticsSchedule
);

router.post(
  '/:id/resume',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'schedule'),
  resumeAnalyticsSchedule
);

module.exports = router;
