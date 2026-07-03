const ANALYTICS_SCHEDULE_QUEUE_NAME = 'analytics-schedule';
const ANALYTICS_SCHEDULE_WORKER_CONCURRENCY = 2;

const ANALYTICS_SCHEDULE_FREQUENCIES = Object.freeze(['daily', 'weekly', 'monthly']);
const ANALYTICS_SCHEDULE_STATUSES = Object.freeze(['active', 'paused', 'archived']);
const ANALYTICS_SCHEDULE_EXPORT_FORMATS = Object.freeze(['csv', 'xlsx', 'pdf']);
const ANALYTICS_SCHEDULE_RUN_STATUSES = Object.freeze(['success', 'failed', 'skipped']);

const ANALYTICS_SNAPSHOT_STATUSES = Object.freeze(['success', 'failed']);

const ANALYTICS_SCHEDULE_QUEUE_RETRY = Object.freeze({
  attempts: 2,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: 100,
  removeOnFail: 50,
});

/**
 * Build a cron expression from schedule fields (UTC fields; Bull applies tz separately).
 */
function buildCronExpression(schedule) {
  const minute = Number(schedule.minute ?? 0);
  const hour = Number(schedule.hour ?? 9);
  const frequency = String(schedule.frequency || 'weekly').toLowerCase();

  if (frequency === 'daily') {
    return `${minute} ${hour} * * *`;
  }
  if (frequency === 'weekly') {
    const dayOfWeek = Number(schedule.dayOfWeek ?? 1);
    return `${minute} ${hour} * * ${dayOfWeek}`;
  }
  const dayOfMonth = Math.min(Math.max(Number(schedule.dayOfMonth ?? 1), 1), 28);
  return `${minute} ${hour} ${dayOfMonth} * *`;
}

function repeatJobId(scheduleId) {
  return `analytics-schedule-${String(scheduleId)}`;
}

module.exports = {
  ANALYTICS_SCHEDULE_QUEUE_NAME,
  ANALYTICS_SCHEDULE_WORKER_CONCURRENCY,
  ANALYTICS_SCHEDULE_FREQUENCIES,
  ANALYTICS_SCHEDULE_STATUSES,
  ANALYTICS_SCHEDULE_EXPORT_FORMATS,
  ANALYTICS_SCHEDULE_RUN_STATUSES,
  ANALYTICS_SNAPSHOT_STATUSES,
  ANALYTICS_SCHEDULE_QUEUE_RETRY,
  buildCronExpression,
  repeatJobId,
};
