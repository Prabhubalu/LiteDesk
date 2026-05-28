const mailroomConfigService = require('../services/mailroomConfigService');
const {
  validateAndNormalizeIngestMessage,
  sanitizeMetadata
} = require('../platform/mailroom/connectors/publicApi/ingestValidator');
const { buildPortalCaseMailroomMessage } = require('../platform/mailroom/connectors/portal/portalMessageBuilder');
const {
  processNormalizedInboundThroughMailroom
} = require('../platform/mailroom/pipeline/genericInboundPipeline');
const {
  assertPortalUserCanAccessCase,
  assertPortalUserCanAccessConversation,
  sanitizePortalIngestResponse
} = require('../platform/mailroom/connectors/portal/portalSafety');
const {
  getPortalRulesForUser,
  assertPortalAttachmentAllowed
} = require('../platform/mailroom/connectors/portal/portalRules');
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

async function assertPortalConnectorEnabled(organizationId) {
  const config = await mailroomConfigService.getOrCreateConfig(organizationId);
  if (!config?.connectors?.portal?.enabled) {
    const err = new Error('Mailroom portal connector is disabled');
    err.statusCode = 403;
    throw err;
  }
  return config;
}

/**
 * Portal → Mailroom connector (M5).
 * Ensures the portal user is always the sender and prevents leaking internal-only metadata.
 */
async function ingestPortalMessage(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    await assertPortalConnectorEnabled(organizationId);

    const input = req.body?.message || {};
    const caseId = input.metadata?.caseId || input.metadata?.linkedCaseId || null;
    if (caseId) {
      await assertPortalUserCanAccessCase({ organizationId, caseId, user: req.user });
    }

    const normalized = validateAndNormalizeIngestMessage({
      ...input,
      channel: 'portal',
      participants: {
        ...(input.participants || {}),
        from: req.user?.email || (input.participants?.from || null)
      },
      metadata: {
        ...sanitizeMetadata(input.metadata, { allowKeys: ['caseId', 'linkedCaseId'] }),
        portalUserId: String(req.user?._id || ''),
        portalUserEmail: String(req.user?.email || '')
      }
    }, {
      defaultChannel: 'portal',
      metadataAllowKeys: ['caseId', 'linkedCaseId', 'portalUserId', 'portalUserEmail']
    });

    const result = await processNormalizedInboundThroughMailroom({
      organizationId,
      connectorType: 'portal',
      source: 'portal',
      jsonPayload: req.body || {},
      message: normalized
    });

    return res.json({ success: true, data: sanitizePortalIngestResponse(result) });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status !== 500) {
      return res.status(status).json({
        success: false,
        message: error.message,
        errors: error.validationErrors || undefined
      });
    }
    console.error('[portalMailroomController] ingestPortalMessage', error);
    return res.status(500).json({ success: false, message: 'Failed to ingest portal message' });
  }
}

/**
 * Portal reply tied to a specific Case (long-term safe semantics).
 * Forces metadata.caseId and never trusts client-provided sender identity.
 */
async function replyToCaseFromPortal(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    const caseId = req.params.caseId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }
    if (!caseId) {
      return res.status(400).json({ success: false, message: 'caseId is required' });
    }

    const config = await assertPortalConnectorEnabled(organizationId);
    await assertPortalUserCanAccessCase({ organizationId, caseId, user: req.user });

    const portalCapabilities = req.portalCapabilities
      || await getPortalRulesForUser(req.user, config);
    const input = req.body?.message || {};
    const attachments = Array.isArray(input.attachments) ? input.attachments : [];
    if (attachments.length > portalCapabilities.maxAttachmentsPerMessage) {
      const err = new Error(`Maximum ${portalCapabilities.maxAttachmentsPerMessage} attachments per message`);
      err.statusCode = 400;
      throw err;
    }

    const normalized = await buildPortalCaseMailroomMessage(input, {
      organizationId,
      caseId,
      user: req.user,
      subjectFallback: input.subject || 'Case reply',
      portalAudience: portalCapabilities.audience
    });

    const result = await processNormalizedInboundThroughMailroom({
      organizationId,
      connectorType: 'portal',
      source: 'portal_case_reply',
      jsonPayload: req.body || {},
      message: normalized
    });

    return res.json({ success: true, data: sanitizePortalIngestResponse(result) });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status !== 500) {
      return res.status(status).json({
        success: false,
        message: error.message,
        errors: error.validationErrors || undefined
      });
    }
    console.error('[portalMailroomController] replyToCaseFromPortal', error);
    return res.status(500).json({ success: false, message: 'Failed to reply to case' });
  }
}

async function uploadPortalAttachment(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    const config = await assertPortalConnectorEnabled(organizationId);
    const portalCapabilities = await getPortalRulesForUser(req.user, config);
    assertPortalAttachmentAllowed(portalCapabilities, req.file);

    const row = await createUploadedAttachment({
      organizationId,
      file: req.file,
      source: 'portal',
      uploadedByUserId: req.user?._id || null
    });

    return res.json({
      success: true,
      data: {
        attachmentId: row._id,
        originalFileName: row.originalFileName,
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        status: row.status
      }
    });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status !== 500) {
      return res.status(status).json({ success: false, message: error.message });
    }
    console.error('[portalMailroomController] uploadPortalAttachment', error);
    return res.status(500).json({ success: false, message: 'Failed to upload attachment' });
  }
}

async function listPortalConversationAttachments(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    await assertPortalConnectorEnabled(organizationId);
    await assertPortalUserCanAccessConversation({
      organizationId,
      conversationId: req.params.conversationId,
      user: req.user
    });

    const data = await listAttachmentsForConversation(organizationId, req.params.conversationId);
    return res.json({ success: true, data });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status !== 500) {
      return res.status(status).json({ success: false, message: error.message });
    }
    console.error('[portalMailroomController] listPortalConversationAttachments', error);
    return res.status(500).json({ success: false, message: 'Failed to list attachments' });
  }
}

async function listPortalMessageAttachments(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    await assertPortalConnectorEnabled(organizationId);

    const data = await listAttachmentsForMessage(organizationId, req.params.messageId);
    if (data.linkedCaseId) {
      await assertPortalUserCanAccessCase({
        organizationId,
        caseId: data.linkedCaseId,
        user: req.user
      });
    } else if (data.conversationId) {
      await assertPortalUserCanAccessConversation({
        organizationId,
        conversationId: data.conversationId,
        user: req.user
      });
    }

    return res.json({ success: true, data });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status !== 500) {
      return res.status(status).json({ success: false, message: error.message });
    }
    console.error('[portalMailroomController] listPortalMessageAttachments', error);
    return res.status(500).json({ success: false, message: 'Failed to list attachments' });
  }
}

module.exports = {
  ingestPortalMessage,
  replyToCaseFromPortal,
  uploadPortalAttachment,
  listPortalConversationAttachments,
  listPortalMessageAttachments,
  uploadMiddleware: upload.single('file')
};
