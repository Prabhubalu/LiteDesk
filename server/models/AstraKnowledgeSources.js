'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

/**
 * Org-level Knowledge Sources switches for Astra / case draft / Live Chat.
 */
const AstraKnowledgeSourcesSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
      index: true,
    },
    articlesEnabled: { type: Boolean, default: true },
    documentsEnabled: { type: Boolean, default: true },
    websiteEnabled: { type: Boolean, default: true },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = wrapTenantModel(
  mongoose.model('AstraKnowledgeSources', AstraKnowledgeSourcesSchema),
);
