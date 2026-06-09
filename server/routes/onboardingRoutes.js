'use strict';

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const {
  getMyOnboarding,
  patchMyOnboarding,
  patchOrganizationOnboarding
} = require('../controllers/onboardingController');

router.use(protect);
router.use(organizationIsolation);
router.use(checkTrialStatus);

router.get('/me', getMyOnboarding);
router.patch('/me', patchMyOnboarding);
router.patch('/organization', patchOrganizationOnboarding);

module.exports = router;
