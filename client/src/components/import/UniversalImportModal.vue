<template>
  <Teleport to="body">
    <div
      v-if="!selectedModule"
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-module-title"
      @keydown.escape="$emit('close')"
    >
      <div
        class="flex max-h-[min(92vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        @click.stop
      >
        <div class="border-b border-gray-100 px-5 py-4 dark:border-gray-800 sm:px-6">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <p class="text-xs font-medium text-gray-500 dark:text-gray-400">
                {{ t('import.importWizardProgressStep', { current: 1, total: 5 }) }}
              </p>
              <h2 id="import-module-title" class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t('import.universalImportModalImportData') }}
              </h2>
              <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                {{ t('import.universalImportModalStepHint') }}
              </p>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              :aria-label="t('actions.close')"
              @click="$emit('close')"
            >
              <XMarkIcon class="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div class="mt-4 flex gap-1">
            <span
              v-for="n in 5"
              :key="n"
              class="h-1 flex-1 rounded-full"
              :class="n === 1 ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'"
            />
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
            {{ t('import.universalImportModalChooseWhichModuleYouWantTo') }}
          </p>
          <div class="space-y-2">
            <button
              v-for="module in modules"
              :key="module.key"
              type="button"
              class="flex w-full items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-left transition-colors hover:border-indigo-400 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-indigo-500 dark:hover:bg-gray-800/50"
              @click="selectModule(module.key)"
            >
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
                :class="module.gradient"
              >
                <component :is="module.icon" class="h-5 w-5" aria-hidden="true" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ module.label }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ module.description }}</p>
              </div>
              <ChevronRightIcon class="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

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
import { ChevronRightIcon, XMarkIcon } from '@heroicons/vue/24/outline';
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
    gradient: 'bg-blue-600',
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
    gradient: 'bg-emerald-600',
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
    gradient: 'bg-violet-600',
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
    gradient: 'bg-orange-600',
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
