<template>
  <div
    class="process-setup flex h-full min-h-0 flex-col bg-gray-50 dark:bg-gray-900"
    :class="{ 'process-setup--astra': createMode === 'astra' }"
  >
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
      <div
        class="w-full flex flex-col min-h-0 max-h-full relative"
        :class="createMode === 'astra' ? 'max-w-2xl' : 'max-w-lg'"
      >
        <div v-if="createMode !== 'astra'" class="shrink-0 mb-4 text-center sm:mb-6">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('process.setupTitle') }}</h1>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
            {{ t('process.setupDescription') }}
          </p>
        </div>

        <form
          class="flex min-h-0 flex-1 flex-col overflow-hidden relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
          :class="{ 'process-setup__astra-card': createMode === 'astra' }"
          @submit.prevent="onSubmit"
        >
          <Transition name="process-setup-fade">
            <div
              v-if="saving && createMode === 'astra'"
              class="process-setup__working absolute inset-0 z-20 flex flex-col items-center justify-center px-6 text-center"
              aria-live="polite"
            >
              <div class="process-setup__working-orb" aria-hidden="true">
                <img src="/assets/logo/Ai%20Logo.svg" alt="" class="h-16 w-16 object-contain" />
              </div>
              <p class="process-setup__shimmer-title mt-5 text-xl font-semibold tracking-tight">
                {{ t('process.setupAstraWorkingTitle') }}
              </p>
              <p class="mt-2 text-sm text-gray-600 dark:text-gray-300 min-h-[1.25rem]">
                {{ astraWorkingStatus }}
              </p>
              <div class="process-setup__progress mt-6" aria-hidden="true">
                <span /><span /><span />
              </div>
            </div>
          </Transition>

          <div
            class="flex-1 min-h-0 overflow-y-auto p-6 space-y-5"
            :class="{ 'opacity-40 pointer-events-none': saving && createMode === 'astra' }"
          >
            <div class="grid grid-cols-2 gap-1.5 rounded-xl p-1 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <button
                type="button"
                class="px-3 py-2.5 text-sm font-medium rounded-lg transition-all"
                :class="createMode === 'manual'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800'"
                @click="createMode = 'manual'"
              >
                {{ t('process.setupModeManual') }}
              </button>
              <button
                type="button"
                class="relative px-3 py-2.5 text-sm font-medium rounded-lg transition-all overflow-hidden"
                :class="createMode === 'astra'
                  ? 'process-setup__mode-astra-active text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800'"
                @click="createMode = 'astra'"
              >
                <span class="relative z-[1] inline-flex items-center justify-center gap-1.5">
                  <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M10 1.5l1.2 3.8a2 2 0 001.2 1.2L16.2 7.7l-3.8 1.2a2 2 0 00-1.2 1.2L10 13.9l-1.2-3.8a2 2 0 00-1.2-1.2L3.8 7.7l3.8-1.2a2 2 0 001.2-1.2L10 1.5zM15.5 12l.7 2.1a1 1 0 00.6.6L19 15.5l-2.2.7a1 1 0 00-.6.6L15.5 19l-.7-2.2a1 1 0 00-.6-.6L12 15.5l2.2-.7a1 1 0 00.6-.6L15.5 12z" />
                  </svg>
                  {{ t('process.setupModeAstra') }}
                </span>
              </button>
            </div>

            <div v-if="createMode === 'astra'" class="process-setup__hero text-center pt-1 pb-2">
              <div class="process-setup__hero-logo mx-auto">
                <img src="/assets/logo/Ai%20Logo.svg" alt="" class="h-14 w-14 object-contain" aria-hidden="true" />
              </div>
              <h1 class="process-setup__shimmer-title mt-3 text-[28px] font-semibold tracking-tight">
                {{ t('process.setupAstraAgentTitle') }}
              </h1>
              <p class="mt-1.5 text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
                {{ t('process.setupAstraDescription') }}
              </p>
              <div class="mt-4 flex flex-wrap items-center justify-center gap-2">
                <span v-for="chip in astraCapabilityChips" :key="chip" class="process-setup__chip">
                  {{ chip }}
                </span>
              </div>
            </div>

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

            <div v-if="createMode === 'astra'" class="process-setup__prompt">
              <div class="flex items-center justify-between gap-2 mb-2">
                <label class="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {{ t('process.setupAstraBrief') }} <span class="text-red-500">*</span>
                </label>
                <span class="text-[10px] uppercase tracking-wider text-indigo-600/70 dark:text-indigo-300/70 font-semibold">
                  {{ t('process.setupAstraPromptLabel') }}
                </span>
              </div>
              <textarea
                v-model="form.brief"
                rows="6"
                :placeholder="t('process.setupAstraBriefPh')"
                class="process-setup__prompt-area w-full px-4 py-3 text-[15px] leading-relaxed rounded-xl resize-y min-h-[9rem]"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">{{ t('process.setupAstraBriefHint') }}</p>
            </div>

            <div class="space-y-4" :class="createMode === 'astra' ? 'process-setup__scope rounded-xl p-4' : ''">
              <p
                v-if="createMode === 'astra'"
                class="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                {{ t('process.setupAstraScopeLabel') }}
              </p>

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

              <div v-if="createMode !== 'astra'" class="rounded-lg bg-gray-50 dark:bg-gray-900/50 px-3 py-2">
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
              class="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl disabled:opacity-50 transition-all"
              :class="createMode === 'astra' ? 'process-setup__cta' : 'text-white bg-indigo-600 hover:bg-indigo-700'"
            >
              <span v-if="createMode === 'astra'" class="inline-flex items-center justify-center gap-2">
                <svg v-if="!saving" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M10 1.5l1.2 3.8a2 2 0 001.2 1.2L16.2 7.7l-3.8 1.2a2 2 0 00-1.2 1.2L10 13.9l-1.2-3.8a2 2 0 00-1.2-1.2L3.8 7.7l3.8-1.2a2 2 0 001.2-1.2L10 1.5z" />
                </svg>
                {{ submitLabel }}
              </span>
              <span v-else>{{ submitLabel }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
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

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const { activeTabId, updateTabTitle, findTabById } = useTabs();
const SELECT_CLASS = PROCESS_SELECT_BUTTON_CLASS;
const saving = ref(false);
const error = ref(null);
const createMode = ref('manual');
const astraWorkingIndex = ref(0);
let astraWorkingTimer = null;
const registryAppOptions = ref([]);
const registryModulesByApp = ref({});

const form = ref({
  name: '',
  brief: '',
  appKey: '',
  entityType: '',
  coreTrigger: '',
  triggerBehaviour: 'every_time',
  includeClosedRecords: false,
  updateWatchField: '__any__',
  schedule: { preset: 'daily', hour: 9, minute: 0, dayOfWeek: 1, dayOfMonth: 1, timezone: 'UTC' }
});

const astraCapabilityChips = computed(() => [
  t('process.setupAstraChipTrigger'),
  t('process.setupAstraChipConditions'),
  t('process.setupAstraChipActions'),
  t('process.setupAstraChipDraft')
]);

const astraWorkingStatuses = computed(() => [
  t('process.setupAstraStatusReading'),
  t('process.setupAstraStatusMapping'),
  t('process.setupAstraStatusWiring'),
  t('process.setupAstraStatusValidating'),
  t('process.setupAstraStatusDrafting')
]);

const astraWorkingStatus = computed(
  () => astraWorkingStatuses.value[astraWorkingIndex.value % astraWorkingStatuses.value.length]
);

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
  const scoped = !!(
    form.value.appKey &&
    form.value.entityType &&
    form.value.coreTrigger &&
    (!triggerBehaviourApplies(form.value.coreTrigger) || form.value.triggerBehaviour)
  );
  if (!scoped) return false;
  if (createMode.value === 'astra') {
    return String(form.value.brief || '').trim().length >= 12;
  }
  return true;
});

const submitLabel = computed(() => {
  if (saving.value) {
    return createMode.value === 'astra'
      ? t('process.setupAstraGenerating')
      : t('process.setupCreating');
  }
  return createMode.value === 'astra'
    ? t('process.setupAstraGenerate')
    : t('process.setupContinue');
});

function startAstraWorkingCycle() {
  stopAstraWorkingCycle();
  astraWorkingIndex.value = 0;
  astraWorkingTimer = window.setInterval(() => {
    astraWorkingIndex.value += 1;
  }, 2200);
}

function stopAstraWorkingCycle() {
  if (astraWorkingTimer != null) {
    window.clearInterval(astraWorkingTimer);
    astraWorkingTimer = null;
  }
}

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
      alert(t('process.designerWebhookSecret', { secret: res.webhookSecret }));
    }
    await router.push({ name: 'process-designer', params: { id: res.data._id } });
  } catch (e) {
    error.value = e.message || t('process.setupCreateFailed');
  } finally {
    saving.value = false;
  }
}

async function generateWithAstra() {
  if (!canContinue.value) return;
  saving.value = true;
  error.value = null;
  startAstraWorkingCycle();
  try {
    const generated = await apiClient.post('/ai/processes/generate', {
      brief: form.value.brief.trim(),
      name: form.value.name.trim() || undefined,
      appKey: form.value.appKey,
      entityType: form.value.entityType,
      coreTrigger: form.value.coreTrigger,
      updateWatchField: form.value.updateWatchField,
      schedule: form.value.schedule,
      triggerBehaviour: resolveTriggerBehaviourForSave(
        form.value.coreTrigger,
        form.value.triggerBehaviour
      ),
      includeClosedRecords: form.value.includeClosedRecords === true
    });
    if (!generated?.success || !generated.process) {
      throw new Error(generated?.message || t('process.setupAstraGenerateFailed'));
    }

    const processPayload = {
      ...generated.process,
      name: form.value.name.trim() || generated.process.name,
      status: 'draft',
      triggerConfigured: true,
      triggerBehaviour: resolveTriggerBehaviourForSave(
        form.value.coreTrigger,
        form.value.triggerBehaviour
      ),
      includeClosedRecords: form.value.includeClosedRecords === true
    };

    const res = await apiClient.post('/admin/processes', processPayload);
    if (!res.success) throw new Error(res.message || t('process.setupCreateFailed'));
    if (res.webhookSecret) {
      alert(t('process.designerWebhookSecret', { secret: res.webhookSecret }));
    }
    if (Array.isArray(generated.warnings) && generated.warnings.length) {
      console.info('[Process Designer] generation warnings', generated.warnings);
    }
    await router.push({ name: 'process-designer', params: { id: res.data._id } });
  } catch (e) {
    error.value = e.message || t('process.setupAstraGenerateFailed');
  } finally {
    stopAstraWorkingCycle();
    saving.value = false;
  }
}

function onSubmit() {
  if (createMode.value === 'astra') return generateWithAstra();
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
});

onUnmounted(() => {
  stopAstraWorkingCycle();
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

<style scoped>
.process-setup--astra {
  background:
    radial-gradient(ellipse 70% 45% at 50% -5%, rgba(96, 73, 231, 0.14), transparent 55%),
    radial-gradient(ellipse 45% 30% at 95% 85%, rgba(50, 119, 254, 0.08), transparent 50%),
    #f9fafb;
}

:global(html.dark) .process-setup--astra {
  background:
    radial-gradient(ellipse 70% 45% at 50% -5%, rgba(96, 73, 231, 0.28), transparent 55%),
    radial-gradient(ellipse 45% 30% at 95% 85%, rgba(50, 119, 254, 0.12), transparent 50%),
    #111827;
}

.process-setup__astra-card {
  border-radius: 1.25rem;
  border-color: rgba(96, 73, 231, 0.22);
  box-shadow:
    0 0 0 1px rgba(96, 73, 231, 0.08),
    0 18px 48px rgba(96, 73, 231, 0.08),
    0 4px 16px rgba(15, 23, 42, 0.04);
}

:global(html.dark) .process-setup__astra-card {
  border-color: rgba(167, 139, 250, 0.25);
  box-shadow:
    0 0 0 1px rgba(96, 73, 231, 0.2),
    0 18px 48px rgba(0, 0, 0, 0.35);
}

.process-setup__mode-astra-active {
  background: linear-gradient(120deg, #6049e7, #7c5cff 55%, #4f6ef7);
  box-shadow: 0 6px 20px rgba(96, 73, 231, 0.28);
}

.process-setup__hero-logo {
  width: 4.25rem;
  height: 4.25rem;
  display: grid;
  place-items: center;
  border-radius: 1.25rem;
  background: linear-gradient(145deg, rgba(96, 73, 231, 0.08), rgba(50, 119, 254, 0.06));
  box-shadow:
    0 0 0 1px rgba(96, 73, 231, 0.15),
    0 10px 28px rgba(96, 73, 231, 0.12);
  animation: process-setup-logo-breathe 3.2s ease-in-out infinite;
}

.process-setup__shimmer-title {
  background-image: linear-gradient(
    100deg,
    #1f2937 0%,
    #1f2937 38%,
    #7c5cff 46%,
    #6049e7 50%,
    #4f46e5 54%,
    #3730a3 58%,
    #1f2937 66%,
    #1f2937 100%
  );
  background-size: 240% 100%;
  background-position: 100% 0;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  animation: process-setup-title-shimmer 3.6s ease-in-out infinite;
}

:global(html.dark) .process-setup__shimmer-title {
  background-image: linear-gradient(
    100deg,
    #f9fafb 0%,
    #f9fafb 38%,
    #a78bfa 46%,
    #6049e7 50%,
    #818cf8 54%,
    #c4b5fd 58%,
    #f9fafb 66%,
    #f9fafb 100%
  );
}

.process-setup__chip {
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  color: #4338ca;
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.18);
}

:global(html.dark) .process-setup__chip {
  color: #c4b5fd;
  background: rgba(99, 102, 241, 0.15);
  border-color: rgba(167, 139, 250, 0.25);
}

.process-setup__prompt {
  border-radius: 1rem;
  padding: 0.85rem;
  background: linear-gradient(180deg, rgba(96, 73, 231, 0.04), rgba(96, 73, 231, 0.02));
  border: 1px solid rgba(96, 73, 231, 0.16);
}

:global(html.dark) .process-setup__prompt {
  background: rgba(96, 73, 231, 0.1);
  border-color: rgba(167, 139, 250, 0.22);
}

.process-setup__prompt-area {
  background: #fff;
  border: 1px solid rgba(148, 163, 184, 0.45);
  color: #111827;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

:global(html.dark) .process-setup__prompt-area {
  background: #111827;
  border-color: rgba(75, 85, 99, 0.9);
  color: #f9fafb;
}

.process-setup__prompt-area::placeholder {
  color: #9ca3af;
}

.process-setup__prompt-area:focus {
  border-color: rgba(96, 73, 231, 0.65);
  box-shadow: 0 0 0 3px rgba(96, 73, 231, 0.18);
}

.process-setup__scope {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
}

:global(html.dark) .process-setup__scope {
  background: rgba(17, 24, 39, 0.45);
  border-color: #374151;
}

.process-setup__cta {
  color: #fff;
  background: linear-gradient(120deg, #6049e7 0%, #7c5cff 50%, #4f6ef7 100%);
  background-size: 160% 100%;
  box-shadow: 0 8px 24px rgba(96, 73, 231, 0.28);
  animation: process-setup-cta-shift 4s ease-in-out infinite;
}

.process-setup__cta:hover:not(:disabled) {
  filter: brightness(1.05);
}

.process-setup__working {
  border-radius: inherit;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(10px);
}

:global(html.dark) .process-setup__working {
  background: rgba(17, 24, 39, 0.88);
}

.process-setup__working-orb {
  width: 5.5rem;
  height: 5.5rem;
  display: grid;
  place-items: center;
  border-radius: 1.5rem;
  background: linear-gradient(145deg, rgba(96, 73, 231, 0.1), rgba(50, 119, 254, 0.08));
  box-shadow:
    0 0 0 1px rgba(96, 73, 231, 0.18),
    0 12px 36px rgba(96, 73, 231, 0.2);
  animation: process-setup-logo-breathe 1.8s ease-in-out infinite;
}

.process-setup__progress {
  display: flex;
  gap: 0.45rem;
}

.process-setup__progress span {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 999px;
  background: rgba(96, 73, 231, 0.45);
  animation: process-setup-dot 1.2s ease-in-out infinite;
}

.process-setup__progress span:nth-child(2) { animation-delay: 0.15s; }
.process-setup__progress span:nth-child(3) { animation-delay: 0.3s; }

.process-setup-fade-enter-active,
.process-setup-fade-leave-active { transition: opacity 0.25s ease; }
.process-setup-fade-enter-from,
.process-setup-fade-leave-to { opacity: 0; }

@keyframes process-setup-title-shimmer {
  0%, 18% { background-position: 100% 0; }
  55%, 100% { background-position: 0% 0; }
}

@keyframes process-setup-logo-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
}

@keyframes process-setup-cta-shift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

@keyframes process-setup-dot {
  0%, 100% { opacity: 0.35; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-3px); }
}

@media (prefers-reduced-motion: reduce) {
  .process-setup__shimmer-title,
  .process-setup__hero-logo,
  .process-setup__cta,
  .process-setup__working-orb,
  .process-setup__progress span { animation: none !important; }

  .process-setup__shimmer-title {
    background: none;
    color: #111827;
    -webkit-text-fill-color: #111827;
  }

  :global(html.dark) .process-setup__shimmer-title {
    color: #f9fafb;
    -webkit-text-fill-color: #f9fafb;
  }
}
</style>
