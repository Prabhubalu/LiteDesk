const express = require('express');
const { organizationIsolation, checkTrialStatus, checkFeatureAccess } = require('../middleware/organizationMiddleware');
const { protectAnalyticsApiToken } = require('../middleware/analyticsApiTokenMiddleware');
const {
  v1ListReports,
  v1GetReport,
  v1ExecuteReport,
  v1ExportReport,
  v1ListWidgets,
  v1ExecuteWidget,
  v1ListDashboards,
  v1GetDashboard,
} = require('../controllers/analyticsV1Controller');

const router = express.Router();

router.use(protectAnalyticsApiToken());
router.use(organizationIsolation);
router.use(checkTrialStatus);
router.use(checkFeatureAccess('reports'));

router.get('/reports', v1ListReports);
router.get('/reports/:id', v1GetReport);
router.post('/reports/:id/execute', v1ExecuteReport);
router.post('/reports/:id/export', v1ExportReport);

router.get('/widgets', v1ListWidgets);
router.post('/widgets/:id/execute', v1ExecuteWidget);

router.get('/dashboards', v1ListDashboards);
router.get('/dashboards/:id', v1GetDashboard);

module.exports = router;
