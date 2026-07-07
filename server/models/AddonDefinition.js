/**
 * Platform catalog metadata for installable addons (master DB).
 */

const mongoose = require('mongoose');

const AddonDefinitionSchema = new mongoose.Schema({
  addonKey: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
  icon: {
    type: String,
    trim: true,
    default: 'puzzle-piece',
  },
  category: {
    type: String,
    enum: ['COMMUNICATION', 'AUTOMATION', 'ANALYTICS', 'INTEGRATION', 'OTHER'],
    default: 'OTHER',
  },
  enabled: {
    type: Boolean,
    default: true,
  },
  order: {
    type: Number,
    default: 0,
  },
  requiredApps: [{
    type: String,
    trim: true,
    uppercase: true,
  }],
  optionalApps: [{
    type: String,
    trim: true,
    uppercase: true,
  }],
  marketplace: {
    category: { type: String, trim: true, default: 'Communication' },
    comingSoon: { type: Boolean, default: false },
    beta: { type: Boolean, default: false },
    shortDescription: { type: String, trim: true, default: '' },
    docsUrl: { type: String, trim: true, default: '' },
  },
}, {
  timestamps: true,
});

AddonDefinitionSchema.index({ addonKey: 1 }, { unique: true });
AddonDefinitionSchema.index({ enabled: 1, order: 1 });

module.exports = mongoose.model('AddonDefinition', AddonDefinitionSchema);
