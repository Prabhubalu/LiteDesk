const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const controller = require('../controllers/documentController');

router.use(protect);
router.use(organizationIsolation);
router.use(checkTrialStatus);

router
  .route('/')
  .get(checkPermission('documents', 'view'), controller.listFolders)
  .post(checkPermission('documents', 'create'), controller.createFolder);

router
  .route('/:id')
  .delete(checkPermission('documents', 'delete'), controller.deleteFolder);

module.exports = router;
