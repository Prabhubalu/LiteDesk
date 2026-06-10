const TenantMailroomConfig = require('../models/TenantMailroomConfig');
const {
  getDefaultMailroomConfig,
  getTemplate,
  listTemplates
} = require('../platform/mailroom/policies/templates/defaultTemplates');
const {
  sanitizeMailroomConfig,
  validateMailroomConfig
} = require('../platform/mailroom/policies/validators/mailroomPolicyValidator');

async function getOrCreateConfig(organizationId) {
  let row = await TenantMailroomConfig.findOne({ organizationId }).lean();
  if (row) {
    const policies = resolvePoliciesForRow(row);
    return {
      organizationId: row.organizationId,
      enabled: row.enabled === true,
      activeTemplateId: row.activeTemplateId,
      schemaVersion: row.schemaVersion,
      policies,
      connectors: row.connectors || resolveConnectorsForRow(row),
      security: row.security || resolveSecurityForRow(row),
      updatedAt: row.updatedAt,
      createdAt: row.createdAt
    };
  }

  const defaults = getDefaultMailroomConfig();
  return {
    organizationId,
    ...defaults,
    updatedAt: null,
    createdAt: null
  };
}

function resolvePoliciesForRow(row) {
  const stored = row?.policies || {};
  if (hasConfiguredPolicies(stored)) return stored;

  const template = getTemplate(row?.activeTemplateId || 'helpdesk_standard_email');
  return template?.policies || getDefaultMailroomConfig().policies;
}

function resolveConnectorsForRow(row) {
  const stored = row?.connectors || {};
  if (Object.keys(stored).length > 0) return stored;

  const template = getTemplate(row?.activeTemplateId || 'helpdesk_standard_email');
  return template?.connectors || getDefaultMailroomConfig().connectors;
}

function resolveSecurityForRow(row) {
  const stored = row?.security || {};
  if (Object.keys(stored).length > 0) return stored;

  const template = getTemplate(row?.activeTemplateId || 'helpdesk_standard_email');
  return template?.security || getDefaultMailroomConfig().security;
}

function hasConfiguredPolicies(policies) {
  if (!policies || typeof policies !== 'object') return false;
  return Boolean(
    policies.threading
    || policies.ingest
    || policies.dedup
    || policies.caseLink
    || policies.classification
    || policies.dispatch
  );
}

async function upsertConfig(organizationId, userId, body) {
  const sanitized = sanitizeMailroomConfig(body);
  const validation = validateMailroomConfig(sanitized);
  if (!validation.ok) {
    const err = new Error(validation.errors.join('; '));
    err.statusCode = 400;
    err.validationErrors = validation.errors;
    throw err;
  }

  if (body.applyTemplateId) {
    const template = getTemplate(body.applyTemplateId);
    if (!template) {
      const err = new Error('Unknown template id');
      err.statusCode = 400;
      throw err;
    }
    sanitized.activeTemplateId = template.id;
    sanitized.policies = template.policies;
    sanitized.connectors = template.connectors;
    sanitized.security = template.security || sanitized.security;
  }

  const row = await TenantMailroomConfig.findOneAndUpdate(
    { organizationId },
    {
      $set: {
        organizationId,
        enabled: sanitized.enabled,
        activeTemplateId: sanitized.activeTemplateId,
        schemaVersion: sanitized.schemaVersion,
        policies: sanitized.policies,
        connectors: sanitized.connectors,
        security: sanitized.security,
        updatedBy: userId || null
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return row;
}

module.exports = {
  getOrCreateConfig,
  upsertConfig,
  listTemplates,
  getTemplate,
  getDefaultMailroomConfig
};
