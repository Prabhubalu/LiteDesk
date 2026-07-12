<template>
  <div class="space-y-3">
    <p v-if="loading" class="text-[10px] text-gray-500">{{ t('process.inspectorLoadingFields') }}</p>
    <p v-else-if="!moduleKey" class="text-[10px] text-gray-500">{{ t('process.inspectorPickModuleFirst') }}</p>

    <template v-else>
      <div
        v-for="(row, idx) in rows"
        :key="idx"
        class="space-y-1.5 pb-3 border-b border-gray-100 dark:border-gray-700 last:border-0 last:pb-0"
      >
        <div class="flex items-center justify-between gap-2">
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300">
            {{ t('process.inspectorSelectField') }}
          </label>
          <button
            type="button"
            class="text-[11px] text-red-600 dark:text-red-400 hover:underline shrink-0"
            :aria-label="t('process.inspectorRemoveFieldRow')"
            @click="removeRow(idx)"
          >
            {{ t('process.inspectorRemoveFieldRow') }}
          </button>
        </div>
        <HeadlessSelect
          :model-value="row.key"
          :options="fieldKeyOptionsForRow(row.key)"
          allow-empty
          :empty-label="t('process.inspectorSelectField')"
          :button-class="PROCESS_SELECT_BUTTON_CLASS"
          @update:model-value="(v) => setRowKey(idx, v)"
        />

        <template v-if="row.key">
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 pt-0.5">
            {{ t('process.inspectorValueMode') }}
          </label>
          <HeadlessSelect
            :model-value="row.mode"
            :options="valueModeOptions"
            :button-class="PROCESS_SELECT_BUTTON_CLASS"
            @update:model-value="(v) => onModeChange(idx, v)"
          />

          <!-- Raw -->
          <template v-if="row.mode === 'raw'">
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 pt-0.5">
              {{ t('process.inspectorFieldValuePh') }}
            </label>
            <HeadlessSelect
              v-if="valueMeta(row.key)?.valueInputType === 'select' && valueMeta(row.key)?.options?.length"
              :model-value="row.value"
              :options="valueMeta(row.key).options"
              allow-empty
              :empty-label="t('process.inspectorFieldValuePh')"
              :button-class="PROCESS_SELECT_BUTTON_CLASS"
              @update:model-value="(v) => setRowValue(idx, v)"
            />
            <HeadlessSelect
              v-else-if="valueMeta(row.key)?.valueInputType === 'boolean'"
              :model-value="row.value"
              :options="booleanOptions"
              :button-class="PROCESS_SELECT_BUTTON_CLASS"
              @update:model-value="(v) => setRowValue(idx, v)"
            />
            <input
              v-else
              :value="row.value"
              :type="inputTypeFor(row.key)"
              :placeholder="t('process.inspectorFieldValuePh')"
              :class="INPUT_CLASS"
              @input="setRowValue(idx, $event.target.value)"
            />
          </template>

          <!-- Copy from field -->
          <template v-else-if="row.mode === 'copy'">
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 pt-0.5">
              {{ t('process.inspectorCopyFromField') }}
            </label>
            <HeadlessSelect
              :model-value="row.source"
              :options="sourceFieldOptions"
              allow-empty
              :empty-label="t('process.inspectorCopyFromField')"
              :button-class="PROCESS_SELECT_BUTTON_CLASS"
              @update:model-value="(v) => setRowSource(idx, v)"
            />
            <p class="text-[10px] text-gray-500">{{ t('process.inspectorCopyFromHint') }}</p>
          </template>

          <!-- Expression — compact summary + open modal -->
          <template v-else>
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 pt-0.5">
              {{ t('process.inspectorExpression') }}
            </label>
            <button
              type="button"
              class="w-full text-left rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2.5 py-2 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors"
              @click="openExpressionModal(idx)"
            >
              <div class="flex items-start gap-2">
                <div class="flex-1 min-w-0">
                  <code
                    v-if="row.expression"
                    class="block text-[11px] font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-all line-clamp-3"
                  >{{ row.expression }}</code>
                  <span v-else class="text-[11px] text-gray-400 italic">
                    {{ t('process.expressionCompactEmpty') }}
                  </span>
                </div>
                <span class="shrink-0 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                  {{ row.expression ? t('process.expressionCompactEdit') : t('process.expressionCompactBuild') }}
                </span>
              </div>
            </button>
          </template>
        </template>
      </div>

      <button
        type="button"
        class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
        @click="addRow"
      >
        {{ t('process.inspectorAddFieldRow') }}
      </button>
    </template>

    <ProcessExpressionBuilderModal
      :open="expressionModalOpen"
      :model-value="expressionModalDraft"
      :field-label="expressionModalFieldLabel"
      :mergetags="mergetagOptions"
      :target-field-options="expressionTargetOptions"
      :target-value-input-type="expressionTargetInputType"
      :formula-catalog="formulaCatalog"
      @update:open="(v) => (expressionModalOpen = v)"
      @save="onExpressionModalSave"
      @cancel="expressionModalOpen = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import ProcessExpressionBuilderModal from '@/components/process-flow/ProcessExpressionBuilderModal.vue';
import { PROCESS_SELECT_BUTTON_CLASS, ENTITY_TYPE_TO_MODULE_KEY } from '@/utils/processDesignerConstants';
import { fetchWebformModuleDefinition } from '@/utils/webformModuleDefinition';
import { inferValueInputType } from '@/composables/useProcessModuleFields';
import { PROCESS_FORMULA_HELPER_CATALOG } from '@/constants/processFormulaHelperCatalog';
import apiClient from '@/utils/apiClient';

const INPUT_CLASS =
  'w-full px-2.5 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white';

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
  moduleKey: { type: String, default: '' },
  sourceEntityType: { type: String, default: '' }
});

const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();
const loading = ref(false);
/** @type {import('vue').Ref<Array<{ key: string, label: string, options: Array<{value:string,label:string}>, valueInputType: string }>>} */
const fieldOptions = ref([]);
/** @type {import('vue').Ref<Array<{ value: string, label: string }>>} */
const sourceFieldOptions = ref([]);
const formulaCatalog = ref([...PROCESS_FORMULA_HELPER_CATALOG]);

const expressionModalOpen = ref(false);
const expressionModalIdx = ref(-1);
const expressionModalDraft = ref('');
const expressionModalFieldLabel = ref('');
const expressionTargetOptions = ref([]);
const expressionTargetInputType = ref('');

const valueModeOptions = computed(() => [
  { value: 'raw', label: t('process.inspectorValueModeRaw') },
  { value: 'copy', label: t('process.inspectorValueModeCopy') },
  { value: 'expression', label: t('process.inspectorValueModeExpression') }
]);

const booleanOptions = computed(() => [
  { value: 'true', label: t('process.inspectorBooleanTrue') },
  { value: 'false', label: t('process.inspectorBooleanFalse') }
]);

const mergetagOptions = computed(() => {
  const tags = sourceFieldOptions.value.map((f) => ({
    label: f.label,
    insert: `trigger.${f.value}`,
    valueInputType: f.valueInputType || '',
    options: Array.isArray(f.options) ? f.options : []
  }));
  tags.unshift(
    { label: 'now()', insert: 'now()', valueInputType: '', options: [] },
    { label: 'today', insert: 'today', valueInputType: '', options: [] },
    { label: 'entityId', insert: 'entityId', valueInputType: '', options: [] }
  );
  return tags;
});

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

function emptyRow() {
  return { key: '', mode: 'raw', value: '', source: '', expression: '' };
}

function parseStoredEntry(raw) {
  if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
    const mode = String(raw.mode || 'raw').toLowerCase();
    if (mode === 'copy') {
      return { mode: 'copy', value: '', source: String(raw.source ?? ''), expression: '' };
    }
    if (mode === 'expression') {
      return {
        mode: 'expression',
        value: '',
        source: '',
        expression: String(raw.expression ?? raw.value ?? '')
      };
    }
    return {
      mode: 'raw',
      value: raw.value == null ? '' : String(raw.value),
      source: '',
      expression: ''
    };
  }
  return {
    mode: 'raw',
    value: raw == null ? '' : String(raw),
    source: '',
    expression: ''
  };
}

function serializeRow(row) {
  if (!row.key) return null;
  if (row.mode === 'copy') return { mode: 'copy', source: row.source || '' };
  if (row.mode === 'expression') return { mode: 'expression', expression: row.expression || '' };
  return { mode: 'raw', value: row.value };
}

const rows = computed(() => {
  const map = props.modelValue && typeof props.modelValue === 'object' ? props.modelValue : {};
  const keys = Object.keys(map);
  if (!keys.length) return [emptyRow()];
  return keys.map((key) => ({ key, ...parseStoredEntry(map[key]) }));
});

const fieldMetaByKey = computed(() => {
  const map = {};
  for (const f of fieldOptions.value) map[f.key] = f;
  return map;
});

function valueMeta(key) {
  return fieldMetaByKey.value[key] || null;
}

function fieldKeyOptionsForRow(currentKey) {
  const used = new Set(rows.value.map((r) => r.key).filter(Boolean));
  return fieldOptions.value
    .filter((f) => f.key === currentKey || !used.has(f.key))
    .map((f) => ({ value: f.key, label: f.label || f.key }));
}

function inputTypeFor(key) {
  const type = valueMeta(key)?.valueInputType;
  if (type === 'number') return 'number';
  if (type === 'date') return 'date';
  if (type === 'datetime') return 'datetime-local';
  return 'text';
}

function resolveModuleKey(raw) {
  const key = String(raw || '').trim();
  if (!key) return '';
  return ENTITY_TYPE_TO_MODULE_KEY[key] || key;
}

function toOption(opt) {
  if (opt == null || opt === '') return null;
  if (typeof opt === 'string' || typeof opt === 'number' || typeof opt === 'boolean') {
    const value = String(opt);
    return { value, label: value };
  }
  if (typeof opt === 'object') {
    const value = opt.value ?? opt.key ?? opt.name ?? opt.label ?? '';
    if (value === '' || value == null) return null;
    return { value: String(value), label: String(opt.label ?? opt.name ?? opt.value ?? value) };
  }
  return null;
}

function mapDefFields(fields) {
  return (fields || [])
    .filter((f) => f?.key)
    .map((f) => {
      const rawOpts = f.options || f.enum || f.picklistOptions || f.allowedValues || f.values || [];
      const options = Array.isArray(rawOpts) ? rawOpts.map(toOption).filter(Boolean) : [];
      const entryProbe = { dataType: f.dataType || f.type, type: f.type, options };
      return {
        key: f.key,
        label: f.label || f.key,
        options,
        valueInputType: inferValueInputType(entryProbe)
      };
    })
    .sort((a, b) => String(a.label).localeCompare(String(b.label)));
}

async function loadFields(moduleKey) {
  const key = resolveModuleKey(moduleKey);
  if (!key) {
    fieldOptions.value = [];
    return;
  }
  loading.value = true;
  try {
    const { fields } = await fetchWebformModuleDefinition(key);
    fieldOptions.value = mapDefFields(fields);
  } catch {
    fieldOptions.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadSourceFields(entityType) {
  const key = resolveModuleKey(entityType);
  if (!key) {
    sourceFieldOptions.value = [];
    return;
  }
  try {
    const { fields } = await fetchWebformModuleDefinition(key);
    sourceFieldOptions.value = mapDefFields(fields).map((f) => ({
      value: f.key,
      label: f.label || f.key,
      options: f.options || [],
      valueInputType: f.valueInputType || ''
    }));
  } catch {
    sourceFieldOptions.value = [];
  }
}

watch(() => props.moduleKey, (mk) => loadFields(mk), { immediate: true });
watch(() => props.sourceEntityType, (et) => loadSourceFields(et), { immediate: true });

function emitMap(nextRows) {
  const out = {};
  for (const row of nextRows) {
    if (!row.key) continue;
    const serialized = serializeRow(row);
    if (serialized) out[row.key] = serialized;
  }
  emit('update:modelValue', out);
}

function setRowKey(idx, key) {
  const next = rows.value.map((r) => ({ ...r }));
  next[idx] = { ...emptyRow(), key: key || '', mode: next[idx]?.mode || 'raw' };
  emitMap(next);
}

function onModeChange(idx, mode) {
  const next = rows.value.map((r) => ({ ...r }));
  const m = mode || 'raw';
  next[idx] = {
    ...next[idx],
    mode: m,
    value: m === 'raw' ? next[idx].value : '',
    source: m === 'copy' ? next[idx].source : '',
    expression: m === 'expression' ? next[idx].expression : ''
  };
  emitMap(next);
  if (m === 'expression') {
    openExpressionModal(idx);
  }
}

function setRowValue(idx, value) {
  const next = rows.value.map((r) => ({ ...r }));
  next[idx] = { ...next[idx], mode: 'raw', value };
  emitMap(next);
}

function setRowSource(idx, source) {
  const next = rows.value.map((r) => ({ ...r }));
  next[idx] = { ...next[idx], mode: 'copy', source: source || '' };
  emitMap(next);
}

function openExpressionModal(idx) {
  const row = rows.value[idx];
  if (!row) return;
  expressionModalIdx.value = idx;
  expressionModalDraft.value = row.expression || '';
  const meta = valueMeta(row.key);
  expressionModalFieldLabel.value = meta?.label
    ? `${meta.label} (${row.key})`
    : row.key;
  expressionTargetOptions.value = Array.isArray(meta?.options) ? meta.options : [];
  expressionTargetInputType.value = meta?.valueInputType || '';
  expressionModalOpen.value = true;
}

function onExpressionModalSave(expression) {
  const idx = expressionModalIdx.value;
  if (idx < 0) return;
  const next = rows.value.map((r) => ({ ...r }));
  next[idx] = { ...next[idx], mode: 'expression', expression: expression || '' };
  emitMap(next);
  expressionModalOpen.value = false;
}

function addRow() {
  emitMap([...rows.value, emptyRow()]);
}

function removeRow(idx) {
  const next = rows.value.filter((_, i) => i !== idx);
  emitMap(next.length ? next : [emptyRow()]);
}
</script>
