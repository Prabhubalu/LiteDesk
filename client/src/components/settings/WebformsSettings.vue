<template>
  <WebformSubmissionsPanel
    v-if="activeWebformId && activeView === 'submissions'"
    :webform-id="activeWebformId"
  />
  <WebformBuilder
    v-else-if="activeWebformId"
    :webform-id="activeWebformId"
  />
  <SettingsScrollPanel v-else>
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('webforms.hubTitle') }}</h2>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('webforms.hubDescription') }}</p>
        </div>
        <button
          v-if="canCreate && !loading && webforms.length > 0"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          :disabled="creating"
          @click="openCreateModal"
        >
          <PlusIcon class="h-4 w-4" />
          {{ t('webforms.hubCreateLabel') }}
        </button>
      </div>
    </template>

    <div class="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div class="rounded-xl border border-gray-200 bg-white px-5 py-4 dark:border-gray-700 dark:bg-gray-800">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('webforms.statTotal') }}</p>
        <p class="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{{ stats.total }}</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white px-5 py-4 dark:border-gray-700 dark:bg-gray-800">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('webforms.statActive') }}</p>
        <p class="mt-1 text-3xl font-bold text-emerald-600 dark:text-emerald-400">{{ stats.active }}</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white px-5 py-4 dark:border-gray-700 dark:bg-gray-800">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('webforms.statSubmissions') }}</p>
        <p class="mt-1 text-3xl font-bold text-indigo-600 dark:text-indigo-400">{{ stats.submissions }}</p>
      </div>
    </div>

    <div class="mb-4 flex flex-wrap items-center gap-2">
      <div class="relative w-full max-w-xs">
        <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          v-model="searchQuery"
          type="search"
          :placeholder="t('webforms.hubSearchPlaceholder')"
          class="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          @keydown.enter.prevent="fetchWebforms"
        />
      </div>
      <select
        v-model="statusFilter"
        class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        @change="fetchWebforms"
      >
        <option value="all">{{ t('webforms.filterAllStatuses') }}</option>
        <option value="Draft">{{ t('webforms.statusDraft') }}</option>
        <option value="Active">{{ t('webforms.statusActive') }}</option>
        <option value="Archived">{{ t('webforms.statusArchived') }}</option>
      </select>
      <button
        type="button"
        class="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        @click="fetchWebforms"
      >
        {{ t('actions.refresh') }}
      </button>
    </div>

    <div v-if="loading" class="flex justify-center py-16">
      <div class="h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
    </div>

    <div
      v-else-if="webforms.length === 0"
      class="rounded-2xl border border-dashed border-gray-300 px-6 py-14 text-center dark:border-gray-600"
    >
      <DocumentTextIcon class="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
      <p class="mt-3 text-sm font-medium text-gray-900 dark:text-white">{{ t('webforms.hubEmptyTitle') }}</p>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('webforms.hubEmptyMessage') }}</p>
      <button
        v-if="canCreate"
        type="button"
        class="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        :disabled="creating"
        @click="openCreateModal"
      >
        <PlusIcon class="h-4 w-4" />
        {{ t('webforms.hubCreateLabel') }}
      </button>
    </div>

    <div v-else class="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900/40">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('webforms.colName') }}</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('webforms.colTarget') }}</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('webforms.colStatus') }}</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('webforms.colSubmissions') }}</th>
            <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('webforms.colActions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
          <tr v-for="row in webforms" :key="row._id">
            <td class="px-4 py-3">
              <div class="font-medium text-gray-900 dark:text-white">{{ row.name }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">{{ row.webformId }}</div>
            </td>
            <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{{ targetLabel(row.targetModuleKey) }}</td>
            <td class="px-4 py-3">
              <span
                class="rounded-full px-2 py-0.5 text-xs font-semibold"
                :class="statusClass(row.status)"
              >
                {{ statusLabel(row.status) }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
              <button
                type="button"
                class="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                @click="openSubmissions(row)"
              >
                {{ row.totalSubmissions || 0 }}
              </button>
            </td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-2">
                <button
                  type="button"
                  class="rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                  @click="openSubmissions(row)"
                >
                  {{ t('webforms.actionSubmissions') }}
                </button>
                <button
                  v-if="canEdit"
                  type="button"
                  class="rounded-lg px-2.5 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                  @click="openWebform(row)"
                >
                  {{ t('actions.edit') }}
                </button>
                <button
                  v-if="canDelete"
                  type="button"
                  class="rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                  @click="deleteWebform(row)"
                >
                  {{ t('actions.delete') }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </SettingsScrollPanel>

  <WebformCreateSetupModal
    :open="showCreateModal"
    @close="showCreateModal = false"
    @create="onCreateSetup"
  />
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import {
  DocumentTextIcon,
  MagnifyingGlassIcon,
  PlusIcon
} from '@heroicons/vue/24/outline';
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import WebformBuilder from '@/components/webforms/WebformBuilder.vue';
import WebformSubmissionsPanel from '@/components/webforms/WebformSubmissionsPanel.vue';
import WebformCreateSetupModal from '@/components/webforms/WebformCreateSetupModal.vue';
import apiClient from '@/utils/apiClient';
import { buildMandatoryWebformFields } from '@/utils/webformModuleFields';
import { fetchWebformModuleDefinition } from '@/utils/webformModuleDefinition';
import { useAuthStore } from '@/stores/authRegistry';
import { canManageWebforms } from '@/utils/settingsTabAccess';
import { captureWebformsSettingsViewed } from '@/config/posthogWebforms';

import { confirmAction } from '@/composables/useConfirmAction';
const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const loading = ref(false);
const creating = ref(false);
const showCreateModal = ref(false);
const webforms = ref([]);
const searchQuery = ref('');
const statusFilter = ref('all');

const activeWebformId = computed(() => {
  const id = route.query.webformId;
  return typeof id === 'string' && id.length > 0 ? id : '';
});

const activeView = computed(() => {
  return route.query.view === 'submissions' ? 'submissions' : 'builder';
});

const settingsAccessCtx = computed(() => ({
  isOwner: !!authStore.user?.isOwner,
  role: authStore.user?.role,
  permissions: authStore.user?.permissions
}));

const canCreate = computed(() => canManageWebforms(settingsAccessCtx.value, 'create'));
const canEdit = computed(() => canManageWebforms(settingsAccessCtx.value, 'edit'));
const canDelete = computed(() => canManageWebforms(settingsAccessCtx.value, 'delete'));

const stats = computed(() => ({
  total: webforms.value.length,
  active: webforms.value.filter((row) => row.status === 'Active').length,
  submissions: webforms.value.reduce((sum, row) => sum + (row.totalSubmissions || 0), 0)
}));

function targetLabel(moduleKey) {
  const key = String(moduleKey || '').toLowerCase();
  if (key === 'people') return t('webforms.targetPeople');
  if (key === 'organizations') return t('webforms.targetOrganizations');
  if (key === 'cases') return t('webforms.targetCases');
  if (key === 'deals') return t('webforms.targetDeals');
  return key;
}

function statusLabel(status) {
  if (status === 'Active') return t('webforms.statusActive');
  if (status === 'Archived') return t('webforms.statusArchived');
  return t('webforms.statusDraft');
}

function statusClass(status) {
  if (status === 'Active') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
  }
  if (status === 'Archived') {
    return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  }
  return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
}

async function fetchWebforms() {
  loading.value = true;
  try {
    const params = {};
    if (searchQuery.value.trim()) params.search = searchQuery.value.trim();
    if (statusFilter.value !== 'all') params.status = statusFilter.value;
    const res = await apiClient.get('/webforms', { params });
    webforms.value = res?.success && Array.isArray(res.data) ? res.data : [];
  } catch {
    webforms.value = [];
  } finally {
    loading.value = false;
  }
}

async function openCreateModal() {
  showCreateModal.value = true;
}

async function onCreateSetup({ name, targetModuleKey, targetAppKey }) {
  creating.value = true;
  try {
    let fields = [];
    try {
      const { fields: moduleFields } = await fetchWebformModuleDefinition(targetModuleKey);
      fields = buildMandatoryWebformFields(targetModuleKey, moduleFields);
    } catch {
      fields = [];
    }

    const res = await apiClient.post('/webforms', {
      name,
      status: 'Draft',
      targetModuleKey,
      targetAppKey,
      fields
    });
    if (res?.success && res.data?._id) {
      showCreateModal.value = false;
      await fetchWebforms();
      openWebform(res.data);
    }
  } finally {
    creating.value = false;
  }
}

function openWebform(row) {
  router.replace({
    path: '/settings',
    query: {
      ...route.query,
      tab: 'webforms',
      webformId: row._id
    }
  });
}

function openSubmissions(row) {
  router.replace({
    path: '/settings',
    query: {
      tab: 'webforms',
      webformId: row._id,
      view: 'submissions'
    }
  });
}

async function deleteWebform(row) {
  if (!await confirmAction(t('webforms.confirmDelete'))) return;
  try {
    await apiClient.delete(`/webforms/${row._id}`);
    await fetchWebforms();
  } catch {
    // apiClient surfaces toast/errors
  }
}

onMounted(() => {
  captureWebformsSettingsViewed();
  fetchWebforms();
});

watch(
  () => [route.query.tab, route.query.webformId, route.query.view],
  ([tab, webformId]) => {
    if (tab === 'webforms' && !webformId) {
      fetchWebforms();
    }
  }
);
</script>
