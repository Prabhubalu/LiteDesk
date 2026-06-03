import { v4 as uuidv4 } from 'uuid';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { Schedule } from './models/Schedule.js';
import { TestRun } from './models/TestRun.js';
import { getConfig } from '../shared/config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUITES_PATH = path.join(__dirname, '../catalog/suites.json');

/** @type {Map<string, { stop: () => void }>} */
const tasks = new Map();

async function triggerSchedule(scheduleDoc) {
  const config = getConfig();
  const runId = uuidv4();
  const suites = fs.existsSync(SUITES_PATH) ? JSON.parse(fs.readFileSync(SUITES_PATH, 'utf8')) : {};
  const suite = suites[scheduleDoc.suiteKey] || { name: scheduleDoc.suiteKey };

  await TestRun.create({
    runId,
    suiteKey: scheduleDoc.suiteKey,
    suiteName: suite.name,
    envKey: scheduleDoc.envKey,
    dryRun: false,
    triggeredBy: `schedule:${scheduleDoc.scheduleId}`,
    sutApiUrl: config.sutApiUrl,
    status: 'queued',
    stats: { total: 0, passed: 0, failed: 0, skipped: 0, pending: 0 },
    results: [],
    startedAt: new Date(),
  });

  scheduleDoc.lastRunAt = new Date();
  scheduleDoc.lastRunId = runId;
  await scheduleDoc.save();

  const { executeRunJob } = await import('./runExecutor.mjs');
  const result = await executeRunJob({
    runId,
    suiteKey: scheduleDoc.suiteKey,
    envKey: scheduleDoc.envKey,
    triggeredBy: `schedule:${scheduleDoc.scheduleId}`,
    slackWebhookUrl: scheduleDoc.slackWebhookUrl,
  });

  scheduleDoc.lastStatus = result.status;
  await scheduleDoc.save();
  return result;
}

export async function registerSchedule(scheduleDoc) {
  await unregisterSchedule(scheduleDoc.scheduleId);
  if (!scheduleDoc.enabled) return;

  const { CronJob } = await import('cron');
  const job = CronJob.from({
    cronTime: scheduleDoc.cronExpression,
    onTick: () => {
      Schedule.findOne({ scheduleId: scheduleDoc.scheduleId })
        .then((fresh) => {
          if (fresh?.enabled) return triggerSchedule(fresh);
        })
        .catch((err) => console.error(`[ATP Scheduler] tick failed:`, err.message));
    },
    start: true,
    timeZone: 'UTC',
  });

  tasks.set(scheduleDoc.scheduleId, job);
  try {
    const next = job.nextDate();
    scheduleDoc.nextRunAt = next ? new Date(next.toString()) : null;
    await scheduleDoc.save();
  } catch {
    /* optional nextDate */
  }
}

export async function unregisterSchedule(scheduleId) {
  const job = tasks.get(scheduleId);
  if (job) {
    job.stop();
    tasks.delete(scheduleId);
  }
}

export async function reloadAllSchedules() {
  if (mongoose.connection.readyState !== 1) return;
  for (const id of [...tasks.keys()]) {
    await unregisterSchedule(id);
  }
  const list = await Schedule.find({ enabled: true });
  for (const doc of list) {
    await registerSchedule(doc);
  }
  console.log(`[ATP Scheduler] Registered ${list.length} schedule(s)`);
}

export async function startScheduler() {
  if (mongoose.connection.readyState !== 1) {
    console.log('[ATP Scheduler] MongoDB offline — schedules disabled');
    return;
  }
  await reloadAllSchedules();
}
