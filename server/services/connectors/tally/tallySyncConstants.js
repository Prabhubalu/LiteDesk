'use strict';

const TALLY_SYNC_QUEUE_NAME = 'integrations:tally:sync';
const TALLY_AGENT_INBOUND_QUEUE_NAME = 'integrations:tally:agent-inbound';

const TALLY_WORKER_CONCURRENCY = parseInt(process.env.TALLY_WORKER_CONCURRENCY || '2', 10);

const TALLY_RETRY_PROFILE = Object.freeze({
  attempts: 5,
  backoff: { type: 'exponential', delay: 10000 },
  removeOnComplete: 200,
  removeOnFail: 500,
});

module.exports = {
  TALLY_SYNC_QUEUE_NAME,
  TALLY_AGENT_INBOUND_QUEUE_NAME,
  TALLY_WORKER_CONCURRENCY,
  TALLY_RETRY_PROFILE,
};
