const path = require('path');

const IMPORT_QUEUE_NAME = 'imports:csv:process';

const IMPORT_BATCH_SIZE = parseInt(process.env.IMPORT_BATCH_SIZE || '1000', 10);
const IMPORT_MAX_ROWS = parseInt(process.env.IMPORT_MAX_ROWS || '1000000', 10);
const IMPORT_INLINE_MAX_ROWS = parseInt(process.env.IMPORT_INLINE_MAX_ROWS || '5000', 10);
const IMPORT_MAX_FILE_BYTES = parseInt(
  process.env.IMPORT_MAX_FILE_BYTES || String(512 * 1024 * 1024),
  10
);
const IMPORT_MAX_STORED_ERRORS = parseInt(process.env.IMPORT_MAX_STORED_ERRORS || '500', 10);
const IMPORT_MAX_STORED_RECORD_IDS = parseInt(process.env.IMPORT_MAX_STORED_RECORD_IDS || '10000', 10);
const IMPORT_PROGRESS_UPDATE_EVERY = parseInt(process.env.IMPORT_PROGRESS_UPDATE_EVERY || '250', 10);
const IMPORT_STAGING_TTL_MS = parseInt(process.env.IMPORT_STAGING_TTL_MS || String(24 * 60 * 60 * 1000), 10);
const DUPLICATE_CHECK_MAX_SAMPLES = parseInt(process.env.DUPLICATE_CHECK_MAX_SAMPLES || '100', 10);
const DUPLICATE_CHECK_OR_CHUNK = parseInt(process.env.DUPLICATE_CHECK_OR_CHUNK || '200', 10);
const DUPLICATE_CHECK_IN_CHUNK = parseInt(process.env.DUPLICATE_CHECK_IN_CHUNK || '1500', 10);
const IMPORT_WORKER_CONCURRENCY = parseInt(process.env.IMPORT_WORKER_CONCURRENCY || '4', 10);

const IMPORT_BASE_DIR = process.env.IMPORT_STAGING_DIR
  || path.join(__dirname, '../../data/imports');

const IMPORT_RETRY_PROFILE = Object.freeze({
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: 200,
  removeOnFail: 500,
});

const SUPPORTED_MODULES = Object.freeze(['contacts', 'deals', 'tasks', 'organizations']);

module.exports = {
  IMPORT_QUEUE_NAME,
  IMPORT_BATCH_SIZE,
  IMPORT_MAX_ROWS,
  IMPORT_INLINE_MAX_ROWS,
  IMPORT_MAX_FILE_BYTES,
  IMPORT_MAX_STORED_ERRORS,
  IMPORT_MAX_STORED_RECORD_IDS,
  IMPORT_PROGRESS_UPDATE_EVERY,
  IMPORT_STAGING_TTL_MS,
  DUPLICATE_CHECK_MAX_SAMPLES,
  DUPLICATE_CHECK_OR_CHUNK,
  DUPLICATE_CHECK_IN_CHUNK,
  IMPORT_WORKER_CONCURRENCY,
  IMPORT_BASE_DIR,
  IMPORT_RETRY_PROFILE,
  SUPPORTED_MODULES,
};
