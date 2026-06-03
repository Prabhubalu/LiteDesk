import { getConfig } from '../shared/config.mjs';

const QUEUE_NAME = 'atp-api-runs';

/** @type {import('bull').Queue | null} */
let queue = null;

export async function getRunQueue() {
  if (queue) return queue;

  const redisUrl = process.env.REDIS_URL || process.env.ATP_REDIS_URL;
  if (!redisUrl) return null;

  try {
    const Bull = (await import('bull')).default;
    queue = new Bull(QUEUE_NAME, redisUrl, {
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 1,
      },
    });
    return queue;
  } catch (err) {
    console.warn('[ATP Queue] Bull unavailable:', err.message);
    return null;
  }
}

export async function enqueueRun(params) {
  const q = await getRunQueue();
  if (!q) return { inline: true, jobId: null };

  const job = await q.add('execute-suite', params, {
    jobId: params.runId,
  });
  return { inline: false, jobId: job.id };
}

export async function startQueueWorker() {
  const q = await getRunQueue();
  if (!q) {
    console.log('[ATP Queue] No REDIS_URL — runs execute inline in API process');
    return null;
  }

  const concurrency = Number(process.env.ATP_WORKER_CONCURRENCY || 2);

  q.process('execute-suite', concurrency, async (job) => {
    const { executeRunJob } = await import('./runExecutor.mjs');
    return executeRunJob(job.data);
  });

  q.on('failed', (job, err) => {
    console.error(`[ATP Queue] Job ${job?.id} failed:`, err.message);
  });

  console.log(`[ATP Queue] Worker listening on "${QUEUE_NAME}" concurrency=${concurrency}`);
  return q;
}
