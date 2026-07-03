const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus, checkFeatureAccess } = require('../middleware/organizationMiddleware');
const { checkAnalyticsPermission } = require('../middleware/analyticsPermissionMiddleware');
const { ANALYTICS_MODULE_KEYS } = require('../permissions/analyticsPermissions');
const {
  listDashboards,
  createDashboard,
  getDashboardById,
  updateDashboard,
  deleteDashboard,
  publishDashboard,
  executeDashboard,
  duplicateDashboard,
  getDefaultDashboard,
  certifyDashboard,
  uncertifyDashboard,
} = require('../controllers/analyticsDashboardController');
const {
  listDashboardEmbedTokens,
  createDashboardEmbedToken,
  revokeDashboardEmbedToken,
} = require('../controllers/analyticsEmbedController');

const router = express.Router();

router.use(protect);
router.use(organizationIsolation);
router.use(checkTrialStatus);
router.use(checkFeatureAccess('reports'));

router
  .route('/')
  .get(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.DASHBOARDS, 'read'), listDashboards)
  .post(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.DASHBOARDS, 'create'), createDashboard);

router.get(
  '/default',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.DASHBOARDS, 'read'),
  getDefaultDashboard
);

router
  .route('/:id')
  .get(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.DASHBOARDS, 'read'), getDashboardById)
  .put(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.DASHBOARDS, 'update'), updateDashboard)
  .delete(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.DASHBOARDS, 'delete'), deleteDashboard);

router.post(
  '/:id/publish',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.DASHBOARDS, 'publish'),
  publishDashboard
);

router.post(
  '/:id/execute',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.DASHBOARDS, 'read'),
  executeDashboard
);

router.post(
  '/:id/duplicate',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.DASHBOARDS, 'create'),
  duplicateDashboard
);

router.get(
  '/:id/embed-tokens',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.DASHBOARDS, 'share'),
  listDashboardEmbedTokens
);

router.post(
  '/:id/embed-tokens',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.DASHBOARDS, 'share'),
  createDashboardEmbedToken
);

router.post(
  '/embed-tokens/:tokenId/revoke',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.DASHBOARDS, 'share'),
  revokeDashboardEmbedToken
);

router.post(
  '/:id/certify',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.ADMIN, 'certify'),
  certifyDashboard
);

router.post(
  '/:id/uncertify',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.ADMIN, 'certify'),
  uncertifyDashboard
);

module.exports = router;
