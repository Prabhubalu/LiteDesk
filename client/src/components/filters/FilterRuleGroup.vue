<template>
  <div class="group space-y-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-900/40">
    <FilterRuleFields
      class="w-full"
      :reserve-connector-column="hasNested"
      :field-key="rule.fieldKey"
      :model-value="rule.fieldKey ? filters[rule.fieldKey] : ''"
      :operator="resolveOperator(rule)"
      :field-options="availableFieldsForRule(rule)"
      :filter-by-key="filterByKey"
      :hide-operator-until-field="!showParentFullRow"
      @update:field-key="(key) => onParentFieldChange(key)"
      @update:model-value="(value) => onParentValueChange(value)"
      @update:operator="(op) => onParentOperatorChange(op)"
      @remove="onParentRemove"
      @filter-opened="(key) => $emit('filter-opened', key)"
    >
      <template v-if="showParentWhere" #connector>
        <span :class="[FILTER_RULE_CONNECTOR_LABEL_CLASS, 'text-gray-500 dark:text-gray-400']">
          {{ t('common.filterBuilderWhere') }}
        </span>
      </template>
    </FilterRuleFields>

    <div v-if="hasNested" class="flex flex-col gap-2">
      <template
        v-for="nestedChild in rule.nested!.children"
        :key="nestedChild.id"
      >
        <FilterRuleFields
          v-if="nestedChild.kind === 'rule'"
          class="w-full"
          reserve-connector-column
          :field-key="nestedChild.fieldKey"
          :model-value="nestedChild.fieldKey ? filters[nestedChild.fieldKey] : ''"
          :operator="resolveOperator(nestedChild)"
          :field-options="availableFieldsForRule(nestedChild)"
          :filter-by-key="filterByKey"
          :hide-operator-until-field="!nestedChild.fieldKey"
          @update:field-key="(key) => onNestedFieldChange(nestedChild.id, key)"
          @update:model-value="(value) => onNestedValueChange(nestedChild.id, value)"
          @update:operator="(op) => onNestedOperatorChange(nestedChild.id, op)"
          @remove="onRemoveNestedRule(nestedChild.id)"
          @filter-opened="(key) => $emit('filter-opened', key)"
        >
          <template #connector>
            <FilterLogicConnector
              v-if="getNestedRuleIndex(nestedChild.id) === 0"
              :model-value="rule.nested!.logic"
              @update:model-value="onNestedLogicChange"
            />
            <span
              v-else
              :class="[FILTER_RULE_CONNECTOR_LABEL_CLASS, 'text-gray-400 dark:text-gray-500']"
            >
              {{ rule.nested!.logic === 'OR' ? t('common.filterBuilderOr') : t('common.filterBuilderAnd') }}
            </span>
          </template>
        </FilterRuleFields>
      </template>

    </div>

    <div class="flex items-center justify-between">
      <button
        type="button"
        class="text-xs font-medium text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        @click="onAddNestedFilter"
      >
        {{ t('common.filterBuilderAddNestedFilter') }}
      </button>
      <button
        v-if="hasGroupContent"
        type="button"
        class="rounded-md px-1.5 py-0.5 text-xs font-medium text-gray-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 dark:text-gray-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
        @click="onClearGroup"
      >
        {{ t('common.filterBuilderClearGroup') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import FilterRuleFields from '@/components/filters/FilterRuleFields.vue';
import FilterLogicConnector from '@/components/filters/FilterLogicConnector.vue';
import { FILTER_RULE_CONNECTOR_LABEL_CLASS } from '@/components/filters/filterRuleLayout';
import type { FilterConfig } from '@/platform/filters/filterResolver';
import type { FilterOperatorId } from '@/platform/filters/filterOperators';
import { getDefaultOperatorForFilter, operatorRequiresValue } from '@/platform/filters/filterOperators';
import type { FilterGroupNode, FilterLogic, FilterRuleRef } from '@/platform/filters/filterQueryAst';
import {
  createEmptyRuleRef,
  isFilterRuleRef,
} from '@/platform/filters/filterQueryAst';

const props = defineProps<{
  rule: FilterRuleRef;
  filters: Record<string, unknown>;
  filterConfig: FilterConfig[];
  filterByKey: Record<string, FilterConfig>;
  filterOperators: Record<string, FilterOperatorId>;
  usedFieldKeys: Set<string>;
}>();

const emit = defineEmits<{
  (e: 'update:rule', rule: FilterRuleRef): void;
  (e: 'add-nested'): void;
  (e: 'remove-rule'): void;
  (e: 'apply', payload: { key: string; value: unknown; operator: FilterOperatorId }): void;
  (e: 'clear-field', key: string): void;
  (e: 'filter-opened', key: string): void;
}>();

const { t } = useI18n();

const hasNested = computed(() => Boolean(props.rule.nested?.children?.length));

const showParentWhere = computed(() => hasNested.value);

const showParentFullRow = computed(() => hasNested.value);

const hasGroupContent = computed(() => Boolean(props.rule.fieldKey) || hasNested.value);

function cloneRule(): FilterRuleRef {
  return JSON.parse(JSON.stringify(props.rule)) as FilterRuleRef;
}

function resolveOperator(rule: { fieldKey: string | null }) {
  if (!rule.fieldKey) return 'is' as FilterOperatorId;
  return props.filterOperators[rule.fieldKey] ?? getDefaultOperatorForFilter(props.filterByKey[rule.fieldKey]);
}

function availableFieldsForRule(rule: { id: string; fieldKey: string | null }) {
  const selfKey = rule.fieldKey;
  return props.filterConfig.filter((filter) => {
    if (selfKey === filter.key) return true;
    return !props.usedFieldKeys.has(filter.key);
  });
}

function getNestedRuleIndex(ruleId: string): number {
  if (!props.rule.nested) return 0;
  let index = 0;
  for (const child of props.rule.nested.children) {
    if (child.kind !== 'rule') continue;
    if (child.id === ruleId) return index;
    index += 1;
  }
  return 0;
}

function findNestedRule(group: FilterGroupNode, ruleId: string) {
  return group.children.find((c) => c.kind === 'rule' && c.id === ruleId);
}

function onParentRemove() {
  if (!hasNested.value) {
    emit('remove-rule');
    return;
  }
  if (props.rule.fieldKey) {
    emit('clear-field', props.rule.fieldKey);
  }
  const next = cloneRule();
  next.fieldKey = null;
  emit('update:rule', next);
}

function onParentFieldChange(fieldKey: string | null) {
  const next = cloneRule();
  if (next.fieldKey && next.fieldKey !== fieldKey) {
    emit('clear-field', next.fieldKey);
  }
  next.fieldKey = fieldKey;
  if (fieldKey) {
    const filter = props.filterByKey[fieldKey];
    emit('apply', {
      key: fieldKey,
      value: props.filters[fieldKey] ?? '',
      operator: getDefaultOperatorForFilter(filter ?? null),
    });
  }
  emit('update:rule', next);
}

function onParentOperatorChange(operator: FilterOperatorId) {
  if (!props.rule.fieldKey) return;
  const key = props.rule.fieldKey;
  emit('apply', {
    key,
    value: operatorRequiresValue(operator) ? (props.filters[key] ?? '') : '',
    operator,
  });
}

function onParentValueChange(value: unknown) {
  if (!props.rule.fieldKey) return;
  emit('apply', {
    key: props.rule.fieldKey,
    value,
    operator: resolveOperator(props.rule),
  });
}

function onNestedLogicChange(logic: FilterLogic) {
  const next = cloneRule();
  if (next.nested) next.nested.logic = logic;
  emit('update:rule', next);
}

function onNestedFieldChange(ruleId: string, fieldKey: string | null) {
  const next = cloneRule();
  if (!next.nested) return;
  const nestedRule = findNestedRule(next.nested, ruleId);
  if (!nestedRule || !isFilterRuleRef(nestedRule)) return;

  if (nestedRule.fieldKey && nestedRule.fieldKey !== fieldKey) {
    emit('clear-field', nestedRule.fieldKey);
  }
  nestedRule.fieldKey = fieldKey;

  if (fieldKey) {
    const filter = props.filterByKey[fieldKey];
    emit('apply', {
      key: fieldKey,
      value: props.filters[fieldKey] ?? '',
      operator: getDefaultOperatorForFilter(filter ?? null),
    });
  }
  emit('update:rule', next);
}

function onNestedOperatorChange(ruleId: string, operator: FilterOperatorId) {
  const nestedRule = props.rule.nested?.children.find((c) => c.kind === 'rule' && c.id === ruleId);
  if (!nestedRule || !isFilterRuleRef(nestedRule) || !nestedRule.fieldKey) return;
  const key = nestedRule.fieldKey;
  emit('apply', {
    key,
    value: operatorRequiresValue(operator) ? (props.filters[key] ?? '') : '',
    operator,
  });
}

function onNestedValueChange(ruleId: string, value: unknown) {
  const nestedRule = props.rule.nested?.children.find((c) => c.kind === 'rule' && c.id === ruleId);
  if (!nestedRule || !isFilterRuleRef(nestedRule) || !nestedRule.fieldKey) return;
  emit('apply', {
    key: nestedRule.fieldKey,
    value,
    operator: resolveOperator(nestedRule),
  });
}

function onRemoveNestedRule(ruleId: string) {
  const next = cloneRule();
  if (!next.nested) return;
  const nestedRule = findNestedRule(next.nested, ruleId);
  if (nestedRule && isFilterRuleRef(nestedRule) && nestedRule.fieldKey) {
    emit('clear-field', nestedRule.fieldKey);
  }
  next.nested.children = next.nested.children.filter((c) => !(c.kind === 'rule' && c.id === ruleId));

  if (next.nested.children.length === 0) {
    delete next.nested;
  }
  emit('update:rule', next);
}

function onAddNestedFilter() {
  if (!hasNested.value) {
    emit('add-nested');
    return;
  }
  const next = cloneRule();
  if (!next.nested) return;
  next.nested.children.push(createEmptyRuleRef());
  emit('update:rule', next);
}

function onClearGroup() {
  const next = cloneRule();

  if (next.fieldKey) {
    emit('clear-field', next.fieldKey);
    next.fieldKey = null;
  }

  if (next.nested) {
    for (const child of next.nested.children) {
      if (child.kind === 'rule' && child.fieldKey) {
        emit('clear-field', child.fieldKey);
      }
    }
    delete next.nested;
  }

  emit('update:rule', next);
}
</script>
