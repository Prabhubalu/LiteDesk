<template>
  <span
    class="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
    :class="portalCaseStatusClass(status)"
  >
    {{ label }}
  </span>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { portalCaseStatusClass, portalCaseStatusLabelKey } from '@/utils/portalCaseUtils';

const props = defineProps({
  status: { type: String, default: '' }
});

const { t } = useI18n();

const label = computed(() => {
  const key = portalCaseStatusLabelKey(props.status);
  return key ? t(key) : props.status || '—';
});
</script>
