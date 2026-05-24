'use strict';

/**
 * Master DB map: parser tenant/mailbox ids → CRM org + mailbox (for short ids and webhooks).
 */
const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const ParserMailboxRegistrySchema = new Schema(
  {
    parserTenantId: { type: String, required: true, trim: true },
    parserMailboxId: { type: String, required: true, trim: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    mailboxObjectId: { type: Schema.Types.ObjectId, ref: 'Mailbox', required: true },
    mailboxKind: { type: String, enum: ['personal', 'group'], default: 'personal' },
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true, collection: 'parser_mailbox_registry' }
);

ParserMailboxRegistrySchema.index(
  { parserTenantId: 1, parserMailboxId: 1 },
  { unique: true }
);
ParserMailboxRegistrySchema.index({ organizationId: 1, mailboxObjectId: 1 });

const ParserMailboxRegistry =
  mongoose.models.ParserMailboxRegistry
  || mongoose.model('ParserMailboxRegistry', ParserMailboxRegistrySchema);

module.exports = ParserMailboxRegistry;
