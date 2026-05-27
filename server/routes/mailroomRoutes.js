const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');

const { downloadMailroomAttachment } = require('../controllers/mailroomAttachmentController');
const { ingestChatMessage } = require('../controllers/mailroomChatController');

const router = express.Router();

router.use(protect);
router.use(resolveAppContext);
router.use(requireAppEntitlement);
router.use(organizationIsolation);

router.get('/attachments/:id/download', downloadMailroomAttachment);
router.post('/chat/ingest', ingestChatMessage);

module.exports = router;

