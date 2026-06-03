const importMappingTemplateService = require('../services/import/importMappingTemplateService');
const { getImportableFieldKeySet } = require('../services/import/importImportableFieldsService');
const { buildColumnRulesFromFieldMapping } = require('../utils/importMappingTemplateUtils');

async function listImportMappingTemplates(req, res) {
  try {
    const { module } = req.query;
    const data = await importMappingTemplateService.listTemplates(
      req.user.organizationId,
      module || undefined
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('List import mapping templates error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error fetching import mapping templates',
    });
  }
}

async function getImportMappingTemplate(req, res) {
  try {
    const data = await importMappingTemplateService.getTemplateById(
      req.user.organizationId,
      req.params.id
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Get import mapping template error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error fetching import mapping template',
    });
  }
}

async function createImportMappingTemplate(req, res) {
  try {
    const {
      module,
      name,
      description,
      columnRules,
      fieldMapping,
      isDefault,
      duplicatePolicy,
      sampleSourceHeaders,
    } = req.body || {};

    let resolvedRules = columnRules;
    if (!Array.isArray(resolvedRules) || !resolvedRules.length) {
      const allowedKeys = module
        ? await getImportableFieldKeySet(req.user.organizationId, module)
        : null;
      resolvedRules = buildColumnRulesFromFieldMapping(fieldMapping, allowedKeys || undefined);
    }

    const data = await importMappingTemplateService.createTemplate({
      organizationId: req.user.organizationId,
      userId: req.user._id,
      module,
      name,
      description,
      columnRules: resolvedRules,
      isDefault,
      duplicatePolicy: duplicatePolicy || null,
      sampleSourceHeaders,
    });

    res.status(201).json({ success: true, data });
  } catch (error) {
    console.error('Create import mapping template error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error creating import mapping template',
    });
  }
}

async function updateImportMappingTemplate(req, res) {
  try {
    const data = await importMappingTemplateService.updateTemplate({
      organizationId: req.user.organizationId,
      userId: req.user._id,
      templateId: req.params.id,
      name: req.body?.name,
      description: req.body?.description,
      columnRules: req.body?.columnRules,
      isDefault: req.body?.isDefault,
      duplicatePolicy: req.body?.duplicatePolicy,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Update import mapping template error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error updating import mapping template',
    });
  }
}

async function deleteImportMappingTemplate(req, res) {
  try {
    await importMappingTemplateService.deleteTemplate(
      req.user.organizationId,
      req.params.id
    );
    res.status(200).json({ success: true, message: 'Template deleted' });
  } catch (error) {
    console.error('Delete import mapping template error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error deleting import mapping template',
    });
  }
}

async function applyImportMappingTemplate(req, res) {
  try {
    const { csvHeaders, trackUsage } = req.body || {};
    const data = await importMappingTemplateService.applyTemplate({
      organizationId: req.user.organizationId,
      templateId: req.params.id,
      csvHeaders,
      trackUsage: trackUsage !== false,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Apply import mapping template error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error applying import mapping template',
    });
  }
}

module.exports = {
  listImportMappingTemplates,
  getImportMappingTemplate,
  createImportMappingTemplate,
  updateImportMappingTemplate,
  deleteImportMappingTemplate,
  applyImportMappingTemplate,
};
