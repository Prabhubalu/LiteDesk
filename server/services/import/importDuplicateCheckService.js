const { resolveImportRowsSource } = require('./importCsvReader');
const { buildCrmOrganizationQuery } = require('./importRowProcessors');
const { MODULE_HANDLERS, countImportDuplicates } = require('./importDuplicateQuery');
const {
  applyImportFieldDefaults,
  sanitizeImportFieldDefaultValues,
} = require('../../utils/importFieldDefaults');

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
      fieldDefaultValues: rawFieldDefaultValues,
      checkFields = handler.defaultCheckFields,
    } = req.body;
    const fieldDefaultValues = sanitizeImportFieldDefaultValues(rawFieldDefaultValues);

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

    const rowsWithDefaults = async function* rowsWithDefaults() {
      for await (const entry of source.rows()) {
        yield {
          ...entry,
          row: applyImportFieldDefaults(entry.row, fieldMapping, fieldDefaultValues),
        };
      }
    };

    const result = await countImportDuplicates({
      module,
      rows: rowsWithDefaults(),
      fieldMapping,
      checkFields,
      organizationId,
      crmBaseQuery,
    });

    res.status(200).json({
      success: true,
      data: {
        total: source.totalRows,
        duplicates: result.duplicates,
        unique: result.unique,
        existingDuplicates: result.existingDuplicates,
        inFileDuplicates: result.inFileDuplicates,
        uncheckable: result.uncheckable,
        existingDuplicateSamples: result.existingDuplicateSamples,
        inFileDuplicateSamples: result.inFileDuplicateSamples,
        checkedFields: checkFields,
        samplesTruncated: result.samplesTruncated,
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
