'use strict';

/**
 * Singleton platform config for Arivu Inbound Parser (master DB).
 * Editable only by platform administrators via Control Plane UI.
 */

const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const PlatformInboundParserConfigSchema = new Schema(
  {
    _id: { type: String, default: 'default' },
    /** Parser API base URL, e.g. https://parser.arivusystems.com (no trailing slash). */
    parserApiBaseUrl: { type: String, trim: true, default: '' },
    /** Public CRM API base URL the parser calls for webhooks, e.g. https://api.arivusystems.com */
    crmPublicApiBaseUrl: { type: String, trim: true, default: '' },
    encryptedParserApiKey: { type: String, default: '' },
    encryptedWebhookSecret: { type: String, default: '' },
    enabled: { type: Boolean, default: false },
    updatedByUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true, collection: 'platform_inbound_parser_config' }
);

module.exports =
  mongoose.models.PlatformInboundParserConfig
  || mongoose.model('PlatformInboundParserConfig', PlatformInboundParserConfigSchema);
