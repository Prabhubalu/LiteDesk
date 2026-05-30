const ImportHistory = require('../../models/ImportHistory');
const {
  IMPORT_PROGRESS_UPDATE_EVERY,
  IMPORT_MAX_STORED_ERRORS,
} = require('./importConstants');

function resolveImportStatus({ total = 0, created = 0, updated = 0, skipped = 0, failed = 0 }) {
  if (total > 0 && failed === total) return 'failed';
  if (failed > 0) return 'partial';
  return 'completed';
}

async function markImportHistoryFailed(importHistoryId, errorMessage, processingTime) {
  await ImportHistory.findByIdAndUpdate(importHistoryId, {
    status: 'failed',
    importErrors: [{ row: 0, error: errorMessage }],
    processingTime,
    'jobState.completedAt': new Date(),
  });
}

async function finalizeImportHistory(importHistoryId, results, processingTime) {
  const skipped = results.skipped ?? 0;
  const failed = results.failed ?? 0;
  const total = results.total ?? 0;

  await ImportHistory.findByIdAndUpdate(importHistoryId, {
    status: resolveImportStatus({
      total,
      created: results.created,
      updated: results.updated,
      skipped,
      failed,
    }),
    'stats.created': results.created,
    'stats.updated': results.updated,
    'stats.skipped': skipped,
    'stats.failed': failed,
    'stats.total': total,
    'stats.processed': total,
    'recordIds.created': results.createdIds || [],
    'recordIds.updated': results.updatedIds || [],
    importErrors: (results.errors || []).slice(0, IMPORT_MAX_STORED_ERRORS),
    processingTime,
    'metadata.recordIdsTruncated': Boolean(results.recordIdsTruncated),
    'jobState.lastProcessedRow': total,
    'jobState.completedAt': new Date(),
  });
}

async function flushImportCheckpoint(importHistoryId, results, lastProcessedRow) {
  const update = {
    'stats.created': results.created,
    'stats.updated': results.updated,
    'stats.skipped': results.skipped,
    'stats.failed': results.failed,
    'stats.processed': lastProcessedRow,
    'jobState.lastProcessedRow': lastProcessedRow,
    'recordIds.created': results.createdIds || [],
    'recordIds.updated': results.updatedIds || [],
    importErrors: (results.errors || []).slice(0, IMPORT_MAX_STORED_ERRORS),
    'metadata.recordIdsTruncated': Boolean(results.recordIdsTruncated),
  };

  await ImportHistory.findByIdAndUpdate(importHistoryId, update);
}

function shouldFlushProgress(processed, total) {
  return processed === 1
    || processed % IMPORT_PROGRESS_UPDATE_EVERY === 0
    || processed === total;
}

module.exports = {
  resolveImportStatus,
  markImportHistoryFailed,
  finalizeImportHistory,
  flushImportCheckpoint,
  shouldFlushProgress,
};
