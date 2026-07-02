<template>
  <fieldset>
    <legend class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
      {{ t('templates.htmlImport.startFromTitle') }}
    </legend>
    <div class="grid gap-2 sm:grid-cols-3" role="radiogroup" :aria-label="t('templates.htmlImport.startFromTitle')">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        role="radio"
        :aria-checked="modelValue === option.value"
        class="rounded-lg border px-3 py-3 text-left transition-colors"
        :class="modelValue === option.value
          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
          : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'"
        :disabled="disabled"
        @click="emit('update:modelValue', option.value)"
      >
        <span class="flex items-center gap-2 font-medium text-gray-900 dark:text-white">
          <span
            class="inline-flex h-4 w-4 items-center justify-center rounded-full border"
            :class="modelValue === option.value
              ? 'border-indigo-600 bg-indigo-600'
              : 'border-gray-400 dark:border-gray-500'"
          >
            <span v-if="modelValue === option.value" class="h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          {{ option.label }}
        </span>
        <span class="mt-1 block text-xs text-gray-500 dark:text-gray-400">
          {{ option.description }}
        </span>
      </button>
    </div>
  </fieldset>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

defineProps({
  modelValue: { type: String, default: 'blank' },
  disabled: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();

const options = computed(() => [
  {
    value: 'blank',
    label: t('templates.htmlImport.startBlank'),
    description: t('templates.htmlImport.startBlankDescription')
  },
  {
    value: 'gallery',
    label: t('templates.htmlImport.startGallery'),
    description: t('templates.htmlImport.startGalleryDescription')
  },
  {
    value: 'import',
    label: t('templates.htmlImport.startImport'),
    description: t('templates.htmlImport.startImportDescription')
  }
]);
</script>
