const { resolveImportRowsSource } = require('./importCsvReader');
const { buildCrmOrganizationQuery } = require('./importRowProcessors');
const { MODULE_HANDLERS, countImportDuplicates } = require('./importDuplicateQuery');

async function runDuplicateCheck(req, res, module) {
  try {
    const handler = MODULE_HANDLERS[module];
    if (!handler) {
      return res.status(400).json({ success: false, message: `Unsupported module: ${module}` });
    }

    const {
      csvData,
      stagingId,
      fieldMapping,
      checkFields = handler.defaultCheckFields,
    } = req.body;

    if (!fieldMapping) {
      return res.status(400).json({
        success: false,
        message: 'fieldMapping is required',
      });
    }

    if (!csvData && !stagingId) {
      return res.status(400).json({
        success: false,
        message: 'CSV data or stagingId is required',
      });
    }

    const organizationId = req.user.organizationId;
    const source = await resolveImportRowsSource({ organizationId, csvData, stagingId });
    const crmBaseQuery = module === 'organizations'
      ? await buildCrmOrganizationQuery(organizationId)
      : null;

    const { duplicates, unique } = await countImportDuplicates({
      module,
      rows: source.rows(),
      fieldMapping,
      checkFields,
      organizationId,
      crmBaseQuery,
    });

    res.status(200).json({
      success: true,
      data: {
        total: source.totalRows,
        duplicates,
        unique,
        duplicateRecords: [],
        uniqueRecords: [],
        checkedFields: checkFields,
        samplesTruncated: false,
        scannedFromStaging: Boolean(stagingId),
      },
    });
  } catch (error) {
    console.error(`Check duplicates (${module}) error:`, error);
    res.status(error.statusCode || 500).json({
      success: false,
      code: error.code,
      message: error.message || 'Error checking for duplicates',
    });
  }
}

module.exports = {
  runDuplicateCheck,
};
