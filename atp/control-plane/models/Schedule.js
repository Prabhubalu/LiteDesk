import mongoose from 'mongoose';

const scheduleSchema = new mongoose.Schema(
  {
    scheduleId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    suiteKey: { type: String, required: true, index: true },
    envKey: { type: String, default: 'local' },
    cronExpression: { type: String, required: true },
    enabled: { type: Boolean, default: true, index: true },
    slackWebhookUrl: String,
    lastRunAt: Date,
    lastRunId: String,
    lastStatus: String,
    nextRunAt: Date,
    createdBy: { type: String, default: 'dashboard' },
  },
  { timestamps: true }
);

export const Schedule =
  mongoose.models.Schedule || mongoose.model('Schedule', scheduleSchema);
