const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const controller = require('../controllers/peopleController');

router.use(protect);
router.use(organizationIsolation);

router.post('/', controller.create);
router.get('/', controller.list);

// Add note to person (must be before /:id route)
router.post('/:id/notes', controller.addNote);

// Activity logs (must be before /:id route)
router.get('/:id/activity-logs', controller.getActivityLogs);
router.post('/:id/activity-logs', controller.addActivityLog);

router.get('/:id', controller.getById);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;


