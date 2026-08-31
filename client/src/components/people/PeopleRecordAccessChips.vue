<template>
  <div v-if="hasAnyChip" class="flex flex-wrap items-center gap-1.5">
    <button
      v-if="portalAccess?.isEligible"
      type="button"
      class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium transition-colors"
      :class="portalChipClass"
      :title="t('people.accessChipPortalHint')"
      @click="emit('open-access', 'portal')"
    >
      <span class="text-gray-500 dark:text-gray-400">{{ t('people.externalAccessBadge') }}</span>
      <span class="mx-1 text-gray-300 dark:text-gray-600" aria-hidden="true">·</span>
      <span>{{ portalAccess.chipLabel }}</span>
    </button>
    <button
      v-if="marketingAccess?.isEligible"
      type="button"
      class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium transition-colors"
      :class="marketingChipClass"
      :title="t('people.accessChipMarketingHint')"
      @click="emit('open-access', 'marketing')"
    >
      <span class="text-gray-500 dark:text-gray-400">{{ t('people.accessChipMarketingLabel') }}</span>
      <span class="mx-1 text-gray-300 dark:text-gray-600" aria-hidden="true">·</span>
      <span>{{ marketingAccess.chipLabel }}</span>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  portalAccess: { type: Object, default: null },
  marketingAccess: { type: Object, default: null }
});

const emit = defineEmits(['open-access']);

const { t } = useI18n();

const hasAnyChip = computed(
  () => props.portalAccess?.isEligible || props.marketingAccess?.isEligible
);

const portalChipClass = computed(() => {
  if (props.portalAccess?.portalEnabled) {
    return 'border-green-200 bg-green-50 text-green-800 hover:bg-green-100 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200 dark:hover:bg-green-900/30';
  }
  return 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700';
});

const marketingChipClass = computed(() => {
  const pref = props.marketingAccess?.preference;
  if (!pref) {
    return 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700';
  }
  if (pref.globalStatus === 'unsubscribed') {
    return 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100 dark:hover:bg-amber-900/30';
  }
  return 'border-green-200 bg-green-50 text-green-800 hover:bg-green-100 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200 dark:hover:bg-green-900/30';
});
</script>
