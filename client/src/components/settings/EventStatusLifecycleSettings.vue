<script setup lang="ts">
/**
 * Event Status Lifecycle Settings
 * System-owned categories (OPEN / DONE / CANCELLED).
 * Tenant-managed vocabulary for non-audit event types.
 */
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import type { EventStatusTypeConfig, EventStatusValue, StatusCategory } from '@/platform/events/eventStatus';
import { STATUS_CATEGORIES } from '@/platform/events/eventStatus';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';

const { t } = useI18n();

const loading = ref(true);
const saving = ref(false);
const loadError = ref('');
const saveError = ref('');
const saveOk = ref('');
const configs = ref<EventStatusTypeConfig[]>([]);
const selectedKey = ref('MEETING');
const draftValues = ref<EventStatusValue[]>([]);
const originalSnapshot = ref('');

const configurableConfigs = computed(() =>
  configs.value.filter((c) => c.configurable)
);

const auditConfigs = computed(() =>
  configs.value.filter((c) => c.isAudit)
);

const selectedConfig = computed(() =>
  configs.value.find((c) => c.eventTypeKey === selectedKey.value) || null
);

const dirty = computed(() => {
  if (!originalSnapshot.value) return false;
  return JSON.stringify(draftValues.value) !== originalSnapshot.value;
});

const valuesByCategory = computed(() => {
  const map: Record<StatusCategory, EventStatusValue[]> = {
    OPEN: [],
    DONE: [],
    CANCELLED: [],
  };
  for (const v of draftValues.value) {
    if (map[v.category]) map[v.category].push(v);
  }
  for (const cat of STATUS_CATEGORIES) {
    map[cat].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  return map;
});

function slugKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || `status_${Date.now()}`;
}

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    // apiClient returns parsed JSON body (not axios { data })
    const res = await apiClient.get('/settings/core-modules/events/status-lifecycle');
    const payload = res?.data ?? res;
    configs.value = Array.isArray(payload?.configs) ? payload.configs : [];
    if (!configs.value.find((c) => c.eventTypeKey === selectedKey.value)) {
      selectedKey.value = configurableConfigs.value[0]?.eventTypeKey || configs.value[0]?.eventTypeKey || 'MEETING';
    }
    loadSelectedIntoDraft();
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } }; message?: string };
    loadError.value = e?.response?.data?.message || e?.message || 'Failed to load';
    configs.value = [];
  } finally {
    loading.value = false;
  }
}

function loadSelectedIntoDraft() {
  const cfg = selectedConfig.value;
  draftValues.value = JSON.parse(JSON.stringify(cfg?.values || []));
  originalSnapshot.value = JSON.stringify(draftValues.value);
  saveError.value = '';
  saveOk.value = '';
}

watch(selectedKey, () => {
  if (dirty.value) {
    // Discard draft when switching types (simple model)
  }
  loadSelectedIntoDraft();
});

function addValue(category: StatusCategory) {
  const baseLabel = category === 'OPEN' ? 'New open' : category === 'DONE' ? 'New done' : 'New cancelled';
  let label = baseLabel;
  let n = 1;
  while (draftValues.value.some((v) => v.label.toLowerCase() === label.toLowerCase())) {
    n += 1;
    label = `${baseLabel} ${n}`;
  }
  let key = slugKey(label);
  while (draftValues.value.some((v) => v.key === key)) {
    key = `${key}_${n++}`;
  }
  draftValues.value.push({
    key,
    label,
    category,
    color: category === 'OPEN' ? '#3B82F6' : category === 'DONE' ? '#8B5CF6' : '#6B7280',
    order: (valuesByCategory.value[category].length + 1) * 10,
    isDefault: false,
    isSystem: false,
    archived: false,
  });
}

function setDefault(value: EventStatusValue) {
  draftValues.value = draftValues.value.map((v) =>
    v.category === value.category
      ? { ...v, isDefault: v.key === value.key }
      : v
  );
}

function archiveValue(value: EventStatusValue) {
  if (value.isSystem) return;
  const idx = draftValues.value.findIndex((v) => v.key === value.key);
  if (idx < 0) return;
  const current = draftValues.value[idx];
  if (!current) return;
  draftValues.value[idx] = { ...current, archived: true, isDefault: false };
  // Ensure category still has a default among active
  const active = draftValues.value.filter((v) => v.category === value.category && !v.archived);
  if (active.length && !active.some((v) => v.isDefault)) {
    const first = active[0];
    if (first) first.isDefault = true;
  }
}

function unarchiveValue(value: EventStatusValue) {
  const idx = draftValues.value.findIndex((v) => v.key === value.key);
  if (idx < 0) return;
  const current = draftValues.value[idx];
  if (!current) return;
  draftValues.value[idx] = { ...current, archived: false };
}

function updateLabel(value: EventStatusValue, label: string) {
  const idx = draftValues.value.findIndex((v) => v.key === value.key);
  if (idx < 0) return;
  const current = draftValues.value[idx];
  if (!current) return;
  draftValues.value[idx] = { ...current, label };
}

function updateColor(value: EventStatusValue, color: string) {
  const idx = draftValues.value.findIndex((v) => v.key === value.key);
  if (idx < 0) return;
  const current = draftValues.value[idx];
  if (!current) return;
  draftValues.value[idx] = { ...current, color };
}

function resetDraft() {
  loadSelectedIntoDraft();
}

async function save() {
  if (!selectedConfig.value?.configurable || !dirty.value) return;
  saving.value = true;
  saveError.value = '';
  saveOk.value = '';
  try {
    const res = await apiClient.put(
      `/settings/core-modules/events/status-lifecycle/${selectedKey.value}`,
      { values: draftValues.value }
    );
    const updated = res?.data ?? res;
    if (updated?.eventTypeKey || updated?.values) {
      const i = configs.value.findIndex((c) => c.eventTypeKey === selectedKey.value);
      if (i >= 0) configs.value[i] = updated as EventStatusTypeConfig;
      else configs.value.push(updated as EventStatusTypeConfig);
      loadSelectedIntoDraft();
    }
    saveOk.value = t('settings.modFieldsEventLifecycleSaved');
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } }; message?: string };
    saveError.value = e?.response?.data?.message || e?.message || 'Save failed';
  } finally {
    saving.value = false;
  }
}

function categoryLabel(cat: StatusCategory): string {
  if (cat === 'OPEN') return t('settings.modFieldsEventLifecycleCatOpen');
  if (cat === 'DONE') return t('settings.modFieldsEventLifecycleCatDone');
  return t('settings.modFieldsEventLifecycleCatCancelled');
}

onMounted(load);
</script>

<template>
  <div class="p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
    <div class="space-y-2">
      <p class="text-sm text-gray-500 dark:text-gray-400">
        {{ t('settings.modFieldsEventLifecycleDesc') }}
      </p>
      <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <p class="text-xs text-blue-800 dark:text-blue-400">
          <strong>{{ t('settings.modFieldsNoteLabel') }}</strong>
          {{ t('settings.modFieldsEventLifecycleNote') }}
        </p>
      </div>
    </div>

    <div v-if="loading" class="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
      {{ t('settings.modFieldsLoadingStatusValues') }}
    </div>
    <div v-else-if="loadError" class="text-sm text-red-600 dark:text-red-400">{{ loadError }}</div>

    <template v-else>
      <div
        v-if="!configs.length"
        class="text-sm text-amber-700 dark:text-amber-300 py-4"
      >
        {{ t('settings.modFieldsEventLifecycleEmpty') }}
      </div>

      <!-- Type selector -->
      <div v-if="configs.length" class="flex flex-wrap gap-2">
        <button
          v-for="cfg in configs"
          :key="cfg.eventTypeKey"
          type="button"
          class="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
          :class="
            selectedKey === cfg.eventTypeKey
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:border-indigo-400'
          "
          @click="selectedKey = cfg.eventTypeKey"
        >
          {{ cfg.label }}
          <span
            v-if="!cfg.configurable"
            class="ml-1 opacity-70"
          >· {{ t('settings.modFieldsSystemLocked') }}</span>
        </button>
      </div>

      <!-- Read-only audit types -->
      <div
        v-if="selectedConfig && !selectedConfig.configurable"
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4"
      >
        <p class="text-sm text-amber-800 dark:text-amber-300">
          {{ t('settings.modFieldsEventLifecycleAuditLocked') }}
        </p>
        <div v-for="cat in STATUS_CATEGORIES" :key="cat" class="space-y-2">
          <h5 class="text-xs font-semibold uppercase tracking-wide text-gray-500">{{ categoryLabel(cat) }}</h5>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="v in (valuesByCategory[cat] || []).filter((x) => !x.archived)"
              :key="v.key"
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white"
              :style="{ backgroundColor: v.color || '#6B7280' }"
            >
              {{ v.label }}
            </span>
          </div>
        </div>
      </div>

      <!-- Editable non-audit -->
      <div
        v-else-if="selectedConfig"
        class="space-y-6"
      >
        <div
          v-for="cat in STATUS_CATEGORIES"
          :key="cat"
          class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5"
        >
          <div class="flex items-center justify-between mb-3">
            <div>
              <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ categoryLabel(cat) }}</h4>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {{ t('settings.modFieldsEventLifecycleCategoryHint') }}
              </p>
            </div>
            <button
              type="button"
              class="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
              @click="addValue(cat)"
            >
              {{ t('settings.modFieldsEventLifecycleAddStatus') }}
            </button>
          </div>

          <div class="space-y-2">
            <div
              v-for="v in valuesByCategory[cat]"
              :key="v.key"
              class="flex flex-wrap items-center gap-3 p-3 rounded-lg"
              :class="v.archived ? 'bg-gray-100/80 dark:bg-gray-900/40 opacity-60' : 'bg-gray-50 dark:bg-gray-700/50'"
            >
              <input
                type="color"
                :value="v.color || '#6366F1'"
                class="w-8 h-8 rounded border border-gray-200 dark:border-gray-600 cursor-pointer bg-transparent"
                :disabled="false"
                @input="updateColor(v, ($event.target as HTMLInputElement).value)"
              >
              <input
                type="text"
                :value="v.label"
                class="flex-1 min-w-[8rem] px-2 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                @input="updateLabel(v, ($event.target as HTMLInputElement).value)"
              >
              <span
                v-if="v.isSystem"
                class="px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded"
              >{{ t('settings.modFieldsSystemLocked') }}</span>
              <label class="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                <HeadlessCheckbox
                  :checked="!!v.isDefault && !v.archived"
                  :disabled="!!v.archived"
                  @change="setDefault(v)"
                />
                {{ t('settings.modFieldsEventLifecycleDefault') }}
              </label>
              <button
                v-if="!v.isSystem && !v.archived"
                type="button"
                class="text-xs text-gray-500 hover:text-red-600"
                @click="archiveValue(v)"
              >
                {{ t('settings.modFieldsEventLifecycleArchive') }}
              </button>
              <button
                v-if="!v.isSystem && v.archived"
                type="button"
                class="text-xs text-indigo-600 hover:text-indigo-700"
                @click="unarchiveValue(v)"
              >
                {{ t('settings.modFieldsEventLifecycleRestore') }}
              </button>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button
            type="button"
            class="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg"
            :disabled="!dirty || saving"
            @click="save"
          >
            {{ saving ? t('states.saving') : t('actions.save') }}
          </button>
          <button
            type="button"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
            :disabled="!dirty || saving"
            @click="resetDraft"
          >
            {{ t('actions.reset') }}
          </button>
          <span v-if="saveOk" class="text-sm text-emerald-600 dark:text-emerald-400">{{ saveOk }}</span>
          <span v-if="saveError" class="text-sm text-red-600 dark:text-red-400">{{ saveError }}</span>
        </div>
      </div>

      <!-- Audit types summary (sidebar list) -->
      <div v-if="auditConfigs.length" class="text-xs text-gray-500 dark:text-gray-400">
        {{ t('settings.modFieldsEventLifecycleAuditSummary', { count: auditConfigs.length }) }}
      </div>
    </template>
  </div>
</template>
