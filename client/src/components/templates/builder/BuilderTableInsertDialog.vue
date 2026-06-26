<template>
  <div
    v-if="open"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
    @mousedown.self="emit('cancel')"
  >
    <div
      class="w-full max-w-sm rounded-xl border bg-white p-5 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
      role="dialog"
      aria-modal="true"
      @mousedown.stop
    >
      <h3 class="text-base font-semibold text-neutral-900 dark:text-neutral-100">
        {{ t('templates.builderTableInsertTitle') }}
      </h3>
      <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {{ t('templates.builderTableInsertHint') }}
      </p>

      <div class="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label class="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-300">
            {{ t('templates.builderTableInsertRows') }}
          </label>
          <input
            v-model.number="rows"
            type="number"
            min="1"
            max="50"
            class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-300">
            {{ t('templates.builderTableInsertCols') }}
          </label>
          <input
            v-model.number="cols"
            type="number"
            min="1"
            max="20"
            class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800"
          />
        </div>
      </div>

      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          @click="emit('cancel')"
        >
          {{ t('actions.cancel') }}
        </button>
        <button
          type="button"
          class="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
          @click="confirm"
        >
          {{ t('templates.builderTableInsertCreate') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  open: { type: Boolean, default: false }
});

const emit = defineEmits(['confirm', 'cancel']);

const { t } = useI18n();
const rows = ref(3);
const cols = ref(3);

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      rows.value = 3;
      cols.value = 3;
    }
  }
);

function confirm() {
  emit('confirm', {
    rows: Math.max(1, Math.min(50, Number(rows.value) || 3)),
    cols: Math.max(1, Math.min(20, Number(cols.value) || 3))
  });
}
</script>
