<template>
  <SettingsScrollPanel>
    <template #header>
      <button
        @click="goBack"
        class="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors mb-2"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <span>{{ t('settings.settingsAppMgmtBack') }}</span>
      </button>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <!-- Application Icon -->
          <div class="flex items-center justify-center w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ application?.name || t('settings.settingsAppDetailTitleFallback') }}</h2>
            <p v-if="application?.description" class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ application.description }}</p>
          </div>
        </div>
        <!-- Status Badge -->
        <div v-if="application" class="flex items-center gap-2">
          <span
            :class="[
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium',
              getStatusBadgeClass(application.status)
            ]"
          >
            <svg
              v-if="application.status === 'ENABLED'"
              class="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <svg
              v-else-if="application.status === 'TRIAL'"
              class="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {{ getStatusLabel(application.status) }}
          </span>
        </div>
      </div>
    </template>

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
          {{ error.message || t('settings.settingsAppDetailLoadFailed') }}
        </p>
      </div>
    </div>

    <!-- Application Details -->
    <div v-else-if="application" class="space-y-6">
      <!-- SECTION B: Configure Sales (Primary Actions) -->
      <div v-if="(application.status === 'ENABLED' || application.status === 'TRIAL') && isSalesApp" class="space-y-4">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">{{ t('settings.settingsAppDetailConfigureTitle', { app: t('settings.appsNameSales') }) }}</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {{ t('settings.settingsAppDetailConfigureSalesSubtitle') }}
          </p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            v-for="config in salesConfigOptions"
            :key="config.id"
            @click="navigateToSalesConfig(config.id)"
            class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md hover:border-indigo-500 dark:hover:border-indigo-400 transition-all cursor-pointer group text-left"
          >
            <div class="flex items-start gap-4">
              <div class="flex items-center justify-center w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 transition-colors flex-shrink-0">
                <component :is="config.icon" class="w-6 h-6" />
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="text-base font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mb-1">
                  {{ configOptionLabel(config) }}
                </h4>
                <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                  {{ configOptionDesc(config) }}
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>

      <!-- SECTION B2: Configure Helpdesk (Primary Actions) -->
      <div v-if="(application.status === 'ENABLED' || application.status === 'TRIAL') && isHelpdeskApp" class="space-y-4">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">{{ t('settings.settingsAppDetailConfigureTitle', { app: t('settings.appsNameHelpdesk') }) }}</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {{ t('settings.settingsAppDetailConfigureHelpdeskSubtitle') }}
          </p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            v-for="config in helpdeskConfigOptions"
            :key="config.id"
            @click="navigateToHelpdeskConfig(config.id)"
            class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md hover:border-indigo-500 dark:hover:border-indigo-400 transition-all cursor-pointer group text-left"
          >
            <div class="flex items-start gap-4">
              <div class="flex items-center justify-center w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 transition-colors flex-shrink-0">
                <component :is="config.icon" class="w-6 h-6" />
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="text-base font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mb-1">
                  {{ configOptionLabel(config) }}
                </h4>
                <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                  {{ configOptionDesc(config) }}
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>

      <!-- SECTION A: Dependencies (Informational - Read-Only) -->
      <div class="space-y-6">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">{{ t('settings.settingsAppDetailDependencies') }}</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {{ t('settings.settingsAppDetailDependenciesBody', { appName: application.name }) }}
          </p>
        </div>

        <!-- Required Dependencies -->
        <div v-if="application.dependencies?.required && application.dependencies.required.length > 0">
          <div class="flex items-center gap-2 mb-3">
            <h4 class="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              {{ t('settings.settingsAppDetailRequiredDeps') }}
            </h4>
            <span class="text-xs text-gray-500 dark:text-gray-500">
              {{ moduleCountLabel(application.dependencies.required.length) }}
            </span>
          </div>
          <div class="space-y-3">
            <div
              v-for="dep in application.dependencies.required"
              :key="dep.moduleKey"
              @click="viewModuleDetail(dep.moduleKey)"
              class="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md hover:border-indigo-500 dark:hover:border-indigo-400 transition-all cursor-pointer group"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center gap-3 mb-2">
                    <h4 class="text-base font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {{ dep.moduleName }}
                    </h4>
                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      {{ t('settings.modFieldsDepRequired') }}
                    </span>
                  </div>
                  <p v-if="dep.description" class="text-sm text-gray-600 dark:text-gray-400">
                    {{ dep.description }}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {{ t('settings.settingsAppDetailViewDetailsHint') }}
                  </p>
                </div>
                <!-- Locked Status -->
                <span
                  class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                  :title="t('settings.settingsAppDetailDepLockedTooltip')"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  {{ t('settings.orgLocked') }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Optional Dependencies -->
        <div v-if="application.dependencies?.optional && application.dependencies.optional.length > 0">
          <div class="flex items-center gap-2 mb-3">
            <h4 class="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              {{ t('settings.settingsAppDetailOptionalDeps') }}
            </h4>
            <span class="text-xs text-gray-500 dark:text-gray-500">
              {{ moduleCountLabel(application.dependencies.optional.length) }}
            </span>
          </div>
          <div class="space-y-3">
            <div
              v-for="dep in application.dependencies.optional"
              :key="dep.moduleKey"
              @click="viewModuleDetail(dep.moduleKey)"
              class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md hover:border-indigo-500 dark:hover:border-indigo-400 transition-all cursor-pointer group"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center gap-3 mb-2">
                    <h4 class="text-base font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {{ dep.moduleName }}
                    </h4>
                    <span
                      v-if="dep.enabled"
                      class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                    >
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                      {{ t('settings.settingsAppsStatusEnabled') }}
                    </span>
                    <span
                      v-else
                      class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                    >
                      {{ t('settings.settingsAppsStatusDisabled') }}
                    </span>
                  </div>
                  <p v-if="dep.description" class="text-sm text-gray-600 dark:text-gray-400">
                    {{ dep.description }}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {{ t('settings.settingsAppDetailViewDetailsHint') }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- No Dependencies Message -->
        <div v-if="(!application.dependencies?.required || application.dependencies.required.length === 0) && (!application.dependencies?.optional || application.dependencies.optional.length === 0)" class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('settings.settingsAppDetailNoDependencies') }}
          </p>
        </div>
      </div>

      <!-- SECTION C: Shared Platform Entities (Redirect Only) -->
      <div v-if="isSalesApp" class="space-y-4">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">{{ t('settings.settingsAppDetailSharedEntities') }}</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {{ t('settings.settingsAppDetailSharedEntitiesBody') }}
          </p>
        </div>
        <div class="space-y-3">
          <div
            v-for="entity in sharedCoreEntities"
            :key="entity.moduleKey"
            class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
          >
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-2">
                  <h4 class="text-base font-semibold text-gray-900 dark:text-white">
                    {{ sharedEntityLabel(entity) }}
                  </h4>
                  <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                    </svg>
                    {{ t('settings.settingsAppDetailCoreModuleBadge') }}
                  </span>
                </div>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {{ sharedEntityDesc(entity) }}
                </p>
                <button
                  @click="viewModuleDetail(entity.moduleKey)"
                  class="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                >
                  <span>{{ t('settings.settingsAppDetailOpenEntitySettings', { entityName: sharedEntityLabel(entity) }) }}</span>
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </SettingsScrollPanel>
</template>

<script setup>
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import { ref, computed, onMounted, h } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';

const { t } = useI18n();

function moduleCountLabel(count) {
  return count === 1
    ? t('settings.settingsAppDetailModuleCountOne', { count })
    : t('settings.settingsAppDetailModuleCountOther', { count });
}
const route = useRoute();
const router = useRouter();

const application = ref(null);
const loading = ref(true);
const error = ref(null);

const appKey = computed(() => {
  return route.query.appKey || route.params.appKey;
});

const isSalesApp = computed(() => {
  return appKey.value === 'SALES';
});
const isHelpdeskApp = computed(() => {
  return appKey.value === 'HELPDESK';
});

const STATUS_LABEL_KEYS = {
  ENABLED: 'settings.settingsAppsStatusEnabled',
  DISABLED: 'settings.settingsAppsStatusDisabled',
  TRIAL: 'settings.settingsAppsStatusTrial',
  SUSPENDED: 'settings.settingsAppsStatusSuspended',
  INCLUDED: 'settings.settingsAppsStatusIncluded',
};

// Icon components for Sales configuration options
const PipelineIcon = () => h('svg', { class: 'w-6 h-6', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' })
]);

const SchemaIcon = () => h('svg', { class: 'w-6 h-6', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' })
]);

const AutomationIcon = () => h('svg', { class: 'w-6 h-6', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M13 10V3L4 14h7v7l9-11h-7z' })
]);

const PlaybookIcon = () => h('svg', { class: 'w-6 h-6', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' })
]);

const SettingsIcon = () => h('svg', { class: 'w-6 h-6', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' }),
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' })
]);

const PermissionsIcon = () => h('svg', { class: 'w-6 h-6', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' })
]);
const AnalyticsIcon = () => h('svg', { class: 'w-6 h-6', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6' })
]);

function configOptionLabel(option) {
  return option?.nameKey ? t(option.nameKey) : '';
}

function configOptionDesc(option) {
  return option?.descriptionKey ? t(option.descriptionKey) : '';
}

function sharedEntityLabel(entity) {
  return entity?.nameKey ? t(entity.nameKey) : '';
}

function sharedEntityDesc(entity) {
  return entity?.descriptionKey ? t(entity.descriptionKey) : '';
}

// Sales-owned configuration options – Sales Modules first
const salesConfigOptions = [
  {
    id: 'schema',
    nameKey: 'settings.appsSalesModules',
    descriptionKey: 'settings.appsSalesModulesDesc',
    icon: SchemaIcon
  },
  {
    id: 'pipelines',
    nameKey: 'settings.appsPipelines',
    descriptionKey: 'settings.appsPipelinesDesc',
    icon: PipelineIcon
  },
  {
    id: 'automations',
    nameKey: 'settings.settingsAppDetailAutomations',
    descriptionKey: 'settings.settingsAppDetailAutomationsDesc',
    icon: AutomationIcon
  },
  {
    id: 'playbooks',
    nameKey: 'settings.appsPlaybooks',
    descriptionKey: 'settings.appsPlaybooksDesc',
    icon: PlaybookIcon
  },
  {
    id: 'permissions',
    nameKey: 'settings.settingsAppDetailPermissions',
    descriptionKey: 'settings.settingsAppDetailPermissionsDesc',
    icon: PermissionsIcon
  }
];

const helpdeskConfigOptions = [
  {
    id: 'schema',
    nameKey: 'settings.appsHelpdeskCases',
    descriptionKey: 'settings.appsHelpdeskCasesDesc',
    icon: SchemaIcon
  },
  {
    id: 'execution-settings',
    nameKey: 'settings.appsHelpdeskExecution',
    descriptionKey: 'settings.appsHelpdeskExecutionDesc',
    icon: SettingsIcon
  },
  {
    id: 'analytics',
    nameKey: 'settings.appsHelpdeskAnalytics',
    descriptionKey: 'settings.appsHelpdeskAnalyticsDesc',
    icon: AnalyticsIcon
  }
];

// Shared Core entities that Sales uses
const sharedCoreEntities = [
  {
    moduleKey: 'PEOPLE',
    nameKey: 'settings.assignRulesModPeople',
    descriptionKey: 'settings.settingsAppDetailPeopleDesc'
  },
  {
    moduleKey: 'ORGANIZATIONS',
    nameKey: 'settings.assignRulesModOrganizations',
    descriptionKey: 'settings.settingsAppDetailOrganizationsDesc'
  }
];

const navigateToSalesConfig = (configId) => {
  router.push({
    path: '/settings',
    query: {
      tab: 'applications',
      app: 'sales',
      config: configId
    }
  });
};

const navigateToHelpdeskConfig = (configId) => {
  const query = {
    tab: 'applications',
    app: 'helpdesk',
    config: configId
  };
  if (configId === 'schema') {
    query.module = 'cases';
  }
  router.push({
    path: '/settings',
    query
  });
};

const fetchApplication = async () => {
  if (!appKey.value) {
    error.value = new Error(t('settings.settingsSubDetailAppKeyRequired'));
    loading.value = false;
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const data = await apiClient(`/settings/applications/${appKey.value}`, {
      method: 'GET'
    });

    if (data && data.success && data.appKey) {
      application.value = data;
    } else {
      error.value = new Error(t('settings.settingsSubDetailInvalidResponse'));
      application.value = null;
    }
  } catch (err) {
    console.error('Failed to fetch application:', err);
    error.value = err;
    application.value = null;
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  router.push('/settings?tab=applications');
};


const viewModuleDetail = (moduleKey) => {
  router.push({
    path: '/settings',
    query: {
      tab: 'core-modules',
      moduleKey: moduleKey
    }
  });
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
  fetchApplication();
});
</script>
