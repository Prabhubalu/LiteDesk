const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { lazySalesInitialization } = require('../middleware/lazySalesInitializationMiddleware');
const { createSettingsAuditMiddleware } = require('../middleware/settingsAuditMiddleware');
const { getPreferences, updatePreferences } = require('../controllers/notificationPreferenceController');

// Auth + app context + org isolation for notification preferences
// NOTE: Notification preferences are platform-level and accessible to all authenticated users
// regardless of app entitlement. The appKey is used for filtering, not access control.
router.use(protect);
router.use(resolveAppContext);
router.use(lazySalesInitialization);
router.use(organizationIsolation);
router.use(createSettingsAuditMiddleware({ surface: 'notifications' }));

router.get('/', getPreferences);
router.put('/', updatePreferences);

module.exports = router;

