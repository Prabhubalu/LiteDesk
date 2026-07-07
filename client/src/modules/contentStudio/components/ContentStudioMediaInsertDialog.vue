<template>
  <TransitionRoot as="template" :show="open">
    <Dialog class="relative z-[10000]" @close="emit('cancel')">
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-neutral-900/50 dark:bg-black/70" />
      </TransitionChild>

      <div class="fixed inset-0 z-10 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4">
          <TransitionChild
            as="template"
            enter="ease-out duration-200"
            enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enter-to="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leave-from="opacity-100 translate-y-0 sm:scale-100"
            leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <DialogPanel class="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
              <DialogTitle class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {{ dialogTitle }}
              </DialogTitle>
              <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                {{ dialogHint }}
              </p>

              <form class="mt-5 space-y-4" @submit.prevent="handleSubmit">
                <div>
                  <label class="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {{ t('contentStudio.fieldMediaTitle') }}
                  </label>
                  <input
                    ref="titleInputRef"
                    v-model="title"
                    type="text"
                    :class="ui.input"
                    :placeholder="titlePlaceholder"
                  />
                </div>

                <div>
                  <label class="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {{ t('contentStudio.fieldMediaUrl') }}
                    <span class="text-danger-600 dark:text-danger-400">*</span>
                  </label>
                  <input
                    v-model="url"
                    type="url"
                    required
                    :class="ui.input"
                    :placeholder="urlPlaceholder"
                  />
                </div>

                <div>
                  <label class="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {{ t('contentStudio.fieldMediaInfo') }}
                  </label>
                  <textarea
                    v-model="info"
                    rows="3"
                    :class="ui.input"
                    :placeholder="t('contentStudio.fieldMediaInfoPlaceholder')"
                  />
                </div>

                <div class="flex justify-end gap-2 pt-2">
                  <button type="button" :class="ui.btnSecondary" @click="emit('cancel')">
                    {{ t('actions.cancel') }}
                  </button>
                  <button type="submit" :class="ui.btnPrimary" :disabled="!url.trim()">
                    {{ t('actions.add') }}
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
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { useBuilderUi } from '@/composables/useBuilderUi';

const props = defineProps({
  open: { type: Boolean, default: false },
  blockType: { type: String, default: 'embed' },
});

const emit = defineEmits(['submit', 'cancel']);

const { t } = useI18n();
const ui = useBuilderUi();

const title = ref('');
const url = ref('');
const info = ref('');
const titleInputRef = ref(null);

const dialogTitle = computed(() => {
  if (props.blockType === 'audio') return t('contentStudio.insertAudioTitle');
  if (props.blockType === 'file') return t('contentStudio.insertFileTitle');
  return t('contentStudio.insertEmbedTitle');
});

const dialogHint = computed(() => {
  if (props.blockType === 'audio') return t('contentStudio.insertAudioHint');
  if (props.blockType === 'file') return t('contentStudio.insertFileHint');
  return t('contentStudio.insertEmbedHint');
});

const titlePlaceholder = computed(() => {
  if (props.blockType === 'audio') return t('contentStudio.insertAudioTitlePlaceholder');
  if (props.blockType === 'file') return t('contentStudio.insertFileTitlePlaceholder');
  return t('contentStudio.insertEmbedTitlePlaceholder');
});

const urlPlaceholder = computed(() => {
  if (props.blockType === 'audio') return t('contentStudio.insertAudioUrlPlaceholder');
  if (props.blockType === 'file') return t('contentStudio.insertFileUrlPlaceholder');
  return t('contentStudio.insertEmbedUrlPlaceholder');
});

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    title.value = '';
    url.value = '';
    info.value = '';
    void nextTick(() => titleInputRef.value?.focus());
  },
);

function handleSubmit() {
  if (!url.value.trim()) return;
  emit('submit', {
    title: title.value.trim(),
    url: url.value.trim(),
    info: info.value.trim(),
  });
}
</script>
