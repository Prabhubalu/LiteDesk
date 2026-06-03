<template>
  <SettingsScrollPanel>
    <template #header>
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.tabCoreModules') }}</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ t('settings.tabCoreModulesDesc') }}
        </p>
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
          {{ error.message || t('settings.settingsCoreModLoadFailed') }}
        </p>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!loading && !error && modules.length === 0" class="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
      <svg class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('settings.settingsCoreModEmptyTitle') }}</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.settingsCoreModEmptyBody') }}</p>
    </div>

    <!-- Modules Grid -->
    <div
      v-else
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      <div
        v-for="module in modules"
        :key="module.moduleKey"
        @click="viewModuleDetail(module.moduleKey)"
        class="group flex flex-col h-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-lg hover:border-indigo-500/50 dark:hover:border-indigo-400/50 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
      >
        <!-- Card Header -->
        <div class="flex items-start gap-3 mb-4">
          <div class="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 transition-colors">
            <component :is="getModuleIcon(module.moduleKey)" class="w-6 h-6" />
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="text-base font-semibold text-gray-900 dark:text-white truncate">
              {{ module.name }}
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {{ moduleCardCounts(module.moduleKey) }}
            </p>
            <p
              v-if="showModuleDescription(module)"
              class="text-sm text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2"
            >
              {{ module.description }}
            </p>
          </div>
          <svg class="flex-shrink-0 w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </div>

        <!-- Badges -->
        <div class="flex flex-wrap gap-2">
          <span
            v-if="module.platformOwned"
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            {{ t('settings.modFieldsBadgeCore') }}
          </span>
          <span
            v-else
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            {{ t('settings.modFieldsBadgeApp') }}
          </span>
          <span
            v-if="module.applications && module.applications.length > 1"
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {{ t('settings.settingsCoreModBadgeShared') }}
          </span>
          <span
            v-if="module.applications && module.applications.some(app => app.required && !app.canToggle)"
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
            :title="t('settings.settingsCoreModLockedTooltip')"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            {{ t('settings.modFieldsLocked') }}
          </span>
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
import { fetchCoreModulesSettingsCached, fetchModulesListCached, invalidateTenantSchemaCaches } from '@/utils/tenantSchemaApiCache';
import {
  UsersIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  CalendarDaysIcon,
  FolderIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  ShoppingCartIcon,
  CubeIcon,
} from '@heroicons/vue/24/outline';

const { t } = useI18n();
const router = useRouter();

// Module-specific icons (matches sidebar and tab navigation)
const moduleIconMap = {
  people: UsersIcon,
  organizations: BuildingOfficeIcon,
  tasks: CheckCircleIcon,
  events: CalendarDaysIcon,
  items: FolderIcon,
  forms: ClipboardDocumentListIcon,
  quotes: DocumentTextIcon,
  sales_orders: ShoppingCartIcon,
  invoices: DocumentTextIcon,
};

function getModuleIcon(moduleKey) {
  const key = (moduleKey || '').toLowerCase();
  return moduleIconMap[key] || CubeIcon;
}

// Hide redundant "[Module name] - Shared platform capability" (section subtitle already states this)
function showModuleDescription(module) {
  if (!module.description || !module.name) return false;
  const d = module.description.trim();
  const redundant = `${module.name} - Shared platform capability`;
  return d !== redundant && d.toLowerCase() !== redundant.toLowerCase();
}

const modules = ref([]);
const loading = ref(true);
const error = ref(null);
// Counts from GET /modules (key -> { fields, relationships })
const countsByKey = ref({});

const fetchCoreModules = async () => {
  loading.value = true;
  error.value = null;

  try {
    const [coreRes, modulesRes] = await Promise.all([
      fetchCoreModulesSettingsCached(),
      fetchModulesListCached({}).catch(() => ({ data: {} }))
    ]);

    const data = coreRes;
    if (data && data.modules) {
      modules.value = data.modules.sort((a, b) => {
        const orderA = a.order !== undefined ? a.order : 999;
        const orderB = b.order !== undefined ? b.order : 999;
        return orderA - orderB;
      });
    } else {
      modules.value = [];
    }

    // apiClient returns the response body: { success, data: modulesArray }
    const list = Array.isArray(modulesRes?.data) ? modulesRes.data : [];
    const map = {};
    for (const m of list) {
      const key = (m.key || m.moduleKey || '').toLowerCase();
      if (!key) continue;
      map[key] = {
        fields: typeof m.fieldCount === 'number' ? m.fieldCount : (Array.isArray(m.fields) ? m.fields.length : 0),
        relationships: Array.isArray(m.relationships) ? m.relationships.length : 0
      };
    }
    countsByKey.value = map;
  } catch (err) {
    console.error('Failed to fetch core modules:', err);
    error.value = err;
    modules.value = [];
  } finally {
    loading.value = false;
  }
};

function getModuleCounts(moduleKey) {
  const key = (moduleKey || '').toLowerCase();
  const c = countsByKey.value[key];
  return c ? { fields: c.fields, relationships: c.relationships } : { fields: 0, relationships: 0 };
}

function moduleCardCounts(moduleKey) {
  const counts = getModuleCounts(moduleKey);
  return t('settings.modFieldsCardCounts', counts);
}

const viewModuleDetail = (moduleKey) => {
  router.push(`/settings?tab=core-modules&moduleKey=${moduleKey}`);
};

onMounted(() => {
  // Bust stale cache after Quotes was promoted to a platform core module
  invalidateTenantSchemaCaches();
  fetchCoreModules();
});
</script>
