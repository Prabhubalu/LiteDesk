'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { TALLY_SYNC_WAYS } = require('../constants/tallyModuleMappingDefaults');
const { INBOUND_CREATE_POLICIES } = require('../constants/atipConstants');

const { Schema } = mongoose;

const TallyModuleMappingSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    companyGuid: { type: String, trim: true, default: null, index: true },
    tallyModuleKey: { type: String, required: true, trim: true, lowercase: true, index: true },
    tallyModuleName: { type: String, required: true, trim: true },
    arivuModuleKey: { type: String, trim: true, default: null },
    arivuModuleName: { type: String, trim: true, default: '—' },
    entityType: { type: String, trim: true, default: null, index: true },
    syncWay: {
      type: String,
      enum: TALLY_SYNC_WAYS,
      default: 'disabled',
      index: true,
    },
    /**
     * ATIP 2C: when syncWay allows Tally→Arivu for vouchers,
     * draft | posted_if_valid | review_only (catalog/link only).
     */
    inboundCreatePolicy: {
      type: String,
      enum: INBOUND_CREATE_POLICIES,
      default: 'review_only',
    },
    /** Filter: parents[], dateWindowDays, postedOnly, syncFrom, nameContains, excludeSystemLedgers, requireUom */
    filter: { type: Schema.Types.Mixed, default: {} },
    /** Migration mass-backfill start date (ISO). Shown when migrationMode is on. */
    syncFrom: { type: Date, default: null },
    syncOrder: { type: Number, default: 50 },
    referenceOnly: { type: Boolean, default: false },
    discoverOnly: { type: Boolean, default: false },
    enabled: { type: Boolean, default: true },
    lastSyncAt: { type: Date, default: null },
    lastAlterId: { type: String, trim: true, default: null },
    lastMasterId: { type: String, trim: true, default: null },
    watermark: { type: Schema.Types.Mixed, default: {} },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

TallyModuleMappingSchema.index(
  { organizationId: 1, companyGuid: 1, tallyModuleKey: 1 },
  { unique: true }
);

module.exports = wrapTenantModel(mongoose.model('TallyModuleMapping', TallyModuleMappingSchema));
