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
            <DialogPanel class="w-full max-w-4xl rounded-xl bg-white dark:bg-gray-900 shadow-xl">
              <div class="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-white">
                  {{ t('templates.htmlImport.previewTitle') }}
                </DialogTitle>
                <div class="flex items-center gap-2">
                  <div class="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-1">
                    <button
                      v-for="option in colorSchemeOptions"
                      :key="option.value"
                      type="button"
                      class="rounded-md px-3 py-1 text-xs"
                      :class="colorScheme === option.value ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-300'"
                      @click="colorScheme = option.value"
                    >
                      {{ option.label }}
                    </button>
                  </div>
                  <div class="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-1">
                    <button
                      v-for="option in viewportOptions"
                      :key="option.value"
                      type="button"
                      class="rounded-md px-3 py-1 text-xs"
                      :class="viewport === option.value ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-300'"
                      @click="viewport = option.value"
                    >
                      {{ option.label }}
                    </button>
                  </div>
                </div>
              </div>
              <div class="p-6">
                <EmailPreviewFrame
                  :html="bodyHtml"
                  :css="previewCss"
                  :viewport="viewport"
                  :color-scheme="colorScheme"
                />
              </div>
              <div class="flex justify-end border-t border-gray-200 dark:border-gray-700 px-6 py-4">
                <button type="button" class="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600" @click="emit('close')">
                  {{ t('actions.close') }}
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
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import EmailPreviewFrame from './EmailPreviewFrame.vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  html: { type: String, default: '' },
  css: { type: String, default: '' },
  initialViewport: { type: String, default: 'desktop' }
});

const emit = defineEmits(['close']);

const { t } = useI18n();
const viewport = ref('desktop');
const colorScheme = ref('light');

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    viewport.value = props.initialViewport === 'mobile' ? 'mobile' : 'desktop';
    colorScheme.value = 'light';
  }
);

const bodyHtml = computed(() => props.html);
const previewCss = computed(() => props.css);

const colorSchemeOptions = computed(() => [
  { value: 'light', label: t('templates.htmlImport.previewLight') },
  { value: 'dark', label: t('templates.htmlImport.previewDark') }
]);

const viewportOptions = computed(() => [
  { value: 'desktop', label: t('templates.htmlImport.previewDesktop') },
  { value: 'mobile', label: t('templates.htmlImport.previewMobile') }
]);
</script>
