<template>
  <Teleport to="body">
    <TransitionRoot as="template" :show="isOpen">
      <Dialog class="relative z-[10000]" @close="emit('close')">
        <TransitionChild
          as="template"
          enter="ease-out duration-200"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="ease-in duration-200"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <div class="fixed inset-0 bg-gray-500/50 dark:bg-black/60" />
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
                <div class="rounded-tl-xl overflow-hidden pointer-events-auto flex h-full">
                  <DialogPanel class="rounded-tl-xl overflow-hidden flex h-full w-[min(92vw,32rem)] max-w-[95vw] flex-col bg-white shadow-xl dark:bg-gray-800">
                    <form class="rounded-none relative flex h-full flex-col divide-y divide-gray-200 dark:divide-gray-700" @submit.prevent="submit">
                      <div class="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-5 sm:px-6">
                        <div class="flex min-w-0 items-start gap-3">
                          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300 shadow-none">
                            <SwatchIcon class="h-5 w-5" aria-hidden="true" />
                          </div>
                          <div class="min-w-0">
                            <DialogTitle class="truncate text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                              {{ t('templates.themeCreateTitle') }}
                            </DialogTitle>
                            <p class="mt-0.5 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
                              {{ t('templates.themesEmptyMessage') }}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          class="relative rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 cursor-pointer shrink-0"
                          @click="emit('close')"
                        >
                          <span class="absolute -inset-2.5" />
                          <span class="sr-only">{{ t('common.closePanel') }}</span>
                          <XMarkIcon class="size-6" aria-hidden="true" />
                        </button>
                      </div>

                      <div class="h-0 min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
                        <div class="space-y-3 px-4 py-5 sm:px-6">
                          <div>
                            <label class="mb-1 block" :class="ui.label">
                              {{ t('templates.fieldName') }}
                              <span class="text-danger-500">*</span>
                            </label>
                            <input v-model="form.name" type="text" required :class="ui.input" />
                          </div>
                          <div>
                            <label class="mb-1 block" :class="ui.label">{{ t('templates.themeFieldDescription') }}</label>
                            <textarea v-model="form.description" rows="3" :class="ui.input" />
                          </div>
                        </div>
                      </div>

                      <div class="flex shrink-0 items-center justify-end gap-3 border-t border-gray-200 bg-white px-4 py-4 dark:border-gray-700 dark:bg-gray-800 sm:px-6">
                        <button
                          type="button"
                          class="cursor-pointer rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:ring-gray-600 dark:hover:bg-gray-700"
                          @click="emit('close')"
                        >
                          {{ t('actions.cancel') }}
                        </button>
                        <button
                          type="submit"
                          class="inline-flex cursor-pointer items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                          :disabled="saving || !form.name.trim()"
                        >
                          <span>{{ t('actions.create') }}</span>
                        </button>
                      </div>
                    </form>
                  </DialogPanel>
                </div>
              </TransitionChild>
            </div>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>
  </Teleport>
</template>

<script setup>
import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { SwatchIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import { useBuilderUi } from '@/composables/useBuilderUi';

const props = defineProps({
  isOpen: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'create']);

const { t } = useI18n();
const ui = useBuilderUi();
const saving = ref(false);

const form = reactive({
  name: '',
  description: ''
});

watch(
  () => props.isOpen,
  (open) => {
    if (!open) return;
    form.name = '';
    form.description = '';
    saving.value = false;
  }
);

async function submit() {
  if (!form.name.trim()) return;
  saving.value = true;
  try {
    emit('create', {
      name: form.name.trim(),
      description: form.description.trim()
    });
  } finally {
    saving.value = false;
  }
}
</script>
