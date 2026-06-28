'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  WEBFORM_STATUSES,
  WEBFORM_FIELD_TYPES,
  WEBFORM_RECORD_ACTIONS,
  WEBFORM_DEDUP_ACTIONS,
  WEBFORM_FIELD_WIDTHS
} = require('../constants/webformFields');

const { Schema } = mongoose;

const WebformFieldSchema = new Schema(
  {
    fieldId: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: WEBFORM_FIELD_TYPES,
      required: true,
      default: 'Text'
    },
    required: { type: Boolean, default: false },
    helpText: { type: String, trim: true, default: '' },
    placeholder: { type: String, trim: true, default: '' },
    options: [{ type: String, trim: true }],
    crmFieldKey: { type: String, trim: true, default: '' },
    dependencies: [{ type: Schema.Types.Mixed }],
    columnWidth: {
      type: String,
      enum: WEBFORM_FIELD_WIDTHS,
      default: 'full'
    },
    order: { type: Number, default: 0 },
    stepId: { type: String, trim: true, default: '' },
    visibility: {
      enabled: { type: Boolean, default: false },
      match: { type: String, enum: ['all', 'any'], default: 'all' },
      conditions: [{
        fieldId: { type: String, trim: true, default: '' },
        operator: { type: String, trim: true, default: 'equals' },
        value: { type: String, trim: true, default: '' }
      }]
    }
  },
  { _id: false }
);

const WebformSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    webformId: {
      type: String,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    status: {
      type: String,
      enum: WEBFORM_STATUSES,
      default: 'Draft',
      index: true
    },
    targetModuleKey: {
      type: String,
      trim: true,
      lowercase: true,
      default: 'people'
    },
    targetAppKey: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'PLATFORM'
    },
    fields: {
      type: [WebformFieldSchema],
      default: []
    },
    recordAction: {
      type: String,
      enum: WEBFORM_RECORD_ACTIONS,
      default: 'create'
    },
    dedup: {
      enabled: { type: Boolean, default: false },
      keys: [{ type: String, trim: true }],
      action: {
        type: String,
        enum: WEBFORM_DEDUP_ACTIONS,
        default: 'update'
      }
    },
    notifyOnSubmit: {
      enabled: { type: Boolean, default: true },
      userIds: [{ type: Schema.Types.ObjectId, ref: 'User' }]
    },
    taskOnSubmit: {
      enabled: { type: Boolean, default: false },
      title: { type: String, trim: true, default: '' },
      description: { type: String, trim: true, default: '' },
      dueInDays: { type: Number, min: 0, default: null },
      assignee: {
        type: String,
        enum: ['record_owner', 'webform_creator', 'specific_user'],
        default: 'record_owner'
      },
      assigneeUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null }
    },
    webhook: {
      enabled: { type: Boolean, default: false },
      url: { type: String, trim: true, default: '' },
      secret: { type: String, trim: true, default: '' }
    },
    captcha: {
      enabled: { type: Boolean, default: false },
      siteKey: { type: String, trim: true, default: '' },
      secretKey: { type: String, trim: true, default: '' }
    },
    publicLink: {
      enabled: { type: Boolean, default: false },
      slug: { type: String, trim: true, lowercase: true }
    },
    headerImageUrl: {
      type: String,
      trim: true,
      default: ''
    },
    headerBackgroundColor: {
      type: String,
      trim: true,
      default: ''
    },
    branding: {
      logoUrl: { type: String, trim: true, default: '' },
      themeColor: { type: String, trim: true, default: '#2563eb' },
      backgroundColor: { type: String, trim: true, default: '' },
      fontFamily: { type: String, trim: true, default: 'system' },
      headingColor: { type: String, trim: true, default: '' },
      logoPosition: { type: String, trim: true, default: 'center' },
      logoSize: { type: String, trim: true, default: 'md' },
      formBodyBackgroundColor: { type: String, trim: true, default: '' }
    },
    multiStep: {
      enabled: { type: Boolean, default: false },
      showProgress: { type: Boolean, default: true }
    },
    steps: [{
      stepId: { type: String, trim: true, required: true },
      title: { type: String, trim: true, default: '' },
      description: { type: String, trim: true, default: '' },
      order: { type: Number, default: 0 }
    }],
    thankYouMessage: {
      type: String,
      trim: true,
      default: ''
    },
    redirectUrl: {
      type: String,
      trim: true,
      default: ''
    },
    formActions: {
      align: { type: String, trim: true, default: 'left' },
      submit: {
        label: { type: String, trim: true, default: '' },
        color: { type: String, trim: true, default: 'blue' },
        width: { type: String, trim: true, default: 'full' }
      },
      next: {
        label: { type: String, trim: true, default: '' },
        color: { type: String, trim: true, default: 'gray' },
        width: { type: String, trim: true, default: 'fit' }
      },
      back: {
        label: { type: String, trim: true, default: '' },
        color: { type: String, trim: true, default: 'gray' },
        width: { type: String, trim: true, default: 'fit' }
      },
      reset: {
        enabled: { type: Boolean, default: false },
        label: { type: String, trim: true, default: '' },
        color: { type: String, trim: true, default: 'gray' },
        width: { type: String, trim: true, default: 'fit' }
      },
      cancel: {
        enabled: { type: Boolean, default: false },
        label: { type: String, trim: true, default: '' },
        color: { type: String, trim: true, default: 'gray' },
        width: { type: String, trim: true, default: 'fit' },
        redirectUrl: { type: String, trim: true, default: '' }
      }
    },
    totalSubmissions: {
      type: Number,
      default: 0,
      min: 0
    },
    totalViews: {
      type: Number,
      default: 0,
      min: 0
    },
    lastSubmissionAt: {
      type: Date,
      default: null
    },
    publishedAt: {
      type: Date,
      default: null
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    modifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    auditLog: {
      type: [
        {
          type: { type: String, required: true, trim: true },
          message: { type: String, trim: true, default: '' },
          actorUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
          metadata: { type: Schema.Types.Mixed, default: {} },
          createdAt: { type: Date, default: Date.now }
        }
      ],
      default: []
    }
  },
  { timestamps: true }
);

WebformSchema.index({ organizationId: 1, status: 1 });
WebformSchema.index({ organizationId: 1, webformId: 1 }, { unique: true });
WebformSchema.index(
  { organizationId: 1, 'publicLink.slug': 1 },
  {
    unique: true,
    partialFilterExpression: {
      'publicLink.slug': { $type: 'string', $exists: true }
    }
  }
);

WebformSchema.pre('save', async function preSave(next) {
  if (this.webformId) return next();
  try {
    const WebformModel = this.constructor;
    const count = await WebformModel.countDocuments({ organizationId: this.organizationId });
    this.webformId = `WFM-${String(count + 1).padStart(3, '0')}`;
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = wrapTenantModel(mongoose.model('Webform', WebformSchema));
