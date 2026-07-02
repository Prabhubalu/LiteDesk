'use strict';

const { detectNodeType, getPrimaryEntity, isLegacyAst } = require('./marketingAudienceAstUtils');

function describeFieldRule(rule, moduleKey) {
  const field = rule.fieldKey || 'field';
  const operator = rule.operator || 'is';
  const value = rule.value == null || rule.value === '' ? '' : ` "${rule.value}"`;
  return `${moduleKey}.${field} ${operator}${value}`.trim();
}

function describeRelationshipPath(relationshipPath) {
  return (relationshipPath || []).join(' → ');
}

function describeNode(node, primaryModuleKey, depth = 0) {
  const nodeType = detectNodeType(node);
  if (nodeType === 'field') {
    return describeFieldRule(node, node.moduleKey || primaryModuleKey);
  }
  if (nodeType === 'relationship') {
    const path = describeRelationshipPath(node.relationshipPath);
    const childText = (node.children || [])
      .map((child) => describeNode(child, node.targetModuleKey, depth + 1))
      .filter(Boolean)
      .join(` ${node.logic || 'AND'} `);
    return `Via ${path}: ${childText}`;
  }
  if (nodeType === 'aggregate') {
    const fn = node.function || 'exists';
    const path = describeRelationshipPath(node.relationshipPath);
    const filterText = (node.filter?.children || [])
      .map((child) => describeNode(child, node.targetModuleKey, depth + 1))
      .filter(Boolean)
      .join(` ${node.filter?.logic || 'AND'} `);

    if (['count', 'sum', 'avg', 'min', 'max'].includes(String(fn))) {
      const fieldPart = fn === 'count' ? '' : ` of ${node.fieldKey || 'field'}`;
      const threshold = node.value == null ? '' : ` ${node.operator || 'gte'} ${node.value}`;
      const wherePart = filterText ? ` where ${filterText}` : '';
      return `${fn}${fieldPart} via ${path}${wherePart}${threshold}`.trim();
    }

    const wherePart = filterText ? ` where ${filterText}` : '';
    return `${fn} related records via ${path}${wherePart}`;
  }
  if (nodeType === 'group' || Array.isArray(node.children)) {
    return (node.children || [])
      .map((child) => describeNode(child, primaryModuleKey, depth + 1))
      .filter(Boolean)
      .join(` ${node.logic || 'AND'} `);
  }
  if (node.fieldKey) {
    return describeFieldRule(node, primaryModuleKey);
  }
  return '';
}

function explainFilterQuery(filterQuery) {
  if (!filterQuery) {
    return { summary: '', relationshipHops: 0, estimatedComplexity: 'low' };
  }

  const primary = isLegacyAst(filterQuery)
    ? { moduleKey: 'people' }
    : getPrimaryEntity(filterQuery);

  const summary = describeNode(
    isLegacyAst(filterQuery)
      ? filterQuery
      : { logic: filterQuery.logic, children: filterQuery.children },
    primary.moduleKey
  );

  const pathLengths = [];
  const walk = (node) => {
    const type = detectNodeType(node);
    if (type === 'relationship' || type === 'aggregate') {
      pathLengths.push((node.relationshipPath || []).length);
    }
    for (const child of node.children || []) walk(child);
  };
  walk(filterQuery);

  const maxHops = pathLengths.length ? Math.max(...pathLengths) : 0;
  const estimatedComplexity = maxHops >= 2 ? 'high' : maxHops === 1 ? 'medium' : 'low';

  return {
    summary: summary || 'No rules configured',
    primaryEntity: primary.moduleKey,
    relationshipHops: maxHops,
    estimatedComplexity
  };
}

module.exports = {
  explainFilterQuery
};
