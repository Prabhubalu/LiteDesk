const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const {
    saveWidgetLayout,
    getWidgetLayout,
    saveMetricsConfig,
    getMetricsConfig
} = require('../controllers/userPreferencesController');

// Apply auth and organization middleware to all routes
router.use(protect);
router.use(organizationIsolation);

// Widget Layout Routes
router.post('/widget-layout', saveWidgetLayout);
router.get('/widget-layout', getWidgetLayout);

// Metrics Config Routes
router.post('/metrics-config', saveMetricsConfig);
router.get('/metrics-config', getMetricsConfig);

module.exports = router;

