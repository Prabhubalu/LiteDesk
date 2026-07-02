'use strict';

const {
  normalizeV2Ast,
  isLegacyAst,
  getPrimaryEntity,
  detectNodeType
} = require('./marketingAudienceAstUtils');
const {
  validateRelationshipPath,
  getMarketingAudienceMetadata
} = require('./marketingAudienceMetadataService');
const { MAX_RELATIONSHIP_DEPTH, AGGREGATE_COMPARE_OPERATORS } = require('./marketingAudienceConstants');
const { NUMERIC_AGGREGATE_FUNCTIONS } = require('./marketingAudienceAggregateEvaluator');

async function validateFieldRule(organizationId, rule, metadata, primaryModuleKey) {
  const moduleKey = String(rule.moduleKey || primaryModuleKey || 'people').toLowerCase();
  const fieldKey = String(rule.fieldKey || '').trim();
  if (!fieldKey) return { error: 'Field rule requires fieldKey' };

  const moduleFields = metadata.modules?.[moduleKey]?.fields || [];
  const allowed = moduleFields.find((row) => row.key === fieldKey);
  if (!allowed) {
    return { error: `Field "${fieldKey}" is not filterable on module "${moduleKey}"` };
  }

  const operator = String(rule.operator || 'is');
  if (!allowed.operators?.includes(operator)) {
    return { error: `Operator "${operator}" is not allowed for field "${fieldKey}"` };
  }

  return { ok: true };
}

async function validateRelationshipRule(organizationId, rule, primaryModuleKey) {
  const relationshipPath = Array.isArray(rule.relationshipPath) ? rule.relationshipPath : [];
  if (relationshipPath.length === 0) {
    return { error: 'Relationship rule requires relationshipPath' };
  }
  if (relationshipPath.length > MAX_RELATIONSHIP_DEPTH) {
    return { error: `relationshipPath exceeds max depth of ${MAX_RELATIONSHIP_DEPTH}` };
  }

  const pathResult = await validateRelationshipPath(organizationId, primaryModuleKey, relationshipPath);
  if (pathResult.error) return pathResult;

  const targetModuleKey = String(rule.targetModuleKey || pathResult.targetModuleKey || '').toLowerCase();
  if (targetModuleKey !== pathResult.targetModuleKey) {
    return { error: 'targetModuleKey does not match relationshipPath terminus' };
  }

  for (const child of rule.children || []) {
    const result = await validateNode(organizationId, child, primaryModuleKey, targetModuleKey);
    if (result.error) return result;
  }

  return { ok: true };
}

async function validateAggregateRule(organizationId, rule, primaryModuleKey) {
  const fn = String(rule.function || '').toLowerCase();
  if (!['exists', 'not_exists', 'count', 'sum', 'avg', 'min', 'max'].includes(fn)) {
    return { error: `Unsupported aggregate function: ${fn}` };
  }

  const pathValidation = await validateRelationshipRule(
    organizationId,
    {
      relationshipPath: rule.relationshipPath,
      targetModuleKey: rule.targetModuleKey,
      children: rule.filter?.children || []
    },
    primaryModuleKey
  );
  if (pathValidation.error) return pathValidation;

  if (!NUMERIC_AGGREGATE_FUNCTIONS.has(fn)) {
    return { ok: true };
  }

  const operator = String(rule.operator || '').toLowerCase();
  if (!AGGREGATE_COMPARE_OPERATORS.has(operator)) {
    return { error: `Unsupported aggregate operator: ${operator}` };
  }

  if (rule.value == null || rule.value === '') {
    return { error: 'Aggregate rule requires a comparison value' };
  }

  if (operator === 'between') {
    if (!Array.isArray(rule.value) || rule.value.length !== 2) {
      return { error: 'Between operator requires [min, max] value' };
    }
  }

  if (fn !== 'count') {
    const fieldKey = String(rule.fieldKey || '').trim();
    if (!fieldKey) {
      return { error: `Aggregate function "${fn}" requires fieldKey` };
    }

    const metadata = await getMarketingAudienceMetadata(organizationId, {
      primaryModuleKey
    });
    const targetModuleKey = String(rule.targetModuleKey || '').toLowerCase();
    const moduleFields = metadata.modules?.[targetModuleKey]?.fields || [];
    const allowed = moduleFields.find((row) => row.key === fieldKey);
    if (!allowed) {
      return { error: `Field "${fieldKey}" is not filterable on module "${targetModuleKey}"` };
    }
    if (!['number', 'currency', 'percent', 'integer'].includes(String(allowed.filterType || ''))) {
      return { error: `Field "${fieldKey}" must be numeric for ${fn} aggregate` };
    }
  }

  return { ok: true };
}

async function validateNode(organizationId, node, primaryModuleKey, scopedModuleKey = null) {
  if (!node) return { error: 'Empty rule node' };
  const nodeType = detectNodeType(node);

  const metadata = await getMarketingAudienceMetadata(organizationId, {
    primaryModuleKey
  });

  if (nodeType === 'field') {
    return validateFieldRule(
      organizationId,
      node,
      metadata,
      scopedModuleKey || primaryModuleKey
    );
  }

  if (nodeType === 'relationship') {
    return validateRelationshipRule(organizationId, node, primaryModuleKey);
  }

  if (nodeType === 'aggregate') {
    return validateAggregateRule(organizationId, node, primaryModuleKey);
  }

  if (nodeType === 'group' || Array.isArray(node.children)) {
    if (!node.children?.length) return { error: 'Rule group must include at least one child' };
    for (const child of node.children) {
      const result = await validateNode(organizationId, child, primaryModuleKey, scopedModuleKey);
      if (result.error) return result;
    }
    return { ok: true };
  }

  if (node.fieldKey) {
    return validateFieldRule(organizationId, node, metadata, primaryModuleKey);
  }

  return { error: 'Unrecognized rule node' };
}

async function validateFilterQuery(organizationId, filterQuery) {
  if (!filterQuery) return { error: 'filterQuery is required' };

  if (isLegacyAst(filterQuery)) {
    if (!Array.isArray(filterQuery.children) || filterQuery.children.length === 0) {
      return { error: 'filterQuery must include at least one filter rule' };
    }
    return { ok: true, version: 1 };
  }

  const ast = normalizeV2Ast(filterQuery);
  if (!ast?.children?.length) {
    return { error: 'filterQuery must include at least one filter rule' };
  }

  const primary = getPrimaryEntity(ast);
  const result = await validateNode(
    organizationId,
    { logic: ast.logic, children: ast.children },
    primary.moduleKey
  );
  if (result.error) return result;

  return { ok: true, version: 2, primaryEntity: primary };
}

module.exports = {
  validateFilterQuery,
  validateNode
};
