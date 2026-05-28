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
  isMailboxGmailSmtpReady,
  sendViaMailboxGmailSmtp,
  getOrganizationGmailSmtpRelay
} = require('../../../services/mailboxGmailSmtpService');
const { getCommunicationConfigForOrganization } = require('../config/communicationConfigService');
const { isGmailIntegrationEnabled } = require('../../../config/emailFeatureFlags');
const emailProviderGateway = require('../providers/emailProviderGateway');
const gmailSendProvider = require('../providers/gmailSendProvider');
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

async function buildReplyToForDoc(doc, options = {}) {
  const organizationId = doc.organizationId;
  const moduleKey = doc.relatedTo?.moduleKey;
  const recordId = doc.relatedTo?.recordId;

  try {
    const { ensureReplyToForCommunication } = require('../../../services/emailThreadRegistryService');
    const crmReply = await ensureReplyToForCommunication(doc, {
      mailboxLean: options.mailboxLean || null,
      providerThreadId: options.providerThreadId || doc.providerThreadId
    });
    if (crmReply) {
      return resolveSafeReplyToAddress(crmReply);
    }
  } catch (err) {
    console.warn('[outboundEmail] CRM short reply-to failed, using legacy token:', err.message);
  }

  let replyToAddr;
  try {
    replyToAddr = replyToTokenService.buildReplyToAddress({
      orgId: organizationId,
      moduleKey,
      recordId
    });
  } catch {
    replyToAddr = process.env.EMAIL_REPLY_TO;
  }
  return resolveSafeReplyToAddress(replyToAddr);
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

  const replyTo = await buildReplyToForDoc(doc, { mailboxLean });
  const emailAttachments = await loadAttachmentsFromDoc(doc);
  const textBody = (doc.body || '').replace(/<[^>]+>/g, '');
  const providerThreadId = await resolveProviderThreadId(doc);

  const result = await gmailSendProvider.sendRawMessage({
    gmail: clientResult.gmail,
    from: fromAddress,
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
  const replyTo = await buildReplyToForDoc(doc, { mailboxLean: null });
  const emailAttachments = await loadAttachmentsFromDoc(doc);
  const textBody = (doc.body || '').replace(/<[^>]+>/g, '');

  return emailProviderGateway.sendEmail({
    organizationId: doc.organizationId,
    to: doc.toAddresses,
    cc: doc.ccAddresses,
    bcc: doc.bccAddresses,
    subject: doc.subject || '',
    text: textBody || undefined,
    html: doc.body || undefined,
    replyTo,
    attachments: emailAttachments.length ? emailAttachments : undefined
  });
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

  if (isGmailIntegrationEnabled() && mailboxLean && isMailboxGmailSmtpReady(mailboxLean)) {
    const replyTo = await buildReplyToForDoc(doc, { mailboxLean });
    const emailAttachments = await loadAttachmentsFromDoc(doc);
    const result = await sendViaMailboxGmailSmtp(doc, mailboxLean, {
      replyTo,
      attachments: emailAttachments.length ? emailAttachments : undefined
    });
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

  if (isGmailIntegrationEnabled() && mailboxLean && isGmailMailboxReady(mailboxLean)) {
    const result = await sendViaGmail(doc, mailboxLean);
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

  if (mustUseProvider) {
    return {
      success: false,
      provider: 'gmail',
      error:
        moduleKey === 'workspace'
          ? 'Connect a Gmail mailbox to send from Inbox. Platform SMTP is disabled for workspace email.'
          : 'A connected Gmail mailbox is required to send email for this tenant.',
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

  if (result.provider === 'gmail') {
    if (result.messageId) {
      update.externalMessageId = result.messageId;
      update.providerMessageKey = result.providerMessageKey || `gmail:${result.messageId}`;
    }
    if (result.threadId) {
      update.providerThreadId = String(result.threadId).slice(0, 128);
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
