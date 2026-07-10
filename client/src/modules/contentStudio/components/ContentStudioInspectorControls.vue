<template>
  <div v-if="label" class="flex items-center justify-between gap-3">
    <label :class="[ui.label, 'shrink-0 text-sm normal-case tracking-normal text-neutral-700 dark:text-neutral-300']">{{ label }}</label>
    <div :class="['flex min-w-0 flex-1 justify-end', wide ? '' : 'max-w-[13rem]']">
      <slot />
    </div>
  </div>
  <slot v-else />
</template>

<script setup>
import { useBuilderUi } from '@/composables/useBuilderUi';

defineProps({
  label: { type: String, default: '' },
  wide: { type: Boolean, default: false },
});

const ui = useBuilderUi();
</script>
