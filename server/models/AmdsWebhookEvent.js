'use strict';

const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const AmdsWebhookEventSchema = new Schema(
  {
    event_id: { type: String, required: true, trim: true, unique: true, index: true },
    event_type: { type: String, required: true, trim: true },
    message_id: { type: String, trim: true, index: true },
    tenant_id: { type: String, trim: true, index: true },
    processed_at: { type: Date, default: Date.now, index: true },
    payload: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, collection: 'amds_webhook_events' }
);

AmdsWebhookEventSchema.index({ processed_at: 1 }, { expireAfterSeconds: 2592000 });

module.exports =
  mongoose.models.AmdsWebhookEvent
  || mongoose.model('AmdsWebhookEvent', AmdsWebhookEventSchema);
