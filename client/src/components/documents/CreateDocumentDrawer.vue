<template>
  <Dialog :open="isOpen" class="relative z-50" @close="handleClose">
    <div class="fixed inset-0 bg-black/40" aria-hidden="true" />
    <div class="fixed inset-0 flex items-center justify-center p-4">
      <DialogPanel class="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-900">
        <div class="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <DialogTitle class="text-base font-semibold text-gray-900 dark:text-white">
            {{ t('documents.createDocumentTitle') }}
          </DialogTitle>
          <button type="button" class="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" @click="handleClose">
            <XMarkIcon class="h-5 w-5" />
          </button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {{ t('documents.createDocumentTemplate') }}
            </label>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                v-for="template in DOCUMENT_TEMPLATES"
                :key="template.id"
                type="button"
                class="rounded-lg border p-4 text-left transition-colors"
                :class="selectedTemplateId === template.id
                  ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/30'
                  : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'"
                @click="selectTemplate(template)"
              >
                <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t(template.titleKey) }}</p>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t(template.descriptionKey) }}</p>
              </button>
            </div>
          </div>

          <div>
            <label for="create-document-title" class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {{ t('documents.createDocumentName') }}
            </label>
            <input
              id="create-document-title"
              v-model="titleInput"
              type="text"
              class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              :placeholder="t('documents.createDocumentNamePlaceholder')"
            />
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
            :disabled="creating || !titleInput.trim()"
            @click="handleCreate"
          >
            {{ creating ? t('documents.creatingDocument') : t('documents.createDocumentAction') }}
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
import { DOCUMENT_TEMPLATES, DOCUMENT_TEMPLATE_BLANK } from '@/constants/documentTemplates';
import { toRichContentPayload } from '@/utils/documentRichContent';
import { useDocuments } from '@/composables/useDocuments';
import { useNotifications } from '@/composables/useNotifications';
import { useTabs } from '@/composables/useTabs';
import { captureDocumentCreated } from '@/config/posthogDocuments';

const props = defineProps({
  isOpen: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'created']);

const { t, te } = useI18n();
const notifications = useNotifications();
const { openTab } = useTabs();
const { createDocument } = useDocuments();

const selectedTemplateId = ref(DOCUMENT_TEMPLATE_BLANK.id);
const selectedTemplate = ref(DOCUMENT_TEMPLATE_BLANK);
const titleInput = ref('');
const creating = ref(false);

function selectTemplate(template) {
  selectedTemplateId.value = template.id;
  selectedTemplate.value = template;
  if (template.defaultTitleKey && te(template.defaultTitleKey) && !titleInput.value.trim()) {
    titleInput.value = t(template.defaultTitleKey);
  }
}

function resetForm() {
  selectedTemplateId.value = DOCUMENT_TEMPLATE_BLANK.id;
  selectedTemplate.value = DOCUMENT_TEMPLATE_BLANK;
  titleInput.value = '';
}

function handleClose() {
  if (creating.value) return;
  emit('close');
}

async function handleCreate() {
  const title = titleInput.value.trim();
  if (!title || creating.value) return;

  creating.value = true;
  try {
    const template = selectedTemplate.value || DOCUMENT_TEMPLATE_BLANK;
    const payload = {
      title,
      documentType: template.documentType || 'rich_document',
      status: 'draft',
      richContent: template.richContentHtml
        ? toRichContentPayload(template.richContentHtml)
        : null
    };
    const result = await createDocument(payload);
    if (!result?.success || !result?.data?._id) {
      notifications.error(result?.message || t('documents.createDocumentFailed'));
      return;
    }
    notifications.success(t('documents.createDocumentSuccess'));
    captureDocumentCreated({
      document_type: template.documentType,
      template_id: template.id
    });
    emit('created', result.data);
    emit('close');
    openTab(`/documents/${result.data._id}?edit=1`, {
      title: result.data.title || t('documents.pageTitle'),
      insertAdjacent: true
    });
  } catch (error) {
    notifications.error(error?.message || t('documents.createDocumentFailed'));
  } finally {
    creating.value = false;
  }
}

watch(() => props.isOpen, (open) => {
  if (open) resetForm();
});
</script>
