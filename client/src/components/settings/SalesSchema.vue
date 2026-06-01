<template>
  <ModulesAndFields
    class="flex min-h-0 flex-1 flex-col overflow-hidden"
    ref="modulesAndFieldsRef"
    :module-filter="salesSchemaFilter"
    :excluded-tabs="['pipeline', 'playbooks']"
    :title="t('settings.appsSalesModules')"
    :hide-header="true"
    :start-with-module-list="true"
    :on-navigate-to-pipelines="onNavigateToPipelines"
  />
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
  /** Callback to open Pipelines & Stages (e.g. switch parent tab when editing Deal Stage/Pipeline field) */
  onNavigateToPipelines: {
    type: Function,
    default: null
  }
});
import { useAuthStore } from '@/stores/authRegistry';
import ModulesAndFields from './ModulesAndFields.vue';

const emit = defineEmits(['selected-module-change']);
const authStore = useAuthStore();
const modulesAndFieldsRef = ref(null);

watch(
  () => modulesAndFieldsRef.value?.selectedModule,
  (mod) => { emit('selected-module-change', mod ?? null); },
  { immediate: true }
);

// Sales schema modules: Deals + all custom modules (custom modules appear in Sales module list)
const salesSchemaFilter = (module) => {
  // Check if Sales app is installed
  if (!authStore.hasAppAccess('SALES')) {
    return false;
  }
  // Custom modules always show in Sales module list
  if (module.type === 'custom') return true;
  // Sales-specific system modules (Deals only; others are core entities)
  const salesModuleKeys = ['deals'];
  return salesModuleKeys.includes(module.key?.toLowerCase());
};

function openCreateModal() {
  modulesAndFieldsRef.value?.openCreateModal?.();
}

function goBackToModuleList() {
  modulesAndFieldsRef.value?.clearSelection?.();
}

defineExpose({ openCreateModal, goBackToModuleList });
</script>

