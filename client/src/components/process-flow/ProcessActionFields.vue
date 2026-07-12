<template>
  <div class="space-y-3">
    <div v-for="field in visibleFields" :key="field.key">
      <template v-if="field.type === 'field_map'">
        <template v-if="resolvedModuleKeyForMap(field)">
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ field.label }}
            <span v-if="field.required" class="text-red-500">*</span>
          </label>
          <ProcessActionFieldMap
            :model-value="params[field.key] && typeof params[field.key] === 'object' ? params[field.key] : {}"
            :module-key="resolvedModuleKeyForMap(field)"
            :source-entity-type="processEntityType"
            @update:model-value="(v) => setParam(field.key, v)"
          />
          <p v-if="field.hint" class="mt-0.5 text-[10px] text-gray-500">{{ field.hint }}</p>
        </template>
      </template>

      <template v-else-if="field.type === 'condition_group'">
        <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          {{ field.label }}
          <span v-if="field.required" class="text-red-500">*</span>
        </label>
        <p v-if="!params.moduleKey" class="text-[11px] text-amber-700 dark:text-amber-400">
          {{ t('process.inspectorSelectModuleFirst') }}
        </p>
        <ProcessConditionGroupEditor
          v-else
          :group="filterGroupValue(field.key)"
          :field-options="fetchFieldOptions"
          :module-field-meta="fetchFieldMeta"
          :condition-fields-loading="fetchFieldsLoading"
          :entity-type="params.moduleKey || ''"
          field-path-mode="plain"
          @update:group="(g) => setParam(field.key, g)"
        />
        <p v-if="field.hint" class="mt-0.5 text-[10px] text-gray-500">{{ field.hint }}</p>
      </template>

      <template v-else>
        <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          {{ field.label }}
          <span v-if="field.required" class="text-red-500">*</span>
        </label>
        <HeadlessSelect
          v-if="field.type === 'select'"
          :model-value="params[field.key] ?? field.defaultValue ?? ''"
          :options="localizedSelectOptions(field)"
          :button-class="PROCESS_SELECT_BUTTON_CLASS"
          @update:model-value="(v) => setParam(field.key, v)"
        />
        <HeadlessSelect
          v-else-if="field.type === 'email_template'"
          :model-value="params[field.key] ?? ''"
          :options="emailTemplateOptions"
          allow-empty
          :empty-label="t('process.inspectorSelectEmailTemplate')"
          :button-class="PROCESS_SELECT_BUTTON_CLASS"
          :disabled="emailTemplatesLoading"
          @update:model-value="(v) => setParam(field.key, v)"
        />
        <HeadlessSelect
          v-else-if="field.type === 'module'"
          :model-value="params[field.key] ?? ''"
          :options="moduleOptions"
          allow-empty
          :empty-label="t('process.inspectorSelectModule')"
          :button-class="PROCESS_SELECT_BUTTON_CLASS"
          @update:model-value="(v) => onModuleChange(field.key, v)"
        />
        <textarea
          v-else-if="field.type === 'textarea'"
          :value="params[field.key] ?? ''"
          rows="2"
          :placeholder="field.placeholder"
          class="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
          @input="setParam(field.key, $event.target.value)"
        />
        <input
          v-else-if="field.type === 'number'"
          :value="params[field.key] ?? ''"
          type="number"
          min="1"
          :placeholder="field.placeholder"
          class="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
          @input="setParam(field.key, $event.target.value === '' ? null : Number($event.target.value))"
        />
        <input
          v-else
          :value="params[field.key] ?? ''"
          type="text"
          :placeholder="field.placeholder"
          class="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
          @input="setParam(field.key, $event.target.value)"
        />
        <p v-if="field.hint" class="mt-0.5 text-[10px] text-gray-500">{{ field.hint }}</p>
      </template>
    </div>
    <p v-if="actionDef?.description" class="text-[10px] text-gray-500 leading-snug">{{ actionDef.description }}</p>
    <p
      v-if="actionDef && actionDef.available === false"
      class="text-[10px] text-amber-700 dark:text-amber-400"
    >
      {{ t('process.inspectorActionComingSoon') }}
    </p>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import ProcessActionFieldMap from '@/components/process-flow/ProcessActionFieldMap.vue';
import ProcessConditionGroupEditor from '@/components/process-flow/ProcessConditionGroupEditor.vue';
import {
  PROCESS_SELECT_BUTTON_CLASS,
  getModuleOptions,
  loadProcessScopeFromRegistry,
  normalizeProcessConditionGroup,
  ENTITY_TYPE_TO_MODULE_KEY
} from '@/utils/processDesignerConstants';
import { fetchWebformModuleDefinition } from '@/utils/webformModuleDefinition';
import { inferValueInputType } from '@/composables/useProcessModuleFields';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  actionDef: { type: Object, default: null },
  params: { type: Object, default: () => ({}) },
  /** Process entityType — used when update_record target is current and moduleKey empty */
  processEntityType: { type: String, default: '' }
});

const emit = defineEmits(['update:params']);

const { t } = useI18n();

const moduleOptions = ref(getModuleOptions(t));
const fetchFieldMeta = ref({});
const fetchFieldsLoading = ref(false);
const emailTemplateOptions = ref([]);
const emailTemplatesLoading = ref(false);

onMounted(async () => {
  try {
    await loadProcessScopeFromRegistry(t);
    moduleOptions.value = getModuleOptions(t);
  } catch {
    /* keep fallback */
  }
  if ((props.actionDef?.params || []).some((f) => f.type === 'email_template')) {
    loadEmailTemplates();
  }
});

watch(
  () => props.actionDef?.actionType,
  (actionType) => {
    if (actionType === 'send_email') loadEmailTemplates();
  }
);

const visibleFields = computed(() => {
  const fields = props.actionDef?.params || [];
  return fields.filter((field) => {
    if (!field.showWhen) return true;
    let current = props.params?.[field.showWhen.key];
    if (current == null || current === '') {
      if (field.showWhen.key === 'target') current = 'current';
      else if (field.showWhen.key === 'bodyMode') current = 'custom';
      else if (field.showWhen.key === 'limitMode') current = 'count';
    }
    return current === field.showWhen.equals;
  });
});

const fetchFieldOptions = computed(() =>
  Object.values(fetchFieldMeta.value || {})
    .filter((m) => m?.key)
    .map((m) => ({ value: m.key, label: m.label || m.key }))
    .sort((a, b) => String(a.label).localeCompare(String(b.label)))
);

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

async function loadFetchFields(moduleKey) {
  const key = ENTITY_TYPE_TO_MODULE_KEY[moduleKey] || moduleKey;
  if (!key) {
    fetchFieldMeta.value = {};
    return;
  }
  fetchFieldsLoading.value = true;
  try {
    const { fields } = await fetchWebformModuleDefinition(key);
    const map = {};
    for (const f of fields || []) {
      if (!f?.key) continue;
      const rawOpts = f.options || f.enum || f.picklistOptions || f.allowedValues || f.values || [];
      const options = Array.isArray(rawOpts) ? rawOpts.map(toOption).filter(Boolean) : [];
      const entryProbe = { dataType: f.dataType || f.type, type: f.type, options };
      map[f.key] = {
        key: f.key,
        label: f.label || f.key,
        dataType: f.dataType || f.type || 'Text',
        options,
        valueInputType: inferValueInputType(entryProbe)
      };
    }
    fetchFieldMeta.value = map;
  } catch {
    fetchFieldMeta.value = {};
  } finally {
    fetchFieldsLoading.value = false;
  }
}

watch(
  () => props.params?.moduleKey,
  (mk) => {
    if (props.actionDef?.actionType === 'fetch_records') {
      loadFetchFields(mk);
    }
  },
  { immediate: true }
);

function localizedSelectOptions(field) {
  if (field.key === 'limitMode') {
    return [
      { value: 'all', label: t('process.fetchLimitAll') },
      { value: 'count', label: t('process.fetchLimitCount') }
    ];
  }
  if (field.key === 'bodyMode') {
    return [
      { value: 'custom', label: t('process.emailBodyModeCustom') },
      { value: 'template', label: t('process.emailBodyModeTemplate') }
    ];
  }
  return field.options || [];
}

async function loadEmailTemplates() {
  if (emailTemplatesLoading.value) return;
  emailTemplatesLoading.value = true;
  try {
    const res = await apiClient.get('/templates', {
      params: { outputFormat: 'email', limit: 100 },
      cache: 'no-store'
    });
    const list = Array.isArray(res?.data) ? res.data : [];
    emailTemplateOptions.value = list
      .map((tpl) => {
        const id = tpl?._id || tpl?.id;
        if (!id) return null;
        return {
          value: String(id),
          label: String(tpl.name || tpl.title || id)
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.label.localeCompare(b.label));
  } catch {
    emailTemplateOptions.value = [];
  } finally {
    emailTemplatesLoading.value = false;
  }
}

function filterGroupValue(key) {
  const raw = props.params?.[key];
  if (raw && typeof raw === 'object') return normalizeProcessConditionGroup(raw);
  return normalizeProcessConditionGroup({});
}

function resolvedModuleKeyForMap(field) {
  const depends = field.dependsOn || 'moduleKey';
  const fromParams = props.params?.[depends];
  if (fromParams) return String(fromParams);
  const actionType = props.actionDef?.actionType || '';
  const target = props.params?.target || 'current';
  if (
    (actionType === 'update_record' || actionType === 'delete_record') &&
    target === 'current'
  ) {
    return props.processEntityType || '';
  }
  return '';
}

function setParam(key, value) {
  const next = { ...props.params, [key]: value };
  if (key === 'target' && value === 'current') {
    next.moduleKey = '';
    next.recordId = '';
    next.fieldValues = {};
  }
  if (key === 'target' && value === 'related') {
    next.fieldValues = {};
  }
  if (key === 'limitMode' && value === 'all') {
    next.limit = null;
  }
  if (key === 'limitMode' && value === 'count' && (next.limit == null || next.limit === '')) {
    next.limit = 50;
  }
  emit('update:params', next);
}

function onModuleChange(key, value) {
  const next = { ...props.params, [key]: value };
  if (key === 'moduleKey') {
    next.fieldValues = {};
    next.filterGroup = normalizeProcessConditionGroup({});
  }
  emit('update:params', next);
}
</script>
