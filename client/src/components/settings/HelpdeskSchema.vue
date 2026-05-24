<template>
  <ModulesAndFields
    ref="modulesAndFieldsRef"
    :module-filter="helpdeskSchemaFilter"
    :excluded-tabs="['pipeline', 'playbooks']"
    :title="t('settings.appsHelpdeskModules')"
    :hide-header="true"
    :start-with-module-list="shouldStartWithModuleList"
  />
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

const { t } = useI18n();
import { useAuthStore } from '@/stores/authRegistry';
import ModulesAndFields from './ModulesAndFields.vue';

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

const helpdeskSchemaFilter = (module) => {
  if (!authStore.hasAppAccess('HELPDESK')) return false;

  const moduleKey = String(module?.key || module?.moduleKey || '').toLowerCase();
  const moduleAppKey = String(module?.appKey || '').toLowerCase();
  const moduleRoute = String(module?.ui?.routeBase || module?.routeBase || '').toLowerCase();

  const caseLikeModule = ['cases', 'ticket', 'tickets', 'ticklets'].includes(moduleKey);
  // /modules responses can omit appKey for org-level overrides, so key-based match is primary.
  if (caseLikeModule) return true;
  if (moduleAppKey === 'helpdesk' && moduleRoute === '/helpdesk/cases') return true;

  return false;
};

function goBackToModuleList() {
  modulesAndFieldsRef.value?.clearSelection?.();
}

defineExpose({ goBackToModuleList });
</script>

