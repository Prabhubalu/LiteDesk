<template>
  <TransitionRoot as="template" :show="isOpen">
    <Dialog class="relative z-50" @close="handleClose">
      <!-- Background overlay -->
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-500/75 dark:bg-black/75" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-hidden">
        <div class="absolute inset-0 overflow-hidden">
          <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
            <TransitionChild 
              as="template" 
              enter="transform transition ease-in-out duration-300 sm:duration-300" 
              enter-from="translate-x-full" 
              enter-to="translate-x-0" 
              leave="transform transition ease-in-out duration-300 sm:duration-300" 
              leave-from="translate-x-0" 
              leave-to="translate-x-full"
            >
              <DialogPanel class="pointer-events-auto w-screen max-w-2xl">
                <div class="rounded-tl-xl overflow-hidden relative flex h-full flex-col divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800 shadow-xl">
                  <!-- Fixed Header -->
                  <div class="flex-shrink-0 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-6 sm:px-6">
                    <div class="flex items-center justify-between">
                      <DialogTitle class="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">{{ t('forms.previewDrawerTitle') }}</DialogTitle>
                      <div class="ml-3 flex h-7 items-center">
                        <button 
                          type="button" 
                          class="relative rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 cursor-pointer" 
                          @click="handleClose"
                        >
                          <span class="absolute -inset-2.5"></span>
                          <span class="sr-only">{{ t('forms.previewClosePanelSr') }}</span>
                          <XMarkIcon class="size-6" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <div class="mt-1">
                      <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('forms.previewDrawerSubtitle') }}</p>
                    </div>
                  </div>
                  <!-- Scrollable Content -->
                  <div class="h-0 flex-1 overflow-y-auto">
                    <div class="flex flex-1 flex-col justify-between">
                      <div class="divide-y divide-gray-200 dark:divide-gray-700 px-4 sm:px-6">
                        <div class="space-y-6 pt-6 pb-5">
                          <FormPreview
                            :form="form"
                            :readOnly="true"
                            @close="handleClose"
                            @submit="() => {}"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { useI18n } from 'vue-i18n';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import FormPreview from './FormPreview.vue';

const { t } = useI18n();

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  form: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['close']);

const handleClose = () => {
  emit('close');
};
</script>

