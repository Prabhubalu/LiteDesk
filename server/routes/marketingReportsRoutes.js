const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { requireMarketingApp } = require('../middleware/requireMarketingAppMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const controller = require('../controllers/marketingReportsController');

const router = express.Router();

router.use(protect);
router.use(resolveAppContext);
router.use(requireAppEntitlement);
router.use(requireMarketingApp);
router.use(organizationIsolation);
router.use(checkTrialStatus);

router.get('/', checkPermission('campaigns', 'view'), controller.getReportsSummary);
router.get('/campaigns/export.csv', checkPermission('campaigns', 'view'), controller.exportCampaignPerformanceCsv);
router.get('/campaigns/export.xlsx', checkPermission('campaigns', 'view'), controller.exportCampaignPerformanceXlsx);
router.get('/campaigns/export.pdf', checkPermission('campaigns', 'view'), controller.exportCampaignPerformancePdf);

module.exports = router;
