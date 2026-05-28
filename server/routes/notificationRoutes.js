const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const {
  listNotifications,
  markRead,
  markAllRead
} = require('../controllers/notificationController');
const { streamNotifications } = require('../controllers/notificationStreamController');
const notificationDevController = require('../controllers/notificationDevController');

// SSE stream route - handles its own auth (EventSource can't send Authorization header)
router.get('/stream', streamNotifications);

// Auth + app context + org isolation for notification routes
// NOTE: Notifications are platform-level and accessible to all authenticated users
// regardless of app entitlement. The appKey is used for filtering, not access control.
router.use(protect);
router.use(resolveAppContext);
router.use(organizationIsolation);

router.get('/', listNotifications);
router.post('/:id/read', markRead);
router.post('/read-all', markAllRead);

// Dev-only helpdesk notification simulation (see notificationDevSimulator.js)
router.get('/dev/simulate/meta', notificationDevController.simulateHelpdeskMeta);
router.post('/dev/simulate', notificationDevController.simulateHelpdesk);

module.exports = router;


