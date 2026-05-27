/**
 * Inbound dispatcher (Phase 3).
 *
 * Takes a parsed inbound message (or raw MIME) and runs the full
 * platform pipeline:
 *   parse -> identify tenant -> resolve record -> resolve thread ->
 *   normalize body -> persist communication -> activity log -> lifecycle events.
 *
 * Used by:
 *   - inbound webhook controller (sync fallback when Redis is down)
 *   - inbound queue worker (normal async path)
 *   - dead-letter replay endpoint
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const Communication = require('../../../models/Communication');
const People = require('../../../models/People');
const Organization = require('../../../models/Organization');
const User = require('../../../models/User');
const replyToTokenService = require('../../../services/replyToTokenService');
const { handleInboundEmailForHelpdesk } = require('../../../services/helpdeskChannelIngestionService');
const { uploadsDir } = require('../../../middleware/uploadMiddleware');
const { MAX_ATTACHMENT_SIZE_BYTES } = require('../../../models/Communication');
const { appendCommunicationEvent } = require('../../../services/communicationEventWriter');
const { resolveMailboxIdForInbound } = require('../../../services/mailboxRoutingService');
const { runWithOrganizationTenantContext } = require('../../../utils/runWithOrganizationTenant');

const {
  parseRawMime,
  scanCrmThreadTokenFromRawMime,
  scanRoutingAddressesFromRawMimeRelaxed
} = require('./inboundParser');
const { decodeBase64OrBase64Url } = require('../../../utils/decodeInboundRawMime');
const { resolveThread } = require('./threadResolver');
const { normalizeReplyBody } = require('./replyContentNormalizer');

class InboundDispatchError extends Error {
  constructor(message, { stage = 'unknown', cause = null, routeMeta = null } = {}) {
    super(message);
    this.name = 'InboundDispatchError';
    this.stage = stage;
    if (cause) this.cause = cause;
    if (routeMeta) this.routeMeta = routeMeta;
  }
}

function ensureBuffer(rawMimeInput) {
  if (Buffer.isBuffer(rawMimeInput)) return rawMimeInput;
  if (typeof rawMimeInput === 'string') {
    const buf = decodeBase64OrBase64Url(rawMimeInput);
    if (!buf || buf.length === 0) {
      throw new InboundDispatchError('base64_decode_failed: empty buffer', { stage: 'parse' });
    }
    return buf;
  }
  throw new InboundDispatchError('missing_raw_mime', { stage: 'parse' });
}

async function autoCreatePersonForSender({ organizationId, parsedMessage }) {
  const fromEmail = (parsedMessage.fromAddress || '').toLowerCase().trim();
  if (!fromEmail) return;
  const existing = await People.findOne({
    organizationId,
    email: fromEmail,
    deletedAt: null
  }).lean();
  if (existing) return;
  const orgUser = await User.findOne({ organizationId, status: { $ne: 'inactive' } }).select('_id').lean();
  if (!orgUser) return;
  const displayName = parsedMessage.fromDisplayName || parsedMessage.fromAddress || '';
  const nameParts = displayName ? displayName.split(/\s+/) : [];
  const firstName = nameParts[0] || fromEmail.split('@')[0] || 'Inbound';
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
  const { assignResolvedSource } = require('../../../services/sourceResolver');
  const personPayload = {
    organizationId,
    createdBy: orgUser._id,
    first_name: firstName,
    last_name: lastName || firstName,
    email: fromEmail
  };
  assignResolvedSource(personPayload, 'email');
  await People.create(personPayload);
}

async function resolveTenantContext({ parsedMessage, headerOrganizationId, rawBuffer = null }) {
  let extracted = replyToTokenService.extractFromAddresses(parsedMessage.allRecipients);
  if (!extracted && rawBuffer) {
    const relaxed = replyToTokenService.extractFromAddresses(
      scanRoutingAddressesFromRawMimeRelaxed(rawBuffer)
    );
    if (relaxed) extracted = relaxed;
  }
  if (!extracted && rawBuffer) {
    const token = scanCrmThreadTokenFromRawMime(rawBuffer);
    if (token) {
      extracted = { crmThreadToken: token, tokenType: 'short' };
    }
  }

  const requireToken =
    String(process.env.EMAIL_INBOUND_REQUIRE_REPLY_TOKEN || '').trim().toLowerCase() === 'true';

  if (requireToken && !extracted) {
    throw new InboundDispatchError(
      'Inbound email must include a valid reply+ or replies+ routing token (central catch-all mode)',
      {
        stage: 'route',
        routeMeta: {
          recipientCount: parsedMessage.allRecipients?.length || 0,
          recipientsSample: (parsedMessage.allRecipients || []).slice(0, 8),
          subject: parsedMessage.subject || null,
          hint:
            'Relay MIME has no recipients. Use buildMimeFromFullMessage_ in Apps Script (§3.2) instead of Gmail raw base64; confirm findRoutableMessageInThread_ picks the customer reply.',
          mimeHeaderPreview: rawBuffer
            ? rawBuffer.slice(0, 320).toString('latin1').replace(/[^\x20-\x7e\r\n]/g, '.')
            : null
        }
      }
    );
  }

  let tokenPayload = extracted;
  let registryRoute = null;

  if (extracted?.tokenType === 'short' && extracted.crmThreadToken) {
    const { resolveByCrmThreadToken } = require('../../../services/emailThreadRegistryService');
    registryRoute = await resolveByCrmThreadToken(extracted.crmThreadToken);
    if (!registryRoute) {
      throw new InboundDispatchError('Unknown CRM reply thread token', { stage: 'route' });
    }
    tokenPayload = registryRoute;
  }

  const orgId = tokenPayload?.orgId || tokenPayload?.tenantId || headerOrganizationId || null;
  const moduleKey = tokenPayload?.moduleKey || (orgId ? 'cases' : null);
  const recordId = tokenPayload?.recordId || null;
  if (!orgId) {
    throw new InboundDispatchError('No valid Reply-To token or organization header found', { stage: 'route' });
  }
  return {
    orgId,
    moduleKey,
    recordId,
    tokenPayload,
    registryRoute,
    mailboxIdFromToken: registryRoute?.mailboxId || null,
    conversationIdFromToken: registryRoute?.conversationId || null
  };
}

async function resolveTargetRecord({ orgId, moduleKey, recordId, parsedMessage }) {
  if (moduleKey === 'workspace') {
    if (!recordId || String(recordId) !== String(orgId)) {
      throw new InboundDispatchError('Invalid workspace inbound token', { stage: 'route' });
    }
    const org = await Organization.findById(orgId).select('_id').lean();
    if (!org) {
      throw new InboundDispatchError('Organization not found for workspace inbound', { stage: 'route' });
    }
    return {
      relatedTo: { moduleKey: 'workspace', recordId: orgId },
      helpdeskCaseResult: null
    };
  }

  if (moduleKey === 'people') {
    const person = await People.findOne({
      _id: recordId,
      organizationId: orgId,
      deletedAt: null
    }).lean();
    if (!person) {
      throw new InboundDispatchError('Record not found or access denied', { stage: 'route' });
    }
    return {
      relatedTo: { moduleKey, recordId },
      helpdeskCaseResult: null
    };
  }

  if (moduleKey === 'cases') {
    const helpdeskCaseResult = await handleInboundEmailForHelpdesk({
      organizationId: orgId,
      explicitCaseId: recordId,
      parsedEmail: {
        fromAddress: parsedMessage.fromAddress,
        subject: parsedMessage.subject,
        body: parsedMessage.body
      },
      communicationDraft: {}
    });
    return {
      relatedTo: { moduleKey: 'cases', recordId: helpdeskCaseResult.caseRecord._id },
      helpdeskCaseResult
    };
  }

  throw new InboundDispatchError(`Unsupported moduleKey for inbound: ${moduleKey}`, { stage: 'route' });
}

function persistAttachments({ orgId, parsedMessage }) {
  const inboundAttachments = [];
  if (!Array.isArray(parsedMessage.attachments) || parsedMessage.attachments.length === 0) {
    return inboundAttachments;
  }
  const safeOrgId = String(orgId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const orgDir = path.join(uploadsDir, safeOrgId);
  try {
    if (!fs.existsSync(orgDir)) {
      fs.mkdirSync(orgDir, { recursive: true });
    }
  } catch (mkdirErr) {
    console.error('[inboundDispatcher] mkdir failed:', mkdirErr.message);
    return inboundAttachments;
  }

  for (const att of parsedMessage.attachments) {
    if (!att.content || !Buffer.isBuffer(att.content)) continue;
    if (att.content.length > MAX_ATTACHMENT_SIZE_BYTES) continue;
    const baseName = (att.filename || 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_');
    const ext = path.extname(baseName) || '';
    const name = path.basename(baseName, ext) || 'attachment';
    const storedName = `${name}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const storagePath = `${safeOrgId}/${storedName}`;
    const fullPath = path.join(uploadsDir, storagePath);
    try {
      fs.writeFileSync(fullPath, att.content);
      inboundAttachments.push({
        fileName: att.filename || storedName,
        fileType: att.contentType || 'application/octet-stream',
        fileSize: att.content.length,
        storagePath
      });
    } catch (writeErr) {
      console.error('[inboundDispatcher] attachment write failed:', writeErr.message);
    }
  }
  return inboundAttachments;
}

async function appendActivityLogForPerson({ orgId, recordId, communicationDoc, parsedMessage }) {
  const newLog = {
    user: parsedMessage.fromAddress || 'Unknown',
    userId: null,
    action: 'email_received',
    details: {
      communicationId: communicationDoc._id,
      subject: communicationDoc.subject,
      from: parsedMessage.fromAddress,
      status: 'delivered'
    },
    timestamp: new Date()
  };
  const personForUpdate = await People.findOne(
    { _id: recordId, organizationId: orgId, deletedAt: null }
  ).select('activityLogs').lean();
  if (!personForUpdate) return;
  if (!Array.isArray(personForUpdate.activityLogs)) {
    await People.findOneAndUpdate(
      { _id: recordId, organizationId: orgId, deletedAt: null },
      { $set: { activityLogs: [newLog] } },
      { runValidators: false }
    );
  } else {
    await People.findOneAndUpdate(
      { _id: recordId, organizationId: orgId, deletedAt: null },
      { $push: { activityLogs: newLog } },
      { runValidators: false }
    );
  }
}

/**
 * Run the full inbound pipeline against a raw MIME buffer.
 *
 * @param {object} args
 * @param {Buffer | string} args.rawMime           Raw MIME buffer or base64 string.
 * @param {string} [args.headerOrganizationId]     Optional explicit org id from a trusted header.
 * @param {string} [args.source]                   Source label for lifecycle events.
 * @param {object} [args.forcedWorkspaceInbox]     Trusted ingest: `{ organizationId, mailboxId, providerMessageKey? }` routes to workspace inbox (no Reply-To token).
 * @returns {Promise<object>}                      Result summary (communicationId, threadId, strategy, ...).
 * @throws {InboundDispatchError}                  When a stage fails. The caller decides whether to dead-letter.
 */
async function processRawInbound({
  rawMime,
  headerOrganizationId = null,
  source = 'inbound-webhook',
  forcedWorkspaceInbox = null,
  mailroomPrelinkedCase = null
}) {
  const rawBuffer = ensureBuffer(rawMime);

  const parseResult = await parseRawMime(rawBuffer);
  if (!parseResult.ok) {
    throw new InboundDispatchError(parseResult.error || 'parse_failed', { stage: 'parse' });
  }
  const parsedMessage = parseResult.value;

  let orgId;
  let relatedTo;
  let helpdeskCaseResult;
  let conversationIdFromToken = null;
  let mailboxIdFromToken = null;
  let routeModuleKey = null;
  let routeRecordId = null;

  if (forcedWorkspaceInbox && forcedWorkspaceInbox.organizationId) {
    orgId = forcedWorkspaceInbox.organizationId;
    if (!mongoose.Types.ObjectId.isValid(String(orgId))) {
      throw new InboundDispatchError('Invalid organization for forced workspace ingest', { stage: 'route' });
    }
    const oid = new mongoose.Types.ObjectId(String(orgId));
    const org = await Organization.findById(oid).select('_id').lean();
    if (!org) {
      throw new InboundDispatchError('Organization not found for forced workspace ingest', { stage: 'route' });
    }
    if (String(oid) !== String(org._id)) {
      throw new InboundDispatchError('Workspace record mismatch', { stage: 'route' });
    }
    relatedTo = { moduleKey: 'workspace', recordId: oid };
    helpdeskCaseResult = null;
  } else if (mailroomPrelinkedCase?.caseId) {
    orgId = headerOrganizationId;
    if (!orgId || !mongoose.Types.ObjectId.isValid(String(orgId))) {
      throw new InboundDispatchError('Invalid organization for Mailroom prelinked case', { stage: 'route' });
    }
    const caseId = new mongoose.Types.ObjectId(String(mailroomPrelinkedCase.caseId));
    relatedTo = { moduleKey: 'cases', recordId: caseId };
    helpdeskCaseResult = {
      caseRecord: { _id: caseId },
      action: mailroomPrelinkedCase.action || 'mailroom_linked'
    };
  } else {
    const tenantCtx = await resolveTenantContext({
      parsedMessage,
      headerOrganizationId,
      rawBuffer
    });
    orgId = tenantCtx.orgId;
    conversationIdFromToken = tenantCtx.conversationIdFromToken || null;
    mailboxIdFromToken = tenantCtx.mailboxIdFromToken || null;
    routeModuleKey = tenantCtx.moduleKey;
    routeRecordId = tenantCtx.recordId;
  }

  return runWithOrganizationTenantContext(orgId, async () => {
  if (!relatedTo) {
    const resolved = await resolveTargetRecord({
      orgId,
      moduleKey: routeModuleKey,
      recordId: routeRecordId,
      parsedMessage
    });
    relatedTo = resolved.relatedTo;
    helpdeskCaseResult = resolved.helpdeskCaseResult;
  }

  await appendCommunicationEvent({
    organizationId: orgId,
    eventType: 'inbound_parsed',
    source,
    payload: {
      messageId: parsedMessage.messageId || null,
      fromAddress: parsedMessage.fromAddress,
      subject: parsedMessage.subject,
      attachmentCount: parsedMessage.attachments.length,
      rawSize: parsedMessage.rawSize,
      forcedWorkspace: Boolean(forcedWorkspaceInbox)
    }
  });

  await autoCreatePersonForSender({ organizationId: orgId, parsedMessage });

  const threadResolution = await resolveThread({
    organizationId: orgId,
    inReplyTo: parsedMessage.inReplyTo,
    references: parsedMessage.references,
    relatedTo,
    fromAddress: parsedMessage.fromAddress,
    subject: parsedMessage.subject,
    preferredThreadId: conversationIdFromToken || null
  });

  const normalizedReply = normalizeReplyBody({
    html: parsedMessage.html,
    text: parsedMessage.text
  });

  await appendCommunicationEvent({
    organizationId: orgId,
    communicationId: threadResolution.parent?._id || null,
    eventType: 'inbound_threaded',
    source,
    payload: {
      strategy: threadResolution.strategy,
      threadId: threadResolution.threadId || null,
      hadQuotedContent: normalizedReply.hadQuotedContent,
      hadSignature: normalizedReply.hadSignature
    }
  });

  const inboundAttachments = persistAttachments({ orgId, parsedMessage });

  let mailboxIdInbound = forcedWorkspaceInbox?.mailboxId
    ? (mongoose.Types.ObjectId.isValid(String(forcedWorkspaceInbox.mailboxId))
      ? new mongoose.Types.ObjectId(String(forcedWorkspaceInbox.mailboxId))
      : null)
    : await resolveMailboxIdForInbound({
      organizationId: orgId,
      parsedMessage
    });
  if (
    !mailboxIdInbound
    && mailboxIdFromToken
    && mongoose.Types.ObjectId.isValid(String(mailboxIdFromToken))
  ) {
    mailboxIdInbound = new mongoose.Types.ObjectId(String(mailboxIdFromToken));
  }
  if (!mailboxIdInbound && threadResolution.parent?.mailboxId) {
    mailboxIdInbound = threadResolution.parent.mailboxId;
  }

  const providerMessageKey =
    forcedWorkspaceInbox && forcedWorkspaceInbox.providerMessageKey
      ? String(forcedWorkspaceInbox.providerMessageKey).trim().slice(0, 280)
      : null;

  let doc;
  try {
    doc = new Communication({
      organizationId: orgId,
      kind: 'email',
      direction: 'inbound',
      threadId: threadResolution.threadId || null,
      parentCommunicationId: threadResolution.parent?._id || null,
      subject: parsedMessage.subject,
      body:
        normalizedReply.displayBody
        || normalizedReply.originalBody
        || parsedMessage.text
        || parsedMessage.html
        || parsedMessage.body
        || '',
      fromAddress: parsedMessage.fromAddress,
      toAddresses: parsedMessage.toAddresses,
      ccAddresses: parsedMessage.ccAddresses,
      bccAddresses: parsedMessage.bccAddresses,
      messageId: parsedMessage.messageId,
      inReplyTo: parsedMessage.inReplyTo,
      references: parsedMessage.references.length > 0 ? parsedMessage.references.join(' ') : null,
      receivedAt: parsedMessage.receivedAt,
      status: 'delivered',
      relatedTo,
      mailboxId: mailboxIdInbound || null,
      providerMessageKey: providerMessageKey || null,
      providerThreadId:
        forcedWorkspaceInbox?.providerThreadId
          ? String(forcedWorkspaceInbox.providerThreadId).trim().slice(0, 128)
          : null,
      gmailLabelIds: Array.isArray(forcedWorkspaceInbox?.gmailLabelIds)
        ? forcedWorkspaceInbox.gmailLabelIds
          .map((x) => String(x).trim())
          .filter(Boolean)
          .slice(0, 64)
        : [],
      sentByUserId: null,
      attachments: inboundAttachments,
      metadata: {
        inbound: {
          threadStrategy: threadResolution.strategy,
          hadQuotedContent: normalizedReply.hadQuotedContent,
          hadSignature: normalizedReply.hadSignature,
          originalBodyTruncated: normalizedReply.originalBody !== (normalizedReply.displayBody || parsedMessage.body)
        }
      }
    });
    await doc.save();
  } catch (persistErr) {
    throw new InboundDispatchError(`persist_failed: ${persistErr.message}`, {
      stage: 'persist',
      cause: persistErr
    });
  }

  if (!doc.threadId) {
    await Communication.findByIdAndUpdate(doc._id, { threadId: doc._id });
  }

  if (relatedTo.moduleKey === 'people') {
    await appendActivityLogForPerson({
      orgId,
      recordId: relatedTo.recordId,
      communicationDoc: doc,
      parsedMessage
    });
  }

  await appendCommunicationEvent({
    organizationId: orgId,
    communicationId: doc._id,
    eventType: 'inbound_routed',
    source,
    payload: {
      relatedTo,
      threadStrategy: threadResolution.strategy,
      ...(helpdeskCaseResult && {
        helpdesk: {
          caseId: helpdeskCaseResult.caseRecord._id,
          action: helpdeskCaseResult.action
        }
      })
    }
  });

  if (relatedTo?.moduleKey === 'workspace' || mailboxIdInbound) {
    const { emitInboxUpdated } = require('../../../services/inboxRealtimeService');
    void emitInboxUpdated({
      organizationId: orgId,
      mailboxId: mailboxIdInbound,
      reason: 'inbound',
      meta: {
        communicationId: String(doc._id),
        threadId: String(doc.threadId || doc._id)
      }
    });
  }

  return {
    communicationId: doc._id,
    threadId: doc.threadId || doc._id,
    relatedTo,
    threadStrategy: threadResolution.strategy,
    hadQuotedContent: normalizedReply.hadQuotedContent,
    hadSignature: normalizedReply.hadSignature,
    helpdesk: helpdeskCaseResult
      ? { caseId: helpdeskCaseResult.caseRecord._id, action: helpdeskCaseResult.action }
      : null
  };
  });
}

/**
 * Best-effort org id from MIME (for dead-letter scoping when webhook returns 202 before worker fails).
 */
async function tryResolveInboundOrganizationId(rawMime) {
  const rawBuffer = ensureBuffer(rawMime);
  const parseResult = await parseRawMime(rawBuffer);
  if (!parseResult.ok) return null;
  const tenantCtx = await resolveTenantContext({
    parsedMessage: parseResult.value,
    headerOrganizationId: null
  });
  return tenantCtx?.orgId || null;
}

module.exports = {
  processRawInbound,
  tryResolveInboundOrganizationId,
  InboundDispatchError
};
