<template>
  <div v-if="show" class="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
    <div class="bg-white dark:bg-gray-800 rounded-xl p-5 w-full max-w-md space-y-4">
      <h4 class="text-base font-semibold text-gray-900 dark:text-white">
        {{ mode === 'edit' ? t('records.quoteSectionEditTitle') : t('records.quoteSectionAddTitle') }}
      </h4>

      <div class="space-y-3">
        <label class="block space-y-1">
          <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('records.quoteSectionTitleLabel') }}</span>
          <input
            v-model="form.sectionTitle"
            type="text"
            class="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            :disabled="saving"
          />
        </label>

        <label class="block space-y-1">
          <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('records.quoteSectionTypeLabel') }}</span>
          <select
            v-model="form.sectionType"
            class="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            :disabled="saving"
          >
            <option value="standard">{{ t('records.quoteSectionTypeStandard') }}</option>
            <option value="optional">{{ t('records.quoteSectionTypeOptional') }}</option>
            <option value="future">{{ t('records.quoteSectionTypeFuture') }}</option>
          </select>
        </label>

        <label
          v-if="form.sectionType === 'optional'"
          class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
        >
          <input v-model="form.includeInQuoteTotal" type="checkbox" class="rounded" :disabled="saving" />
          {{ t('records.quoteSectionIncludeInTotal') }}
        </label>
      </div>

      <div class="flex justify-end gap-2 pt-1">
        <button type="button" class="px-3 py-2 text-sm" :disabled="saving" @click="emit('close')">
          {{ t('actions.cancel') }}
        </button>
        <button
          type="button"
          class="px-3 py-2 text-sm rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
          :disabled="saving || !form.sectionTitle.trim()"
          @click="submit"
        >
          {{ mode === 'edit' ? t('actions.save') : t('records.quoteSectionAdd') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  show: { type: Boolean, default: false },
  mode: { type: String, default: 'create' },
  initial: { type: Object, default: null },
  saving: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'submit']);

const { t } = useI18n();

const form = reactive({
  sectionTitle: '',
  sectionType: 'standard',
  includeInQuoteTotal: true
});

watch(
  () => [props.show, props.initial],
  () => {
    if (!props.show) return;
    form.sectionTitle = String(props.initial?.sectionTitle || '').trim();
    form.sectionType = props.initial?.sectionType || 'standard';
    form.includeInQuoteTotal = props.initial?.includeInQuoteTotal !== false;
    if (form.sectionType === 'optional' && props.mode === 'create') {
      form.includeInQuoteTotal = false;
    }
  },
  { immediate: true }
);

watch(
  () => form.sectionType,
  (type) => {
    if (type === 'optional' && props.mode === 'create') {
      form.includeInQuoteTotal = false;
    } else if (type === 'standard' || type === 'future') {
      form.includeInQuoteTotal = type !== 'future';
    }
  }
);

function submit() {
  const sectionTitle = form.sectionTitle.trim();
  if (!sectionTitle) return;
  emit('submit', {
    sectionTitle,
    sectionType: form.sectionType,
    includeInQuoteTotal: form.includeInQuoteTotal === true
  });
}
</script>
