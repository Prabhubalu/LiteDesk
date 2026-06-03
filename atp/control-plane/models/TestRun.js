import mongoose from 'mongoose';

const testResultSchema = new mongoose.Schema(
  {
    caseId: { type: String, required: true, index: true },
    title: String,
    layer: String,
    status: {
      type: String,
      enum: ['passed', 'failed', 'skipped', 'running', 'pending'],
      default: 'pending',
    },
    durationMs: { type: Number, default: 0 },
    metrics: mongoose.Schema.Types.Mixed,
    trace: mongoose.Schema.Types.Mixed,
    error: {
      message: String,
      stack: String,
      request: mongoose.Schema.Types.Mixed,
      response: mongoose.Schema.Types.Mixed,
    },
    startedAt: Date,
    finishedAt: Date,
  },
  { _id: true }
);

const testRunSchema = new mongoose.Schema(
  {
    runId: { type: String, required: true, unique: true, index: true },
    suiteKey: { type: String, required: true, index: true },
    suiteName: String,
    envKey: { type: String, default: 'local' },
    status: {
      type: String,
      enum: ['queued', 'running', 'passed', 'failed', 'partial', 'cancelled'],
      default: 'queued',
      index: true,
    },
    dryRun: { type: Boolean, default: false },
    triggeredBy: { type: String, default: 'cli' },
    sutApiUrl: String,
    gitSha: String,
    stats: {
      total: { type: Number, default: 0 },
      passed: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      pending: { type: Number, default: 0 },
    },
    results: [testResultSchema],
    startedAt: Date,
    finishedAt: Date,
  },
  { timestamps: true }
);

export const TestRun = mongoose.models.TestRun || mongoose.model('TestRun', testRunSchema);
