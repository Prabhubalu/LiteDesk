/**
 * Optional Railway / background worker: processes Bull email jobs only.
 * Run the API with `npm start` and the worker in a second process with `npm run worker`.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const mongoose = require('mongoose');
const { validateEnv } = require('./config/validateEnv');
const { getMongoUris, connectMasterWithRetry, MASTER_DB } = require('./lib/mongoConnect');
const { initSentryNode, flushSentry } = require('./lib/sentryNode');

validateEnv();
initSentryNode();

const emailQueueService = require('./services/emailQueueService');
const inboundEmailQueueService = require('./services/inboundEmailQueueService');
const importQueueService = require('./services/import/importQueueService');
const dbConnectionManager = require('./utils/databaseConnectionManager');

let exiting = false;

async function run() {
  if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
    console.error('[worker] Set REDIS_URL (recommended) or REDIS_HOST for Bull/Redis.');
    process.exit(1);
  }

  let masterUri;
  let baseUri;
  let mongoQueryString;
  try {
    const u = getMongoUris();
    masterUri = u.masterUri;
    baseUri = u.baseUri;
    mongoQueryString = u.mongoQueryString;
  } catch (e) {
    console.error('[worker]', e.message);
    process.exit(1);
  }
  await connectMasterWithRetry(masterUri);
  console.log(`[worker] MongoDB connected: ${MASTER_DB}`);

  dbConnectionManager.baseMongoUri = baseUri;
  dbConnectionManager.connectionQuery = mongoQueryString;
  await dbConnectionManager.initializeMasterConnection();

  emailQueueService.startWorker();
  console.log(`[worker] Email queue worker is running (Bull: ${emailQueueService.COMMUNICATION_QUEUE_NAMES.EMAIL_SEND})`);

  inboundEmailQueueService.startWorker();
  console.log(`[worker] Inbound email worker is running (Bull: ${inboundEmailQueueService.COMMUNICATION_INBOUND_QUEUE_NAMES.EMAIL_INBOUND})`);

  importQueueService.startWorker();
  console.log(`[worker] Import CSV worker is running (Bull: ${importQueueService.IMPORT_QUEUE_NAME})`);

  const analyticsQueueService = require('./services/analytics/analyticsQueueService');
  analyticsQueueService.startWorker();
  console.log(`[worker] Analytics execute worker is running (Bull: ${analyticsQueueService.ANALYTICS_EXECUTE_QUEUE_NAME})`);

  const analyticsScheduleQueueService = require('./services/analytics/analyticsScheduleQueueService');
  analyticsScheduleQueueService.startWorker();
  console.log(`[worker] Analytics schedule worker is running (Bull: ${analyticsScheduleQueueService.ANALYTICS_SCHEDULE_QUEUE_NAME})`);

  const campaignSendQueueService = require('./services/marketing/campaignSendQueueService');
  campaignSendQueueService.startWorker();
  console.log(`[worker] Campaign send worker is running (Bull: ${campaignSendQueueService.CAMPAIGN_SEND_QUEUE_NAME})`);

  const aiEmbedQueueService = require('./services/ai/aiEmbedQueueService');
  aiEmbedQueueService.startWorker();
  console.log(`[worker] AI embed worker is running (Bull: ${aiEmbedQueueService.AI_EMBED_QUEUE_NAME})`);
}

async function stop(signal) {
  if (exiting) return;
  exiting = true;
  console.log(`[worker] ${signal} received, shutting down...`);
  try {
    await emailQueueService.closeQueue();
  } catch (e) {
    console.error('[worker] outbound queue close', e.message);
  }
  try {
    await inboundEmailQueueService.closeQueue();
  } catch (e) {
    console.error('[worker] inbound queue close', e.message);
  }
  try {
    await importQueueService.closeQueue();
  } catch (e) {
    console.error('[worker] import queue close', e.message);
  }
  try {
    const analyticsQueueService = require('./services/analytics/analyticsQueueService');
    await analyticsQueueService.closeQueue();
  } catch (e) {
    console.error('[worker] analytics queue close', e.message);
  }
  try {
    const analyticsScheduleQueueService = require('./services/analytics/analyticsScheduleQueueService');
    await analyticsScheduleQueueService.closeQueue();
  } catch (e) {
    console.error('[worker] analytics schedule queue close', e.message);
  }
  try {
    const campaignSendQueueService = require('./services/marketing/campaignSendQueueService');
    await campaignSendQueueService.closeQueue();
  } catch (e) {
    console.error('[worker] campaign send queue close', e.message);
  }
  try {
    const aiEmbedQueueService = require('./services/ai/aiEmbedQueueService');
    await aiEmbedQueueService.closeQueue();
  } catch (e) {
    console.error('[worker] ai embed queue close', e.message);
  }
  try {
    await mongoose.connection.close();
  } catch (e) {
    console.error('[worker] mongo close', e.message);
  }
  try {
    await flushSentry(2000);
  } catch (e) {
    /* optional */
  }
  process.exit(0);
}

process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));

run().catch((err) => {
  console.error('[worker] Fatal:', err);
  process.exit(1);
});
