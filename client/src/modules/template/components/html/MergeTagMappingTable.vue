<template>
  <section class="space-y-3">
    <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {{ t('templates.htmlImport.mergeMappingTitle', { count: tags.length }) }}
    </h3>

    <p v-if="!tags.length" class="text-sm text-gray-600 dark:text-gray-400">
      {{ t('templates.htmlImport.mergeMappingEmpty') }}
    </p>

    <div v-else class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
        <thead class="bg-gray-50 dark:bg-gray-800/80">
          <tr>
            <th scope="col" class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
              {{ t('templates.htmlImport.mergeDetected') }}
            </th>
            <th scope="col" class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
              {{ t('templates.htmlImport.mergeMapTo') }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
          <tr v-for="tag in tags" :key="tag.raw">
            <td class="px-3 py-2 font-mono text-xs text-gray-800 dark:text-gray-200">
              {{ tag.raw }}
            </td>
            <td class="px-3 py-2">
              <div class="flex flex-wrap items-center gap-2">
                <label class="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                  <input
                    type="checkbox"
                    class="rounded border-gray-300 dark:border-gray-600"
                    :checked="Boolean(localMappings[tag.raw]?.skip)"
                    @change="toggleSkip(tag.raw, $event.target.checked)"
                  />
                  {{ t('templates.htmlImport.mergeSkip') }}
                </label>
                <template v-if="!localMappings[tag.raw]?.skip">
                  <select
                    class="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs"
                    :value="rowModule(tag.raw)"
                    @change="onModuleChange(tag.raw, $event.target.value)"
                  >
                    <option value="">{{ t('templates.htmlImport.mergeSelectModule') }}</option>
                    <option
                      v-for="module in moduleOptions"
                      :key="module.key"
                      :value="module.key"
                    >
                      {{ module.label }}
                    </option>
                  </select>
                  <select
                    class="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs"
                    :disabled="!rowModule(tag.raw) || fieldsLoading[tag.raw]"
                    :value="rowField(tag.raw)"
                    @change="onFieldChange(tag.raw, rowModule(tag.raw), $event.target.value)"
                  >
                    <option value="">{{ t('templates.htmlImport.mergeSelectField') }}</option>
                    <option
                      v-for="field in fieldsForTag(tag.raw)"
                      :key="field.path"
                      :value="field.path"
                    >
                      {{ field.label }}
                    </option>
                  </select>
                </template>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  fetchModuleDefinition,
  humanizeFieldKey,
  isMergeTagEligibleField,
  resolveMergeTagModuleAlias,
  resolveMergeTagModuleKeyFromPath
} from '@/utils/templateMergeTagSchema';

const props = defineProps({
  tags: { type: Array, default: () => [] },
  mappings: { type: Object, default: () => ({}) },
  moduleOptions: { type: Array, default: () => [] }
});

const emit = defineEmits(['update:mappings']);

const { t } = useI18n();

const localMappings = reactive({ ...props.mappings });
const rowModules = reactive({});
const fieldsByModule = reactive({});
const fieldsLoading = reactive({});

watch(
  () => props.mappings,
  (next) => {
    Object.assign(localMappings, next || {});
    void syncRowModulesFromMappings(next || {});
  },
  { deep: true, immediate: true }
);

async function syncRowModulesFromMappings(mappings) {
  for (const [raw, mapping] of Object.entries(mappings || {})) {
    if (!mapping?.path || mapping.skip) continue;
    const moduleKey = resolveMergeTagModuleKeyFromPath(mapping.path);
    if (!moduleKey) continue;
    rowModules[raw] = moduleKey;
    fieldsLoading[raw] = true;
    try {
      await ensureModuleFields(moduleKey);
    } finally {
      fieldsLoading[raw] = false;
    }
  }
}

function rowModule(raw) {
  return rowModules[raw] || '';
}

function rowField(raw) {
  return localMappings[raw]?.path || '';
}

function fieldsForTag(raw) {
  const moduleKey = rowModule(raw);
  return fieldsByModule[moduleKey] || [];
}

async function ensureModuleFields(moduleKey) {
  const key = String(moduleKey || '').trim().toLowerCase();
  if (!key || fieldsByModule[key]) return;
  const definition = await fetchModuleDefinition(key);
  const alias = resolveMergeTagModuleAlias(key);
  fieldsByModule[key] = (definition?.fields || [])
    .filter((field) => isMergeTagEligibleField(field, key))
    .map((field) => ({
      path: `${alias}.${field.key}`,
      label: field.label || field.displayName || humanizeFieldKey(field.key)
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function emitMappings() {
  emit('update:mappings', { ...localMappings });
}

function toggleSkip(raw, skip) {
  localMappings[raw] = skip ? { skip: true } : { skip: false };
  emitMappings();
}

async function onModuleChange(raw, moduleKey) {
  rowModules[raw] = moduleKey;
  fieldsLoading[raw] = true;
  try {
    await ensureModuleFields(moduleKey);
    localMappings[raw] = { skip: false };
    emitMappings();
  } finally {
    fieldsLoading[raw] = false;
  }
}

function onFieldChange(raw, moduleKey, path) {
  if (!path) {
    localMappings[raw] = { skip: false };
  } else {
    localMappings[raw] = { path, skip: false };
  }
  rowModules[raw] = moduleKey;
  emitMappings();
}
</script>
