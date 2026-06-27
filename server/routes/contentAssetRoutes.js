'use strict';

const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const { uploadContentAsset } = require('../middleware/contentUploadMiddleware');
const controller = require('../controllers/contentAssetController');

const router = express.Router();

router.use(protect);
router.use(organizationIsolation);
router.use(checkTrialStatus);

router
  .route('/')
  .get(checkPermission('templates', 'read'), controller.listAssets)
  .post(
    checkPermission('templates', 'create'),
    uploadContentAsset,
    controller.uploadAsset
  );

router
  .route('/:id')
  .get(checkPermission('templates', 'read'), controller.getAsset)
  .put(checkPermission('templates', 'update'), controller.updateAsset)
  .delete(checkPermission('templates', 'delete'), controller.deleteAsset);

router.post(
  '/:id/replace',
  checkPermission('templates', 'update'),
  uploadContentAsset,
  controller.replaceAsset
);

module.exports = router;
