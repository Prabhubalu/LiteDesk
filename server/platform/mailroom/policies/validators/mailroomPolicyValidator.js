const {
  MAILROOM_POLICY_TYPES,
  MAILROOM_THREADING_SIGNALS,
  MAILROOM_DEDUP_BEHAVIORS,
  MAILROOM_CASE_LINK_ACTIONS,
  MAILROOM_INGEST_OPERATORS,
  MAILROOM_INGEST_FIELDS,
  MAILROOM_INGEST_ACTIONS,
  MAILROOM_TEMPLATE_IDS,
  MAILROOM_SCHEMA_VERSION
} = require('../../../../constants/mailroomPolicies');

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function validateThreadingPolicy(policy, errors, prefix) {
  if (!isPlainObject(policy)) {
    errors.push(`${prefix}.threading must be an object`);
    return;
  }
  const strategies = Array.isArray(policy.strategies) ? policy.strategies : [];
  strategies.forEach((s, i) => {
    if (!MAILROOM_THREADING_SIGNALS.includes(s.signal)) {
      errors.push(`${prefix}.threading.strategies[${i}].signal is invalid`);
    }
  });
}

function validateDedupPolicy(policy, errors, prefix) {
  if (!isPlainObject(policy)) {
    errors.push(`${prefix}.dedup must be an object`);
    return;
  }
  if (policy.onDuplicate && !MAILROOM_DEDUP_BEHAVIORS.includes(policy.onDuplicate)) {
    errors.push(`${prefix}.dedup.onDuplicate is invalid`);
  }
}

function validateCaseLinkPolicy(policy, errors, prefix) {
  if (!isPlainObject(policy)) {
    errors.push(`${prefix}.caseLink must be an object`);
    return;
  }
  const checkAction = (obj, field) => {
    if (obj?.action && !MAILROOM_CASE_LINK_ACTIONS.includes(obj.action)) {
      errors.push(`${prefix}.caseLink.${field}.action is invalid`);
    }
  };
  checkAction(policy.onOpenCaseMatch, 'onOpenCaseMatch');
  checkAction(policy.onNoMatch, 'onNoMatch');
  if (policy.onResolvedWithinDays?.enabled) {
    const days = Number(policy.onResolvedWithinDays.days);
    if (!Number.isFinite(days) || days < 0) {
      errors.push(`${prefix}.caseLink.onResolvedWithinDays.days must be a non-negative number`);
    }
    checkAction(policy.onResolvedWithinDays, 'onResolvedWithinDays');
  }
}

function validateIngestPolicy(policy, errors, prefix) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    errors.push(`${prefix}.ingest must be an object`);
    return;
  }
  const rules = Array.isArray(policy.rules) ? policy.rules : [];
  rules.forEach((rule, i) => {
    const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
    conditions.forEach((cond, j) => {
      if (!MAILROOM_INGEST_FIELDS.includes(cond.field)) {
        errors.push(`${prefix}.ingest.rules[${i}].conditions[${j}].field is invalid`);
      }
      if (!MAILROOM_INGEST_OPERATORS.includes(cond.operator)) {
        errors.push(`${prefix}.ingest.rules[${i}].conditions[${j}].operator is invalid`);
      }
    });
    const action = rule.action?.type;
    if (!MAILROOM_INGEST_ACTIONS.includes(action)) {
      errors.push(`${prefix}.ingest.rules[${i}].action.type is invalid`);
    }
  });
  if (
    policy.defaultAction?.type
    && !MAILROOM_INGEST_ACTIONS.includes(policy.defaultAction.type)
  ) {
    errors.push(`${prefix}.ingest.defaultAction.type is invalid`);
  }
}

function validatePolicies(policies) {
  const errors = [];
  if (!isPlainObject(policies)) {
    return { ok: false, errors: ['policies must be an object'] };
  }
  validateThreadingPolicy(policies.threading, errors, 'policies');
  validateIngestPolicy(policies.ingest, errors, 'policies');
  validateDedupPolicy(policies.dedup, errors, 'policies');
  validateCaseLinkPolicy(policies.caseLink, errors, 'policies');
  return { ok: errors.length === 0, errors };
}

function validateMailroomConfig(config) {
  const errors = [];
  if (!isPlainObject(config)) {
    return { ok: false, errors: ['config must be an object'] };
  }
  if (config.schemaVersion != null && Number(config.schemaVersion) !== MAILROOM_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${MAILROOM_SCHEMA_VERSION}`);
  }
  if (config.activeTemplateId && !MAILROOM_TEMPLATE_IDS.includes(config.activeTemplateId)) {
    errors.push('activeTemplateId is invalid');
  }
  if (config.policies) {
    const p = validatePolicies(config.policies);
    if (!p.ok) errors.push(...p.errors);
  }
  return { ok: errors.length === 0, errors };
}

function sanitizeMailroomConfig(input) {
  const raw = isPlainObject(input) ? input : {};
  const policies = isPlainObject(raw.policies) ? raw.policies : {};
  const connectors = isPlainObject(raw.connectors) ? raw.connectors : {};

  return {
    enabled: raw.enabled === true,
    activeTemplateId: MAILROOM_TEMPLATE_IDS.includes(raw.activeTemplateId)
      ? raw.activeTemplateId
      : 'helpdesk_standard_email',
    schemaVersion: MAILROOM_SCHEMA_VERSION,
    policies: {
      threading: isPlainObject(policies.threading) ? policies.threading : {},
      ingest: isPlainObject(policies.ingest)
        ? policies.ingest
        : { rules: [], defaultAction: { type: 'route_to_case_flow' } },
      dedup: isPlainObject(policies.dedup) ? policies.dedup : {},
      caseLink: isPlainObject(policies.caseLink) ? policies.caseLink : {},
      classification: isPlainObject(policies.classification) ? policies.classification : { rules: [] },
      dispatch: isPlainObject(policies.dispatch) ? policies.dispatch : { publish: [] }
    },
    connectors: {
      arivuParser: { enabled: connectors.arivuParser?.enabled !== false },
      rawMimeWebhook: { enabled: connectors.rawMimeWebhook?.enabled !== false }
    }
  };
}

module.exports = {
  MAILROOM_POLICY_TYPES,
  validatePolicies,
  validateMailroomConfig,
  sanitizeMailroomConfig
};
