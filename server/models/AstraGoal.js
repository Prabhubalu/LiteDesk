'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

/**
 * Astra v2 autonomous goal (tenant-scoped).
 * Backs the autonomous service: a user-declared or system-proposed objective
 * that Astra tracks and against which it proposes Next-Best-Actions.
 */
const AstraGoalSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    title: { type: String, trim: true, maxlength: 200, required: true },
    description: { type: String, trim: true, maxlength: 4000, default: '' },
    status: {
      type: String,
      enum: ['draft', 'active', 'paused', 'achieved', 'abandoned'],
      default: 'active',
      index: true,
    },
    /** Surface this goal is anchored to (e.g. 'deals', 'inbox', 'home'). */
    surface: { type: String, trim: true, maxlength: 80, default: '' },
    /** Structured metric target, e.g. { metric: 'openPipeline', target: 100000 }. */
    target: { type: mongoose.Schema.Types.Mixed, default: {} },
    /** Cached last computed progress snapshot. */
    progress: { type: mongoose.Schema.Types.Mixed, default: {} },
    dueAt: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true },
);

AstraGoalSchema.index({ organizationId: 1, userId: 1, status: 1 });

module.exports = wrapTenantModel(mongoose.model('AstraGoal', AstraGoalSchema));
