'use strict';

const TALLY_SYNC_QUEUE_NAME = 'integrations:tally:sync';
/** @deprecated Prefer agent poll/ack inbound; retained for cloud-process tests only. */
const TALLY_AGENT_INBOUND_QUEUE_NAME = 'integrations:tally:agent-inbound';

const TALLY_WORKER_CONCURRENCY = parseInt(process.env.TALLY_WORKER_CONCURRENCY || '2', 10);

const TALLY_RETRY_PROFILE = Object.freeze({
  attempts: 5,
  backoff: { type: 'exponential', delay: 10000 },
  removeOnComplete: 200,
  removeOnFail: 500,
});

/** ATIP Queue Engine — priority bands and rate limits */
const TALLY_QUEUE_PRIORITIES = Object.freeze({
  metadata: 1,
  outbox_push: 5,
  pull_masters: 10,
  pull_vouchers: 15,
  selective: 8,
  scheduled: 20,
});

const TALLY_RATE_LIMIT = Object.freeze({
  maxJobsPerCompanyPerMinute: parseInt(process.env.TALLY_MAX_JOBS_PER_COMPANY_PER_MIN || '30', 10),
  companyWriteConcurrency: 1,
});

module.exports = {
  TALLY_SYNC_QUEUE_NAME,
  TALLY_AGENT_INBOUND_QUEUE_NAME,
  TALLY_WORKER_CONCURRENCY,
  TALLY_RETRY_PROFILE,
  TALLY_QUEUE_PRIORITIES,
  TALLY_RATE_LIMIT,
};
