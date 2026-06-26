'use strict';

const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const controller = require('../controllers/contentTemplateController');

const router = express.Router();

router.use(protect);
router.use(organizationIsolation);
router.use(checkTrialStatus);

router.post('/render', checkPermission('templates', 'render'), controller.renderTemplate);
router.post('/render/preview', checkPermission('templates', 'render'), controller.renderTemplatePreview);

router.get('/gallery', checkPermission('templates', 'view'), controller.listTemplateGallery);
router.get('/summary', checkPermission('templates', 'view'), controller.getTemplateSummary);

router
  .route('/')
  .get(checkPermission('templates', 'view'), controller.listTemplates)
  .post(checkPermission('templates', 'create'), controller.createTemplate);

router
  .route('/:id')
  .get(checkPermission('templates', 'view'), controller.getTemplate)
  .put(checkPermission('templates', 'edit'), controller.updateTemplate)
  .delete(checkPermission('templates', 'delete'), controller.deleteTemplate);

router.post('/:id/clone', checkPermission('templates', 'create'), controller.cloneTemplate);
router.post('/:id/publish', checkPermission('templates', 'publish'), controller.publishTemplate);
router.post('/:id/archive', checkPermission('templates', 'archive'), controller.archiveTemplate);
router.get('/:id/versions', checkPermission('templates', 'view'), controller.listTemplateVersions);
router.post('/:id/versions/compare', checkPermission('templates', 'view'), controller.compareTemplateVersions);
router.get('/:id/versions/:version', checkPermission('templates', 'view'), controller.getTemplateVersion);
router.post('/:id/versions/:version/restore', checkPermission('templates', 'edit'), controller.restoreTemplateVersion);
router.post('/:id/validate', checkPermission('templates', 'view'), controller.validateTemplate);
router.post('/:id/render/preview', checkPermission('templates', 'render'), controller.renderTemplatePreview);
router.post('/:id/render', checkPermission('templates', 'render'), controller.renderTemplate);

module.exports = router;
