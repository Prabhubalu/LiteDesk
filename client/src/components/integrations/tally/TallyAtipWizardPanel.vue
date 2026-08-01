<template>
  <div class="space-y-4">
    <!-- Status + progress -->
    <div class="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div class="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-4 py-4 sm:px-6 dark:border-gray-700/80">
        <div class="min-w-0">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">
            {{ t('settings.tallyWizardTitle') }}
          </h2>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {{ t('settings.tallyWizardSubtitle') }}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span
            class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
            :class="healthPillClass"
          >
            <span class="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />
            {{ healthLabel }}
          </span>
          <button
            type="button"
            class="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-900"
            :disabled="loading"
            :title="t('actions.refresh')"
            @click="load"
          >
            {{ loading ? t('states.loading') : t('actions.refresh') }}
          </button>
        </div>
      </div>

      <!-- Compact progress track -->
      <div class="px-4 py-4 sm:px-6">
        <div class="flex items-center gap-0.5 overflow-x-auto pb-1">
          <template v-for="(step, idx) in displaySteps" :key="step.id">
            <div
              class="flex min-w-0 flex-1 flex-col items-center gap-1.5"
              :class="idx === 0 ? '' : ''"
            >
              <div class="flex w-full items-center">
                <div
                  v-if="idx > 0"
                  class="h-0.5 min-w-[0.5rem] flex-1"
                  :class="step.done || step.current ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-gray-700'"
                />
                <span
                  class="relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-2 ring-white dark:ring-gray-800"
                  :class="step.done
                    ? 'bg-emerald-600 text-white'
                    : step.current
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'"
                >
                  <svg v-if="step.done" class="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2.5 6.2 4.8 8.5 9.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  <span v-else>{{ idx + 1 }}</span>
                </span>
                <div
                  v-if="idx < displaySteps.length - 1"
                  class="h-0.5 min-w-[0.5rem] flex-1"
                  :class="step.done ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-gray-700'"
                />
              </div>
              <span
                class="hidden max-w-[5.5rem] truncate text-center text-[10px] font-medium leading-tight sm:block"
                :class="step.current
                  ? 'text-indigo-700 dark:text-indigo-300'
                  : step.done
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-gray-400'"
              >
                {{ stepLabel(step) }}
              </span>
            </div>
          </template>
        </div>

        <!-- Current step detail -->
        <div
          v-if="currentDisplay"
          class="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                {{ t('settings.tallyWizardCurrentStep', { n: currentIndex + 1, total: displaySteps.length }) }}
              </p>
              <h3 class="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                {{ stepLabel(currentDisplay) }}
              </h3>
              <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
                {{ stepHint(currentDisplay) }}
              </p>
            </div>
            <button
              v-if="primaryAction"
              type="button"
              class="rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
              :disabled="(primaryAction.needsCompany && !companyGuid) || actionBusy"
              @click="primaryAction.run"
            >
              {{ actionBusy ? t('states.loading') : primaryAction.label }}
            </button>
          </div>
        </div>

        <div
          v-else-if="wizard?.ready"
          class="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20"
        >
          <h3 class="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
            {{ t('settings.tallyWizardCompleteTitle') }}
          </h3>
          <p class="mt-1 text-sm text-emerald-800/80 dark:text-emerald-300/80">
            {{ t('settings.tallyWizardCompleteDesc') }}
          </p>
        </div>
      </div>
    </div>

    <!-- Checklist -->
    <div
      v-if="checklistEntries.length"
      class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5"
    >
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
        {{ t('settings.tallyValidationTitle') }}
      </h3>
      <ul class="mt-3 grid gap-2 sm:grid-cols-2">
        <li
          v-for="item in checklistEntries"
          :key="item.key"
          class="flex items-start gap-2.5 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-700/80"
        >
          <span
            class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
            :class="item.ok
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'"
          >
            {{ item.ok ? '✓' : '!' }}
          </span>
          <div class="min-w-0">
            <div class="text-sm font-medium text-gray-800 dark:text-gray-100">{{ item.label }}</div>
            <div v-if="item.message" class="text-xs text-gray-500">{{ item.message }}</div>
          </div>
        </li>
      </ul>
    </div>

    <!-- Secondary actions -->
    <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
        {{ t('settings.tallyWizardActions') }}
      </h3>
      <p v-if="!companyGuid" class="mt-2 text-sm text-amber-700 dark:text-amber-300">
        {{ t('settings.tallyCompanyRequired') }}
      </p>
      <div class="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-900"
          :disabled="!companyGuid || actionBusy"
          @click="discoverMetadata"
        >
          {{ t('settings.tallyCatalogDiscover') }}
        </button>
        <button
          type="button"
          class="rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-900"
          :disabled="!companyGuid || actionBusy"
          @click="createDraft"
        >
          {{ t('settings.tallyWizardDraftMappings') }}
        </button>
        <button
          type="button"
          class="rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-900"
          :disabled="!companyGuid || !draftVersionId || actionBusy"
          @click="activateMapping"
        >
          {{ t('settings.tallyWizardActivateMapping') }}
        </button>
        <button
          type="button"
          class="rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-900"
          :disabled="!companyGuid || actionBusy"
          @click="triggerSync"
        >
          {{ t('settings.addonsTallySyncNow') }}
        </button>
      </div>
      <p v-if="actionMessage" class="mt-3 text-sm text-emerald-700 dark:text-emerald-300">{{ actionMessage }}</p>
      <p v-if="actionError" class="mt-2 text-sm text-red-600 dark:text-red-400">{{ actionError }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  companyGuid: { type: String, default: '' },
});

const emit = defineEmits(['synced']);

const { t, te } = useI18n();
const wizard = ref(null);
const loading = ref(false);
const actionBusy = ref(false);
const actionMessage = ref('');
const actionError = ref('');
const draftVersionId = ref('');

const CHECKLIST_KEYS = [
  'tallyRunning',
  'portListening',
  'versionSupported',
  'companyOpen',
  'tdlLoaded',
  'xmlPermissions',
  'licenseOk',
];

const STEP_I18N = {
  connect: { label: 'settings.tallyAtipStepConnect', hint: 'settings.tallyAtipStepConnectHint' },
  detect_company: { label: 'settings.tallyAtipStepDetect', hint: 'settings.tallyAtipStepDetectHint' },
  scan_metadata: { label: 'settings.tallyAtipStepScan', hint: 'settings.tallyAtipStepScanHint' },
  ai_mappings: { label: 'settings.tallyAtipStepAi', hint: 'settings.tallyAtipStepAiHint' },
  review: { label: 'settings.tallyAtipStepReview', hint: 'settings.tallyAtipStepReviewHint' },
  start_sync: { label: 'settings.tallyAtipStepSync', hint: 'settings.tallyAtipStepSyncHint' },
  progress: { label: 'settings.tallyAtipStepProgress', hint: 'settings.tallyAtipStepProgressHint' },
  complete: { label: 'settings.tallyAtipStepComplete', hint: 'settings.tallyAtipStepCompleteHint' },
};

const HEALTH_I18N = {
  searching: 'settings.tallyHealthStateSearching',
  found: 'settings.tallyHealthStateFound',
  metadata_pending: 'settings.tallyHealthStateMetadata',
  ready: 'settings.tallyHealthStateReady',
  degraded: 'settings.tallyHealthStateDegraded',
  offline: 'settings.tallyHealthStateOffline',
};

function stepLabel(step) {
  const key = STEP_I18N[step?.id]?.label;
  if (key && te(key)) return t(key);
  return step?.label || step?.id || '—';
}

function stepHint(step) {
  const key = STEP_I18N[step?.id]?.hint;
  if (key && te(key)) return t(key);
  return '';
}

const displaySteps = computed(() => {
  const current = wizard.value?.currentStep;
  return (wizard.value?.steps || []).map((s) => ({
    ...s,
    current: !s.done && s.id === current,
  }));
});

const currentIndex = computed(() => {
  const i = displaySteps.value.findIndex((s) => s.current);
  return i >= 0 ? i : displaySteps.value.findIndex((s) => !s.done);
});

const currentDisplay = computed(() => {
  if (currentIndex.value < 0) return null;
  return displaySteps.value[currentIndex.value] || null;
});

const healthLabel = computed(() => {
  const state = wizard.value?.healthState;
  const key = HEALTH_I18N[state];
  if (key && te(key)) return t(key);
  return state || '—';
});

const healthPillClass = computed(() => {
  const state = wizard.value?.healthState;
  if (state === 'ready') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200';
  }
  if (state === 'offline' || state === 'degraded') {
    return 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100';
  }
  return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200';
});

const checklistEntries = computed(() => {
  const c = wizard.value?.checklist;
  if (!c || typeof c !== 'object') return [];
  return CHECKLIST_KEYS.filter((k) => c[k] != null).map((key) => {
    const val = c[key];
    const ok = typeof val === 'object' ? Boolean(val?.ok) : Boolean(val);
    const labelKey = `settings.tallyCheck${key.charAt(0).toUpperCase()}${key.slice(1)}`;
    return {
      key,
      ok,
      label: te(labelKey) ? t(labelKey) : key,
      message: typeof val === 'object' ? val?.message : null,
    };
  });
});

const primaryAction = computed(() => {
  const id = currentDisplay.value?.id;
  if (!id || id === 'complete') return null;
  const map = {
    connect: { label: t('settings.tallyWizardPair'), needsCompany: false, run: () => { actionMessage.value = t('settings.tallyWizardPairHint'); } },
    detect_company: { label: t('settings.tallyWizardRefreshCompanies'), needsCompany: false, run: load },
    scan_metadata: { label: t('settings.tallyCatalogDiscover'), needsCompany: true, run: discoverMetadata },
    ai_mappings: { label: t('settings.tallyWizardDraftMappings'), needsCompany: true, run: createDraft },
    review: { label: t('settings.tallyWizardActivateMapping'), needsCompany: true, run: activateMapping },
    start_sync: { label: t('settings.addonsTallySyncNow'), needsCompany: true, run: triggerSync },
    progress: { label: t('actions.refresh'), needsCompany: false, run: load },
  };
  return map[id] || null;
});

async function load() {
  loading.value = true;
  actionError.value = '';
  try {
    const res = await apiClient('/connectors/tally/atip/wizard', { method: 'GET' });
    wizard.value = res?.data || res || null;
    const binding = (wizard.value?.bindings || []).find((b) => b.companyGuid === props.companyGuid);
    if (binding?.activeMappingVersionId) {
      draftVersionId.value = String(binding.activeMappingVersionId);
    }
  } catch (err) {
    actionError.value = err?.response?.data?.message || err?.message || t('settings.tallyLoadFailed');
  } finally {
    loading.value = false;
  }
}

async function discoverMetadata() {
  if (!props.companyGuid) return;
  actionBusy.value = true;
  actionError.value = '';
  actionMessage.value = '';
  try {
    await apiClient.post('/connectors/tally/atip/metadata/discover', { companyGuid: props.companyGuid });
    actionMessage.value = t('settings.tallyCatalogDiscoverQueued');
    await load();
  } catch (err) {
    actionError.value = err?.response?.data?.message || err?.message || t('settings.tallyCatalogDiscoverFailed');
  } finally {
    actionBusy.value = false;
  }
}

async function createDraft() {
  if (!props.companyGuid) return;
  actionBusy.value = true;
  actionError.value = '';
  actionMessage.value = '';
  try {
    const res = await apiClient.post('/connectors/tally/atip/mappings/draft', { companyGuid: props.companyGuid });
    const data = res?.data || res;
    draftVersionId.value = String(data?._id || data?.id || data?.versionId || '');
    actionMessage.value = t('settings.tallyWizardDraftCreated');
    await load();
  } catch (err) {
    actionError.value = err?.response?.data?.message || err?.message || t('settings.tallyWizardDraftFailed');
  } finally {
    actionBusy.value = false;
  }
}

async function activateMapping() {
  if (!props.companyGuid || !draftVersionId.value) return;
  actionBusy.value = true;
  actionError.value = '';
  actionMessage.value = '';
  try {
    await apiClient.post(`/connectors/tally/atip/mappings/${encodeURIComponent(draftVersionId.value)}/activate`, {
      companyGuid: props.companyGuid,
    });
    actionMessage.value = t('settings.tallyWizardMappingActivated');
    await load();
  } catch (err) {
    actionError.value = err?.response?.data?.message || err?.message || t('settings.tallyWizardActivateFailed');
  } finally {
    actionBusy.value = false;
  }
}

async function triggerSync() {
  if (!props.companyGuid) return;
  actionBusy.value = true;
  actionError.value = '';
  actionMessage.value = '';
  try {
    await apiClient.post('/connectors/tally/sync/trigger', {
      jobType: 'incremental',
      companyGuid: props.companyGuid,
      dryRun: false,
    });
    actionMessage.value = t('settings.tallyWizardSyncTriggered');
    emit('synced');
    await load();
  } catch (err) {
    actionError.value = err?.response?.data?.message || err?.message || t('settings.addonsTallySyncFailed');
  } finally {
    actionBusy.value = false;
  }
}

watch(() => props.companyGuid, () => {
  load();
});

onMounted(load);

defineExpose({ load });
</script>
