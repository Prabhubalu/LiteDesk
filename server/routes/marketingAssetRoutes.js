const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { requireMarketingApp } = require('../middleware/requireMarketingAppMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const { uploadContentAsset } = require('../middleware/contentUploadMiddleware');
const controller = require('../controllers/marketingAssetController');

const router = express.Router();

router.use(protect);
router.use(resolveAppContext);
router.use(requireAppEntitlement);
router.use(requireMarketingApp);
router.use(organizationIsolation);
router.use(checkTrialStatus);

router
  .route('/')
  .get(checkPermission('assets', 'view'), controller.listAssets)
  .post(
    checkPermission('assets', 'create'),
    uploadContentAsset,
    controller.uploadAsset
  );

router
  .route('/:id')
  .get(checkPermission('assets', 'view'), controller.getAsset)
  .put(checkPermission('assets', 'edit'), controller.updateAsset)
  .delete(checkPermission('assets', 'delete'), controller.deleteAsset);

module.exports = router;
