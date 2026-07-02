<template>
  <TransitionRoot as="template" :show="isOpen">
    <Dialog class="relative z-[60]" @close="emit('close')">
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

      <div class="fixed inset-0 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4">
          <TransitionChild
            as="template"
            enter="ease-out duration-200"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="ease-in duration-150"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <DialogPanel class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900">
              <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t('marketing.campaignsTestSendTitle') }}
              </DialogTitle>
              <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {{ t('marketing.campaignsTestSendDescription') }}
              </p>

              <form class="mt-4 space-y-4" @submit.prevent="submit">
                <div>
                  <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {{ t('marketing.campaignsTestSendEmailLabel') }}
                  </label>
                  <input
                    v-model="email"
                    type="email"
                    required
                    autocomplete="email"
                    class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                    :placeholder="t('marketing.campaignsTestSendEmailPlaceholder')"
                  />
                </div>

                <div>
                  <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {{ t('marketing.campaignsTestSendNameLabel') }}
                  </label>
                  <input
                    v-model="name"
                    type="text"
                    class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                    :placeholder="t('marketing.campaignsTestSendNamePlaceholder')"
                  />
                </div>

                <div class="flex gap-3 pt-2">
                  <button
                    type="submit"
                    class="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                    :disabled="sending || !email.trim()"
                  >
                    {{ sending ? t('states.saving') : t('marketing.campaignsTestSendConfirm') }}
                  </button>
                  <button
                    type="button"
                    class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200"
                    @click="emit('close')"
                  >
                    {{ t('actions.cancel') }}
                  </button>
                </div>
              </form>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { ref, watch } from 'vue';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  sending: { type: Boolean, default: false },
  defaultEmail: { type: String, default: '' }
});

const emit = defineEmits(['close', 'submit']);

const { t } = useI18n();
const email = ref('');
const name = ref('');

function submit() {
  emit('submit', {
    email: email.value.trim(),
    name: name.value.trim() || undefined
  });
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      email.value = props.defaultEmail || '';
      name.value = '';
    }
  }
);
</script>
