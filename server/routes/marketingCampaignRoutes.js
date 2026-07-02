const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { requireMarketingApp } = require('../middleware/requireMarketingAppMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const controller = require('../controllers/marketingCampaignController');

const router = express.Router();

router.use(protect);
router.use(resolveAppContext);
router.use(requireAppEntitlement);
router.use(requireMarketingApp);
router.use(organizationIsolation);
router.use(checkTrialStatus);

router.get('/', checkPermission('campaigns', 'view'), controller.listCampaigns);
router.get('/send-metrics', checkPermission('campaigns', 'view'), controller.getCampaignSendMetrics);
router.get('/send-policy', checkPermission('campaigns', 'view'), controller.getCampaignSendPolicy);
router.get('/approvals/pending', checkPermission('campaigns', 'view'), controller.listPendingApprovals);
router.post('/', checkPermission('campaigns', 'create'), controller.createCampaign);
router.get('/:id', checkPermission('campaigns', 'view'), controller.getCampaign);
router.put('/:id', checkPermission('campaigns', 'edit'), controller.updateCampaign);
router.delete('/:id', checkPermission('campaigns', 'edit'), controller.deleteCampaign);
router.post('/:id/duplicate', checkPermission('campaigns', 'create'), controller.duplicateCampaign);
router.post('/:id/pause', checkPermission('campaigns', 'edit'), controller.pauseCampaign);
router.post('/:id/resume', checkPermission('campaigns', 'edit'), controller.resumeCampaign);
router.post('/:id/cancel', checkPermission('campaigns', 'edit'), controller.cancelCampaign);
router.post('/:id/archive', checkPermission('campaigns', 'edit'), controller.archiveCampaign);
router.get('/:id/recipients', checkPermission('campaigns', 'view'), controller.listCampaignRecipients);
router.get('/:id/send-progress', checkPermission('campaigns', 'view'), controller.getCampaignSendProgress);
router.get('/:id/precheck', checkPermission('campaigns', 'view'), controller.getCampaignPrecheck);
router.post('/:id/submit-for-review', checkPermission('campaigns', 'edit'), controller.submitCampaignForReview);
router.post('/:id/approve', checkPermission('campaigns', 'view'), controller.approveCampaign);
router.post('/:id/reject', checkPermission('campaigns', 'view'), controller.rejectCampaign);
router.post('/:id/schedule', checkPermission('campaigns', 'send'), controller.scheduleCampaign);
router.post('/:id/test', checkPermission('campaigns', 'send'), controller.testSendCampaign);
router.post('/:id/send', checkPermission('campaigns', 'send'), controller.sendCampaign);
router.get('/:id/ab-results', checkPermission('campaigns', 'view'), controller.getCampaignAbResults);
router.post('/:id/select-ab-winner', checkPermission('campaigns', 'send'), controller.selectCampaignAbWinner);
router.get('/:id/analytics', checkPermission('campaigns', 'view'), controller.getCampaignAnalytics);
router.get('/:id/health', checkPermission('campaigns', 'view'), controller.getCampaignHealth);

module.exports = router;
