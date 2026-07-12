<template>
  <div class="space-y-3">
    <div
      v-for="block in blocks"
      :key="block.key"
      class="contents"
    >
      <div class="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/40 p-3 space-y-2">
        <div>
          <p class="text-xs font-semibold text-gray-900 dark:text-white">
            {{ block.title }}
          </p>
          <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
            {{ block.hint }}
          </p>
        </div>

        <template v-for="(item, index) in block.conditions" :key="`${block.key}-${index}`">
          <div
            v-if="index > 0"
            class="text-[10px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 px-0.5"
          >
            {{ block.joinLabel }}
          </div>
          <div class="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2.5 space-y-2">
            <div class="flex items-start justify-between gap-2">
              <label class="block text-xs font-medium text-gray-700 dark:text-gray-300">
                {{ t('process.inspectorFieldHeading') }}
              </label>
              <button
                type="button"
                class="text-[11px] text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                @click="removeCondition(block.key, index)"
              >
                {{ t('process.inspectorRemoveCondition') }}
              </button>
            </div>
            <HeadlessSelect
              :model-value="fieldKeyFor(item)"
              :options="fieldSelectOptions"
              allow-empty
              :empty-label="t('process.inspectorSelectField')"
              :button-class="PROCESS_SELECT_BUTTON_CLASS"
              @update:model-value="(key) => onFieldKeyChange(block.key, index, key)"
            />
            <div>
              <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ t('process.inspectorOperatorHeading') }}
              </label>
              <HeadlessSelect
                :model-value="item.operator || 'equals'"
                :options="operatorOptions"
                :button-class="PROCESS_SELECT_BUTTON_CLASS"
                @update:model-value="(op) => patchCondition(block.key, index, { operator: op })"
              />
            </div>
            <div v-if="String(item.operator || '') !== 'exists'">
              <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ t('process.inspectorValueMode') }}
              </label>
              <HeadlessSelect
                :model-value="valueModeFor(item)"
                :options="conditionValueModeOptions"
                :button-class="PROCESS_SELECT_BUTTON_CLASS"
                @update:model-value="(mode) => onValueModeChange(block.key, index, mode)"
              />
            </div>

            <div v-if="String(item.operator || '') !== 'exists'">
              <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ t('process.inspectorValueHeading') }}
              </label>

              <!-- Expression -->
              <template v-if="valueModeFor(item) === 'expression'">
                <button
                  type="button"
                  class="w-full text-left rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2.5 py-2 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors"
                  @click="openExpressionModal(block.key, index, item)"
                >
                  <div class="flex items-start gap-2">
                    <div class="flex-1 min-w-0">
                      <code
                        v-if="item.expression"
                        class="block text-[11px] font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-all line-clamp-3"
                      >{{ item.expression }}</code>
                      <span v-else class="text-[11px] text-gray-400 italic">
                        {{ t('process.expressionCompactEmpty') }}
                      </span>
                    </div>
                    <span class="shrink-0 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                      {{ item.expression ? t('process.expressionCompactEdit') : t('process.expressionCompactBuild') }}
                    </span>
                  </div>
                </button>
              </template>

              <!-- Raw -->
              <template v-else>
              <HeadlessSelect
                v-if="valueInputType(item) === 'select'"
                :model-value="stringValue(item.value)"
                :options="valueOptions(item)"
                allow-empty
                :empty-label="t('process.inspectorSelectValue')"
                :button-class="PROCESS_SELECT_BUTTON_CLASS"
                @update:model-value="(v) => patchCondition(block.key, index, { value: v })"
              />
              <div
                v-else-if="valueInputType(item) === 'multi-select'"
                class="space-y-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 max-h-40 overflow-y-auto"
              >
                <label
                  v-for="opt in valueOptions(item)"
                  :key="String(opt.value)"
                  class="flex items-center gap-2 px-1 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    :checked="multiValues(item).includes(String(opt.value))"
                    @change="(e) => toggleMultiValue(block.key, index, item, opt.value, e.target.checked)"
                  />
                  <span class="text-sm text-gray-800 dark:text-gray-200">{{ opt.label }}</span>
                </label>
                <p v-if="!valueOptions(item).length" class="text-[10px] text-amber-600 dark:text-amber-400 px-1">
                  {{ t('process.inspectorNoPicklistOptions') }}
                </p>
              </div>
              <input
                v-else-if="valueInputType(item) === 'number'"
                :value="item.value"
                type="number"
                class="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                @input="(e) => patchCondition(block.key, index, { value: e.target.value === '' ? '' : Number(e.target.value) })"
              />
              <HeadlessSelect
                v-else-if="valueInputType(item) === 'boolean'"
                :model-value="booleanString(item.value)"
                :options="booleanOptions"
                allow-empty
                :empty-label="t('process.inspectorSelectGeneric')"
                :button-class="PROCESS_SELECT_BUTTON_CLASS"
                @update:model-value="(v) => patchCondition(block.key, index, { value: v === 'true' ? true : v === 'false' ? false : '' })"
              />
              <input
                v-else-if="valueInputType(item) === 'date'"
                :value="stringValue(item.value)"
                type="date"
                class="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                @input="(e) => patchCondition(block.key, index, { value: e.target.value })"
              />
              <input
                v-else-if="valueInputType(item) === 'datetime'"
                :value="datetimeLocalValue(item.value)"
                type="datetime-local"
                class="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                @input="(e) => patchCondition(block.key, index, { value: e.target.value })"
              />
              <input
                v-else
                :value="stringValue(item.value)"
                type="text"
                :placeholder="t('process.inspectorEnterValuePh')"
                class="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                @input="(e) => patchCondition(block.key, index, { value: e.target.value })"
              />
              <p
                v-if="valueInputType(item) === 'select' && !valueOptions(item).length && !conditionFieldsLoading"
                class="text-[10px] text-amber-600 dark:text-amber-400 mt-1"
              >
                {{ t('process.inspectorNoPicklistOptions') }}
              </p>
              </template>
            </div>
          </div>
        </template>

        <button
          type="button"
          class="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
          @click="addCondition(block.key)"
        >
          {{ t('process.inspectorAddCondition') }}
        </button>
      </div>

      <div
        v-if="block.key === 'and'"
        class="flex items-center gap-2 px-1"
      >
        <span class="text-[10px] font-semibold uppercase text-gray-500 dark:text-gray-400 shrink-0">
          {{ t('process.inspectorBetweenBlocks') }}
        </span>
        <HeadlessSelect
          :model-value="group.blockCombinator"
          :options="combinatorOptions"
          :button-class="PROCESS_SELECT_BUTTON_CLASS"
          @update:model-value="onBlockCombinatorChange"
        />
      </div>
    </div>

    <p v-if="conditionFieldsLoading" class="text-[10px] text-gray-500">
      {{ t('process.inspectorLoadingFieldOptions') }}
    </p>

    <ProcessExpressionBuilderModal
      :open="expressionModalOpen"
      :model-value="expressionModalDraft"
      :field-label="expressionModalFieldLabel"
      :mergetags="mergetagOptions"
      :formula-catalog="formulaCatalog"
      @update:open="(v) => (expressionModalOpen = v)"
      @save="onExpressionModalSave"
      @cancel="expressionModalOpen = false"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import ProcessExpressionBuilderModal from '@/components/process-flow/ProcessExpressionBuilderModal.vue';
import {
  getConditionOperatorOptions,
  getBooleanValueOptions,
  PROCESS_SELECT_BUTTON_CLASS,
  conditionFieldToPath,
  conditionPathToField
} from '@/utils/processDesignerConstants';
import { PROCESS_FORMULA_HELPER_CATALOG } from '@/constants/processFormulaHelperCatalog';
import apiClient from '@/utils/apiClient';

const { t } = useI18n();

const props = defineProps({
  group: { type: Object, required: true },
  fieldOptions: { type: Array, default: () => [] },
  moduleFieldMeta: { type: Object, default: () => ({}) },
  conditionFieldsLoading: { type: Boolean, default: false },
  entityType: { type: String, default: '' },
  /** 'event' → event.currentState.field ; 'plain' → field key only (fetch filters) */
  fieldPathMode: { type: String, default: 'event' }
});

const emit = defineEmits(['update:group', 'change']);

const formulaCatalog = ref([...PROCESS_FORMULA_HELPER_CATALOG]);
const expressionModalOpen = ref(false);
const expressionModalDraft = ref('');
const expressionModalFieldLabel = ref('');
const expressionModalTarget = ref({ blockKey: 'and', index: -1 });

async function loadFormulaCatalog() {
  try {
    const res = await apiClient.get('/admin/processes/designer-metadata');
    const list = res?.data?.formulaHelpers || res?.formulaHelpers;
    if (Array.isArray(list) && list.length) formulaCatalog.value = list;
  } catch {
    /* keep bundled catalog */
  }
}
loadFormulaCatalog();

const combinatorOptions = computed(() => [
  { value: 'AND', label: t('process.inspectorCombinatorAnd') },
  { value: 'OR', label: t('process.inspectorCombinatorOr') }
]);
const operatorOptions = computed(() => getConditionOperatorOptions(t));
const booleanOptions = computed(() => getBooleanValueOptions(t));
const fieldSelectOptions = computed(() => props.fieldOptions);
const conditionValueModeOptions = computed(() => [
  { value: 'raw', label: t('process.inspectorValueModeRaw') },
  { value: 'expression', label: t('process.inspectorValueModeExpression') }
]);

const mergetagOptions = computed(() => {
  const tags = (props.fieldOptions || []).map((f) => {
    const meta = props.moduleFieldMeta?.[f.value] || {};
    return {
      label: f.label,
      insert: `trigger.${f.value}`,
      valueInputType: meta.valueInputType || '',
      options: Array.isArray(meta.options) ? meta.options : []
    };
  });
  tags.unshift(
    { label: 'now()', insert: 'now()', valueInputType: '', options: [] },
    { label: 'today', insert: 'today', valueInputType: '', options: [] },
    { label: 'entityId', insert: 'entityId', valueInputType: '', options: [] }
  );
  return tags;
});

const blocks = computed(() => [
  {
    key: 'and',
    title: t('process.inspectorAndBlockTitle'),
    hint: t('process.inspectorAndHint'),
    joinLabel: 'AND',
    conditions: props.group.andBlock?.conditions || []
  },
  {
    key: 'or',
    title: t('process.inspectorOrBlockTitle'),
    hint: t('process.inspectorOrHint'),
    joinLabel: 'OR',
    conditions: props.group.orBlock?.conditions || []
  }
]);

function emptyLeaf() {
  return { field: '', operator: 'equals', valueMode: 'raw', value: '', expression: '' };
}

function emitGroup(next) {
  emit('update:group', next);
  emit('change');
}

function onBlockCombinatorChange(blockCombinator) {
  emitGroup({ ...props.group, blockCombinator });
}

function blockPath(blockKey) {
  return blockKey === 'or' ? 'orBlock' : 'andBlock';
}

function patchCondition(blockKey, index, patch) {
  const path = blockPath(blockKey);
  const conditions = [...(props.group[path]?.conditions || [])];
  conditions[index] = { ...conditions[index], ...patch };
  emitGroup({ ...props.group, [path]: { conditions } });
}

function removeCondition(blockKey, index) {
  const path = blockPath(blockKey);
  emitGroup({
    ...props.group,
    [path]: {
      conditions: (props.group[path]?.conditions || []).filter((_, i) => i !== index)
    }
  });
}

function addCondition(blockKey) {
  const path = blockPath(blockKey);
  emitGroup({
    ...props.group,
    [path]: {
      conditions: [...(props.group[path]?.conditions || []), emptyLeaf()]
    }
  });
}

function fieldKeyFor(item) {
  const path = item?.field || '';
  if (!path) return '';
  const key = conditionPathToField(path);
  const known = props.fieldOptions.some((f) => f.value === key);
  return known ? key : '';
}

function onFieldKeyChange(blockKey, index, key) {
  if (!key) {
    patchCondition(blockKey, index, {
      field: '',
      value: '',
      expression: '',
      valueMode: 'raw',
      operator: 'equals'
    });
    return;
  }
  const field =
    props.fieldPathMode === 'plain'
      ? key
      : conditionFieldToPath(key, props.entityType);
  const meta = props.moduleFieldMeta[key];
  const isMulti = meta?.valueInputType === 'multi-select';
  patchCondition(blockKey, index, {
    field,
    value: isMulti ? [] : '',
    expression: '',
    valueMode: 'raw',
    operator: isMulti ? 'contains' : 'equals'
  });
}

function valueModeFor(item) {
  return String(item?.valueMode || 'raw').toLowerCase() === 'expression' ? 'expression' : 'raw';
}

function onValueModeChange(blockKey, index, mode) {
  const next = mode === 'expression' ? 'expression' : 'raw';
  patchCondition(blockKey, index, { valueMode: next });
}

function openExpressionModal(blockKey, index, item) {
  expressionModalTarget.value = { blockKey, index };
  expressionModalDraft.value = item?.expression || '';
  const key = fieldKeyFor(item);
  const meta = key ? props.moduleFieldMeta[key] : null;
  expressionModalFieldLabel.value = meta?.label
    ? `${meta.label} (${key})`
    : key || t('process.inspectorValueHeading');
  expressionModalOpen.value = true;
}

function onExpressionModalSave(expression) {
  const { blockKey, index } = expressionModalTarget.value;
  if (index < 0) return;
  patchCondition(blockKey, index, {
    valueMode: 'expression',
    expression: expression || ''
  });
  expressionModalOpen.value = false;
}

function multiValues(item) {
  if (Array.isArray(item?.value)) return item.value.map(String);
  if (item?.value == null || item.value === '') return [];
  return [String(item.value)];
}

function toggleMultiValue(blockKey, index, item, optValue, checked) {
  const current = multiValues(item);
  const v = String(optValue);
  const next = checked
    ? current.includes(v) ? current : [...current, v]
    : current.filter((x) => x !== v);
  patchCondition(blockKey, index, { value: next });
}

function metaFor(item) {
  const key = fieldKeyFor(item);
  if (!key) return null;
  return props.moduleFieldMeta[key] || null;
}

function valueOptions(item) {
  return metaFor(item)?.options || [];
}

function valueInputType(item) {
  const meta = metaFor(item);
  if (!meta) return 'text';
  if (meta.valueInputType) return meta.valueInputType;
  if (meta.options?.length) return 'select';
  return 'text';
}

function stringValue(v) {
  if (v == null) return '';
  return String(v);
}

function booleanString(v) {
  if (v === true || v === 'true') return 'true';
  if (v === false || v === 'false') return 'false';
  return '';
}

function datetimeLocalValue(v) {
  if (v == null || v === '') return '';
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s.slice(0, 16);
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return s;
  }
}
</script>
