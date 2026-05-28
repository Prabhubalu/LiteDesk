<template>
  <TransitionRoot as="template" :show="show">
    <Dialog class="relative z-[10000]" @close="$emit('close')">
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-150"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-900/70 transition-opacity" />
      </TransitionChild>

      <div class="fixed inset-0 z-[10000] w-screen overflow-y-auto p-4 sm:p-6">
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
            <DialogPanel
              class="flex max-h-[min(90vh,900px)] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-900"
              @click.stop
            >
              <header
                class="flex shrink-0 items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700"
              >
                <PaperClipIcon class="h-5 w-5 shrink-0 text-gray-400" />
                <div class="min-w-0 flex-1">
                  <DialogTitle class="truncate text-sm font-semibold text-gray-900 dark:text-white">
                    {{ attachment?.originalFileName || t('cases.recordActivityAttachments', { count: 1 }) }}
                  </DialogTitle>
                  <p v-if="attachment?.sizeBytes" class="text-xs text-gray-500 dark:text-gray-400">
                    {{ formatMailroomAttachmentSize(attachment.sizeBytes) }}
                  </p>
                </div>
                <button
                  type="button"
                  class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                  :disabled="loading || !attachment"
                  @click="$emit('download')"
                >
                  <ArrowDownTrayIcon class="h-4 w-4" />
                  {{ t('cases.recordAttachmentDownload') }}
                </button>
                <button
                  type="button"
                  class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                  :aria-label="t('actions.close')"
                  @click="$emit('close')"
                >
                  <XMarkIcon class="h-5 w-5" />
                </button>
              </header>

              <div class="flex min-h-[12rem] flex-1 items-center justify-center overflow-auto bg-gray-50 p-4 dark:bg-gray-950/50">
                <div v-if="loading" class="flex flex-col items-center gap-3 py-12">
                  <span
                    class="inline-block h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"
                  />
                  <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('cases.recordAttachmentPreviewLoading') }}</p>
                </div>

                <p v-else-if="error" class="max-w-sm text-center text-sm text-red-600 dark:text-red-400">
                  {{ error }}
                </p>

                <img
                  v-else-if="previewUrl && isMailroomImageMime(attachment?.mimeType)"
                  :src="previewUrl"
                  :alt="attachment?.originalFileName"
                  class="max-h-[min(70vh,720px)] max-w-full object-contain"
                />

                <iframe
                  v-else-if="previewUrl && attachment?.mimeType === 'application/pdf'"
                  :src="previewUrl"
                  class="h-[min(70vh,720px)] w-full rounded-lg border-0 bg-white"
                  :title="attachment?.originalFileName"
                />

                <div v-else class="max-w-sm text-center">
                  <DocumentIcon class="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
                  <p class="mt-3 text-sm text-gray-600 dark:text-gray-300">
                    {{ t('cases.recordAttachmentPreviewUnavailable') }}
                  </p>
                  <button
                    type="button"
                    class="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                    @click="$emit('download')"
                  >
                    <ArrowDownTrayIcon class="h-4 w-4" />
                    {{ t('cases.recordAttachmentDownload') }}
                  </button>
                </div>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot
} from '@headlessui/vue';
import {
  ArrowDownTrayIcon,
  DocumentIcon,
  PaperClipIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline';
import { formatMailroomAttachmentSize, isMailroomImageMime } from '@/utils/caseEmailAttachments';

defineProps({
  show: { type: Boolean, default: false },
  attachment: { type: Object, default: null },
  previewUrl: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' }
});

defineEmits(['close', 'download']);

const { t } = useI18n();
</script>
