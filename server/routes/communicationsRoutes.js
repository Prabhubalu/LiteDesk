const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const controller = require('../controllers/communicationsController');
const { streamInbox } = require('../controllers/inboxStreamController');
const { handleSseCorsPreflight } = require('../utils/sseCors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const objectStorage = require('../services/objectStorageService');

const memUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

// SSE — auth via query token (EventSource cannot send Authorization header)
router.options('/inbox/stream', handleSseCorsPreflight);
router.get('/inbox/stream', streamInbox);

router.use(protect);
router.use(organizationIsolation);

router.get('/email/compose-preview', controller.previewComposeEmail);
router.get('/email/reply-to-preview', controller.previewReplyTo);
router.post('/email', controller.sendEmail);
router.get('/pipeline-metrics', controller.getPipelineMetrics);
router.get('/pipeline-diagnostics', controller.getPipelineDiagnostics);
router.get('/inbound/diagnostics', controller.getInboundDiagnostics);
router.get('/inbound/dead-letter', controller.listInboundDeadLetters);
router.post('/inbound/dead-letter/:id/replay', controller.replayInboundDeadLetter);
router.get('/suppressions/stats', controller.getSuppressionStats);
router.get('/suppressions', controller.getSuppressions);
router.delete('/suppressions/:email', controller.removeSuppression);
router.get('/webhook-test/templates', controller.getWebhookTestTemplates);
router.post('/webhook-test/simulate', controller.simulateWebhookEvent);
router.get('/threads', controller.getThreads);
router.get('/threads/:threadId/messages', controller.getThreadMessages);
router.get('/workspace-threads', controller.getWorkspaceThreads);
router.get('/workspace-thread-ids', controller.getWorkspaceThreadIds);
router.get('/workspace-thread-counts', controller.getWorkspaceThreadCounts);
router.get('/templates', controller.getTemplates);
router.patch('/threads/bulk', controller.bulkThreadActions);
router.patch('/threads/:threadId/view', controller.markThreadViewed);
router.patch('/threads/:threadId/done', controller.markThreadDone);
router.patch('/threads/:threadId/snooze', controller.markThreadSnooze);
router.patch('/threads/:threadId/assign', controller.assignThreadOwner);
router.patch('/threads/:threadId/tags', controller.updateThreadTags);
router.get('/:communicationId/delivery-status', controller.getCommunicationDeliveryStatus);
router.post('/:communicationId/create-task', controller.createTaskFromEmail);
router.post('/:communicationId/create-case', controller.createCaseFromEmail);

router.get('/attachments/download', controller.downloadCommunicationAttachment);

async function handleCommunicationOciUpload(req, res) {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const orgId = req.user?.organizationId?.toString() || 'public';
    const safeOrgId = String(orgId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const baseName = String(req.file.originalname || 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
    const key = `attachments/${safeOrgId}/outbound/${Date.now()}-${uuidv4()}-${baseName}`;
    await objectStorage.putBuffer({
      key,
      buffer: req.file.buffer,
      contentType: req.file.mimetype || 'application/octet-stream',
      metadata: { originalname: baseName }
    });
    return res.json({
      success: true,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      storagePath: `oci:${key}`
    });
  } catch (err) {
    console.error('[communications] upload-oci error:', err);
    return res.status(500).json({ success: false, message: 'Upload failed', error: err.message });
  }
}

router.post('/upload', memUpload.single('file'), handleCommunicationOciUpload);
router.post('/upload-oci', memUpload.single('file'), handleCommunicationOciUpload);

module.exports = router;
