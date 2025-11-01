const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const controller = require('../controllers/organizationV2Controller');

router.use(protect);

router.post('/', controller.create);
router.get('/', controller.list);

// Activity logs (must be before /:id route)
router.get('/:id/activity-logs', controller.getActivityLogs);
router.post('/:id/activity-logs', controller.addActivityLog);

router.get('/:id', controller.getById);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;


