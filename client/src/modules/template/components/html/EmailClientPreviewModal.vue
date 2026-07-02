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
            <DialogPanel class="w-full max-w-5xl rounded-xl bg-white dark:bg-gray-900 shadow-xl">
              <div class="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-white">
                  {{ t('templates.htmlImport.clientPreviewTitle') }}
                </DialogTitle>
                <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {{ t('templates.htmlImport.clientPreviewDescription') }}
                </p>
              </div>

              <div class="max-h-[75vh] overflow-y-auto p-6">
                <div v-if="loading" class="flex justify-center py-12">
                  <div class="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                </div>

                <div v-else-if="!status?.enabled" class="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center dark:border-gray-600">
                  <p class="text-sm font-medium text-gray-900 dark:text-white">
                    {{ t('templates.htmlImport.clientPreviewNotConfigured') }}
                  </p>
                  <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    {{ t('templates.htmlImport.clientPreviewNotConfiguredHint') }}
                  </p>
                </div>

                <div v-else-if="error" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                  {{ error }}
                </div>

                <div v-else-if="session" class="grid gap-4 sm:grid-cols-2">
                  <article
                    v-for="client in session.clients"
                    :key="client.code"
                    class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div class="border-b border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 dark:border-gray-700 dark:text-white">
                      {{ client.label }}
                    </div>
                    <div class="bg-gray-100 p-3 dark:bg-gray-950">
                      <img
                        :src="previewImageUrl(client.code)"
                        :alt="client.label"
                        class="mx-auto max-h-[420px] w-full object-contain object-top"
                        loading="lazy"
                      />
                    </div>
                  </article>
                </div>
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
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { getApiUrlForFetch } from '@/config/apiBase';
import {
  createClientPreview,
  fetchClientPreviewStatus
} from '../../services/htmlImportApi';

const props = defineProps({
  open: { type: Boolean, default: false },
  html: { type: String, default: '' },
  subject: { type: String, default: '' }
});

const emit = defineEmits(['close']);

const { t } = useI18n();

const loading = ref(false);
const error = ref('');
const status = ref(null);
const session = ref(null);

function previewImageUrl(clientCode) {
  if (!session.value?.emailGuid) return '';
  return getApiUrlForFetch(
    `/templates/html/client-preview/${encodeURIComponent(session.value.emailGuid)}/${encodeURIComponent(clientCode)}`
  );
}

async function loadPreview() {
  loading.value = true;
  error.value = '';
  session.value = null;

  try {
    status.value = await fetchClientPreviewStatus();
    if (!status.value.enabled) return;

    session.value = await createClientPreview(props.html, props.subject);
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('templates.htmlImport.clientPreviewFailed');
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.open, props.html],
  ([isOpen]) => {
    if (!isOpen) return;
    void loadPreview();
  },
  { immediate: true }
);
</script>
