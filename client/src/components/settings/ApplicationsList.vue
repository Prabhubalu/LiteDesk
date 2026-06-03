<template>
  <SettingsScrollPanel>
    <template #header>
      <div class="flex items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.tabApplications') }}</h2>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {{ t('settings.settingsAppsListSubtitle') }}
          </p>
        </div>
        <button
          @click="viewAppManagement"
          class="shrink-0 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors border border-indigo-200 dark:border-indigo-800"
        >
          {{ t('settings.settingsAppsToggleManagement') }}
        </button>
      </div>
    </template>

    <div class="space-y-6">
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-sm text-red-800 dark:text-red-300">
          {{ error.message || t('settings.settingsAppsLoadFailed') }}
        </p>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!loading && !error && applications.length === 0" class="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
      <svg class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('settings.settingsAppsEmptyTitle') }}</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.settingsAppsEmptyBody') }}</p>
    </div>

    <!-- Applications Grid (same layout as Core Modules) -->
    <div
      v-else
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      <div
        v-for="app in applications"
        :key="app.appKey"
        @click="viewApplicationDetail(app.appKey)"
        class="group flex flex-col h-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-lg hover:border-indigo-500/50 dark:hover:border-indigo-400/50 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
      >
        <!-- Card Header -->
        <div class="flex items-start gap-3">
          <div class="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 transition-colors">
            <component :is="getAppIcon(app.appKey)" class="w-6 h-6" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h3 class="text-base font-semibold text-gray-900 dark:text-white truncate min-w-0 flex-1">
                {{ app.name }}
              </h3>
              <span
                :class="[
                  'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium flex-shrink-0 ml-auto',
                  getStatusBadgeClass(app.status)
                ]"
              >
                <svg
                  v-if="app.status === 'ENABLED'"
                  class="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <svg
                  v-else-if="app.status === 'TRIAL'"
                  class="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <svg
                  v-else-if="app.status === 'DISABLED'"
                  class="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                {{ getStatusLabel(app.status) }}
              </span>
            </div>
            <p
              v-if="app.description"
              class="text-sm text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2"
            >
              {{ app.description }}
            </p>
          </div>
        </div>
      </div>
    </div>
    </div>
  </SettingsScrollPanel>
</template>

<script setup>
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';
import {
  CurrencyDollarIcon,
  LifebuoyIcon,
  FolderIcon,
  GlobeAltIcon,
  ClipboardDocumentCheckIcon,
  AcademicCapIcon,
  CubeIcon,
} from '@heroicons/vue/24/outline';

const { t } = useI18n();
const router = useRouter();

const appIconMap = {
  sales: CurrencyDollarIcon,
  helpdesk: LifebuoyIcon,
  projects: FolderIcon,
  portal: GlobeAltIcon,
  audit: ClipboardDocumentCheckIcon,
  lms: AcademicCapIcon,
  inventory: CubeIcon,
};

function getAppIcon(appKey) {
  const key = (appKey || '').toLowerCase();
  return appIconMap[key] || CubeIcon;
}
const applications = ref([]);
const loading = ref(true);
const error = ref(null);

const STATUS_LABEL_KEYS = {
  ENABLED: 'settings.settingsAppsStatusEnabled',
  DISABLED: 'settings.settingsAppsStatusDisabled',
  TRIAL: 'settings.settingsAppsStatusTrial',
  SUSPENDED: 'settings.settingsAppsStatusSuspended',
  INCLUDED: 'settings.settingsAppsStatusIncluded',
};

const fetchApplications = async () => {
  loading.value = true;
  error.value = null;

  try {
    const data = await apiClient('/settings/applications', {
      method: 'GET'
    });

    if (data && data.applications) {
      applications.value = data.applications;
    } else {
      applications.value = [];
    }
  } catch (err) {
    console.error('Failed to fetch applications:', err);
    error.value = err;
    applications.value = [];
  } finally {
    loading.value = false;
  }
};

const viewApplicationDetail = (appKey) => {
  router.push({ path: '/settings', query: { tab: 'applications', appKey: appKey } });
};

const viewAppManagement = () => {
  router.push({ path: '/settings', query: { tab: 'applications', view: 'management' } });
};

const getStatusLabel = (status) => {
  const key = STATUS_LABEL_KEYS[status];
  return key ? t(key) : status;
};

const getStatusBadgeClass = (status) => {
  const classes = {
    'ENABLED': 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    'DISABLED': 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
    'TRIAL': 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
    'SUSPENDED': 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300',
    'INCLUDED': 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
  };
  return classes[status] || classes['DISABLED'];
};

onMounted(() => {
  fetchApplications();
});
</script>
