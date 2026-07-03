const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus, checkFeatureAccess } = require('../middleware/organizationMiddleware');
const { checkAnalyticsPermission } = require('../middleware/analyticsPermissionMiddleware');
const { ANALYTICS_MODULE_KEYS } = require('../permissions/analyticsPermissions');
const {
  listAnalyticsApiTokens,
  createAnalyticsApiToken,
  revokeAnalyticsApiToken,
} = require('../controllers/analyticsApiTokenController');

const router = express.Router();

router.use(protect);
router.use(organizationIsolation);
router.use(checkTrialStatus);
router.use(checkFeatureAccess('reports'));

router
  .route('/')
  .get(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.ADMIN, 'manageSettings'), listAnalyticsApiTokens)
  .post(checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.ADMIN, 'manageSettings'), createAnalyticsApiToken);

router.post(
  '/:id/revoke',
  checkAnalyticsPermission(ANALYTICS_MODULE_KEYS.ADMIN, 'manageSettings'),
  revokeAnalyticsApiToken
);

module.exports = router;
