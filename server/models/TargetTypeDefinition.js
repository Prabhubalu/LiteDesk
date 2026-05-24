'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { METRIC_KINDS } = require('../constants/targetConstants');

const SourceModuleSchema = new mongoose.Schema({
  appKey: { type: String, required: true, trim: true, uppercase: true },
  moduleKey: { type: String, required: true, trim: true, lowercase: true }
}, { _id: false });

const TargetTypeDefinitionSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  key: { type: String, required: true, trim: true, lowercase: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  metricKind: { type: String, enum: METRIC_KINDS, default: 'count' },
  defaultSourceModules: { type: [SourceModuleSchema], default: [] },
  exclusiveGroup: { type: String, default: null },
  carryForwardPolicy: {
    underachieved: { type: String, enum: ['carry', 'expire', 'none'], default: 'none' },
    overachieved: { type: String, enum: ['bonus_carry', 'none'], default: 'none' }
  },
  isSystem: { type: Boolean, default: false },
  enabled: { type: Boolean, default: true }
}, { timestamps: true });

TargetTypeDefinitionSchema.index({ organizationId: 1, key: 1 }, { unique: true });

module.exports = wrapTenantModel(mongoose.model('TargetTypeDefinition', TargetTypeDefinitionSchema));
