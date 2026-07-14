<template>
  <div class="grid gap-2 sm:grid-cols-2" role="radiogroup" :aria-label="t('templates.htmlImport.startFromTitle')">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="modelValue === option.value"
      class="rounded-lg border px-3 py-3 text-left text-sm transition-colors"
      :class="modelValue === option.value
        ? [ui.selectedRing, ui.selectedBg, 'border-primary-500'].join(' ')
        : [ui.border, 'border hover:border-primary-300 dark:hover:border-primary-600'].join(' ')"
      :disabled="disabled"
      @click="emit('update:modelValue', option.value)"
    >
      <span class="flex items-center gap-2 font-medium text-neutral-900 dark:text-neutral-100">
        <span
          class="inline-flex h-4 w-4 items-center justify-center rounded-full border"
          :class="modelValue === option.value
            ? 'border-primary-600 bg-primary-600'
            : 'border-neutral-400 dark:border-neutral-500'"
        >
          <span v-if="modelValue === option.value" class="h-1.5 w-1.5 rounded-full bg-white" />
        </span>
        {{ option.label }}
      </span>
      <span class="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">
        {{ option.description }}
      </span>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBuilderUi } from '@/composables/useBuilderUi';

defineProps({
  modelValue: { type: String, default: 'blank' },
  disabled: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();
const ui = useBuilderUi();

const options = computed(() => [
  {
    value: 'blank',
    label: t('templates.htmlImport.startBlank'),
    description: t('templates.htmlImport.startBlankDescription')
  },
  {
    value: 'import',
    label: t('templates.htmlImport.startImport'),
    description: t('templates.htmlImport.startImportDescription')
  }
]);
</script>
