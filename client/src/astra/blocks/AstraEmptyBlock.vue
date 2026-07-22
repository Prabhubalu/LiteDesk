<template>
  <section
    :class="[
      'flex flex-col items-center justify-center px-5 py-8 text-center',
      PLATFORM_HOME_CARD_CLASS,
    ]"
  >
    <p class="text-sm font-medium text-neutral-800 dark:text-neutral-100">
      {{ title || t('astra.emptyBlockTitle') }}
    </p>
    <p
      v-if="description"
      class="mt-1 max-w-sm text-xs text-neutral-500 dark:text-neutral-400"
    >
      {{ description }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { PLATFORM_HOME_CARD_CLASS } from '@/utils/platformHomeLayout';

defineProps<{
  title?: string;
  description?: string;
}>();

const { t } = useI18n();
</script>
