const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { MAILROOM_SCHEMA_VERSION } = require('../constants/mailroomPolicies');

const { Schema } = mongoose;

const TenantMailroomConfigSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
      unique: true
    },
    enabled: { type: Boolean, default: false },
    activeTemplateId: { type: String, trim: true, default: 'helpdesk_standard_email' },
    schemaVersion: { type: Number, default: MAILROOM_SCHEMA_VERSION },
    policies: { type: Schema.Types.Mixed, default: {} },
    connectors: { type: Schema.Types.Mixed, default: {} },
    security: { type: Schema.Types.Mixed, default: {} },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true, collection: 'tenant_mailroom_configs' }
);

module.exports = wrapTenantModel(
  mongoose.models.TenantMailroomConfig
    || mongoose.model('TenantMailroomConfig', TenantMailroomConfigSchema)
);
