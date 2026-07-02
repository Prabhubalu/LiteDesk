<template>
  <TransitionRoot as="template" :show="open">
    <Dialog class="relative z-[65]" @close="emit('close')">
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-150"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-900/50" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-y-auto p-4">
        <div class="flex min-h-full items-center justify-center">
          <TransitionChild
            as="template"
            enter="ease-out duration-200"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="ease-in duration-150"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <DialogPanel class="w-full max-w-md rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl">
              <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t('templates.htmlImport.exportTitle') }}
              </DialogTitle>

              <div class="mt-4 space-y-2">
                <label
                  v-for="option in exportOptions"
                  :key="option.value"
                  class="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm"
                >
                  <input v-model="selected" type="radio" name="export-format" :value="option.value" />
                  <span>{{ option.label }}</span>
                </label>
              </div>

              <div class="mt-6 flex justify-end gap-2">
                <button type="button" class="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600" @click="emit('close')">
                  {{ t('actions.cancel') }}
                </button>
                <button type="button" class="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700" @click="emit('export', selected)">
                  {{ t('templates.htmlImport.exportAction') }}
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';

defineProps({
  open: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'export']);

const { t } = useI18n();
const selected = ref('download');

const exportOptions = computed(() => [
  { value: 'download', label: t('templates.htmlImport.exportDownload') },
  { value: 'zip', label: t('templates.htmlImport.exportZip') },
  { value: 'copy', label: t('templates.htmlImport.exportCopy') }
]);
</script>
