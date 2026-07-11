import {
  createDefaultRootGroup,
  createEmptyRuleRef,
  createGroupId,
  createRuleRefId
} from '@/platform/filters/filterQueryAst';
import { compileFilterQueryAst } from '@/platform/filters/filterQueryAstCompiler';
import { compileOperatorValueForApi, isFilterRuleActive } from '@/platform/filters/filterQueryCompiler';

function isV2Ast(ast) {
  return ast?.version >= 2;
}

/** Convert server segment filter AST into FilterBuilder state (primary-entity field rules only). */
export function hydrateFilterBuilderFromAst(ast, primaryModuleKey = 'people') {
  const filters = {};
  const operators = {};

  function convertLegacyNode(node) {
    if (node?.fieldKey) {
      filters[node.fieldKey] = node.value;
      operators[node.fieldKey] = node.operator || 'is';
      return {
        kind: 'rule',
        id: createRuleRefId(),
        fieldKey: node.fieldKey
      };
    }

    const children = Array.isArray(node?.children) ? node.children.map(convertLegacyNode) : [];
    return {
      kind: 'group',
      id: createGroupId(),
      logic: String(node?.logic || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND',
      children: children.length > 0 ? children : [createEmptyRuleRef()]
    };
  }

  function convertV2FieldNode(node) {
    if (node?.type === 'field' || (node?.fieldKey && !node.relationshipPath)) {
      const moduleKey = node.moduleKey || primaryModuleKey;
      if (moduleKey !== primaryModuleKey) return null;
      filters[node.fieldKey] = node.value;
      operators[node.fieldKey] = node.operator || 'is';
      return {
        kind: 'rule',
        id: createRuleRefId(),
        fieldKey: node.fieldKey
      };
    }

    if (node?.type === 'group' || node?.logic) {
      const children = Array.isArray(node.children)
        ? node.children.map(convertV2FieldNode).filter(Boolean)
        : [];
      return {
        kind: 'group',
        id: createGroupId(),
        logic: String(node?.logic || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND',
        children: children.length > 0 ? children : [createEmptyRuleRef()]
      };
    }

    return null;
  }

  if (!ast) {
    return { filters, operators, query: createDefaultRootGroup(), relationshipRules: [] };
  }

  if (isV2Ast(ast)) {
    const fieldChildren = (ast.children || []).filter(
      (node) => node?.type === 'field' || (node?.fieldKey && !node.relationshipPath && !node.function)
    );
    const relationshipRules = (ast.children || [])
      .filter((node) => node?.type === 'relationship' || node?.type === 'aggregate')
      .map((node) => hydrateRelationshipRule(node));

    const convertedFieldNodes = fieldChildren.map(convertV2FieldNode).filter(Boolean);
    const group = {
      kind: 'group',
      id: createGroupId(),
      logic: String(ast.logic || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND',
      children: convertedFieldNodes.length > 0 ? convertedFieldNodes : [createEmptyRuleRef()]
    };

    return { filters, operators, query: group, relationshipRules, primaryEntity: ast.primaryEntity };
  }

  if (!Array.isArray(ast.children)) {
    return { filters, operators, query: createDefaultRootGroup(), relationshipRules: [] };
  }

  return {
    filters,
    operators,
    query: convertLegacyNode(ast),
    relationshipRules: []
  };
}

function hydrateRelationshipRule(node) {
  const conditions = hydrateRelationshipConditions(node.children || node.filter?.children || []);
  const fn = String(node.function || 'exists').toLowerCase();
  const isNumericAggregate = ['count', 'sum', 'avg', 'min', 'max'].includes(fn);

  return {
    id: createRuleRefId(),
    type: node.type || (isNumericAggregate || fn === 'not_exists' ? 'aggregate' : 'relationship'),
    relationshipPath: Array.isArray(node.relationshipPath) ? [...node.relationshipPath] : [],
    targetModuleKey: node.targetModuleKey || '',
    logic: node.logic || node.filter?.logic || 'AND',
    function: fn,
    fieldKey: node.fieldKey || '',
    aggregateOperator: node.operator || 'gte',
    aggregateValue: node.value ?? (fn === 'count' ? 1 : 0),
    filters: conditions.filters,
    operators: conditions.operators,
    query: conditions.query
  };
}

function hydrateRelationshipConditions(children) {
  const filters = {};
  const operators = {};
  const queryChildren = [];

  for (const child of children || []) {
    if (child?.fieldKey || child?.type === 'field') {
      filters[child.fieldKey] = child.value;
      operators[child.fieldKey] = child.operator || 'is';
      queryChildren.push({
        kind: 'rule',
        id: createRuleRefId(),
        fieldKey: child.fieldKey
      });
    }
  }

  return {
    filters,
    operators,
    query: {
      kind: 'group',
      id: createGroupId(),
      logic: 'AND',
      children: queryChildren.length > 0 ? queryChildren : [createEmptyRuleRef()]
    }
  };
}

import { normalizeFilterSelectOptions } from '@/utils/picklistOptionUtils';

export function normalizeFilterOptions(rawOptions = []) {
  return normalizeFilterSelectOptions(rawOptions);
}

export function buildFilterConfigFromMetadata(moduleFields = []) {
  return moduleFields.map((field, index) => ({
    key: field.key,
    label: field.label || field.key,
    filterType: field.filterType || 'text',
    fieldPath: field.fieldPath || field.key,
    options: normalizeFilterOptions(field.options),
    priority: index + 1
  }));
}

export function buildFilterConfigByKey(filterConfig) {
  return Object.fromEntries(filterConfig.map((item) => [item.key, item]));
}

function flattenCompiledFilterRules(node) {
  if (!node) return [];
  if (node.fieldKey) {
    return [
      {
        fieldKey: node.fieldKey,
        operator: node.operator || 'is',
        value: node.value
      }
    ];
  }
  const rows = [];
  for (const child of node.children || []) {
    rows.push(...flattenCompiledFilterRules(child));
  }
  return rows;
}

/** Compile active field rules from FilterBuilder state (flat + advanced filterQuery). */
export function compileActiveFieldRulesFromState(queryState, filterByKey, moduleKey) {
  const { filterQuery, flat } = compileFilterQueryAst(
    queryState.query,
    queryState.filters || {},
    queryState.operators || {},
    filterByKey
  );

  const rules = [];
  const seen = new Set();

  if (filterQuery?.children?.length) {
    for (const row of flattenCompiledFilterRules(filterQuery)) {
      if (!row.fieldKey || seen.has(row.fieldKey)) continue;
      seen.add(row.fieldKey);
      rules.push({
        type: 'field',
        moduleKey,
        fieldKey: row.fieldKey,
        operator: row.operator,
        value: row.value
      });
    }
  }

  for (const [fieldKey, value] of Object.entries(flat || {})) {
    if (seen.has(fieldKey)) continue;
    rules.push({
      type: 'field',
      moduleKey,
      fieldKey,
      operator: queryState.operators?.[fieldKey] || 'is',
      value
    });
    seen.add(fieldKey);
  }

  for (const [fieldKey, rawValue] of Object.entries(queryState.filters || {})) {
    if (seen.has(fieldKey)) continue;
    const operator = queryState.operators?.[fieldKey] || 'is';
    if (!isFilterRuleActive(rawValue, operator)) continue;
    const filter = filterByKey[fieldKey];
    rules.push({
      type: 'field',
      moduleKey,
      fieldKey,
      operator,
      value: filter
        ? compileOperatorValueForApi(filter, rawValue, operator)
        : rawValue
    });
    seen.add(fieldKey);
  }

  return rules;
}

export function compileRelationshipConditions(queryState, filterByKey) {
  return compileActiveFieldRulesFromState(
    {
      query: queryState.query,
      filters: queryState.filters,
      operators: queryState.operators
    },
    filterByKey,
    queryState.targetModuleKey
  );
}

export function buildV2FilterQuery({
  primaryEntity,
  fieldAst,
  fieldRules,
  fieldModuleKey,
  relationshipRules = [],
  moduleFieldsByKey = {}
}) {
  const children = [];

  const primaryFieldRules =
    fieldRules ||
    (fieldAst?.children?.length
      ? fieldAst.children
          .filter((child) => child.fieldKey)
          .map((child) => ({
            type: 'field',
            moduleKey: fieldModuleKey,
            fieldKey: child.fieldKey,
            operator: child.operator,
            value: child.value
          }))
      : []);

  children.push(...primaryFieldRules);

  for (const rule of relationshipRules) {
    const path = (rule.relationshipPath || []).filter(Boolean);
    if (!path.length || !rule.targetModuleKey) continue;

    const targetConfig = buildFilterConfigFromMetadata(
      moduleFieldsByKey[rule.targetModuleKey] || []
    );
    const filterByKey = buildFilterConfigByKey(targetConfig);
    const conditionChildren = compileRelationshipConditions(
      { ...rule, targetModuleKey: rule.targetModuleKey },
      filterByKey
    );

    const aggregateFn = String(rule.function || 'exists').toLowerCase();
    const isNumericAggregate = ['count', 'sum', 'avg', 'min', 'max'].includes(aggregateFn);

    if (aggregateFn === 'not_exists' || isNumericAggregate) {
      children.push({
        type: 'aggregate',
        relationshipPath: path,
        targetModuleKey: rule.targetModuleKey,
        function: aggregateFn,
        fieldKey: isNumericAggregate && aggregateFn !== 'count' ? rule.fieldKey || undefined : undefined,
        operator: isNumericAggregate ? rule.aggregateOperator || 'gte' : undefined,
        value: isNumericAggregate
          ? rule.aggregateValue ?? (aggregateFn === 'count' ? 1 : 0)
          : undefined,
        filter: conditionChildren.length
          ? { type: 'group', logic: rule.logic || 'AND', children: conditionChildren }
          : undefined
      });
      continue;
    }

    children.push({
      type: 'relationship',
      relationshipPath: path,
      targetModuleKey: rule.targetModuleKey,
      logic: rule.logic || 'AND',
      children: conditionChildren
    });
  }

  return {
    version: 2,
    primaryEntity,
    logic: 'AND',
    children
  };
}

/** @deprecated use buildFilterConfigFromMetadata */
export function getMarketingPeopleFilterConfig(t) {
  return buildFilterConfigFromMetadata([
    { key: 'name', label: t('people.sysFieldName'), filterType: 'text' },
    { key: 'email', label: t('people.sysFieldEmail'), filterType: 'text' },
    { key: 'phone', label: t('people.sysFieldPhone'), filterType: 'text' },
    { key: 'assignedTo', label: t('people.sysFieldAssignedTo'), filterType: 'user' },
    { key: 'organization', label: t('people.sysFieldOrganization'), filterType: 'user' },
    { key: 'sales_type', label: t('marketing.segmentsFilterSalesType'), filterType: 'select' },
    { key: 'helpdesk_role', label: t('marketing.segmentsFilterHelpdeskRole'), filterType: 'select' }
  ]);
}
