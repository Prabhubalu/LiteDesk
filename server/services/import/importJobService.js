const ImportHistory = require('../../models/ImportHistory');
const { parseCSV } = require('./importCsvParser');
const {
  countDataRows,
  readCsvPreview,
} = require('./importCsvReader');
const {
  saveStagingUpload,
  promoteStagingToImport,
  saveInlineCsvAsImportFile,
} = require('./importCsvStorage');
const { enqueueImportJob } = require('./importQueueService');
const {
  IMPORT_MAX_ROWS,
  IMPORT_INLINE_MAX_ROWS,
  IMPORT_BATCH_SIZE,
  SUPPORTED_MODULES,
} = require('./importConstants');

function assertSupportedModule(module) {
  if (!SUPPORTED_MODULES.includes(module)) {
    const error = new Error(`Unsupported import module: ${module}`);
    error.statusCode = 400;
    throw error;
  }
}

function rejectImportRowLimit(rowCount, res) {
  if (rowCount <= IMPORT_MAX_ROWS) return false;
  res.status(400).json({
    success: false,
    code: 'IMPORT_ROW_LIMIT_EXCEEDED',
    message: `Import exceeds the maximum of ${IMPORT_MAX_ROWS.toLocaleString()} rows per file. Split your file into smaller batches.`,
    maxRows: IMPORT_MAX_ROWS,
    rowCount,
  });
  return true;
}

function respondImportAccepted(res, importHistory, total, queueMode) {
  res.status(202).json({
    success: true,
    data: {
      importId: importHistory._id,
      total,
      status: 'processing',
      accepted: true,
      queueMode,
    },
  });
}

function parseImportConfig(body = {}) {
  const fieldMapping = body.fieldMapping;
  if (!fieldMapping || typeof fieldMapping !== 'object') {
    const error = new Error('fieldMapping is required');
    error.statusCode = 400;
    throw error;
  }

  return {
    fieldMapping,
    updateExisting: Boolean(body.updateExisting),
    fileName: body.fileName || 'import.csv',
    shouldCheckDuplicates: body.shouldCheckDuplicates !== false,
    duplicateCheckFields: Array.isArray(body.duplicateCheckFields) ? body.duplicateCheckFields : [],
    stagingId: body.stagingId || null,
    csvData: body.csvData || null,
  };
}

async function stageCsvUpload({ organizationId, importedBy, file }) {
  if (!file?.buffer) {
    const error = new Error('CSV file is required');
    error.statusCode = 400;
    throw error;
  }

  const { stagingId, stagingPath } = await saveStagingUpload({
    organizationId,
    importedBy,
    buffer: file.buffer,
    originalName: file.originalname,
  });

  const totalRows = await countDataRows(stagingPath);
  const { headers, preview } = await readCsvPreview(stagingPath, 5);

  return {
    stagingId,
    headers,
    preview,
    totalRows,
    fileName: file.originalname || 'import.csv',
    byteSize: file.size,
  };
}

async function resolveImportSource({
  organizationId,
  userId,
  importHistoryId,
  config,
  uploadedFile,
}) {
  if (config.stagingId) {
    const promoted = await promoteStagingToImport({
      organizationId,
      stagingId: config.stagingId,
      importHistoryId,
    });
    const totalRows = await countDataRows(promoted.importPath);
    const { headers } = await readCsvPreview(promoted.importPath, 1);
    return {
      storagePath: promoted.importPath,
      fileName: promoted.fileName || config.fileName,
      totalRows,
      headers,
      source: 'staging',
    };
  }

  if (uploadedFile?.buffer) {
    const staging = await saveStagingUpload({
      organizationId,
      importedBy: userId,
      buffer: uploadedFile.buffer,
      originalName: uploadedFile.originalname || config.fileName,
    });
    const promoted = await promoteStagingToImport({
      organizationId,
      stagingId: staging.stagingId,
      importHistoryId,
    });
    const totalRows = await countDataRows(promoted.importPath);
    const { headers } = await readCsvPreview(promoted.importPath, 1);
    return {
      storagePath: promoted.importPath,
      fileName: promoted.fileName || config.fileName,
      totalRows,
      headers,
      source: 'upload',
    };
  }

  if (config.csvData) {
    const { headers, rows } = parseCSV(config.csvData);
    if (rows.length > IMPORT_INLINE_MAX_ROWS) {
      const error = new Error(
        `Inline imports are limited to ${IMPORT_INLINE_MAX_ROWS.toLocaleString()} rows. Upload the CSV file instead.`
      );
      error.statusCode = 400;
      error.code = 'IMPORT_INLINE_LIMIT_EXCEEDED';
      throw error;
    }
    const storagePath = await saveInlineCsvAsImportFile({
      organizationId,
      importHistoryId,
      csvData: config.csvData,
    });
    return {
      storagePath,
      fileName: config.fileName,
      totalRows: rows.length,
      headers,
      source: 'inline',
    };
  }

  const error = new Error('Provide stagingId, file upload, or csvData');
  error.statusCode = 400;
  throw error;
}

async function submitImportJob({ req, res, module }) {
  assertSupportedModule(module);

  let importHistory = null;
  try {
    const config = parseImportConfig(req.body);
    const organizationId = req.user.organizationId;
    const userId = req.user._id;

    importHistory = await ImportHistory.create({
      organizationId,
      module,
      fileName: config.fileName,
      importedBy: userId,
      status: 'processing',
      duplicateCheckEnabled: config.shouldCheckDuplicates,
      duplicateCheckFields: config.duplicateCheckFields,
      duplicateAction: config.updateExisting ? 'update' : 'skip',
      stats: { total: 0, processed: 0 },
      jobState: {
        batchSize: IMPORT_BATCH_SIZE,
        enqueuedAt: new Date(),
        lastProcessedRow: 0,
      },
      metadata: {
        fieldMapping: config.fieldMapping,
        source: config.stagingId ? 'staging' : (req.file ? 'upload' : 'inline'),
      },
    });

    const source = await resolveImportSource({
      organizationId,
      userId,
      importHistoryId: importHistory._id,
      config,
      uploadedFile: req.file,
    });

    if (rejectImportRowLimit(source.totalRows, res)) {
      await ImportHistory.findByIdAndDelete(importHistory._id);
      return;
    }

    importHistory = await ImportHistory.findByIdAndUpdate(
      importHistory._id,
      {
        fileName: source.fileName,
        storagePath: source.storagePath,
        'stats.total': source.totalRows,
        'metadata.csvHeaders': source.headers,
        'metadata.fieldMapping': config.fieldMapping,
        'metadata.totalRows': source.totalRows,
        'metadata.source': source.source,
      },
      { new: true }
    );

    const queueResult = enqueueImportJob(importHistory._id, organizationId);
    respondImportAccepted(res, importHistory, source.totalRows, queueResult.mode);
  } catch (error) {
    console.error(`[importJobService] submit ${module} failed:`, error);
    if (importHistory?._id) {
      await ImportHistory.findByIdAndDelete(importHistory._id).catch(() => {});
    }

    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      code: error.code,
      message: error.message || 'Error starting import job',
    });
  }
}

module.exports = {
  stageCsvUpload,
  submitImportJob,
  rejectImportRowLimit,
  IMPORT_MAX_ROWS,
  IMPORT_INLINE_MAX_ROWS,
};
