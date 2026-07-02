const express = require('express');
const controller = require('../controllers/marketingPublicController');
const { publicMarketingPreferenceLimiter } = require('../middleware/rateLimitMiddleware');

const router = express.Router();

router.get('/preferences/:token', publicMarketingPreferenceLimiter, controller.getPreferenceCenter);
router.put('/preferences/:token', express.json(), publicMarketingPreferenceLimiter, controller.updatePreferenceCenter);
router.post(
  '/preferences/:token/unsubscribe',
  express.json(),
  publicMarketingPreferenceLimiter,
  controller.unsubscribeByToken
);
router.post('/unsubscribe', express.json(), publicMarketingPreferenceLimiter, controller.unsubscribe);

module.exports = router;
