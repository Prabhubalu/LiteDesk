<template>
  <div class="space-y-4">
    <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.tallyWizardTitle') }}</h2>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Health: <span class="font-medium text-gray-800 dark:text-gray-200">{{ wizard?.healthState || '—' }}</span>
            <span v-if="wizard?.currentStep" class="ml-2 text-gray-400">· step {{ wizard.currentStep }}</span>
          </p>
        </div>
        <button
          type="button"
          class="rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-900"
          :disabled="loading"
          @click="load"
        >
          {{ loading ? t('states.loading') : t('actions.refresh') }}
        </button>
      </div>

      <ol class="mt-5 space-y-2">
        <li
          v-for="(step, idx) in wizard?.steps || []"
          :key="step.id"
          class="flex items-start gap-3 rounded-lg border px-3 py-2.5"
          :class="step.done
            ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20'
            : step.id === wizard?.currentStep
              ? 'border-indigo-300 bg-indigo-50/60 dark:border-indigo-800 dark:bg-indigo-950/20'
              : 'border-gray-200 dark:border-gray-700'"
        >
          <span
            class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
            :class="step.done
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'"
          >
            {{ step.done ? '✓' : idx + 1 }}
          </span>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium text-gray-900 dark:text-white">{{ step.label }}</div>
            <div class="text-xs text-gray-500">{{ step.id }}</div>
          </div>
        </li>
      </ol>

      <div v-if="checklistEntries.length" class="mt-5">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.tallyValidationTitle') }}</h3>
        <ul class="mt-2 grid gap-2 sm:grid-cols-2">
          <li
            v-for="[key, val] in checklistEntries"
            :key="key"
            class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
          >
            <span :class="val ? 'text-emerald-600' : 'text-amber-600'">{{ val ? '✓' : '○' }}</span>
            {{ key }}
          </li>
        </ul>
      </div>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Actions</h3>
      <p v-if="!companyGuid" class="mt-2 text-sm text-amber-700 dark:text-amber-300">{{ t('settings.tallyCompanyRequired') }}</p>
      <div class="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          :disabled="!companyGuid || actionBusy"
          @click="discoverMetadata"
        >
          Discover metadata
        </button>
        <button
          type="button"
          class="rounded-xl border border-indigo-300 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-700 dark:text-indigo-300"
          :disabled="!companyGuid || actionBusy"
          @click="createDraft"
        >
          Draft mappings
        </button>
        <button
          type="button"
          class="rounded-xl border border-emerald-300 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300"
          :disabled="!companyGuid || !draftVersionId || actionBusy"
          @click="activateMapping"
        >
          Activate mapping
        </button>
        <button
          type="button"
          class="rounded-xl bg-gray-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900"
          :disabled="!companyGuid || actionBusy"
          @click="triggerSync"
        >
          {{ t('settings.addonsTallySyncNow') }}
        </button>
      </div>
      <p v-if="actionMessage" class="mt-3 text-sm text-gray-600 dark:text-gray-300">{{ actionMessage }}</p>
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

const { t } = useI18n();
const wizard = ref(null);
const loading = ref(false);
const actionBusy = ref(false);
const actionMessage = ref('');
const actionError = ref('');
const draftVersionId = ref('');

const checklistEntries = computed(() => {
  const c = wizard.value?.checklist;
  if (!c || typeof c !== 'object') return [];
  return Object.entries(c);
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
    actionMessage.value = 'Metadata discovery queued.';
    await load();
  } catch (err) {
    actionError.value = err?.response?.data?.message || err?.message || 'Discover failed';
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
    actionMessage.value = draftVersionId.value
      ? `Draft mapping created (${draftVersionId.value}).`
      : 'Draft mapping created.';
    await load();
  } catch (err) {
    actionError.value = err?.response?.data?.message || err?.message || 'Draft failed';
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
    actionMessage.value = 'Mapping activated.';
    await load();
  } catch (err) {
    actionError.value = err?.response?.data?.message || err?.message || 'Activate failed';
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
    actionMessage.value = 'Sync triggered.';
    emit('synced');
    await load();
  } catch (err) {
    actionError.value = err?.response?.data?.message || err?.message || 'Sync failed';
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
