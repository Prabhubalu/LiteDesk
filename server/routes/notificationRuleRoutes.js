const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { requireSalesApp } = require('../middleware/requireSalesAppMiddleware');
const { lazySalesInitialization } = require('../middleware/lazySalesInitializationMiddleware');
const {
  listRules,
  createRule,
  updateRule,
  deleteRule,
  toggleRule
} = require('../controllers/notificationRuleController');
const { createSettingsAuditMiddleware } = require('../middleware/settingsAuditMiddleware');

// Auth + app context + org isolation for notification rules
// Notification rules are user-level and app-scoped
router.use(protect);
router.use(resolveAppContext);
router.use(requireAppEntitlement); // Check user's app entitlements
router.use(lazySalesInitialization); // Lazy initialize Sales app if needed
router.use(requireSalesApp); // Enforce Sales app access
router.use(organizationIsolation);
router.use(createSettingsAuditMiddleware({ surface: 'notifications', entityType: 'NotificationRule' }));

router.get('/', listRules);
router.post('/', createRule);
router.put('/:id', updateRule);
router.delete('/:id', deleteRule);
router.post('/:id/toggle', toggleRule);

module.exports = router;

