<template>
  <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
    <div
      v-for="item in items"
      :key="item.id"
      :class="[
        'rounded-2xl px-3.5 py-3',
        PLATFORM_HOME_CARD_CLASS,
      ]"
    >
      <p class="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
        {{ item.label }}
      </p>
      <p
        class="mt-1 text-xl font-semibold tracking-tight"
        :class="valueClass(item.tone)"
      >
        {{ item.value }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PLATFORM_HOME_CARD_CLASS } from '@/utils/platformHomeLayout';
import type { AstraMetricItem } from '@/astra/blocks/types';

defineProps<{
  items: AstraMetricItem[];
}>();

function valueClass(tone?: AstraMetricItem['tone']) {
  if (tone === 'primary') return 'text-primary-700 dark:text-primary-300';
  if (tone === 'success') return 'text-emerald-700 dark:text-emerald-300';
  if (tone === 'warning') return 'text-amber-700 dark:text-amber-300';
  return 'text-neutral-900 dark:text-white';
}
</script>
