<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { isFiniteSubscriptionLimit } from '@/utils/subscriptionLimits';

const props = defineProps({
  trial: {
    type: Object,
    default: null
  }
});

const { t } = useI18n();

const bannerText = computed(() => {
  if (!props.trial || props.trial.daysRemaining == null) return '';

  const days = props.trial.daysRemaining;
  const used = props.trial.contactsUsed ?? 0;

  if (!isFiniteSubscriptionLimit(props.trial.contactsLimit)) {
    return t('onboarding.trialBannerUnlimited', { days, used });
  }

  return t('onboarding.trialBanner', {
    days,
    used,
    limit: props.trial.contactsLimit
  });
});
</script>

<template>
  <div
    v-if="trial && trial.daysRemaining != null"
    class="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
  >
    {{ bannerText }}
  </div>
</template>
