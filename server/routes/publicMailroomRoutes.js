const express = require('express');

const router = express.Router();
const mailroomPublicController = require('../controllers/mailroomPublicController');
const { mailroomPublicIngestLimiter } = require('../middleware/rateLimitMiddleware');

router.use(mailroomPublicIngestLimiter);

// Public ingest API (M5)
// Auth: Bearer token (stored in TenantMailroomConfig.connectors.publicApi.ingestKey)
router.post('/ingest', mailroomPublicController.ingestPublicMessage);
router.post('/conversations/:conversationId/messages', mailroomPublicController.appendPublicMessage);
router.post('/attachments', mailroomPublicController.uploadMiddleware, mailroomPublicController.uploadAttachment);
router.get('/conversations/:conversationId/attachments', mailroomPublicController.listConversationAttachments);
router.get('/messages/:messageId/attachments', mailroomPublicController.listMessageAttachments);

module.exports = router;
