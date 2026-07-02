<template>
  <div class="space-y-2">
    <template v-for="child in group.children" :key="child.id">
      <div v-if="child.kind === 'rule'" class="flex items-center gap-2">
        <div
          v-if="ruleCount > 1"
          class="flex h-9 flex-shrink-0 items-center justify-end self-center"
          :style="{ width: FILTER_RULE_CONNECTOR_WIDTH }"
        >
          <span
            v-if="getRuleIndex(child.id) === 0"
            :class="[FILTER_RULE_CONNECTOR_LABEL_CLASS, 'text-gray-500 dark:text-gray-400']"
          >
            {{ t('common.filterBuilderWhere') }}
          </span>
          <FilterLogicConnector
            v-else-if="getRuleIndex(child.id) === 1"
            :model-value="group.logic"
            @update:model-value="onLogicChange"
          />
          <span
            v-else
            :class="[FILTER_RULE_CONNECTOR_LABEL_CLASS, 'text-gray-400 dark:text-gray-500']"
          >
            {{ group.logic === 'OR' ? t('common.filterBuilderOr') : t('common.filterBuilderAnd') }}
          </span>
        </div>
        <FilterRuleGroup
          class="min-w-0 flex-1"
          :rule="child"
          :filters="filters"
          :filter-config="filterConfig"
          :filter-by-key="filterByKey"
          :filter-operators="filterOperators"
          :used-field-keys="usedFieldKeysForRule(child.id)"
          @update:rule="(rule) => onRuleUpdate(child.id, rule)"
          @add-nested="onAddNestedToRule(child.id)"
          @remove-rule="onRemoveRule(child.id)"
          @apply="$emit('apply', $event)"
          @clear-field="$emit('clear-field', $event)"
          @filter-opened="(key) => $emit('filter-opened', key)"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import FilterRuleGroup from '@/components/filters/FilterRuleGroup.vue';
import FilterLogicConnector from '@/components/filters/FilterLogicConnector.vue';
import {
  FILTER_RULE_CONNECTOR_LABEL_CLASS,
  FILTER_RULE_CONNECTOR_WIDTH,
} from '@/components/filters/filterRuleLayout';
import type { FilterConfig } from '@/platform/filters/filterResolver';
import type { FilterOperatorId } from '@/platform/filters/filterOperators';
import type { FilterGroupNode, FilterLogic, FilterRuleRef } from '@/platform/filters/filterQueryAst';
import {
  appendNestedRuleToRule,
  createEmptyRuleRef,
  isFilterRuleRef,
  isFilterGroupNode,
} from '@/platform/filters/filterQueryAst';
import type { FilterQueryNode } from '@/platform/filters/filterQueryAst';

const props = defineProps<{
  group: FilterGroupNode;
  filters: Record<string, unknown>;
  filterConfig: FilterConfig[];
  filterByKey: Record<string, FilterConfig>;
  filterOperators: Record<string, FilterOperatorId>;
  usedFieldKeys: Set<string>;
}>();

const emit = defineEmits<{
  (e: 'apply', payload: { key: string; value: unknown; operator: FilterOperatorId }): void;
  (e: 'clear-field', key: string): void;
  (e: 'filter-opened', key: string): void;
  (e: 'update-group', group: FilterGroupNode): void;
}>();

const { t } = useI18n();

const ruleCount = computed(
  () => props.group.children.filter((child) => child.kind === 'rule').length
);

function getRuleIndex(ruleId: string): number {
  let index = 0;
  for (const child of props.group.children) {
    if (child.kind !== 'rule') continue;
    if (child.id === ruleId) return index;
    index += 1;
  }
  return 0;
}

function cloneGroup(): FilterGroupNode {
  return JSON.parse(JSON.stringify(props.group)) as FilterGroupNode;
}

function findRule(group: FilterGroupNode, ruleId: string) {
  return group.children.find((c) => c.kind === 'rule' && c.id === ruleId);
}

function collectNestedFieldKeys(rule: { nested?: FilterGroupNode }): string[] {
  const keys: string[] = [];
  if (!rule.nested) return keys;
  for (const child of rule.nested.children) {
    if (child.kind === 'rule' && child.fieldKey) keys.push(child.fieldKey);
  }
  return keys;
}

function collectFieldKeysFromNodes(nodes: FilterQueryNode[], skipRuleId: string, keys: Set<string>) {
  for (const node of nodes) {
    if (isFilterRuleRef(node)) {
      if (node.id !== skipRuleId && node.fieldKey) keys.add(node.fieldKey);
      if (node.nested) {
        for (const nested of node.nested.children) {
          if (nested.kind === 'rule' && nested.id !== skipRuleId && nested.fieldKey) {
            keys.add(nested.fieldKey);
          }
        }
      }
      continue;
    }
    if (isFilterGroupNode(node)) {
      collectFieldKeysFromNodes(node.children, skipRuleId, keys);
    }
  }
}

function usedFieldKeysForRule(ruleId: string): Set<string> {
  const keys = new Set<string>();
  collectFieldKeysFromNodes(props.group.children, ruleId, keys);
  return keys;
}

function onLogicChange(logic: FilterLogic) {
  const next = cloneGroup();
  next.logic = logic;
  emit('update-group', next);
}

function onRuleUpdate(ruleId: string, rule: FilterRuleRef) {
  const next = cloneGroup();
  const idx = next.children.findIndex((c) => c.kind === 'rule' && c.id === ruleId);
  if (idx >= 0) next.children[idx] = rule;
  emit('update-group', next);
}

function onAddNestedToRule(ruleId: string) {
  const next = cloneGroup();
  const rule = findRule(next, ruleId);
  if (!rule || !isFilterRuleRef(rule)) return;
  const updated = appendNestedRuleToRule(rule);
  rule.nested = updated.nested;
  emit('update-group', next);
}

function onRemoveRule(ruleId: string) {
  const next = cloneGroup();
  const rule = findRule(next, ruleId);
  if (rule && isFilterRuleRef(rule)) {
    if (rule.fieldKey) emit('clear-field', rule.fieldKey);
    for (const key of collectNestedFieldKeys(rule)) {
      emit('clear-field', key);
    }
  }
  next.children = next.children.filter((c) => !(c.kind === 'rule' && c.id === ruleId));
  if (next.children.length === 0) {
    next.children = [createEmptyRuleRef()];
  }
  emit('update-group', next);
}
</script>
