<template>
  <section class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
    <div class="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
        {{ t('templates.htmlImport.orgMappingsTitle') }}
      </h2>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        {{ t('templates.htmlImport.orgMappingsDescription') }}
      </p>
    </div>

    <div v-if="loadError" class="px-6 py-4 text-sm text-red-600 dark:text-red-400">
      {{ loadError }}
    </div>

    <div v-else-if="loading" class="flex justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
    </div>

    <div v-else class="px-6 py-5 space-y-4">
      <p v-if="!rows.length" class="text-sm text-gray-600 dark:text-gray-400">
        {{ t('templates.htmlImport.orgMappingsEmpty') }}
      </p>

      <div v-else class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
          <thead class="bg-gray-50 dark:bg-gray-800/80">
            <tr>
              <th scope="col" class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                {{ t('templates.htmlImport.mergeDetected') }}
              </th>
              <th scope="col" class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                {{ t('templates.htmlImport.mergeMapTo') }}
              </th>
              <th scope="col" class="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">
                {{ t('templates.htmlImport.orgMappingsActions') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
            <tr v-for="row in rows" :key="row.id">
              <td class="px-3 py-2 align-top">
                <input
                  v-model="row.raw"
                  type="text"
                  class="w-full min-w-[160px] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 font-mono text-xs"
                  :placeholder="t('templates.htmlImport.orgMappingsTagPlaceholder')"
                  :disabled="!canEdit"
                />
              </td>
              <td class="px-3 py-2 align-top">
                <div class="flex flex-wrap items-center gap-2">
                  <label class="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                    <input
                      v-model="row.skip"
                      type="checkbox"
                      class="rounded border-gray-300 dark:border-gray-600"
                      :disabled="!canEdit"
                      @change="onSkipChange(row)"
                    />
                    {{ t('templates.htmlImport.mergeSkip') }}
                  </label>
                  <template v-if="!row.skip">
                    <select
                      v-model="row.moduleKey"
                      class="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs"
                      :disabled="!canEdit"
                      @change="onModuleChange(row)"
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
                      v-model="row.path"
                      class="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs"
                      :disabled="!canEdit || !row.moduleKey || row.fieldsLoading"
                    >
                      <option value="">{{ t('templates.htmlImport.mergeSelectField') }}</option>
                      <option
                        v-for="field in fieldsForRow(row)"
                        :key="field.path"
                        :value="field.path"
                      >
                        {{ field.label }}
                      </option>
                    </select>
                  </template>
                </div>
              </td>
              <td class="px-3 py-2 align-top text-right">
                <button
                  type="button"
                  class="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                  :disabled="!canEdit"
                  @click="removeRow(row.id)"
                >
                  {{ t('actions.delete') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          :disabled="!canEdit || saving"
          @click="addRow"
        >
          {{ t('templates.htmlImport.orgMappingsAdd') }}
        </button>

        <div class="flex gap-2">
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            :disabled="saving || !hasChanges || !canEdit"
            @click="resetRows"
          >
            {{ t('actions.reset') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            :disabled="saving || !hasChanges || !canEdit"
            @click="save"
          >
            {{ saving ? t('states.saving') : t('actions.save') }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotifications } from '@/composables/useNotifications';
import { useTemplateModuleOptions } from '@/composables/useTemplateMergeTagSchema';
import {
  fetchModuleDefinition,
  humanizeFieldKey,
  isMergeTagEligibleField,
  resolveMergeTagModuleAlias,
  resolveMergeTagModuleKeyFromPath
} from '@/utils/templateMergeTagSchema';
import { useOrgMergeMappings } from '../../composables/useOrgMergeMappings';

const { t } = useI18n();
const authStore = useAuthStore();
const notifications = useNotifications();
const { moduleOptions, loadModuleOptions } = useTemplateModuleOptions();
const { loading, saving, loadOrgMappings, replaceMappings } = useOrgMergeMappings();

const loadError = ref(null);
const rows = ref([]);
const savedSnapshot = ref('');

const fieldsByModule = reactive({});

const canEdit = computed(() => authStore.can('templates', 'edit'));

const hasChanges = computed(() => JSON.stringify(rowsToRecord(rows.value)) !== savedSnapshot.value);

function createRowId() {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function rowsToRecord(sourceRows) {
  const output = {};
  for (const row of sourceRows) {
    const raw = String(row.raw || '').trim();
    if (!raw) continue;
    if (row.skip) {
      output[raw] = { skip: true };
      continue;
    }
    const path = String(row.path || '').trim();
    if (path) {
      output[raw] = { path, skip: false };
    }
  }
  return output;
}

function recordToRows(record) {
  return Object.entries(record || {}).map(([raw, mapping]) => ({
    id: createRowId(),
    raw,
    skip: Boolean(mapping?.skip),
    moduleKey: mapping?.path ? (resolveMergeTagModuleKeyFromPath(mapping.path) || '') : '',
    path: mapping?.skip ? '' : String(mapping?.path || ''),
    fieldsLoading: false
  }));
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

function fieldsForRow(row) {
  const moduleKey = String(row.moduleKey || '').trim().toLowerCase();
  return fieldsByModule[moduleKey] || [];
}

async function preloadModuleFieldsForRows(sourceRows) {
  const moduleKeys = new Set(
    sourceRows
      .map((row) => row.moduleKey)
      .filter(Boolean)
  );
  await Promise.all([...moduleKeys].map((key) => ensureModuleFields(key)));
}

function addRow() {
  rows.value = [
    ...rows.value,
    {
      id: createRowId(),
      raw: '',
      skip: false,
      moduleKey: '',
      path: '',
      fieldsLoading: false
    }
  ];
}

function removeRow(id) {
  rows.value = rows.value.filter((row) => row.id !== id);
}

function onSkipChange(row) {
  if (row.skip) {
    row.path = '';
    row.moduleKey = '';
  }
}

async function onModuleChange(row) {
  row.path = '';
  if (!row.moduleKey) return;
  row.fieldsLoading = true;
  try {
    await ensureModuleFields(row.moduleKey);
  } finally {
    row.fieldsLoading = false;
  }
}

function resetRows() {
  rows.value = recordToRows(JSON.parse(savedSnapshot.value || '{}'));
  void preloadModuleFieldsForRows(rows.value);
}

async function load() {
  loadError.value = null;
  try {
    await loadModuleOptions();
    const mappings = await loadOrgMappings();
    rows.value = recordToRows(mappings);
    savedSnapshot.value = JSON.stringify(mappings);
    await preloadModuleFieldsForRows(rows.value);
  } catch (error) {
    loadError.value = error?.message || t('templates.htmlImport.orgMappingsLoadFailed');
  }
}

async function save() {
  const record = rowsToRecord(rows.value);
  const rawKeys = rows.value.map((row) => String(row.raw || '').trim()).filter(Boolean);
  const uniqueKeys = new Set(rawKeys);
  if (rawKeys.length !== uniqueKeys.size) {
    notifications.error(t('templates.htmlImport.orgMappingsDuplicateTag'));
    return;
  }

  for (const row of rows.value) {
    const raw = String(row.raw || '').trim();
    if (!raw) continue;
    if (!row.skip && !String(row.path || '').trim()) {
      notifications.error(t('templates.htmlImport.orgMappingsIncompleteRow', { tag: raw }));
      return;
    }
  }

  try {
    const saved = await replaceMappings(record);
    savedSnapshot.value = JSON.stringify(saved);
    rows.value = recordToRows(saved);
    await preloadModuleFieldsForRows(rows.value);
    notifications.success(t('templates.htmlImport.orgMappingsSaved'));
  } catch (error) {
    notifications.error(error?.message || t('templates.htmlImport.orgMappingsSaveFailed'));
  }
}

onMounted(load);
</script>
