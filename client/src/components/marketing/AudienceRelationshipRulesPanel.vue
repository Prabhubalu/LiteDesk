<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-3">
      <div>
        <p class="text-sm font-medium text-gray-900 dark:text-white">
          {{ t('marketing.segmentsRelationshipRulesTitle') }}
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{ t('marketing.segmentsRelationshipRulesDescription') }}
        </p>
      </div>
      <button
        type="button"
        class="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200"
        @click="addRule"
      >
        {{ t('marketing.segmentsAddRelationshipRule') }}
      </button>
    </div>

    <div
      v-if="rules.length === 0"
      class="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-600"
    >
      <p>{{ t('marketing.segmentsRelationshipRulesEmpty') }}</p>
      <ul
        v-if="primaryRelationshipOptions.length > 0"
        class="mt-3 flex flex-wrap justify-center gap-2 text-xs text-gray-600 dark:text-gray-300"
      >
        <li
          v-for="option in primaryRelationshipOptions"
          :key="option.relationshipKey"
          class="rounded-full border border-gray-200 px-2 py-0.5 dark:border-gray-600"
        >
          {{ option.label || option.relationshipKey }}
        </li>
      </ul>
    </div>

    <div
      v-for="(rule, index) in rules"
      :key="rule.id"
      class="rounded-xl border border-gray-200 p-4 dark:border-gray-700"
    >
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm font-medium text-gray-900 dark:text-white">
          {{ t('marketing.segmentsRelationshipRuleLabel', { index: index + 1 }) }}
        </p>
        <button
          type="button"
          class="text-xs text-red-600 hover:text-red-500 dark:text-red-400"
          @click="removeRule(index)"
        >
          {{ t('actions.remove') }}
        </button>
      </div>

      <div class="mb-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
            {{ t('marketing.segmentsRelationshipMatchMode') }}
          </label>
          <select
            :value="rule.function || 'exists'"
            class="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900"
            @change="updateFunction(index, $event.target.value)"
          >
            <option value="exists">{{ t('marketing.segmentsRelationshipMatchExists') }}</option>
            <option value="not_exists">{{ t('marketing.segmentsRelationshipMatchNotExists') }}</option>
            <option value="count">{{ t('marketing.segmentsAggregateCount') }}</option>
            <option value="sum">{{ t('marketing.segmentsAggregateSum') }}</option>
            <option value="avg">{{ t('marketing.segmentsAggregateAvg') }}</option>
          </select>
        </div>
        <template v-if="isNumericAggregate(rule)">
          <div v-if="requiresAggregateField(rule)">
            <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
              {{ t('marketing.segmentsAggregateField') }}
            </label>
            <select
              :value="rule.fieldKey || ''"
              class="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900"
              @change="patchRule(index, { fieldKey: $event.target.value })"
            >
              <option value="">{{ t('marketing.segmentsAggregateFieldSelect') }}</option>
              <option
                v-for="field in numericFieldsForModule(rule.targetModuleKey)"
                :key="field.key"
                :value="field.key"
              >
                {{ field.label || field.key }}
              </option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
              {{ t('marketing.segmentsAggregateOperator') }}
            </label>
            <select
              :value="rule.aggregateOperator || 'gte'"
              class="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900"
              @change="patchRule(index, { aggregateOperator: $event.target.value })"
            >
              <option value="eq">{{ t('marketing.segmentsAggregateOpEq') }}</option>
              <option value="neq">{{ t('marketing.segmentsAggregateOpNeq') }}</option>
              <option value="gt">{{ t('marketing.segmentsAggregateOpGt') }}</option>
              <option value="gte">{{ t('marketing.segmentsAggregateOpGte') }}</option>
              <option value="lt">{{ t('marketing.segmentsAggregateOpLt') }}</option>
              <option value="lte">{{ t('marketing.segmentsAggregateOpLte') }}</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
              {{ t('marketing.segmentsAggregateValue') }}
            </label>
            <input
              :value="rule.aggregateValue ?? ''"
              type="number"
              step="any"
              class="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900"
              @input="patchRule(index, { aggregateValue: parseAggregateValue($event.target.value) })"
            />
          </div>
        </template>
        <div class="sm:col-span-2">
          <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
            {{ t('marketing.segmentsRelationshipPath') }}
          </label>
          <div class="flex flex-wrap gap-2">
            <select
              v-for="(hop, hopIndex) in rule.relationshipPath"
              :key="`${rule.id}-${hopIndex}`"
              :value="hop"
              class="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900"
              @change="updateHop(index, hopIndex, $event.target.value)"
            >
              <option value="">{{ t('marketing.segmentsRelationshipSelect') }}</option>
              <option
                v-for="option in hopOptions(rule, hopIndex)"
                :key="option.relationshipKey"
                :value="option.relationshipKey"
              >
                {{ option.label || option.relationshipKey }}
              </option>
            </select>
            <button
              v-if="canAddHop(rule)"
              type="button"
              class="rounded-lg border border-gray-300 px-2 py-1 text-xs dark:border-gray-600"
              @click="addHop(index)"
            >
              {{ t('marketing.segmentsAddRelationshipHop') }}
            </button>
          </div>
        </div>
      </div>

      <div
        v-if="rule.targetModuleKey && showRelatedFilters(rule)"
        class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
      >
        <FilterBuilderPanel
          :filter-config="targetFilterConfig(rule.targetModuleKey)"
          :filters="rule.filters"
          :filter-by-key="targetFilterByKey(rule.targetModuleKey)"
          :filter-operators="rule.operators"
          :query="rule.query"
          @apply="(payload) => onApplyFilter(index, payload)"
          @clear-field="(key) => onClearField(index, key)"
          @clear-all="() => onClearAll(index)"
          @update-query="(nextQuery) => onUpdateQuery(index, nextQuery)"
          @filter-opened="(key) => onFilterOpened(index, key)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import FilterBuilderPanel from '@/components/filters/FilterBuilderPanel.vue';
import { createDefaultRootGroup, createRuleRefId } from '@/platform/filters/filterQueryAst';
import { useFilterFieldOptions } from '@/composables/useFilterFieldOptions';
import { useAuthStore } from '@/stores/authRegistry';
import {
  buildFilterConfigByKey,
  buildFilterConfigFromMetadata
} from '@/utils/marketingAudienceFilterConfig';

const props = defineProps({
  rules: {
    type: Array,
    default: () => []
  },
  metadata: {
    type: Object,
    default: null
  },
  primaryModuleKey: {
    type: String,
    default: 'people'
  }
});

const emit = defineEmits(['update:rules']);

const { t } = useI18n();
const authStore = useAuthStore();
const { handleFilterOpened: loadFilterFieldOptions, enrichFilterMap } = useFilterFieldOptions(
  computed(() => props.primaryModuleKey),
  computed(() => String(authStore.user?._id || ''))
);

const maxDepth = computed(() => props.metadata?.limits?.maxRelationshipDepth || 3);

const primaryRelationshipOptions = computed(() => {
  const graph = props.metadata?.relationshipGraph || {};
  const keys = graph[props.primaryModuleKey] || [];
  const rels = props.metadata?.relationships || [];
  return keys
    .map((relationshipKey) => rels.find((row) => row.relationshipKey === relationshipKey))
    .filter(Boolean);
});

function emitRules(nextRules) {
  emit('update:rules', nextRules);
}

const NUMERIC_FIELD_TYPES = new Set(['number', 'currency', 'percent', 'integer']);

function isNumericAggregate(rule) {
  return ['count', 'sum', 'avg', 'min', 'max'].includes(String(rule?.function || '').toLowerCase());
}

function requiresAggregateField(rule) {
  return ['sum', 'avg', 'min', 'max'].includes(String(rule?.function || '').toLowerCase());
}

function showRelatedFilters(rule) {
  const fn = String(rule?.function || 'exists').toLowerCase();
  return fn === 'exists' || fn === 'not_exists' || isNumericAggregate(rule);
}

function numericFieldsForModule(moduleKey) {
  const fields = props.metadata?.modules?.[moduleKey]?.fields || [];
  return fields.filter((field) => NUMERIC_FIELD_TYPES.has(String(field.filterType || '')));
}

function parseAggregateValue(raw) {
  if (raw === '' || raw == null) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function addRule() {
  emitRules([
    ...props.rules,
    {
      id: createRuleRefId(),
      type: 'relationship',
      relationshipPath: [''],
      targetModuleKey: '',
      logic: 'AND',
      function: 'exists',
      fieldKey: '',
      aggregateOperator: 'gte',
      aggregateValue: 1,
      filters: {},
      operators: {},
      query: createDefaultRootGroup()
    }
  ]);
}

function removeRule(index) {
  emitRules(props.rules.filter((_, i) => i !== index));
}

function currentModuleForRule(rule, hopIndex) {
  if (hopIndex === 0) return props.primaryModuleKey;
  let current = props.primaryModuleKey;
  for (let i = 0; i < hopIndex; i += 1) {
    const key = rule.relationshipPath[i];
    const edge = (props.metadata?.relationships || []).find(
      (row) => row.fromModuleKey === current && row.relationshipKey === key
    );
    if (!edge) return current;
    current = edge.toModuleKey;
  }
  return current;
}

function hopOptions(rule, hopIndex) {
  const fromModule = currentModuleForRule(rule, hopIndex);
  const graph = props.metadata?.relationshipGraph || {};
  const keys = graph[fromModule] || [];
  const rels = props.metadata?.relationships || [];
  return keys
    .map((relationshipKey) => rels.find((row) => row.relationshipKey === relationshipKey))
    .filter(Boolean);
}

function resolveTargetModule(rule) {
  let current = props.primaryModuleKey;
  for (const key of rule.relationshipPath) {
    if (!key) return '';
    const edge = (props.metadata?.relationships || []).find(
      (row) => row.fromModuleKey === current && row.relationshipKey === key
    );
    if (!edge) return '';
    current = edge.toModuleKey;
  }
  return current;
}

function updateFunction(ruleIndex, value) {
  const rule = props.rules[ruleIndex];
  const fn = String(value || 'exists').toLowerCase();
  const patch = { function: fn };
  if (isNumericAggregate({ function: fn })) {
    patch.type = 'aggregate';
    patch.aggregateOperator = rule?.aggregateOperator || 'gte';
    patch.aggregateValue = rule?.aggregateValue ?? (fn === 'count' ? 1 : 0);
  } else if (fn === 'not_exists') {
    patch.type = 'aggregate';
  } else {
    patch.type = 'relationship';
  }
  patchRule(ruleIndex, patch);
}

function updateHop(ruleIndex, hopIndex, value) {
  const next = props.rules.map((rule, index) => {
    if (index !== ruleIndex) return rule;
    const path = [...rule.relationshipPath];
    path[hopIndex] = value;
    const trimmed = path.slice(0, hopIndex + 1);
    return {
      ...rule,
      relationshipPath: trimmed,
      targetModuleKey: resolveTargetModule({ ...rule, relationshipPath: trimmed })
    };
  });
  emitRules(next);
}

function canAddHop(rule) {
  const filled = rule.relationshipPath.filter(Boolean);
  if (filled.length === 0) return false;
  if (rule.relationshipPath.length >= maxDepth.value) return false;
  return Boolean(rule.targetModuleKey);
}

function addHop(ruleIndex) {
  const next = props.rules.map((rule, index) => {
    if (index !== ruleIndex) return rule;
    return {
      ...rule,
      relationshipPath: [...rule.relationshipPath, '']
    };
  });
  emitRules(next);
}

function targetFilterConfig(moduleKey) {
  return buildFilterConfigFromMetadata(props.metadata?.modules?.[moduleKey]?.fields || []);
}

function targetFilterByKey(moduleKey) {
  return enrichFilterMap(buildFilterConfigByKey(targetFilterConfig(moduleKey)), moduleKey);
}

async function onFilterOpened(ruleIndex, key) {
  const rule = props.rules[ruleIndex];
  if (!rule?.targetModuleKey) return;
  const config = targetFilterByKey(rule.targetModuleKey)[key];
  await loadFilterFieldOptions(key, config, rule.targetModuleKey);
}

function patchRule(ruleIndex, patch) {
  emitRules(
    props.rules.map((rule, index) => (index === ruleIndex ? { ...rule, ...patch } : rule))
  );
}

function onApplyFilter(ruleIndex, { key, value, operator }) {
  const rule = props.rules[ruleIndex];
  patchRule(ruleIndex, {
    filters: { ...rule.filters, [key]: value },
    operators: { ...rule.operators, [key]: operator }
  });
}

function onClearField(ruleIndex, key) {
  const rule = props.rules[ruleIndex];
  const filters = { ...rule.filters };
  const operators = { ...rule.operators };
  delete filters[key];
  delete operators[key];
  patchRule(ruleIndex, { filters, operators });
}

function onClearAll(ruleIndex) {
  patchRule(ruleIndex, {
    filters: {},
    operators: {},
    query: createDefaultRootGroup()
  });
}

function onUpdateQuery(ruleIndex, nextQuery) {
  patchRule(ruleIndex, { query: nextQuery });
}
</script>
