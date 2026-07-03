const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus, checkFeatureAccess } = require('../middleware/organizationMiddleware');
const { checkAnalyticsPermission } = require('../middleware/analyticsPermissionMiddleware');
const { ANALYTICS_MODULE_KEYS } = require('../permissions/analyticsPermissions');
const {
  listWidgets,
  createWidget,
  getWidgetById,
  updateWidget,
  deleteWidget,
  publishWidget,
  executeWidget,
  duplicateWidget,
  certifyWidget,
  uncertifyWidget,
} = require('../controllers/analyticsWidgetController');

const router = express.Router();

router.use(protect);
router.use(organizationIsolation);
router.use(checkTrialStatus);
router.use(checkFeatureAccess('reports'));

router
  .route('/')
  .get(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.WIDGETS, 'read'), listWidgets)
  .post(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.WIDGETS, 'create'), createWidget);

router
  .route('/:id')
  .get(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.WIDGETS, 'read'), getWidgetById)
  .put(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.WIDGETS, 'update'), updateWidget)
  .delete(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.WIDGETS, 'delete'), deleteWidget);

router.post(
  '/:id/publish',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.WIDGETS, 'publish'),
  publishWidget
);

router.post(
  '/:id/execute',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.WIDGETS, 'read'),
  executeWidget
);

router.post(
  '/:id/duplicate',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.WIDGETS, 'create'),
  duplicateWidget
);

router.post(
  '/:id/certify',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.ADMIN, 'certify'),
  certifyWidget
);

router.post(
  '/:id/uncertify',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.ADMIN, 'certify'),
  uncertifyWidget
);

module.exports = router;
