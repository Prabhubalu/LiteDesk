<template>
  <div class="mx-auto max-w-2xl px-6 py-10">
    <h1 class="text-xl font-semibold text-gray-900 dark:text-white">
      {{ title }}
    </h1>
    <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
      {{ t('marketing.moduleComingSoon') }}
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  moduleKey: {
    type: String,
    required: true
  }
});

const { t } = useI18n();

const title = computed(() => {
  const key = String(props.moduleKey || '').toLowerCase();
  const labelKeys = {
    campaigns: 'navigation.moduleCampaigns',
    audiences: 'navigation.moduleAudiences',
    segments: 'navigation.moduleSegments'
  };
  const labelKey = labelKeys[key];
  return labelKey ? t(labelKey) : props.moduleKey;
});
</script>
