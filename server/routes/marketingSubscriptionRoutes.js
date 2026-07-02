const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { requireMarketingApp } = require('../middleware/requireMarketingAppMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const controller = require('../controllers/marketingSubscriptionController');

const router = express.Router();

router.use(protect);
router.use(resolveAppContext);
router.use(requireAppEntitlement);
router.use(requireMarketingApp);
router.use(organizationIsolation);
router.use(checkTrialStatus);

router.get('/person/:personId', checkPermission('audiences', 'view'), controller.getPersonSubscriptionHistory);

module.exports = router;
