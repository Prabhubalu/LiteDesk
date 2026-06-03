import { v4 as uuidv4 } from 'uuid';
import { executeSuite } from '../runner/runSuite.mjs';
import { getConfig, SEQUENTIAL_SUITES } from '../shared/config.mjs';

/**
 * Execute a test suite and persist results via control plane API (same process).
 * @param {object} params
 * @param {string} [params.runId]
 * @param {string} params.suiteKey
 * @param {string} [params.envKey]
 * @param {boolean} [params.dryRun]
 * @param {string} [params.triggeredBy]
 */
export async function executeRunJob(params) {
  const runId = params.runId || uuidv4();
  const config = getConfig();

  console.log(`[ATP Executor] Starting run ${runId.slice(0, 8)} suite=${params.suiteKey}`);

  const healthRes = await fetch(`${config.sutApiUrl}/health/live`).catch(() => null);
  if (!healthRes?.ok && !params.dryRun) {
    throw new Error(`SUT not reachable at ${config.sutApiUrl}/health/live`);
  }

  const result = await executeSuite({
    runId,
    suiteKey: params.suiteKey,
    envKey: params.envKey || 'local',
    dryRun: Boolean(params.dryRun),
    triggeredBy: params.triggeredBy || 'worker',
    parallel: !SEQUENTIAL_SUITES.includes(params.suiteKey),
    sequential: SEQUENTIAL_SUITES.includes(params.suiteKey),
    log: (line) => console.log(line),
  });

  console.log(`[ATP Executor] Finished ${runId.slice(0, 8)} status=${result.status}`);

  const webhook =
    params.slackWebhookUrl || process.env.ATP_SLACK_WEBHOOK_URL || '';
  if (webhook && (result.status === 'failed' || params.notifySlackAlways)) {
    try {
      const { TestRun } = await import('./models/TestRun.js');
      const run = await TestRun.findOne({ runId }).lean();
      if (run) {
        const { notifyRunToSlack } = await import('./lib/slackNotify.mjs');
        await notifyRunToSlack(run, webhook);
      }
    } catch (err) {
      console.warn('[ATP Executor] Slack notify failed:', err.message);
    }
  }

  return result;
}
