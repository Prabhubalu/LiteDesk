const ImportHistory = require('../../models/ImportHistory');
const { iterateCsvRows } = require('./importCsvReader');
const { deleteImportArtifacts } = require('./importCsvStorage');
const {
  createResultsAccumulator,
  getRowProcessor,
  buildCrmOrganizationQuery,
  buildOrganizationImportContext,
} = require('./importRowProcessors');
const {
  finalizeImportHistory,
  markImportHistoryFailed,
  flushImportCheckpoint,
  shouldFlushProgress,
} = require('./importHistoryRepository');
const {
  createImportPicklistContext,
  ensurePicklistOptionsForImportRow,
} = require('./importPicklistOptionService');
const { IMPORT_BATCH_SIZE } = require('./importConstants');

async function buildProcessorContext(importRecord) {
  const organizationId = importRecord.organizationId;
  const userId = importRecord.importedBy;
  const duplicateAction = importRecord.duplicateAction || 'skip';
  const updateExisting = duplicateAction === 'update';
  const shouldCheckDuplicates = importRecord.duplicateCheckEnabled !== false
    && duplicateAction !== 'import-all';
  const fieldMapping = importRecord.metadata?.fieldMapping || {};
  const duplicateCheckFields = importRecord.duplicateCheckFields?.length
    ? importRecord.duplicateCheckFields
    : null;

  const base = {
    organizationId,
    userId,
    importHistoryId: importRecord._id,
    updateExisting,
    shouldCheckDuplicates,
    fieldMapping,
    duplicateCheckFields,
  };

  if (importRecord.module === 'organizations') {
    const orgContext = await buildOrganizationImportContext(userId);
    orgContext.crmBaseQuery = await buildCrmOrganizationQuery(organizationId);
    base.orgContext = orgContext;
  }

  return base;
}

function hydrateResultsFromRecord(importRecord) {
  const results = createResultsAccumulator(importRecord.stats?.total || 0);
  results.created = importRecord.stats?.created || 0;
  results.updated = importRecord.stats?.updated || 0;
  results.skipped = importRecord.stats?.skipped || 0;
  results.failed = importRecord.stats?.failed || 0;
  results.errors = importRecord.importErrors || [];
  results.createdIds = importRecord.recordIds?.created || [];
  results.updatedIds = importRecord.recordIds?.updated || [];
  results.recordIdsTruncated = Boolean(importRecord.metadata?.recordIdsTruncated);
  return results;
}

async function runImportJob(importHistoryId) {
  const startTime = Date.now();
  const importRecord = await ImportHistory.findById(importHistoryId);
  if (!importRecord) {
    throw new Error(`Import job not found: ${importHistoryId}`);
  }
  if (importRecord.status !== 'processing') {
    return importRecord;
  }
  if (!importRecord.storagePath) {
    throw new Error('Import job is missing storagePath');
  }

  await ImportHistory.findByIdAndUpdate(importHistoryId, {
    'jobState.startedAt': importRecord.jobState?.startedAt || new Date(),
    'jobState.workerId': process.env.HOSTNAME || process.pid.toString(),
  });

  const processor = getRowProcessor(importRecord.module);
  const processorContext = await buildProcessorContext(importRecord);
  const picklistContext = await createImportPicklistContext(
    importRecord.organizationId,
    importRecord.module
  );
  const results = hydrateResultsFromRecord(importRecord);
  const skipDataRows = importRecord.jobState?.lastProcessedRow || 0;
  const totalRows = importRecord.stats?.total || importRecord.metadata?.totalRows || 0;

  try {
    for await (const { dataRowIndex, rowNumber, row } of iterateCsvRows(importRecord.storagePath, { skipDataRows })) {
      try {
        const normalizedRow = await ensurePicklistOptionsForImportRow({
          fieldMapping: processorContext.fieldMapping,
          row,
          picklistContext,
        });
        await processor({
          ...processorContext,
          row: normalizedRow,
          rowNumber,
          results,
        });
      } catch (error) {
        results.failed += 1;
        if (results.errors.length < 500) {
          results.errors.push({ row: rowNumber, error: error.message });
        }
      }

      if (shouldFlushProgress(dataRowIndex, totalRows)) {
        await flushImportCheckpoint(importHistoryId, results, dataRowIndex);
      }

      if (dataRowIndex % IMPORT_BATCH_SIZE === 0) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    }

    const processingTime = Date.now() - startTime;
    await finalizeImportHistory(importHistoryId, results, processingTime);

    if (importRecord.metadata?.deleteFileAfterImport !== false) {
      await deleteImportArtifacts(importRecord.storagePath);
    }

    return ImportHistory.findById(importHistoryId);
  } catch (error) {
    console.error('[importJobRunner] job failed:', importHistoryId, error);
    await markImportHistoryFailed(importHistoryId, error.message, Date.now() - startTime);
    throw error;
  }
}

module.exports = {
  runImportJob,
};
