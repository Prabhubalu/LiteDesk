'use strict';

const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const controller = require('../controllers/contentThemeController');

const router = express.Router();

router.use(protect);
router.use(organizationIsolation);
router.use(checkTrialStatus);

router
  .route('/')
  .get(checkPermission('templates', 'read'), controller.listThemes)
  .post(checkPermission('templates', 'create'), controller.createTheme);

router
  .route('/:id')
  .get(checkPermission('templates', 'read'), controller.getTheme)
  .put(checkPermission('templates', 'update'), controller.updateTheme)
  .delete(checkPermission('templates', 'delete'), controller.deleteTheme);

router.post('/:id/publish', checkPermission('templates', 'publish'), controller.publishTheme);
router.post('/:id/archive', checkPermission('templates', 'archive'), controller.archiveTheme);

module.exports = router;
