/**
 * Trash (Recycle Bin) API routes
 * See docs/TRASH_IMPLEMENTATION_SPEC.md
 */

const express = require('express');
const trashController = require('../controllers/trashController');
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');

const router = express.Router();

router.use(protect);
router.use(organizationIsolation);

// Stats (no module/record in path)
router.get('/stats', checkPermission('settings', 'view'), trashController.stats);

// List trash
router.get('/', checkPermission('settings', 'view'), trashController.list);

// Bulk permanent delete (must be before /:moduleKey/:recordId)
router.post('/bulk-purge', checkPermission('settings', 'edit'), trashController.bulkPurge);

// Move to trash, restore, purge (module + record in path)
router.post('/:moduleKey/:recordId', checkPermission('settings', 'edit'), trashController.moveToTrash);
router.post('/:moduleKey/:recordId/restore', checkPermission('settings', 'edit'), trashController.restore);
router.delete('/:moduleKey/:recordId', checkPermission('settings', 'edit'), trashController.purge);

module.exports = router;
