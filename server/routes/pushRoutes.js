const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const {
  getPublicKey,
  subscribe,
  unsubscribe
} = require('../controllers/pushController');
const {
  registerDevice,
  unregisterDevice
} = require('../controllers/mobileDeviceController');

// Public route for VAPID public key (no auth needed for subscription)
router.get('/public-key', getPublicKey);

// Auth + app context + org isolation for subscription routes
router.use(protect);
router.use(resolveAppContext);
router.use(organizationIsolation);

router.post('/subscribe', subscribe);
router.post('/unsubscribe', unsubscribe);
router.post('/device', registerDevice);
router.post('/device/unregister', unregisterDevice);

module.exports = router;

