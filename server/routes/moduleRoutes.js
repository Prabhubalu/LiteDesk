const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const controller = require('../controllers/moduleController');

// Require auth and organization context
router.use(protect, organizationIsolation);

// Settings permission (reuse settings.edit to manage modules)
router.get('/', checkPermission('settings', 'edit'), controller.listModules);
router.post('/', checkPermission('settings', 'edit'), controller.createModule);
router.delete('/:id', checkPermission('settings', 'edit'), controller.deleteModule);
router.put('/:id', checkPermission('settings', 'edit'), controller.updateModule);
router.put('/system/:key', checkPermission('settings', 'edit'), controller.updateSystemModule);

module.exports = router;


