<template>
  <Dialog :open="isOpen" class="relative z-50" @close="handleClose">
    <div class="fixed inset-0 bg-black/40" aria-hidden="true" />
    <div class="fixed inset-0 flex items-center justify-center p-4">
      <DialogPanel class="flex w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-900">
        <div class="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <DialogTitle class="text-base font-semibold text-gray-900 dark:text-white">
            {{ t('documents.createExternalLinkTitle') }}
          </DialogTitle>
          <button type="button" class="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" @click="handleClose">
            <XMarkIcon class="h-5 w-5" />
          </button>
        </div>

        <div class="space-y-4 px-5 py-4">
          <div>
            <label for="external-link-title" class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {{ t('documents.createDocumentName') }}
            </label>
            <input
              id="external-link-title"
              v-model="titleInput"
              type="text"
              class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              :placeholder="t('documents.createDocumentNamePlaceholder')"
            />
          </div>

          <div>
            <label for="external-link-url" class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {{ t('documents.externalLinkUrl') }}
            </label>
            <input
              id="external-link-url"
              v-model="urlInput"
              type="url"
              class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              :placeholder="t('documents.externalLinkUrlPlaceholder')"
            />
          </div>

          <div>
            <label for="external-link-provider" class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {{ t('documents.externalLinkProvider') }}
            </label>
            <select
              id="external-link-provider"
              v-model="providerInput"
              class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              <option value="google_drive">{{ t('documents.externalProviderGoogleDrive') }}</option>
              <option value="onedrive">{{ t('documents.externalProviderOneDrive') }}</option>
              <option value="dropbox">{{ t('documents.externalProviderDropbox') }}</option>
            </select>
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
          <button
            type="button"
            class="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            @click="handleClose"
          >
            {{ t('actions.cancel') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            :disabled="creating || !titleInput.trim() || !urlInput.trim()"
            @click="handleCreate"
          >
            {{ creating ? t('documents.creatingDocument') : t('documents.createExternalLinkAction') }}
          </button>
        </div>
      </DialogPanel>
    </div>
  </Dialog>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import { useDocuments } from '@/composables/useDocuments';
import { useNotifications } from '@/composables/useNotifications';
import { useTabs } from '@/composables/useTabs';
import { captureDocumentCreated } from '@/config/posthogDocuments';
import { detectProviderFromUrl } from '@/utils/documentExternalProviders';

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  folderId: { type: String, default: '' }
});

const emit = defineEmits(['close', 'created']);

const { t } = useI18n();
const notifications = useNotifications();
const { openTab } = useTabs();
const { createDocument } = useDocuments();

const titleInput = ref('');
const urlInput = ref('');
const providerInput = ref('google_drive');
const creating = ref(false);

watch(() => props.isOpen, (open) => {
  if (!open) return;
  titleInput.value = '';
  urlInput.value = '';
  providerInput.value = 'google_drive';
});

watch(urlInput, (value) => {
  const detected = detectProviderFromUrl(value);
  if (detected) {
    providerInput.value = detected;
  }
});

function handleClose() {
  emit('close');
}

async function handleCreate() {
  const title = titleInput.value.trim();
  const externalUrl = urlInput.value.trim();
  if (!title || !externalUrl || creating.value) return;

  creating.value = true;
  try {
    const response = await createDocument({
      title,
      documentType: 'external_link',
      sourceType: 'external',
      sourceProvider: providerInput.value,
      externalUrl,
      folderId: props.folderId || undefined,
      status: 'published'
    });
    if (!response?.success) {
      notifications.error(response?.message || t('documents.createExternalLinkFailed'));
      return;
    }
    const doc = response.data;
    captureDocumentCreated({ documentId: doc?._id, documentType: 'external_link', source: 'external_link_drawer' });
    emit('created', doc);
    handleClose();
    if (doc?._id) {
      openTab(`/documents/${doc._id}`, { title: doc.title || t('documents.pageTitle'), insertAdjacent: true });
    }
    notifications.success(t('documents.createExternalLinkSuccess'));
  } catch (error) {
    notifications.error(error?.message || t('documents.createExternalLinkFailed'));
  } finally {
    creating.value = false;
  }
}
</script>
