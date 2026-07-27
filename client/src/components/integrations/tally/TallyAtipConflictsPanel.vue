<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.tallyConflictsTitle') }}</h2>
        <p class="mt-0.5 text-sm text-gray-500">Open conflicts for this connector.</p>
      </div>
      <button
        type="button"
        class="rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200"
        :disabled="loading"
        @click="load"
      >
        {{ loading ? t('states.loading') : t('actions.refresh') }}
      </button>
    </div>

    <p v-if="error" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{{ error }}</p>
    <p v-if="message" class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{{ message }}</p>

    <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <ul class="divide-y divide-gray-100 dark:divide-gray-700">
        <li v-if="!rows.length" class="px-4 py-10 text-center text-sm text-gray-500 sm:px-6">—</li>
        <li
          v-for="c in rows"
          :key="c._id"
          class="px-4 py-4 sm:px-6"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="text-sm font-medium text-gray-900 dark:text-white">
                {{ c.entityType || c.moduleKey || 'Conflict' }}
                <span class="ml-2 text-xs font-normal text-gray-500">{{ c.status }}</span>
              </div>
              <div class="mt-0.5 text-xs text-gray-500">
                {{ c.externalId || c.arivuId || c._id }}
                <span v-if="c.reason || c.message"> · {{ c.reason || c.message }}</span>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200"
                :disabled="busyId === c._id"
                @click="resolve(c, 'use_arivu')"
              >
                {{ t('settings.tallyKeepArivu') }}
              </button>
              <button
                type="button"
                class="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200"
                :disabled="busyId === c._id"
                @click="resolve(c, 'use_external')"
              >
                {{ t('settings.tallyKeepTally') }}
              </button>
              <button
                type="button"
                class="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200"
                :disabled="busyId === c._id"
                @click="resolve(c, 'merge')"
              >
                {{ t('settings.tallyMerge') }}
              </button>
              <button
                type="button"
                class="rounded-lg border border-red-300 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-300"
                :disabled="busyId === c._id"
                @click="resolve(c, 'ignore')"
              >
                {{ t('settings.tallyIgnore') }}
              </button>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';

const { t } = useI18n();
const rows = ref([]);
const loading = ref(false);
const busyId = ref('');
const error = ref('');
const message = ref('');

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await apiClient('/connectors/tally/conflicts', { method: 'GET' });
    rows.value = res?.data || res || [];
    if (!Array.isArray(rows.value)) rows.value = [];
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('settings.tallyLoadFailed');
  } finally {
    loading.value = false;
  }
}

async function resolve(conflict, resolution) {
  busyId.value = conflict._id;
  error.value = '';
  message.value = '';
  try {
    await apiClient.post(`/connectors/tally/conflicts/${conflict._id}/resolve`, { resolution });
    message.value = t('settings.tallyConflictResolved');
    await load();
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || 'Resolve failed';
  } finally {
    busyId.value = '';
  }
}

onMounted(load);
defineExpose({ load });
</script>
