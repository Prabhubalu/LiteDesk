import { inferFallbackFilterConfig } from '@/platform/filters/columnFilterResolver';
import type { FilterConfig } from '@/platform/filters/filterResolver';
import type { FilterOperatorId } from '@/platform/filters/filterOperators';
import { operatorRequiresFilterQuery } from '@/platform/filters/filterOperators';
import {
  compileOperatorValueForApi,
  isFilterRuleActive,
} from '@/platform/filters/filterQueryCompiler';
import type { FilterGroupNode } from '@/platform/filters/filterQueryAst';
import {
  createEmptyRuleRef,
  createRuleRefId,
  isFilterGroupNode,
  isFilterRuleRef,
} from '@/platform/filters/filterQueryAst';

export interface CompiledFilterRule {
  fieldKey: string;
  operator: FilterOperatorId;
  value: unknown;
}

export interface ServerFilterQuery {
  logic: 'AND' | 'OR';
  children: Array<CompiledFilterRule | ServerFilterQuery>;
}

function compileRuleNode(
  fieldKey: string,
  filters: Record<string, unknown>,
  operators: Record<string, FilterOperatorId>,
  filterByKey: Record<string, FilterConfig>
): CompiledFilterRule | null {
  const operator = operators[fieldKey] ?? 'is';
  const value = filters[fieldKey];
  if (!isFilterRuleActive(value, operator)) return null;
  const filter = filterByKey[fieldKey] || inferFallbackFilterConfig(fieldKey);
  if (!filter) return null;
  return {
    fieldKey,
    operator,
    value: compileOperatorValueForApi(filter, value, operator),
  };
}

function compileGroupNode(
  group: FilterGroupNode,
  filters: Record<string, unknown>,
  operators: Record<string, FilterOperatorId>,
  filterByKey: Record<string, FilterConfig>
): ServerFilterQuery | null {
  const children: Array<CompiledFilterRule | ServerFilterQuery> = [];

  for (const node of group.children) {
    if (isFilterRuleRef(node)) {
      const parts: Array<CompiledFilterRule | ServerFilterQuery> = [];

      if (node.fieldKey) {
        const compiled = compileRuleNode(node.fieldKey, filters, operators, filterByKey);
        if (compiled) parts.push(compiled);
      }

      if (node.nested) {
        const nestedCompiled = compileGroupNode(node.nested, filters, operators, filterByKey);
        if (nestedCompiled && nestedCompiled.children.length > 0) parts.push(nestedCompiled);
      }

      if (parts.length === 1) {
        children.push(parts[0]);
      } else if (parts.length > 1) {
        children.push({ logic: 'AND', children: parts });
      }
      continue;
    }
    if (isFilterGroupNode(node)) {
      const legacyNested = compileGroupNode(node, filters, operators, filterByKey);
      if (legacyNested && legacyNested.children.length > 0) children.push(legacyNested);
    }
  }

  if (children.length === 0) return null;
  return { logic: group.logic, children };
}

export function compileFilterQueryAst(
  root: FilterGroupNode,
  filters: Record<string, unknown>,
  operators: Record<string, FilterOperatorId>,
  filterByKey: Record<string, FilterConfig>
): { flat: Record<string, unknown>; filterQuery: ServerFilterQuery | null } {
  const query = compileGroupNode(root, filters, operators, filterByKey);
  const flat: Record<string, unknown> = {};

  if (!query) {
    return { flat, filterQuery: null };
  }

  const flattenRules = (node: ServerFilterQuery | CompiledFilterRule) => {
    if ('fieldKey' in node) {
      flat[node.fieldKey] = node.value;
      return;
    }
    for (const child of node.children) flattenRules(child);
  };
  flattenRules(query);

  const nodeRequiresFilterQuery = (
    node: CompiledFilterRule | ServerFilterQuery
  ): boolean => {
    if ('fieldKey' in node) {
      return operatorRequiresFilterQuery(node.operator);
    }
    return (
      node.logic === 'OR' ||
      node.children.some((child) => nodeRequiresFilterQuery(child))
    );
  };

  const useAdvancedQuery = nodeRequiresFilterQuery(query);

  return {
    flat,
    filterQuery: useAdvancedQuery ? query : null,
  };
}

export function syncRootGroupFromActiveFilters(
  root: FilterGroupNode,
  filterConfig: FilterConfig[],
  filters: Record<string, unknown>,
  operators: Record<string, FilterOperatorId>
): FilterGroupNode {
  const activeRules = filterConfig
    .filter((filter) => isFilterRuleActive(filters[filter.key], operators[filter.key] ?? 'is'))
    .map((filter) => ({
      kind: 'rule' as const,
      id: createRuleRefId(),
      fieldKey: filter.key,
    }));

  if (activeRules.length === 0) {
    return { ...root, children: [createEmptyRuleRef()] };
  }

  return {
    ...root,
    children: [...activeRules, createEmptyRuleRef()],
  };
}
