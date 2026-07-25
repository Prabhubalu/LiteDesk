const mongoose = require('mongoose');
const crypto = require('crypto');
const Schema = mongoose.Schema;
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const CostCentreSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  costCentreId: { type: String, required: true, unique: true, trim: true, index: true },
  code: { type: String, required: true, trim: true, index: true },
  name: { type: String, required: true, trim: true },
  isActive: { type: Boolean, default: true, index: true },
  externalReferenceId: { type: String, trim: true, default: null, index: true },
  syncStatus: { type: String, trim: true, default: 'not_synced', index: true },
  lastSyncAt: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  modifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  deletedAt: { type: Date, default: null, index: true }
}, { timestamps: true });

CostCentreSchema.index({ organizationId: 1, code: 1 }, { unique: true });

CostCentreSchema.pre('validate', function assignCostCentreId(next) {
  if (!this.costCentreId) {
    this.costCentreId = crypto.randomUUID();
  }
  return next();
});

module.exports = wrapTenantModel(mongoose.model('CostCentre', CostCentreSchema));
