/**
 * Generic description version history for any module record.
 * Used when the module does not have its own descriptionVersions (e.g. people, organizations).
 * Deals and tasks keep using their native descriptionVersions; other modules use this collection.
 */
const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const Schema = mongoose.Schema;

const DESCRIPTION_VERSION_RETENTION_DAYS = 365;

const RecordDescriptionVersionSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  moduleKey: { type: String, required: true, trim: true, index: true },
  recordId: { type: String, required: true, trim: true, index: true },
  contentField: { type: String, required: true, trim: true, default: 'description', index: true },
  versions: [{
    content: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
  }]
}, { timestamps: true });

RecordDescriptionVersionSchema.index(
  { organizationId: 1, moduleKey: 1, recordId: 1, contentField: 1 },
  { unique: true }
);

RecordDescriptionVersionSchema.statics.RETENTION_DAYS = DESCRIPTION_VERSION_RETENTION_DAYS;

module.exports = wrapTenantModel(mongoose.model('RecordDescriptionVersion', RecordDescriptionVersionSchema));
