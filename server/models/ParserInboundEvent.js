'use strict';

/**
 * Idempotency + processing state for parser email.received webhooks (master DB).
 */

const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const ParserInboundEventSchema = new Schema(
  {
    parserMessageId: { type: String, required: true, trim: true, index: true },
    parserTenantId: { type: String, required: true, trim: true, index: true },
    parserMailboxId: { type: String, required: true, trim: true },
    parserThreadId: { type: String, trim: true, default: '' },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null },
    mailboxObjectId: { type: Schema.Types.ObjectId, ref: 'Mailbox', default: null },
    receivedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['received', 'processing', 'processed', 'failed'],
      default: 'received',
      index: true
    },
    lastError: { type: String, trim: true, default: '', maxlength: 2000 },
    communicationId: { type: Schema.Types.ObjectId, ref: 'Communication', default: null },
    processedAt: { type: Date, default: null }
  },
  { timestamps: true, collection: 'parser_inbound_events' }
);

ParserInboundEventSchema.index(
  { parserTenantId: 1, parserMessageId: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.ParserInboundEvent
  || mongoose.model('ParserInboundEvent', ParserInboundEventSchema);
