'use strict';

const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const { uploadContentFont } = require('../middleware/contentUploadMiddleware');
const controller = require('../controllers/contentFontController');

const router = express.Router();

router.use(protect);
router.use(organizationIsolation);
router.use(checkTrialStatus);

router.get('/catalog', checkPermission('templates', 'read'), controller.listCatalogFonts);

router
  .route('/')
  .get(checkPermission('templates', 'read'), controller.listFonts)
  .post(checkPermission('templates', 'create'), controller.registerFont);

router.post(
  '/upload',
  checkPermission('templates', 'create'),
  uploadContentFont,
  controller.uploadFont
);

router
  .route('/:id')
  .get(checkPermission('templates', 'read'), controller.getFont)
  .delete(checkPermission('templates', 'delete'), controller.deleteFont);

module.exports = router;
