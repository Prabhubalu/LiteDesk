'use strict';

/**
 * Master DB index: public slug → tenant organization + webform id.
 * Webform definitions live in tenant DBs; this enables public lookup without scanning.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const WebformPublicRegistrySchema = new Schema(
  {
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    webformId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('WebformPublicRegistry', WebformPublicRegistrySchema);
