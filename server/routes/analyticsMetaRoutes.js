const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const { checkAnalyticsPermission } = require('../middleware/analyticsPermissionMiddleware');
const { ANALYTICS_MODULE_KEYS } = require('../permissions/analyticsPermissions');
const {
  getAnalyticsCatalog,
  listReportExecutions,
  getExecution,
} = require('../controllers/analyticsReportController');
const { getWidgetTemplates } = require('../controllers/analyticsWidgetController');
const { getDashboardTemplates } = require('../controllers/analyticsDashboardController');
const {
  getAnalyticsHome,
  searchAnalyticsAssets,
  listFavorites,
  addFavorite,
  removeFavorite,
  listFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  listTrash,
  restoreTrashItem,
  getAnalyticsSettings,
  updateAnalyticsSettings,
} = require('../controllers/analyticsMetaController');

const router = express.Router();

router.use(protect);
router.use(organizationIsolation);

router.get(
  '/home',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'read'),
  getAnalyticsHome
);

router.get(
  '/search',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'read'),
  searchAnalyticsAssets
);

router.get(
  '/favorites',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'read'),
  listFavorites
);

router.post(
  '/favorites',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'read'),
  addFavorite
);

router.delete(
  '/favorites/:assetType/:assetId',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'read'),
  removeFavorite
);

router
  .route('/folders')
  .get(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'read'), listFolders)
  .post(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'create'), createFolder);

router
  .route('/folders/:id')
  .put(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'update'), updateFolder)
  .delete(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'delete'), deleteFolder);

router.get(
  '/trash',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'read'),
  listTrash
);

router.post(
  '/trash/:assetType/:id/restore',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'update'),
  restoreTrashItem
);

router
  .route('/settings')
  .get(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'read'), getAnalyticsSettings)
  .put(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'update'), updateAnalyticsSettings);

router.get(
  '/catalog',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'read'),
  getAnalyticsCatalog
);

router.get(
  '/catalog/widget-templates',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.WIDGETS, 'read'),
  getWidgetTemplates
);

router.get(
  '/catalog/dashboard-templates',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.DASHBOARDS, 'read'),
  getDashboardTemplates
);

router.get(
  '/executions',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'read'),
  listReportExecutions
);

router.get(
  '/executions/:id',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.REPORTS, 'read'),
  getExecution
);

module.exports = router;
