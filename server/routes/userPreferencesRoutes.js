const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const {
    saveWidgetLayout,
    getWidgetLayout
} = require('../controllers/userPreferencesController');

// Apply auth and organization middleware to all routes
router.use(protect);
router.use(organizationIsolation);

// Widget Layout Routes
router.post('/widget-layout', saveWidgetLayout);
router.get('/widget-layout', getWidgetLayout);

module.exports = router;

