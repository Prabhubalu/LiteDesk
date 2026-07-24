'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const ModuleSequenceSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    moduleKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    /** '' | YYYY | YYYY-MM | YYYY-MM-DD */
    periodKey: {
      type: String,
      required: true,
      trim: true,
      default: '',
    },
    nextValue: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

ModuleSequenceSchema.index(
  { organizationId: 1, moduleKey: 1, periodKey: 1 },
  { unique: true }
);

module.exports = wrapTenantModel(mongoose.model('ModuleSequence', ModuleSequenceSchema));
