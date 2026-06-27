const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const geocodeController = require('../controllers/geocodeController');

router.get('/search', protect, organizationIsolation, geocodeController.search);
router.get('/reverse', protect, organizationIsolation, geocodeController.reverse);

module.exports = router;
