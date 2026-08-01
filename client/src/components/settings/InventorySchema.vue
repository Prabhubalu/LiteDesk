<template>
  <ModulesAndFields
    class="flex min-h-0 flex-1 flex-col overflow-hidden"
    ref="modulesAndFieldsRef"
    :module-filter="inventorySchemaFilter"
    :excluded-tabs="['pipeline', 'playbooks']"
    :title="t('settings.appsInventoryModules')"
    :hide-header="true"
    :start-with-module-list="shouldStartWithModuleList"
  />
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import { isInventorySchemaModuleKey } from '@/utils/inventoryWorkbenchNav';
import ModulesAndFields from './ModulesAndFields.vue';

const { t } = useI18n();
const emit = defineEmits(['selected-module-change']);
const authStore = useAuthStore();
const route = useRoute();
const modulesAndFieldsRef = ref(null);
const shouldStartWithModuleList = computed(() => {
  return typeof route.query.module !== 'string' || !route.query.module.trim();
});

watch(
  () => modulesAndFieldsRef.value?.selectedModule,
  (mod) => { emit('selected-module-change', mod ?? null); },
  { immediate: true }
);

const inventorySchemaFilter = (module) => {
  if (!authStore.hasAppAccess('INVENTORY')) return false;

  const moduleKey = String(module?.key || module?.moduleKey || '').toLowerCase();
  const moduleAppKey = String(module?.appKey || '').toLowerCase();

  if (isInventorySchemaModuleKey(moduleKey)) return true;
  if (moduleAppKey === 'inventory') return true;

  return false;
};

function goBackToModuleList() {
  modulesAndFieldsRef.value?.clearSelection?.();
}

defineExpose({ goBackToModuleList });
</script>
