const { validateAndNormalizeIngestMessage } = require('../platform/mailroom/connectors/publicApi/ingestValidator');
const { authenticatePublicMailroomRequest } = require('../platform/mailroom/connectors/publicApi/publicApiAuth');
const {
  processNormalizedInboundThroughMailroom
} = require('../platform/mailroom/pipeline/genericInboundPipeline');
const {
  listAttachmentsForConversation,
  listAttachmentsForMessage
} = require('../platform/mailroom/services/mailroomAttachmentQueryService');
const multer = require('multer');
const { createUploadedAttachment } = require('../platform/mailroom/services/attachmentService');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.MAILROOM_ATTACHMENT_MAX_BYTES || (25 * 1024 * 1024))
  }
});

async function ingestPublicMessage(req, res) {
  try {
    const { organizationId } = await authenticatePublicMailroomRequest(req);

    const normalized = validateAndNormalizeIngestMessage(req.body?.message || {}, {
      defaultChannel: 'api',
      metadataAllowKeys: ['caseId', 'linkedCaseId', 'portalContext', 'source']
    });

    const result = await processNormalizedInboundThroughMailroom({
      organizationId,
      connectorType: 'public_api',
      source: 'public_api',
      jsonPayload: req.body || {},
      message: normalized
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status !== 500) {
      return res.status(status).json({
        success: false,
        message: error.message,
        errors: error.validationErrors || undefined
      });
    }
    console.error('[mailroomPublicController] ingestPublicMessage', error);
    return res.status(500).json({ success: false, message: 'Failed to ingest message' });
  }
}

async function appendPublicMessage(req, res) {
  try {
    const { organizationId } = await authenticatePublicMailroomRequest(req);

    const conversationId = req.params.conversationId || req.body?.conversationId || null;
    if (!conversationId) {
      return res.status(400).json({ success: false, message: 'conversationId is required' });
    }

    const normalized = validateAndNormalizeIngestMessage({
      ...(req.body?.message || {}),
      conversationId
    }, {
      defaultChannel: 'api',
      metadataAllowKeys: ['caseId', 'linkedCaseId', 'portalContext', 'source']
    });

    const result = await processNormalizedInboundThroughMailroom({
      organizationId,
      connectorType: 'public_api',
      source: 'public_api_append',
      jsonPayload: req.body || {},
      message: normalized
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status !== 500) {
      return res.status(status).json({
        success: false,
        message: error.message,
        errors: error.validationErrors || undefined
      });
    }
    console.error('[mailroomPublicController] appendPublicMessage', error);
    return res.status(500).json({ success: false, message: 'Failed to append message' });
  }
}

async function uploadAttachment(req, res) {
  try {
    const { organizationId } = await authenticatePublicMailroomRequest(req);

    const file = req.file;
    const row = await createUploadedAttachment({
      organizationId,
      file,
      source: 'public_api',
      uploadedByUserId: null
    });

    return res.json({
      success: true,
      data: {
        attachmentId: row._id,
        bucket: row.bucket,
        objectKey: row.objectKey,
        originalFileName: row.originalFileName,
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        sha256: row.sha256,
        status: row.status
      }
    });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status !== 500) {
      return res.status(status).json({ success: false, message: error.message });
    }
    console.error('[mailroomPublicController] uploadAttachment', error);
    return res.status(500).json({ success: false, message: 'Failed to upload attachment' });
  }
}

async function listConversationAttachments(req, res) {
  try {
    const { organizationId } = await authenticatePublicMailroomRequest(req);
    const data = await listAttachmentsForConversation(organizationId, req.params.conversationId);
    return res.json({ success: true, data });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status !== 500) {
      return res.status(status).json({ success: false, message: error.message });
    }
    console.error('[mailroomPublicController] listConversationAttachments', error);
    return res.status(500).json({ success: false, message: 'Failed to list attachments' });
  }
}

async function listMessageAttachments(req, res) {
  try {
    const { organizationId } = await authenticatePublicMailroomRequest(req);
    const data = await listAttachmentsForMessage(organizationId, req.params.messageId);
    return res.json({ success: true, data });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status !== 500) {
      return res.status(status).json({ success: false, message: error.message });
    }
    console.error('[mailroomPublicController] listMessageAttachments', error);
    return res.status(500).json({ success: false, message: 'Failed to list attachments' });
  }
}

module.exports = {
  ingestPublicMessage,
  appendPublicMessage,
  uploadAttachment,
  listConversationAttachments,
  listMessageAttachments,
  uploadMiddleware: upload.single('file')
};
