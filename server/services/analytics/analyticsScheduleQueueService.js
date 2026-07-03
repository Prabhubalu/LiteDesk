const {
  ANALYTICS_SCHEDULE_QUEUE_NAME,
  ANALYTICS_SCHEDULE_WORKER_CONCURRENCY,
  ANALYTICS_SCHEDULE_QUEUE_RETRY,
  buildCronExpression,
  repeatJobId,
} = require('../../constants/analyticsSchedule');
const { runAnalyticsSchedule } = require('./analyticsScheduleRunner');

let scheduleQueue = null;

function getLegacyRedisUrl() {
  const host = process.env.REDIS_HOST || 'localhost';
  const port = process.env.REDIS_PORT || 6379;
  const pass = process.env.REDIS_PASSWORD;
  if (pass) {
    return `redis://:${encodeURIComponent(pass)}@${host}:${port}`;
  }
  return `redis://${host}:${port}`;
}

function isRedisConfigured() {
  return Boolean(
    String(process.env.REDIS_URL || '').trim() || String(process.env.REDIS_HOST || '').trim()
  );
}

function initQueue() {
  if (scheduleQueue !== null) return scheduleQueue;
  if (!isRedisConfigured()) {
    scheduleQueue = false;
    return false;
  }

  try {
    const Bull = require('bull');
    const redisUrl = process.env.REDIS_URL || getLegacyRedisUrl();
    const isTls = redisUrl.startsWith('rediss://');
    const opts = { defaultJobOptions: { ...ANALYTICS_SCHEDULE_QUEUE_RETRY } };
    opts.redis = {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      ...(isTls ? { tls: { rejectUnauthorized: true } } : {}),
    };

    scheduleQueue = new Bull(ANALYTICS_SCHEDULE_QUEUE_NAME, redisUrl, opts);
    scheduleQueue.on('error', (err) => {
      console.error('[analyticsScheduleQueue] Redis error:', err.message);
    });
    return scheduleQueue;
  } catch (err) {
    console.error('[analyticsScheduleQueue] Failed to init:', err.message);
    scheduleQueue = false;
    return false;
  }
}

async function processScheduleJob(job) {
  const { scheduleId, organizationId, userId, manual } = job.data || {};
  if (!scheduleId || !organizationId) {
    throw new Error('analytics schedule job missing scheduleId or organizationId');
  }

  return runAnalyticsSchedule({
    scheduleId,
    organizationId,
    userId: userId || null,
    manual: Boolean(manual),
  });
}

async function removeRepeatableForSchedule(schedule) {
  const queue = initQueue();
  if (!queue || !schedule?._id) return;

  const cronExpression = schedule.cronExpression || buildCronExpression(schedule);
  const jobId = repeatJobId(schedule._id);
  const tz = schedule.timezone || 'UTC';
  try {
    await queue.removeRepeatable({
      cron: cronExpression,
      jobId,
      tz,
    });
  } catch (err) {
    console.warn('[analyticsScheduleQueue] removeRepeatable failed:', err.message);
  }
}

async function registerRepeatableSchedule(schedule) {
  const queue = initQueue();
  if (!queue) return { mode: 'inline-only' };
  if (schedule.status !== 'active') {
    await removeRepeatableForSchedule(schedule);
    return { mode: 'paused' };
  }

  const cronExpression = buildCronExpression(schedule);
  const jobId = repeatJobId(schedule._id);
  const tz = schedule.timezone || 'UTC';

  await removeRepeatableForSchedule({ ...schedule.toObject?.() || schedule, cronExpression });

  await queue.add(
    {
      scheduleId: String(schedule._id),
      organizationId: String(schedule.organizationId),
    },
    {
      jobId,
      repeat: { cron: cronExpression, tz },
      ...ANALYTICS_SCHEDULE_QUEUE_RETRY,
    }
  );

  return { mode: 'queued', cronExpression, jobId };
}

function enqueueScheduleRun({ scheduleId, organizationId, userId, manual = false }) {
  const queue = initQueue();
  if (!queue) {
    return { mode: 'inline-required' };
  }

  return queue
    .add(
      {
        scheduleId: String(scheduleId),
        organizationId: String(organizationId),
        userId: userId ? String(userId) : null,
        manual: Boolean(manual),
      },
      {
        jobId: `analytics-schedule-run-${scheduleId}-${Date.now()}`,
        ...ANALYTICS_SCHEDULE_QUEUE_RETRY,
      }
    )
    .then(() => ({ mode: 'queued' }))
    .catch((err) => {
      console.error('[analyticsScheduleQueue] enqueue failed:', err.message);
      return { mode: 'inline-required', error: err.message };
    });
}

function startWorker() {
  const queue = initQueue();
  if (!queue) {
    console.log('[analyticsScheduleQueue] Redis unavailable — schedule runs require inline/manual processing');
    return false;
  }

  queue.process(ANALYTICS_SCHEDULE_WORKER_CONCURRENCY, async (job) => {
    await processScheduleJob(job);
  });

  console.log(
    `[analyticsScheduleQueue] Worker started (${ANALYTICS_SCHEDULE_QUEUE_NAME}, concurrency=${ANALYTICS_SCHEDULE_WORKER_CONCURRENCY})`
  );
  return true;
}

async function closeQueue() {
  if (scheduleQueue && scheduleQueue !== false) {
    await scheduleQueue.close();
    scheduleQueue = null;
  }
}

module.exports = {
  ANALYTICS_SCHEDULE_QUEUE_NAME,
  initQueue,
  registerRepeatableSchedule,
  removeRepeatableForSchedule,
  enqueueScheduleRun,
  processScheduleJob,
  startWorker,
  closeQueue,
};
