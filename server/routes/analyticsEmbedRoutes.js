const express = require('express');
const { organizationIsolation, checkTrialStatus, checkFeatureAccess } = require('../middleware/organizationMiddleware');
const { protectAnalyticsEmbedToken } = require('../middleware/analyticsEmbedTokenMiddleware');
const {
  executeEmbedDashboard,
  getEmbedDashboardMeta,
} = require('../controllers/analyticsEmbedController');

const router = express.Router();

router.use(protectAnalyticsEmbedToken());
router.use(organizationIsolation);
router.use(checkTrialStatus);
router.use(checkFeatureAccess('reports'));

router.get('/dashboard', getEmbedDashboardMeta);
router.post('/dashboard/execute', executeEmbedDashboard);

module.exports = router;
