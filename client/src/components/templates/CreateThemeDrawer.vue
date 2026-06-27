<template>
  <TransitionRoot as="template" :show="isOpen">
    <Dialog class="relative z-50" @close="emit('close')">
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-150"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-900/40" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-hidden">
        <div class="absolute inset-0 overflow-hidden">
          <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
            <TransitionChild
              as="template"
              enter="transform transition ease-out duration-200"
              enter-from="translate-x-full"
              enter-to="translate-x-0"
              leave="transform transition ease-in duration-150"
              leave-from="translate-x-0"
              leave-to="translate-x-full"
            >
              <DialogPanel class="pointer-events-auto w-screen max-w-md bg-white dark:bg-gray-900 shadow-xl">
                <form class="flex h-full flex-col" @submit.prevent="submit">
                  <div class="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                    <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-white">
                      {{ t('templates.themeCreateTitle') }}
                    </DialogTitle>
                  </div>

                  <div class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {{ t('templates.fieldName') }}
                      </label>
                      <input
                        v-model="form.name"
                        type="text"
                        required
                        class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {{ t('templates.themeFieldDescription') }}
                      </label>
                      <textarea
                        v-model="form.description"
                        rows="3"
                        class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div class="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-2">
                    <button
                      type="button"
                      class="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600"
                      @click="emit('close')"
                    >
                      {{ t('actions.cancel') }}
                    </button>
                    <button
                      type="submit"
                      class="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                      :disabled="saving || !form.name.trim()"
                    >
                      {{ t('actions.create') }}
                    </button>
                  </div>
                </form>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';

const props = defineProps({
  isOpen: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'create']);

const { t } = useI18n();
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
