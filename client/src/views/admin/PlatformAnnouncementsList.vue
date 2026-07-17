<template>
  <div class="mx-auto max-w-6xl">
    <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <router-link
          to="/control"
          class="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          ← {{ t('announcements.cpBackControl') }}
        </router-link>
        <h1 class="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
          {{ t('announcements.cpListTitle') }}
        </h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">
          {{ t('announcements.cpListSubtitle') }}
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
          @click="createFromPreset('maintenance')"
        >
          {{ t('announcements.cpPresetMaintenance') }}
        </button>
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100"
          @click="createFromPreset('security')"
        >
          {{ t('announcements.cpPresetSecurity') }}
        </button>
        <router-link
          to="/control/announcements/new"
          class="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          {{ t('announcements.cpCreate') }}
        </router-link>
      </div>
    </div>

    <div class="mb-4 flex flex-wrap items-center gap-3">
      <label class="text-sm text-gray-600 dark:text-gray-400" for="pa-status-filter">
        {{ t('announcements.colStatus') }}
      </label>
      <select
        id="pa-status-filter"
        v-model="statusFilter"
        class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        @change="loadRows"
      >
        <option value="">{{ t('announcements.cpAllStatuses') }}</option>
        <option v-for="status in statusOptions" :key="status" :value="status">
          {{ status }}
        </option>
      </select>
      <label class="text-sm text-gray-600 dark:text-gray-400" for="pa-category-filter">
        {{ t('announcements.cpColCategory') }}
      </label>
      <select
        id="pa-category-filter"
        v-model="categoryFilter"
        class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        @change="loadRows"
      >
        <option value="">{{ t('announcements.cpAllCategories') }}</option>
        <option v-for="cat in categoryOptions" :key="cat" :value="cat">
          {{ cat }}
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

      <div v-else-if="!rows.length" class="px-6 py-16 text-center text-sm text-gray-500 dark:text-gray-400">
        {{ t('announcements.cpListEmpty') }}
      </div>

      <table v-else class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900/50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('announcements.colTitle') }}
            </th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('announcements.cpColCategory') }}
            </th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('announcements.colPriority') }}
            </th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('announcements.colStatus') }}
            </th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('announcements.cpColAudience') }}
            </th>
            <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('announcements.actions') }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <tr v-for="row in rows" :key="row.id" class="hover:bg-gray-50 dark:hover:bg-gray-900/40">
            <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
              {{ row.title }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
              {{ row.category }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
              {{ row.priority }}
            </td>
            <td class="px-4 py-3">
              <span :class="statusClass(row.status)" class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium">
                {{ row.status }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              {{ audienceLabel(row) }}
            </td>
            <td class="px-4 py-3 text-right">
              <router-link
                v-if="!row.isSystem"
                :to="`/control/announcements/${row.id}`"
                class="text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
              >
                {{ t('actions.edit') }}
              </router-link>
              <span v-else class="text-xs text-gray-400">{{ t('announcements.cpSystemManaged') }}</span>
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
import {
  createPlatformAnnouncement,
  listPlatformAnnouncements,
} from '@/utils/platformAnnouncementsApi';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();

const loading = ref(false);
const error = ref('');
const rows = ref([]);
const statusFilter = ref('');
const categoryFilter = ref('');
const statusOptions = ['draft', 'scheduled', 'published', 'paused', 'archived'];
const categoryOptions = ['maintenance', 'security', 'product', 'general', 'system'];

function statusClass(status) {
  if (status === 'published') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  if (status === 'scheduled') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
  if (status === 'paused') return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200';
  if (status === 'archived') return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

function audienceLabel(row) {
  if (row.targetMode === 'all') return t('announcements.cpAudienceAll');
  const count = row.targetOrganizationIds?.length || 0;
  return t('announcements.cpAudienceOrgs', { count });
}

async function loadRows() {
  loading.value = true;
  error.value = '';
  try {
    const response = await listPlatformAnnouncements({
      status: statusFilter.value || undefined,
      category: categoryFilter.value || undefined,
      includeSystem: categoryFilter.value === 'system',
      limit: 50,
    });
    rows.value = response?.data?.announcements || [];
  } catch (err) {
    console.error('[PlatformAnnouncementsList] load failed:', err);
    error.value = t('announcements.cpLoadFailed');
  } finally {
    loading.value = false;
  }
}

async function createFromPreset(preset) {
  error.value = '';
  try {
    const response = await createPlatformAnnouncement({ preset });
    const id = response?.data?.id;
    if (id) {
      await router.push(`/control/announcements/${id}`);
      return;
    }
    error.value = t('announcements.cpCreateFailed');
  } catch (err) {
    console.error('[PlatformAnnouncementsList] preset create failed:', err);
    error.value = err?.response?.data?.message || t('announcements.cpCreateFailed');
  }
}

onMounted(() => {
  document.title = t('announcements.cpListTitle');
  if (!authStore.isPlatformAdmin) {
    router.push({ name: 'dashboard' });
    return;
  }
  void loadRows();
});
</script>
