<template>
  <Teleport to="body">
    <!-- Module Selection -->
    <div
      v-if="!selectedModule"
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-black/60 via-black/50 to-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-module-title"
      @keydown.escape="$emit('close')"
    >
      <div
        class="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl animate-slide-up dark:border-gray-700 dark:bg-gray-900"
        @click.stop
      >
        <!-- Header -->
        <div class="relative bg-gradient-to-r from-indigo-600 to-indigo-700 px-8 py-6 dark:from-indigo-700 dark:to-indigo-800">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="h-7 w-7 text-white">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p class="text-xs font-medium uppercase tracking-wide text-indigo-200">
                  {{ t('import.importWizardProgressStep', { current: 1, total: 5 }) }}
                </p>
                <h2 id="import-module-title" class="text-2xl font-bold text-white">
                  {{ t('import.universalImportModalImportData') }}
                </h2>
                <p class="mt-0.5 text-sm text-indigo-100">
                  {{ t('import.universalImportModalStepHint') }}
                </p>
              </div>
            </div>
            <button
              type="button"
              class="rounded-xl p-2.5 text-white/80 transition-all duration-200 hover:bg-white/20 hover:text-white"
              :aria-label="t('actions.close')"
              @click="$emit('close')"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="h-6 w-6">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Step dots -->
          <div class="mt-5 flex items-center gap-2">
            <span
              v-for="n in 5"
              :key="n"
              class="h-1.5 flex-1 rounded-full transition-colors"
              :class="n === 1 ? 'bg-white' : 'bg-white/25'"
            />
          </div>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto bg-gray-50 px-8 py-6 dark:bg-gray-800/50">
          <p class="mb-5 text-center text-sm text-gray-600 dark:text-gray-400">
            {{ t('import.universalImportModalChooseWhichModuleYouWantTo') }}
          </p>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              v-for="module in modules"
              :key="module.key"
              type="button"
              class="group w-full rounded-xl border-2 border-gray-200 bg-white p-5 text-left transition-all hover:border-indigo-500 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-indigo-400"
              @click="selectModule(module.key)"
            >
              <div class="flex items-center gap-4">
                <div
                  class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white"
                  :class="module.gradient"
                >
                  <component :is="module.icon" class="h-6 w-6" aria-hidden="true" />
                </div>
                <div class="min-w-0 flex-1">
                  <h4 class="font-semibold text-gray-900 transition-colors group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
                    {{ module.label }}
                  </h4>
                  <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{{ module.description }}</p>
                </div>
                <svg class="h-5 w-5 flex-shrink-0 text-gray-300 transition-colors group-hover:text-indigo-500 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- CSV Import Modal (once module selected) -->
  <CSVImportModal
    v-if="selectedModule"
    :entity-type="selectedModule"
    :file-name="fileName"
    :wizard-step-offset="2"
    allow-module-change
    @change-module="selectedModule = null"
    @close="handleClose"
    @import-complete="handleImportComplete"
  />
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, computed, h } from 'vue';
import CSVImportModal from './CSVImportModal.vue';

const emit = defineEmits(['close', 'import-complete']);

const { t } = useI18n();

const selectedModule = ref(null);
const fileName = ref('');

const modules = computed(() => [
  {
    key: 'Contacts',
    label: t('settings.settingsSubDetailUsageContacts'),
    description: t('import.universalImportModalImportCustomerContactsLeadsAndProspects'),
    gradient: 'from-blue-500 to-blue-600',
    icon: {
      render() {
        return h('svg', { xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' }, [
          h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' }),
        ]);
      },
    },
  },
  {
    key: 'Deals',
    label: t('settings.settingsSubDetailUsageDeals'),
    description: t('import.universalImportModalImportSalesOpportunitiesAndDeals'),
    gradient: 'from-green-500 to-green-600',
    icon: {
      render() {
        return h('svg', { xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' }, [
          h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' }),
        ]);
      },
    },
  },
  {
    key: 'Tasks',
    label: t('settings.coreModDetailModuleTasks'),
    description: t('import.universalImportModalImportTasksAndToDoItems'),
    gradient: 'from-purple-500 to-purple-600',
    icon: {
      render() {
        return h('svg', { xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' }, [
          h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' }),
        ]);
      },
    },
  },
  {
    key: 'Organizations',
    label: t('settings.coreModDetailModuleOrganizations'),
    description: t('import.universalImportModalImportCompaniesAndOrganizations'),
    gradient: 'from-orange-500 to-orange-600',
    icon: {
      render() {
        return h('svg', { xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' }, [
          h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' }),
        ]);
      },
    },
  },
]);

const selectModule = (module) => {
  selectedModule.value = module;
};

const handleClose = () => {
  selectedModule.value = null;
  fileName.value = '';
  emit('close');
};

const handleImportComplete = (data) => {
  emit('import-complete', data);
  handleClose();
};
</script>

<style scoped>
@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.animate-slide-up {
  animation: slide-up 0.3s ease-out;
}
</style>
