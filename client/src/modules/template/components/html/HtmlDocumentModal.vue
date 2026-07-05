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
              <div class="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-white">
                  {{ title }}
                </DialogTitle>
              </div>
              <div class="max-h-[70vh] overflow-y-auto p-6">
                <HtmlCodeEditor v-model="localHtml" :read-only="readOnly" :use-monaco="true" />
              </div>
              <div class="flex justify-end gap-2 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
                <button
                  v-if="readOnly"
                  type="button"
                  class="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600"
                  @click="copyHtml"
                >
                  {{ t('templates.builderHtmlCopy') }}
                </button>
                <button
                  v-if="readOnly"
                  type="button"
                  class="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600"
                  @click="downloadHtml"
                >
                  {{ t('templates.builderHtmlDownload') }}
                </button>
                <button type="button" class="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600" @click="emit('close')">
                  {{ readOnly ? t('actions.close') : t('actions.cancel') }}
                </button>
                <button
                  v-if="!readOnly"
                  type="button"
                  class="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                  @click="emit('apply', localHtml)"
                >
                  {{ t('templates.htmlImport.applyHtml') }}
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
import { useNotifications } from '@/composables/useNotifications';
import HtmlCodeEditor from './HtmlCodeEditor.vue';
import { copyTextToClipboard, downloadTextFile, slugifyFilename } from '../../utils/emailHtmlExport';

const props = defineProps({
  open: { type: Boolean, default: false },
  html: { type: String, default: '' },
  readOnly: { type: Boolean, default: true },
  title: { type: String, default: '' },
  downloadFilename: { type: String, default: 'template' }
});

const emit = defineEmits(['close', 'apply']);

const { t } = useI18n();
const notifications = useNotifications();
const localHtml = ref('');

watch(
  () => [props.open, props.html],
  () => {
    if (!props.open) return;
    localHtml.value = props.html;
  },
  { immediate: true }
);

async function copyHtml() {
  const copied = await copyTextToClipboard(localHtml.value);
  notifications.success(
    copied ? t('templates.htmlImport.copySuccess') : t('templates.htmlImport.copyFailed')
  );
}

function downloadHtml() {
  const baseName = slugifyFilename(props.downloadFilename);
  downloadTextFile(`${baseName}.html`, localHtml.value, 'text/html;charset=utf-8');
  notifications.success(t('templates.htmlImport.downloadSuccess'));
}
</script>
