/**
 * ============================================================================
 * Mailbox — personal vs shared (group) workspace inboxes + send-only SMTP senders
 * ============================================================================
 *
 * Personal: one logical inbox per user (e.g. future IMAP/OAuth sync to their work email).
 * Group: tenant-wide shared addresses (e.g. contact-us@) with explicit membership; admins create.
 * smtp_sender: send-only outbound SMTP identities (multiple per user; no inbox sync).
 *
 * Inbound/outbound `Communication` documents may set optional `mailboxId` (see `Communication` model).
 * Group routing: recipient address matched to `emailAddress` in `mailboxRoutingService`.
 * ============================================================================
 */

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const Schema = mongoose.Schema;

const MailboxSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    kind: {
      type: String,
      enum: ['personal', 'group', 'smtp_sender'],
      required: true,
      index: true
    },
    label: { type: String, required: true, trim: true, maxlength: 160 },
    emailAddress: { type: String, trim: true, lowercase: true, default: '' },
    /** Set for kind === 'personal' | 'smtp_sender' (the user who owns this mailbox/sender). */
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    /** For kind === 'group': users who may work this inbox (empty = not restricted yet / legacy). */
    memberUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['draft', 'active'],
      default: 'draft'
    },
    syncStatus: {
      type: String,
      enum: ['not_configured', 'pending', 'connected'],
      default: 'not_configured'
    },
    /**
     * Inbox provider sync (Phase 5). Only `personal` mailboxes support OAuth today.
     * `none` | `google` — refresh token stored encrypted; never returned by API.
     */
    inboxProvider: {
      type: String,
      enum: ['none', 'google'],
      default: 'none'
    },
    inboxSyncEncryptedRefreshToken: { type: String, default: '' },
    inboxSyncAccountEmail: { type: String, trim: true, lowercase: true, default: '' },
    /**
     * Gmail label IDs to import during mailbox sync (system + user labels).
     * Empty / missing means server default (see mailboxGmailInboxSyncService).
     */
    gmailSyncLabelIds: [{ type: String, trim: true, maxlength: 128 }],
    gmailHistoryId: { type: String, trim: true, default: '' },
    /** Gmail Pub/Sub watch expiration (R3.1). */
    gmailWatchExpiration: { type: Date, default: null },
    gmailWatchTopic: { type: String, trim: true, default: '' },
    /** Override messages imported per sync run (else env GMAIL_INBOX_SYNC_MAX_MESSAGES_PER_RUN). */
    gmailSyncMaxMessagesPerRun: { type: Number, min: 1, max: 200, default: null },
    lastInboxSyncAt: { type: Date, default: null },
    lastInboxSyncError: { type: String, trim: true, default: '', maxlength: 2000 },
    /**
     * Outbound send channel.
     * `gmail_api` = Gmail API (OAuth).
     * `gmail_smtp` | `smtp` = per-mailbox SMTP (App Password / provider SMTP; direct, no org relay).
     */
    outboundChannel: {
      type: String,
      enum: ['none', 'gmail_api', 'gmail_smtp', 'smtp'],
      default: 'none'
    },
    smtpOutboundEncryptedAppPassword: { type: String, default: '' },
    smtpOutboundVerifiedAt: { type: Date, default: null },
    /** gmail | outlook | yahoo | zoho | icloud | custom */
    smtpOutboundProvider: { type: String, trim: true, lowercase: true, default: '' },
    smtpOutboundHost: { type: String, trim: true, default: '' },
    smtpOutboundPort: { type: Number, default: null },
    smtpOutboundSecure: { type: Boolean, default: false },
    /** Display name chosen in SMTP setup wizard — used as From name when sending via SMTP. */
    smtpOutboundFromName: { type: String, trim: true, default: '', maxlength: 160 },
    /** Arivu Inbound Parser (platform-provisioned; tenants see routingAddress only). */
    parserTenantId: { type: String, trim: true, default: '' },
    parserMailboxId: { type: String, trim: true, default: '' },
    routingAddress: { type: String, trim: true, lowercase: true, default: '' },
    parserForwardingHint: { type: String, trim: true, default: '', maxlength: 500 },
    parserProvisionedAt: { type: Date, default: null },
    parserProvisioningError: { type: String, trim: true, default: '', maxlength: 500 },
    parserProvisionStatus: {
      type: String,
      enum: ['pending', 'provisioned', 'failed', 'skipped'],
      default: 'pending'
    }
  },
  { timestamps: true }
);

// At most one personal mailbox per user per organization.
MailboxSchema.index(
  { organizationId: 1, kind: 1, ownerUserId: 1 },
  {
    unique: true,
    partialFilterExpression: { kind: 'personal', ownerUserId: { $exists: true, $ne: null } }
  }
);

// One From address per smtp_sender owner (after email is set).
MailboxSchema.index(
  { organizationId: 1, ownerUserId: 1, emailAddress: 1 },
  {
    unique: true,
    partialFilterExpression: {
      kind: 'smtp_sender',
      ownerUserId: { $exists: true, $ne: null },
      emailAddress: { $exists: true, $type: 'string', $gt: '' }
    }
  }
);

MailboxSchema.index({ organizationId: 1, kind: 1, updatedAt: -1 });

const Mailbox = mongoose.model('Mailbox', MailboxSchema);

module.exports = wrapTenantModel(Mailbox);
