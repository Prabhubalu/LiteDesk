<template>
  <div class="mx-auto max-w-6xl">
    <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <router-link
          to="/control"
          class="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          ← {{ t('releaseNotes.adminBackControl') }}
        </router-link>
        <h1 class="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
          {{ t('releaseNotes.adminListTitle') }}
        </h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">
          {{ t('releaseNotes.adminListSubtitle') }}
        </p>
      </div>
      <router-link
        to="/control/release-notes/new"
        class="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        {{ t('releaseNotes.adminCreate') }}
      </router-link>
    </div>

    <div class="mb-4 flex flex-wrap items-center gap-3">
      <label class="text-sm text-gray-600 dark:text-gray-400" for="release-status-filter">
        {{ t('releaseNotes.adminColStatus') }}
      </label>
      <select
        id="release-status-filter"
        v-model="statusFilter"
        class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        @change="loadNotes"
      >
        <option value="">{{ t('releaseNotes.adminAllStatuses') }}</option>
        <option v-for="status in statusOptions" :key="status" :value="status">
          {{ t(`releaseNotes.adminStatus_${status}`) }}
        </option>
      </select>
    </div>

    <div
      v-if="error"
      class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
    >
      {{ error }}
    </div>

    <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div v-if="loading" class="flex justify-center py-16">
        <div class="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
      </div>

      <div v-else-if="!releases.length" class="px-6 py-16 text-center text-sm text-gray-500 dark:text-gray-400">
        {{ t('releaseNotes.adminListEmpty') }}
      </div>

      <table v-else class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900/50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('releaseNotes.adminColVersion') }}
            </th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('releaseNotes.adminColTitle') }}
            </th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('releaseNotes.adminColImportance') }}
            </th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('releaseNotes.adminColStatus') }}
            </th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('releaseNotes.adminColPublished') }}
            </th>
            <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('releaseNotes.adminColActions') }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <tr v-for="release in releases" :key="release.id" class="hover:bg-gray-50 dark:hover:bg-gray-900/40">
            <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
              {{ release.version }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
              {{ release.title }}
            </td>
            <td class="px-4 py-3">
              <span :class="importanceClass(release.importance)" class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium">
                {{ t(`releaseNotes.adminImportance_${release.importance}`) }}
              </span>
            </td>
            <td class="px-4 py-3">
              <span :class="statusClass(release.status)" class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium">
                {{ t(`releaseNotes.adminStatus_${release.status}`) }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              {{ formatDate(release.publishedAt) }}
            </td>
            <td class="px-4 py-3 text-right">
              <router-link
                :to="`/control/release-notes/${release.id}`"
                class="text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
              >
                {{ t('actions.edit') }}
              </router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import { listPlatformNotes } from '@/utils/releaseNotesApi';
import { RELEASE_NOTE_STATUS_OPTIONS } from '@/constants/releaseNoteAdmin';
import { formatUserDateTime } from '@/utils/localeFormat';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();

const loading = ref(false);
const error = ref('');
const releases = ref([]);
const statusFilter = ref('');
const statusOptions = RELEASE_NOTE_STATUS_OPTIONS;

function formatDate(value) {
  if (!value) return '—';
  return formatUserDateTime(value);
}

function importanceClass(importance) {
  if (importance === 'major') return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200';
  if (importance === 'minor') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
}

function statusClass(status) {
  if (status === 'published') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  if (status === 'scheduled') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
  if (status === 'archived') return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

async function loadNotes() {
  loading.value = true;
  error.value = '';
  try {
    const response = await listPlatformNotes({
      status: statusFilter.value || undefined,
      limit: 50
    });
    releases.value = response?.data?.releases || [];
  } catch (err) {
    console.error('[PlatformReleaseNotesList] load failed:', err);
    error.value = t('releaseNotes.adminLoadFailed');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  document.title = t('releaseNotes.adminListTitle');
  if (!authStore.isPlatformAdmin) {
    router.push({ name: 'dashboard' });
    return;
  }
  void loadNotes();
});
</script>
