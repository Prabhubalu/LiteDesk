'use strict';

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const controller = require('../controllers/userCalendarConnectionController');

router.use(protect);
router.use(organizationIsolation);

router.get('/', controller.listConnections);
router.get('/:provider/oauth/start', controller.oauthStart);
router.delete('/:provider', controller.disconnect);

module.exports = router;
