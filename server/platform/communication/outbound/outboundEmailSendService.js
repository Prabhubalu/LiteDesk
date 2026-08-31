/**
 * Routes agent/workspace outbound email to Gmail API or platform SMTP/SES.
 */

const path = require('path');
const fs = require('fs');
const Mailbox = require('../../../models/Mailbox');
const Communication = require('../../../models/Communication');
const User = require('../../../models/User');
const replyToTokenService = require('../../../services/replyToTokenService');
const {
  getGmailApiClientForMailbox,
  isGmailMailboxReady,
  resolveDefaultGmailMailboxForUser,
  countSendableGmailMailboxesForUser
} = require('../../../services/mailboxGmailInboxSyncService');
const {
  isMailboxSmtpReady,
  sendViaMailboxSmtp,
  isConsumerDomain
} = require('../../../services/mailboxSmtpService');
const { getCommunicationConfigForOrganization } = require('../config/communicationConfigService');
const { isGmailIntegrationEnabled } = require('../../../config/emailFeatureFlags');
const emailProviderGateway = require('../providers/emailProviderGateway');
const amdsEmailDelivery = require('../../../services/emailProviders/amdsEmailDelivery');
const { buildCaseAmdsMetadata } = require('../../../services/helpdesk/sendCaseReplyEmail');
const { writeMetadata } = require('../../../utils/arivuMetadata');
const gmailSendProvider = require('../providers/gmailSendProvider');
const fileStorage = require('../../../services/fileStorageService');
const { uploadsDir } = require('../../../middleware/uploadMiddleware');
const objectStorage = require('../../../services/objectStorageService');

function resolveSafeReplyToAddress(value) {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(raw)) return undefined;
  return raw;
}

async function findMailboxForOutbound(organizationId, mailboxId) {
  if (!mailboxId) return null;
  return Mailbox.findOne({ _id: mailboxId, organizationId }).lean();
}

async function findSendableGmailApiMailbox(organizationId, mailboxId) {
  const mb = await findMailboxForOutbound(organizationId, mailboxId);
  if (!mb || !isGmailMailboxReady(mb)) return null;
  return mb;
}

function resolveMailboxFromAddress(mailboxLean) {
  const addr = String(mailboxLean?.emailAddress || mailboxLean?.inboxSyncAccountEmail || '')
    .trim()
    .toLowerCase();
  return addr || null;
}

async function loadAttachmentsFromDoc(doc) {
  const emailAttachments = [];
  const attachments = doc.attachments || [];
  for (const att of attachments) {
    const storagePath = att.storagePath;
    if (!storagePath) continue;
    try {
      let content;
      if (String(storagePath).startsWith('oci:')) {
        const key = String(storagePath).slice(4);
        content = await objectStorage.getBuffer({ key });
      } else if (String(storagePath).startsWith('/api/files/download')) {
        content = await fileStorage.getObjectBuffer(storagePath);
      } else {
        const fullPath = path.join(uploadsDir, storagePath);
        content = fs.readFileSync(fullPath);
      }
      emailAttachments.push({
        filename: att.fileName || path.basename(storagePath),
        content
      });
    } catch (readErr) {
      console.error('[outboundEmail] Failed to read attachment:', storagePath, readErr.message);
    }
  }
  return emailAttachments;
}

async function resolveMailboxReplyTo(mailboxLean) {
  if (!mailboxLean) return undefined;
  const routing = String(mailboxLean.routingAddress || '').trim().toLowerCase();
  if (routing) return resolveSafeReplyToAddress(routing);
  return resolveSafeReplyToAddress(resolveMailboxFromAddress(mailboxLean));
}

/**
 * Reply-To for outbound: match From by default (replies return to the sender identity).
 * Fallbacks: mailbox parser routingAddress, org Reply-To, legacy reply+token.
 */
async function buildReplyToForDoc(doc, options = {}) {
  const organizationId = doc.organizationId;
  const moduleKey = doc.relatedTo?.moduleKey;
  const recordId = doc.relatedTo?.recordId;

  // Prefer the same address shown as From
  const fromRaw = String(doc.fromAddress || '').trim();
  if (fromRaw) {
    const fromEmail = fromRaw.includes('<')
      ? fromRaw.replace(/^.*<([^>]+)>.*$/, '$1').trim()
      : fromRaw;
    const fromReply = resolveSafeReplyToAddress(fromEmail);
    if (fromReply) return fromReply;
  }

  let mailboxLean = options.mailboxLean || null;
  if (!mailboxLean && doc.mailboxId) {
    mailboxLean = await findMailboxForOutbound(organizationId, doc.mailboxId);
  }

  const mailboxReply = await resolveMailboxReplyTo(mailboxLean);
  if (mailboxReply) return mailboxReply;

  try {
    const emailService = require('../../../services/emailService');
    const orgCfg = await emailService.getOrganizationEmailConfig(organizationId);
    const tenantReply = resolveSafeReplyToAddress(orgCfg?.replyTo);
    if (tenantReply) return tenantReply;
  } catch {
    /* continue */
  }

  const envReply = resolveSafeReplyToAddress(process.env.EMAIL_REPLY_TO);
  if (envReply) return envReply;

  const { isShortCrmReplyTokenEnabled } = require('../../../constants/emailReplyRouting');
  if (!isShortCrmReplyTokenEnabled()) {
    return undefined;
  }

  try {
    const { ensureReplyToForCommunication } = require('../../../services/emailThreadRegistryService');
    const crmReply = await ensureReplyToForCommunication(doc, {
      mailboxLean,
      providerThreadId: options.providerThreadId || doc.providerThreadId
    });
    if (crmReply) {
      return resolveSafeReplyToAddress(crmReply);
    }
  } catch (err) {
    console.warn('[outboundEmail] CRM short reply-to failed, using legacy token:', err.message);
  }

  try {
    return resolveSafeReplyToAddress(
      replyToTokenService.buildReplyToAddress({
        orgId: organizationId,
        moduleKey,
        recordId
      })
    );
  } catch {
    return undefined;
  }
}

async function resolveProviderThreadId(doc) {
  if (doc.providerThreadId) return String(doc.providerThreadId).trim();
  if (!doc.parentCommunicationId) return null;
  const parent = await Communication.findById(doc.parentCommunicationId)
    .select('providerThreadId')
    .lean();
  return parent?.providerThreadId ? String(parent.providerThreadId).trim() : null;
}

/**
 * Whether the tenant/user can send agent email (SMTP and/or connected Gmail mailbox).
 */
async function canSendEmailNow(context = {}) {
  const { organizationId, userId, user: userInput, moduleKey } = context;
  if (!organizationId) {
    return emailProviderGateway.isConfigured(context);
  }

  let outboundPolicy = {};
  try {
    const runtimeConfig = await getCommunicationConfigForOrganization(organizationId);
    outboundPolicy = runtimeConfig.outboundEmail || {};
  } catch {
    /* use defaults */
  }

  const smtpOk = await emailProviderGateway.isConfigured({ organizationId });
  const gmailEnabled = isGmailIntegrationEnabled();
  const gmailSmtpRelay = gmailEnabled ? await getOrganizationGmailSmtpRelay(organizationId) : null;
  const user =
    userInput || (userId ? await User.findById(userId).select('_id role isOwner').lean() : null);
  let gmailCount = 0;
  if (gmailEnabled && user) {
    gmailCount = await countSendableGmailMailboxesForUser(organizationId, user);
  }
  if (gmailEnabled && user && gmailSmtpRelay) {
    const smtpMailboxes = await Mailbox.find({
      organizationId,
      smtpOutboundEncryptedAppPassword: { $exists: true, $nin: ['', null] }
    }).lean();
    const { canUserAccessMailboxThreads } = require('../../../services/mailboxAccessService');
    gmailCount += smtpMailboxes.filter(
      (m) => isMailboxGmailSmtpReady(m) && canUserAccessMailboxThreads(user, m)
    ).length;
  }

  if (outboundPolicy.requireMailboxProviderForAgentSend === true) {
    return gmailCount > 0;
  }

  if (moduleKey === 'workspace' && outboundPolicy.disallowPlatformSmtpForWorkspace === true) {
    return gmailCount > 0;
  }

  return smtpOk || gmailCount > 0;
}

async function sendViaGmail(doc, mailboxLean) {
  const clientResult = await getGmailApiClientForMailbox(mailboxLean);
  if (clientResult.error) {
    try {
      await Mailbox.updateOne(
        { _id: mailboxLean._id, organizationId: mailboxLean.organizationId },
        {
          $set: {
            lastInboxSyncError: String(clientResult.error).slice(0, 2000)
          }
        }
      );
    } catch {
      /* best-effort */
    }
    return {
      success: false,
      provider: 'gmail',
      error: clientResult.error,
      code: clientResult.code || 'GMAIL_CLIENT_ERROR'
    };
  }

  const fromAddress = resolveMailboxFromAddress(mailboxLean);
  if (!fromAddress) {
    return {
      success: false,
      provider: 'gmail',
      error: 'Mailbox has no email address configured',
      code: 'MAILBOX_NO_FROM'
    };
  }

  let fromHeader = fromAddress;
  const named = String(doc.fromAddress || '').match(/^(?:"([^"]+)"|([^<]*?))\s*<([^>]+)>/);
  if (named) {
    const displayName = String(named[1] || named[2] || '').trim().replace(/"/g, '');
    if (displayName) {
      fromHeader = `"${displayName}" <${fromAddress}>`;
    }
  }

  const replyTo = await buildReplyToForDoc(doc, { mailboxLean });
  const emailAttachments = await loadAttachmentsFromDoc(doc);
  const textBody = (doc.body || '').replace(/<[^>]+>/g, '');
  const providerThreadId = await resolveProviderThreadId(doc);

  const result = await gmailSendProvider.sendRawMessage({
    gmail: clientResult.gmail,
    from: fromHeader,
    to: doc.toAddresses,
    cc: doc.ccAddresses,
    bcc: doc.bccAddresses,
    subject: doc.subject || '',
    html: doc.body || undefined,
    text: textBody || undefined,
    replyTo,
    inReplyTo: doc.inReplyTo || undefined,
    references: doc.references || undefined,
    messageId: doc.messageId || undefined,
    attachments: emailAttachments.length ? emailAttachments : undefined,
    threadId: providerThreadId || undefined
  });

  if (result.success && result.threadId) {
    const { updateProviderThreadId } = require('../../../services/emailThreadRegistryService');
    void updateProviderThreadId(
      doc.organizationId,
      doc.threadId || doc._id,
      result.threadId
    );
  }

  return result;
}

async function sendViaSmtp(doc) {
  let mailboxLean = null;
  if (doc.mailboxId) {
    mailboxLean = await findMailboxForOutbound(doc.organizationId, doc.mailboxId);
  }
  const replyTo = await buildReplyToForDoc(doc, { mailboxLean });
  const emailAttachments = await loadAttachmentsFromDoc(doc);
  const textBody = (doc.body || '').replace(/<[^>]+>/g, '');

  const moduleKey = doc.relatedTo?.moduleKey;
  const baseMetadata = writeMetadata({
    entity_id: String(doc._id),
    communication_id: String(doc._id),
    org_id: String(doc.organizationId)
  });
  const metadata =
    moduleKey === 'cases' && doc.relatedTo?.recordId
      ? buildCaseAmdsMetadata({
          organizationId: String(doc.organizationId),
          caseId: String(doc.relatedTo.recordId),
          communicationId: String(doc._id)
        })
      : {
          ...baseMetadata,
          ...writeMetadata({ module: moduleKey })
        };

  let fromEmail = String(doc.fromAddress || '').trim();
  let fromName = '';
  const named = fromEmail.match(/^(?:"([^"]+)"|([^<]*?))\s*<([^>]+)>/);
  if (named) {
    fromName = String(named[1] || named[2] || '').trim();
    fromEmail = String(named[3] || '').trim();
  }
  fromEmail = fromEmail.toLowerCase();

  // Prefer display name stored on the Communication; then org From name; then group label
  if (!fromName) {
    if (mailboxLean?.kind === 'group') {
      fromName = String(mailboxLean.label || '').trim();
    } else if (!mailboxLean && fromEmail) {
      try {
        const emailService = require('../../../services/emailService');
        const orgCfg = await emailService.getOrganizationEmailConfig(doc.organizationId);
        const orgFrom = String(orgCfg?.fromEmail || '').trim().toLowerCase();
        if (orgFrom && fromEmail === orgFrom) {
          fromName = String(orgCfg?.fromName || '').trim();
        }
      } catch {
        /* ignore */
      }
    }
  }

  const result = await emailProviderGateway.sendEmail({
    organizationId: doc.organizationId,
    to: doc.toAddresses,
    cc: doc.ccAddresses,
    bcc: doc.bccAddresses,
    subject: doc.subject || '',
    text: textBody || undefined,
    html: doc.body || undefined,
    fromEmail: fromEmail || undefined,
    fromName: fromName || undefined,
    replyTo,
    attachments: emailAttachments.length ? emailAttachments : undefined,
    communicationId: String(doc._id),
    moduleKey,
    idempotencyKey:
      doc.idempotencyKey
      || amdsEmailDelivery.buildCommunicationIdempotencyKey({
        moduleKey,
        organizationId: String(doc.organizationId),
        communicationId: String(doc._id)
      }),
    metadata,
    tags: moduleKey === 'cases' ? ['helpdesk', 'transactional'] : ['crm', moduleKey].filter(Boolean)
  });

  if (
    !result.success
    && fromEmail
    && /domain|verified|not allowed|from.*address|sender/i.test(String(result.error || ''))
  ) {
    return {
      ...result,
      code: result.code || 'FROM_NOT_ALLOWED_BY_PROVIDER',
      error:
        `${result.error} `
        + `Selected From (${fromEmail}) must be allowed by your email provider `
        + '(verify this address/domain in Resend, or connect Gmail for that mailbox).'
    };
  }

  return result;
}

/**
 * Send a Communication document (status should be `sending`).
 * @returns {Promise<{ success: boolean, provider?: string, messageId?: string, threadId?: string, providerMessageKey?: string, error?: string, code?: string }>}
 */
async function sendOutboundCommunication(doc) {
  const organizationId = doc.organizationId;
  const moduleKey = doc.relatedTo?.moduleKey;

  let outboundPolicy = {};
  try {
    const runtimeConfig = await getCommunicationConfigForOrganization(organizationId);
    outboundPolicy = runtimeConfig.outboundEmail || {};
  } catch {
    /* defaults */
  }

  const mustUseProvider =
    outboundPolicy.requireMailboxProviderForAgentSend === true
    || (moduleKey === 'workspace' && outboundPolicy.disallowPlatformSmtpForWorkspace === true);

  let mailboxLean = null;
  if (doc.mailboxId) {
    mailboxLean = await findMailboxForOutbound(organizationId, doc.mailboxId);
  }

  const fromEmail = String(
    doc.fromAddress
    || doc.fromEmail
    || mailboxLean?.emailAddress
    || mailboxLean?.inboxSyncAccountEmail
    || ''
  )
    .trim()
    .toLowerCase();

  async function emitOutboundIfNeeded(result) {
    if (result.success && doc.relatedTo?.moduleKey === 'workspace') {
      const { emitInboxUpdated } = require('../../../services/inboxRealtimeService');
      void emitInboxUpdated({
        organizationId: doc.organizationId,
        mailboxId: doc.mailboxId,
        reason: 'outbound',
        meta: { communicationId: String(doc._id) }
      });
    }
    return result;
  }

  // Consumer From must never fall through to org AMDS/Resend/platform SMTP
  if (fromEmail && isConsumerDomain(fromEmail)) {
    if (mailboxLean && isMailboxSmtpReady(mailboxLean)) {
      const replyTo = await buildReplyToForDoc(doc, { mailboxLean });
      const emailAttachments = await loadAttachmentsFromDoc(doc);
      return emitOutboundIfNeeded(
        await sendViaMailboxSmtp(doc, mailboxLean, {
          replyTo,
          attachments: emailAttachments.length ? emailAttachments : undefined
        })
      );
    }
    if (mailboxLean && isGmailMailboxReady(mailboxLean)) {
      return emitOutboundIfNeeded(await sendViaGmail(doc, mailboxLean));
    }
    return {
      success: false,
      provider: 'smtp',
      error:
        'Connect this personal email with an App Password to send. Personal mailboxes cannot use organization delivery (AMDS/Resend).',
      code: 'NEEDS_SMTP_SETUP'
    };
  }

  if (mailboxLean && isMailboxSmtpReady(mailboxLean)) {
    const replyTo = await buildReplyToForDoc(doc, { mailboxLean });
    const emailAttachments = await loadAttachmentsFromDoc(doc);
    return emitOutboundIfNeeded(
      await sendViaMailboxSmtp(doc, mailboxLean, {
        replyTo,
        attachments: emailAttachments.length ? emailAttachments : undefined
      })
    );
  }

  if (mailboxLean && isGmailMailboxReady(mailboxLean)) {
    return emitOutboundIfNeeded(await sendViaGmail(doc, mailboxLean));
  }

  if (mustUseProvider) {
    return {
      success: false,
      provider: 'gmail',
      error:
        moduleKey === 'workspace'
          ? 'Connect a mailbox to send from Inbox. Platform SMTP is disabled for workspace email.'
          : 'A connected mailbox is required to send email for this tenant.',
      code: 'MAILBOX_PROVIDER_REQUIRED'
    };
  }

  return sendViaSmtp(doc);
}

function buildCommunicationUpdateFromSendResult(result) {
  const finalStatus = result.success ? 'sent' : 'failed';
  const update = {
    status: finalStatus,
    sentAt: new Date(),
    ...(result.success && { 'metadata.provider': result.provider || 'unknown' })
  };

  if (!result.success) {
    update['metadata.deliveryError'] = String(result.error || 'send_failed').slice(0, 2000);
    update['metadata.sendErrorCode'] = result.code ? String(result.code).slice(0, 64) : null;
    update['metadata.sendErrorDomain'] = result.domain ? String(result.domain).slice(0, 253) : null;
  } else {
    update['metadata.sendErrorCode'] = null;
    update['metadata.sendErrorDomain'] = null;
    if (finalStatus === 'sent') {
      update['metadata.deliveryError'] = null;
    }
  }

  if (result.provider === 'gmail') {
    if (result.messageId) {
      update.externalMessageId = result.messageId;
      update.providerMessageKey = result.providerMessageKey || `gmail:${result.messageId}`;
    }
    if (result.threadId) {
      update.providerThreadId = String(result.threadId).slice(0, 128);
    }
  } else if (result.provider === amdsEmailDelivery.PROVIDER_KEY) {
    if (result.messageId) {
      update.externalMessageId = result.messageId;
      update.providerMessageKey = `amds:${result.messageId}`;
      update['metadata.amdsMessageId'] = result.messageId;
    }
  } else if (result.messageId) {
    update.externalMessageId = result.messageId;
  }

  return update;
}

module.exports = {
  canSendEmailNow,
  sendOutboundCommunication,
  buildCommunicationUpdateFromSendResult,
  findMailboxForOutbound,
  findSendableGmailApiMailbox,
  resolveMailboxFromAddress,
  resolveDefaultGmailMailboxForUser,
  loadAttachmentsFromDoc
};
