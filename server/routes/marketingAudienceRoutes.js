const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { requireMarketingApp } = require('../middleware/requireMarketingAppMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const { importUploadOptional } = require('../middleware/importUploadMiddleware');
const controller = require('../controllers/marketingAudienceController');

const router = express.Router();

router.use(protect);
router.use(resolveAppContext);
router.use(requireAppEntitlement);
router.use(requireMarketingApp);
router.use(organizationIsolation);
router.use(checkTrialStatus);

router.get('/', checkPermission('audiences', 'view'), controller.listAudiences);
router.post('/', checkPermission('audiences', 'create'), controller.createAudience);
router.post(
  '/check-duplicates',
  checkPermission('audiences', 'view'),
  controller.checkAudienceDuplicates
);

router.get('/:id', checkPermission('audiences', 'view'), controller.getAudience);
router.put('/:id', checkPermission('audiences', 'edit'), controller.updateAudience);
router.delete('/:id', checkPermission('audiences', 'delete'), controller.deleteAudience);

router.get('/:id/members', checkPermission('audiences', 'view'), controller.listAudienceMembers);
router.post('/:id/preview', checkPermission('audiences', 'view'), controller.previewAudience);
router.post('/:id/members', checkPermission('audiences', 'edit'), controller.addAudienceMembers);
router.delete(
  '/:id/members/:memberId',
  checkPermission('audiences', 'edit'),
  controller.removeAudienceMember
);

router.post(
  '/:id/import',
  checkPermission('audiences', 'import'),
  importUploadOptional,
  controller.importAudienceMembers
);
router.get('/:id/export', checkPermission('audiences', 'export'), controller.exportAudienceMembers);

module.exports = router;
