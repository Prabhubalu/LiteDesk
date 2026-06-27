'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const { canManageUsers } = require('../middleware/permissionMiddleware');
const controller = require('../controllers/peoplePortalController');

router.use(protect);
router.use(organizationIsolation);
router.use(canManageUsers());

router.get('/', controller.getPortal);
router.post('/enable', controller.enablePortal);
router.post('/disable', controller.disablePortal);
router.post('/roles', controller.assignPortalRoles);
router.delete('/roles/:roleId', controller.removePortalRole);
router.post('/resend-invite', controller.resendPortalInvite);
router.post('/reset-password', controller.resetPortalPassword);
router.post('/terminate-sessions', controller.terminatePortalSessions);
router.get('/audit', controller.getPortalAudit);

module.exports = router;
