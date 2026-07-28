<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-2">
      <select
        :value="group.combinator"
        class="rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-medium dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        @change="updateCombinator($event.target.value)"
      >
        <option value="all">{{ t('settings.slaConditionAnd') }}</option>
        <option value="any">{{ t('settings.slaConditionOr') }}</option>
      </select>
      <button
        type="button"
        class="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        @click="addClause"
      >
        {{ t('settings.slaConditionAddClause') }}
      </button>
      <button
        type="button"
        class="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        @click="addGroup"
      >
        {{ t('settings.slaConditionAddGroup') }}
      </button>
    </div>

    <div v-if="group.clauses.length === 0 && group.groups.length === 0" class="text-xs text-gray-500 dark:text-gray-400">
      {{ t('settings.slaConditionEmpty') }}
    </div>

    <div v-for="(clause, idx) in group.clauses" :key="`c-${idx}`" class="grid grid-cols-12 items-end gap-2">
      <div class="col-span-4">
        <select
          v-model="clause.field"
          class="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          @change="onClauseFieldChange(idx)"
        >
          <option value="">{{ t('settings.slaConditionFieldPh') }}</option>
          <option v-for="field in fields" :key="field.key" :value="field.key">{{ field.label }}</option>
        </select>
      </div>
      <div class="col-span-3">
        <select
          v-model="clause.operator"
          class="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          @change="onClauseOperatorChange(idx)"
        >
          <option v-for="op in operators" :key="op" :value="op">{{ operatorLabel(op) }}</option>
        </select>
      </div>
      <div class="col-span-4">
        <template v-if="!valueLessOperator(clause.operator)">
          <select
            v-if="valueOptionsForClause(clause)"
            v-model="clause.value"
            class="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            <option :value="''">{{ t('settings.slaConditionValuePh') }}</option>
            <option v-for="opt in valueOptionsForClause(clause)" :key="String(opt.value)" :value="opt.value">{{ opt.label }}</option>
          </select>

          <select
            v-else-if="isMultiValueOperator(clause.operator)"
            v-model="clause.value"
            multiple
            class="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            <option v-for="opt in multiValueOptionsForClause(clause)" :key="String(opt.value)" :value="opt.value">{{ opt.label }}</option>
          </select>

          <select
            v-else-if="fieldDataType(clause.field) === 'boolean'"
            v-model="clause.value"
            class="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            <option :value="true">{{ t('actions.yes') }}</option>
            <option :value="false">{{ t('actions.no') }}</option>
          </select>

          <input
            v-else-if="fieldDataType(clause.field) === 'number' || fieldDataType(clause.field) === 'currency' || fieldDataType(clause.field) === 'percent'"
            v-model.number="clause.value"
            type="number"
            :placeholder="t('settings.slaConditionValuePh')"
            class="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />

          <DateFilterDropdown
            v-else-if="fieldDataType(clause.field) === 'date' || fieldDataType(clause.field) === 'datetime'"
            :model-value="normalizeDateFilterModel(clause.value)"
            :filter-key="clause.field || 'date'"
            :filter-label="t('settings.slaConditionValuePh')"
            button-class="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            teleport-options
            @update:model-value="(v) => { clause.value = v; }"
          />

          <input
            v-else
            v-model="clause.value"
            type="text"
            :placeholder="t('settings.slaConditionValuePh')"
            class="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </template>
      </div>
      <div class="col-span-1 flex justify-end">
        <button type="button" class="text-xs text-red-600 hover:underline" @click="removeClause(idx)">
          {{ t('actions.remove') }}
        </button>
      </div>
    </div>

    <div
      v-for="(child, gIdx) in group.groups"
      :key="`g-${gIdx}`"
      class="ml-3 space-y-2 border-l-2 border-indigo-200 pl-3 dark:border-indigo-800"
    >
      <SlaConditionBuilder
        :model-value="child"
        :fields="fields"
        :operators="operators"
        @update:model-value="updateChildGroup(gIdx, $event)"
      />
      <button type="button" class="text-xs text-red-600 hover:underline" @click="removeGroup(gIdx)">
        {{ t('settings.slaConditionRemoveGroup') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { SLA_CONDITION_OPERATORS } from '@/constants/slaPolicy';
import DateFilterDropdown from '@/components/common/DateFilterDropdown.vue';
import { parseDateFilterValue } from '@/utils/dateFilterOptions';

const props = defineProps({
  modelValue: { type: Object, required: true },
  fields: { type: Array, default: () => [] },
  operators: { type: Array, default: () => [...SLA_CONDITION_OPERATORS] }
});

const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();

const group = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

function operatorLabel(op) {
  const key = `settings.slaOp_${op}`;
  const translated = t(key);
  return translated === key ? op : translated;
}

function valueLessOperator(operator) {
  return ['exists', 'is_true', 'is_false'].includes(operator);
}

function isMultiValueOperator(operator) {
  return ['in', 'not_in'].includes(operator);
}

function fieldMeta(fieldKey) {
  return (props.fields || []).find((f) => f && f.key === fieldKey) || null;
}

function fieldDataType(fieldKey) {
  const dt = String(fieldMeta(fieldKey)?.dataType || '').toLowerCase();
  return dt || 'text';
}

function normalizeDateFilterModel(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'object') return parseDateFilterValue(v) || v;
  return parseDateFilterValue(v);
}

function normalizeOptions(options = []) {
  return (options || [])
    .map((opt) => {
      if (typeof opt === 'string') return { value: opt, label: opt };
      const value = opt?.value ?? opt?.key ?? opt?.id ?? '';
      return { value, label: opt?.label || String(value) };
    })
    .filter((opt) => opt.value !== '' && opt.value != null);
}

function picklistOptions(fieldKey) {
  return normalizeOptions(fieldMeta(fieldKey)?.options || []);
}

function valueOptionsForClause(clause) {
  if (!clause?.field) return null;
  const dt = fieldDataType(clause.field);
  if (dt !== 'picklist') return null;
  if (isMultiValueOperator(clause.operator)) return null;
  const opts = picklistOptions(clause.field);
  return opts.length ? opts : null;
}

function multiValueOptionsForClause(clause) {
  if (!clause?.field) return [];
  const dt = fieldDataType(clause.field);
  if (!['picklist', 'multi-picklist'].includes(dt)) return [];
  const opts = picklistOptions(clause.field);
  return opts;
}

function normalizeClauseValueForFieldAndOperator(clause) {
  if (!clause) return clause;
  const dt = fieldDataType(clause.field);
  if (isMultiValueOperator(clause.operator) || dt === 'multi-picklist') {
    if (!Array.isArray(clause.value)) clause.value = clause.value ? [clause.value] : [];
    return clause;
  }
  // single-value
  if (Array.isArray(clause.value)) clause.value = clause.value[0] ?? '';
  return clause;
}

function onClauseFieldChange(idx) {
  const clauses = [...(group.value.clauses || [])];
  const clause = { ...clauses[idx] };
  // reset value on field change to avoid stale incompatible values
  clause.value = '';
  clauses[idx] = normalizeClauseValueForFieldAndOperator(clause);
  patch({ ...group.value, clauses });
}

function onClauseOperatorChange(idx) {
  const clauses = [...(group.value.clauses || [])];
  const clause = { ...clauses[idx] };
  clauses[idx] = normalizeClauseValueForFieldAndOperator(clause);
  patch({ ...group.value, clauses });
}

function patch(next) {
  emit('update:modelValue', next);
}

function updateCombinator(combinator) {
  patch({ ...group.value, combinator });
}

function addClause() {
  const clauses = [...(group.value.clauses || []), { field: '', operator: 'equals', value: '' }];
  patch({ ...group.value, clauses });
}

function removeClause(idx) {
  const clauses = (group.value.clauses || []).filter((_, i) => i !== idx);
  patch({ ...group.value, clauses });
}

function addGroup() {
  const groups = [...(group.value.groups || []), { combinator: 'all', clauses: [], groups: [] }];
  patch({ ...group.value, groups });
}

function removeGroup(idx) {
  const groups = (group.value.groups || []).filter((_, i) => i !== idx);
  patch({ ...group.value, groups });
}

function updateChildGroup(idx, child) {
  const groups = [...(group.value.groups || [])];
  groups[idx] = child;
  patch({ ...group.value, groups });
}
</script>
