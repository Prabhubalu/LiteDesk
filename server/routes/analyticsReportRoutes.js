const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus, checkFeatureAccess } = require('../middleware/organizationMiddleware');
const { checkAnalyticsPermission } = require('../middleware/analyticsPermissionMiddleware');
const { ANALYTICS_MODULE_KEYS } = require('../permissions/analyticsPermissions');
const {
  listReports,
  createReport,
  getReportById,
  updateReport,
  deleteReport,
  publishReport,
  executeReport,
  previewReport,
  exportReport,
  duplicateReport,
  certifyReport,
  uncertifyReport,
} = require('../controllers/analyticsReportController');

const router = express.Router();

router.use(protect);
router.use(organizationIsolation);
router.use(checkTrialStatus);
router.use(checkFeatureAccess('reports'));

router.post(
  '/preview',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'execute'),
  previewReport
);

router
  .route('/')
  .get(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'read'), listReports)
  .post(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'create'), createReport);

router
  .route('/:id')
  .get(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'read'), getReportById)
  .put(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'update'), updateReport)
  .delete(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'delete'), deleteReport);

router.post(
  '/:id/duplicate',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'create'),
  duplicateReport
);

router.post(
  '/:id/publish',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'publish'),
  publishReport
);

router.post(
  '/:id/execute',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'execute'),
  executeReport
);

router.post(
  '/:id/export',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'export'),
  exportReport
);

router.post(
  '/:id/certify',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.ADMIN, 'certify'),
  certifyReport
);

router.post(
  '/:id/uncertify',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.ADMIN, 'certify'),
  uncertifyReport
);

module.exports = router;
