<template>
  <ModulesAndFields :module-filter="coreEntitiesFilter" :title="t('settings.settingsCoreEntitiesTitle')" />
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import ModulesAndFields from './ModulesAndFields.vue';

const { t } = useI18n();

// Core entities: People, Organizations, Events, Forms, Tasks, Items, and Reports
const coreEntitiesFilter = (module) => {
  const coreKeys = ['people', 'organizations', 'events', 'forms', 'tasks', 'items', 'quotes', 'sales_orders', 'invoices', 'reports'];
  return coreKeys.includes(module.key?.toLowerCase());
};
</script>
