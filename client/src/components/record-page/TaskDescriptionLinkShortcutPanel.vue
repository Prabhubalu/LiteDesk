<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="task-description-link-shortcut w-72 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg p-3 z-[12000]"
      :style="panelStyle"
      role="dialog"
      :aria-label="t('records.taskDescriptionEditorInsertLink')"
      @mousedown.prevent
    >
      <div class="space-y-2">
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400">URL</label>
        <input
          ref="inputRef"
          :value="linkUrl"
          type="url"
          placeholder="https://"
          class="block w-full rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
          @input="$emit('update:linkUrl', $event.target.value)"
          @keydown.enter.prevent="$emit('apply')"
          @keydown.escape.prevent="$emit('close')"
        />
        <div class="flex gap-2 justify-end">
          <button
            type="button"
            class="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
            @click="$emit('close')"
          >{{ t('performance.cancelWizard') }}</button>
          <button
            type="button"
            :disabled="!canApply"
            class="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            @click="$emit('apply')"
          >{{ t('actions.apply') }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  open: { type: Boolean, default: false },
  panelStyle: { type: Object, default: () => ({}) },
  linkUrl: { type: String, default: 'https://' },
  canApply: { type: Boolean, default: false }
});

defineEmits(['update:linkUrl', 'apply', 'close']);

const { t } = useI18n();
const inputRef = ref(null);

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    nextTick(() => {
      inputRef.value?.focus();
      inputRef.value?.select();
    });
  }
);
</script>
