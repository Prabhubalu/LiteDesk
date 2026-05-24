<template>
  <TargetProgressWidget app-key="HELPDESK" module-key="cases" :title="t('performance.targetsQuotasTitle')" />
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import TargetProgressWidget from './TargetProgressWidget.vue';

const { t } = useI18n();
</script>
