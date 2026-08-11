<template>
  <div class="process-setup flex h-full min-h-0 flex-col bg-gray-50 dark:bg-gray-900">
    <header class="shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
      <button
        type="button"
        class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        @click="goBack"
      >
        {{ t('process.setupBackToProcesses') }}
      </button>
    </header>

    <div class="flex-1 min-h-0 overflow-hidden flex items-stretch justify-center p-4 sm:p-6">
      <div class="w-full flex flex-col min-h-0 max-h-full relative max-w-lg">
        <div class="shrink-0 mb-4 text-center sm:mb-6">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('process.setupTitle') }}</h1>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
            {{ t('process.setupDescription') }}
          </p>
        </div>

        <form
          class="flex min-h-0 flex-1 flex-col overflow-hidden relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
          @submit.prevent="onSubmit"
        >
          <div class="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ t('process.setupProcessName') }}
              </label>
              <input
                v-model="form.name"
                type="text"
                :placeholder="t('process.setupProcessNamePh')"
                class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
              />
            </div>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {{ t('process.setupApp') }} <span class="text-red-500">*</span>
                </label>
                <HeadlessSelect
                  v-model="form.appKey"
                  :options="appOptions"
                  allow-empty
                  :empty-label="t('process.setupSelectApp')"
                  :placeholder="t('process.setupSelectApp')"
                  :button-class="SELECT_CLASS"
                  @update:model-value="onAppChange"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {{ t('process.setupModule') }} <span class="text-red-500">*</span>
                </label>
                <HeadlessSelect
                  v-model="form.entityType"
                  :options="moduleOptions"
                  allow-empty
                  :empty-label="modulePlaceholder"
                  :placeholder="modulePlaceholder"
                  :disabled="!form.appKey"
                  :button-class="SELECT_CLASS"
                  @update:model-value="onModuleChange"
                />
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ t('process.setupModuleHint') }}</p>
              </div>

              <div class="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/20 p-4 space-y-3">
                <div>
                  <span class="text-[10px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                    {{ t('process.setupStep1') }}
                  </span>
                  <label class="block text-sm font-medium text-gray-900 dark:text-white mt-1">
                    {{ t('process.setupStartsWhen') }} <span class="text-red-500">*</span>
                  </label>
                  <HeadlessSelect
                    v-model="form.coreTrigger"
                    :options="coreTriggerOptionsList"
                    allow-empty
                    :empty-label="startsWhenPlaceholder"
                    :placeholder="startsWhenPlaceholder"
                    :disabled="!form.entityType"
                    :button-class="SELECT_CLASS"
                  />
                  <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">{{ startsWhenHint }}</p>
                </div>

                <div v-if="(form.coreTrigger === 'record_updated' || form.coreTrigger === 'record_created_or_updated') && form.entityType">
                  <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {{ t('process.setupWatchChanges') }}
                  </label>
                  <HeadlessSelect
                    v-model="form.updateWatchField"
                    :options="watchFieldOptions"
                    :button-class="SELECT_CLASS"
                  />
                </div>

                <div v-if="form.coreTrigger === 'schedule'" class="space-y-2">
                  <label class="block text-xs font-medium text-gray-700 dark:text-gray-300">
                    {{ t('process.setupFrequency') }}
                  </label>
                  <HeadlessSelect
                    v-model="form.schedule.preset"
                    :options="schedulePresetOptions"
                    :button-class="SELECT_CLASS"
                  />
                </div>

                <p v-if="form.coreTrigger === 'webhook'" class="text-xs text-amber-700 dark:text-amber-300">
                  {{ t('process.setupWebhookNote') }}
                </p>
              </div>

              <div v-if="triggerBehaviourApplies(form.coreTrigger)">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {{ t('process.setupTriggerBehaviour') }} <span class="text-red-500">*</span>
                </label>
                <HeadlessSelect
                  v-model="form.triggerBehaviour"
                  :options="triggerBehaviourOptions"
                  :button-class="SELECT_CLASS"
                />
              </div>

              <div class="flex items-start justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-3">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-gray-900 dark:text-white">
                    {{ t('process.setupIncludeClosedRecords') }}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {{ t('process.setupIncludeClosedRecordsHint') }}
                  </p>
                </div>
                <HeadlessSwitch v-model="form.includeClosedRecords" />
              </div>

              <div class="rounded-lg bg-gray-50 dark:bg-gray-900/50 px-3 py-2">
                <p class="text-[10px] font-semibold uppercase text-gray-500 mb-1">{{ t('process.setupSummary') }}</p>
                <p class="text-sm text-gray-800 dark:text-gray-200">{{ scopeSummary }}</p>
              </div>
            </div>

            <p v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
          </div>

          <div class="shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-4 flex gap-3">
            <button
              type="button"
              class="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              :disabled="saving"
              @click="goBack"
            >
              {{ t('actions.cancel') }}
            </button>
            <button
              type="submit"
              :disabled="!canContinue || saving"
              class="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl disabled:opacity-50 transition-all text-white bg-indigo-600 hover:bg-indigo-700"
            >
              {{ submitLabel }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import HeadlessSwitch from '@/components/ui/HeadlessSwitch.vue';
import {
  getAppOptions,
  getModuleOptions,
  loadProcessScopeFromRegistry,
  coreTriggerOptions,
  getSchedulePresetOptions,
  getScheduleDayOfWeekOptions,
  getScheduleHour12Options,
  getSchedulePeriodOptions,
  toScheduleHour12,
  toScheduleHour24,
  getTriggerBehaviourOptions,
  triggerBehaviourApplies,
  resolveTriggerBehaviourForSave,
  getCoreTriggerDescription,
  PROCESS_SELECT_BUTTON_CLASS,
  updateWatchFieldOptions,
  buildTriggerFromCore,
  buildProcessScopeSentence
} from '@/utils/processDesignerConstants';
import { isProcessDesignerTabPath } from '@/utils/navigationLabels';
import { useTabs } from '@/composables/useTabs';

import { useNotifications } from '@/composables/useNotifications';
const { t } = useI18n();
const notifications = useNotifications();

const router = useRouter();
const route = useRoute();
const { activeTabId, updateTabTitle, findTabById } = useTabs();
const SELECT_CLASS = PROCESS_SELECT_BUTTON_CLASS;
const saving = ref(false);
const error = ref(null);
const registryAppOptions = ref([]);
const registryModulesByApp = ref({});

const form = ref({
  name: '',
  appKey: '',
  entityType: '',
  coreTrigger: '',
  triggerBehaviour: 'every_time',
  includeClosedRecords: false,
  updateWatchField: '__any__',
  schedule: { preset: 'daily', hour: 9, minute: 0, dayOfWeek: 1, dayOfMonth: 1, timezone: 'UTC' }
});

/** When set, Continue POSTs a draft with this process's graph (duplicate-as-create). */
const sourceProcess = ref(null);

const appOptions = computed(() =>
  registryAppOptions.value.length ? registryAppOptions.value : getAppOptions(t)
);
const moduleOptions = computed(() => {
  const key = String(form.value.appKey || '').toUpperCase();
  if (key && registryModulesByApp.value[key]) return registryModulesByApp.value[key];
  return getModuleOptions(t, form.value.appKey);
});
const coreTriggerOptionsList = computed(() => coreTriggerOptions(t));
const schedulePresetOptions = computed(() => getSchedulePresetOptions(t));
const scheduleDayOfWeekOptions = computed(() => getScheduleDayOfWeekOptions(t));
const scheduleHour12Options = computed(() => getScheduleHour12Options());
const schedulePeriodOptions = computed(() => getSchedulePeriodOptions(t));
const triggerBehaviourOptions = computed(() => getTriggerBehaviourOptions(t));
const watchFieldOptions = computed(() => updateWatchFieldOptions(form.value.entityType, t));

const scheduleHour12 = computed({
  get: () => toScheduleHour12(form.value.schedule.hour),
  set: (hour12) => {
    form.value.schedule.hour = toScheduleHour24(hour12, schedulePeriod.value);
  }
});

const schedulePeriod = computed({
  get: () => (Number(form.value.schedule.hour) >= 12 ? 'PM' : 'AM'),
  set: (period) => {
    form.value.schedule.hour = toScheduleHour24(scheduleHour12.value, period);
  }
});

const modulePlaceholder = computed(() => {
  if (!form.value.appKey) return t('process.setupSelectAppFirst');
  return t('process.setupSelectModule');
});

const startsWhenPlaceholder = computed(() => {
  if (!form.value.entityType) return t('process.setupSelectModuleFirst');
  return t('process.setupChooseTrigger');
});

const startsWhenHint = computed(() => {
  if (!form.value.entityType) return t('process.setupPickModuleForTrigger');
  return getCoreTriggerDescription(t, form.value.coreTrigger);
});

const scopeSummary = computed(() =>
  buildProcessScopeSentence(
    {
      appKey: form.value.appKey,
      entityType: form.value.entityType,
      coreTrigger: form.value.coreTrigger,
      trigger: buildTriggerFromCore(form.value.coreTrigger, form.value.entityType, {
        updateWatchField: form.value.updateWatchField,
        schedule: form.value.schedule
      })
    },
    t
  )
);

const canContinue = computed(() => {
  if (sourceProcess.value) {
    return !!(form.value.appKey && form.value.entityType && form.value.name.trim());
  }
  return !!(
    form.value.appKey &&
    form.value.entityType &&
    form.value.coreTrigger &&
    (!triggerBehaviourApplies(form.value.coreTrigger) || form.value.triggerBehaviour)
  );
});

const submitLabel = computed(() =>
  saving.value ? t('process.setupCreating') : t('process.setupContinue')
);

function onAppChange() {
  form.value.entityType = '';
  form.value.coreTrigger = '';
}

function onModuleChange() {
  if (!form.value.entityType) {
    form.value.coreTrigger = '';
  }
}

function buildPayload() {
  if (sourceProcess.value) {
    const src = sourceProcess.value;
    const trigger = { ...(src.trigger || {}) };
    if (trigger.type === 'webhook') {
      trigger.webhookKey = null;
      trigger.secretHash = null;
    }
    return {
      name: form.value.name.trim() || t('process.setupUntitled'),
      description: src.description || '',
      appKey: form.value.appKey || src.appKey,
      entityType: form.value.entityType || src.entityType,
      triggerBehaviour: src.triggerBehaviour || 'every_time',
      includeClosedRecords: src.includeClosedRecords === true,
      trigger,
      triggerConfigured: true,
      status: 'draft',
      nodes: Array.isArray(src.nodes) ? src.nodes : [],
      edges: Array.isArray(src.edges) ? src.edges : []
    };
  }
  return {
    name: form.value.name.trim() || t('process.setupUntitled'),
    description: '',
    appKey: form.value.appKey,
    entityType: form.value.entityType,
    triggerBehaviour: resolveTriggerBehaviourForSave(
      form.value.coreTrigger,
      form.value.triggerBehaviour
    ),
    includeClosedRecords: form.value.includeClosedRecords === true,
    trigger: buildTriggerFromCore(form.value.coreTrigger, form.value.entityType, {
      updateWatchField: form.value.updateWatchField,
      schedule: form.value.schedule
    }),
    triggerConfigured: true,
    status: 'draft',
    nodes: [],
    edges: []
  };
}

async function continueToDesigner() {
  if (!canContinue.value) return;
  saving.value = true;
  error.value = null;
  try {
    const res = await apiClient.post('/admin/processes', buildPayload());
    if (!res.success) throw new Error(res.message || t('process.setupCreateFailed'));
    if (res.webhookSecret) {
      notifications.error(t('process.designerWebhookSecret', { secret: res.webhookSecret }));
    }
    await router.push({ name: 'process-designer', params: { id: res.data._id } });
  } catch (e) {
    error.value = e.message || t('process.setupCreateFailed');
  } finally {
    saving.value = false;
  }
}

function onSubmit() {
  return continueToDesigner();
}

function goBack() {
  router.push({ name: 'settings-automation-processes' });
}

onMounted(async () => {
  document.title = t('process.setupPageTitle');
  try {
    const scope = await loadProcessScopeFromRegistry(t);
    registryAppOptions.value = scope.appOptions;
    registryModulesByApp.value = scope.modulesByApp;
  } catch (e) {
    console.error('Failed to load process scope from registry', e);
  }

  const duplicateFrom = route.query?.duplicateFrom
    ? String(Array.isArray(route.query.duplicateFrom) ? route.query.duplicateFrom[0] : route.query.duplicateFrom)
    : '';
  if (!duplicateFrom) return;
  try {
    const res = await apiClient.get(`/admin/processes/${duplicateFrom}`);
    if (!res?.success || !res.data) return;
    const src = res.data;
    sourceProcess.value = src;
    const baseName = String(src.name || '').trim();
    form.value.name = baseName && !/\(copy\)$/i.test(baseName) ? `${baseName} (Copy)` : baseName;
    form.value.appKey = src.appKey || '';
    form.value.entityType = src.entityType || '';
    form.value.includeClosedRecords = src.includeClosedRecords === true;
  } catch (e) {
    notifications.error(e.message || t('process.designerLoadFailed'));
  }
});

watch(
  () => form.value.coreTrigger,
  (core) => {
    if (!triggerBehaviourApplies(core)) {
      form.value.triggerBehaviour = 'every_time';
    }
  }
);

function processTabDisplayName(name) {
  const trimmed = String(name ?? '').trim();
  return trimmed || t('process.setupTitle');
}

watch(
  () => [activeTabId.value, route.path, form.value.name],
  () => {
    const tabId = activeTabId.value;
    if (!tabId || route.name !== 'process-designer-new') return;
    const tab = findTabById(tabId);
    if (!tab?.path || !isProcessDesignerTabPath(tab.path)) return;
    updateTabTitle(tabId, processTabDisplayName(form.value.name));
  },
  { immediate: true }
);
</script>
