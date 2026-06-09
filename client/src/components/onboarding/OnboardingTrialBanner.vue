<script setup>
import { useI18n } from 'vue-i18n';

defineProps({
  trial: {
    type: Object,
    default: null
  }
});

const { t } = useI18n();
</script>

<template>
  <div
    v-if="trial && trial.daysRemaining != null"
    class="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
  >
    {{ t('onboarding.trialBanner', {
      days: trial.daysRemaining,
      used: trial.contactsUsed ?? 0,
      limit: trial.contactsLimit ?? '—'
    }) }}
  </div>
</template>
