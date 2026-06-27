<template>
  <header :class="ui.toolbar">
    <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
      <div class="flex min-w-0 items-center gap-3">
        <button type="button" :class="ui.btnGhost" @click="emit('back')">
          <ArrowLeftIcon class="h-4 w-4" />
          <span class="hidden sm:inline">{{ t('templates.builderBack') }}</span>
        </button>
        <div class="min-w-0 border-l pl-3" :class="ui.border">
          <h1 class="truncate text-value font-semibold">{{ title }}</h1>
          <p :class="ui.meta">{{ saveLabel }}</p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          :class="ui.btnIcon"
          :disabled="!canUndo"
          :title="t('templates.builderUndo')"
          @click="emit('undo')"
        >
          <ArrowUturnLeftIcon class="h-4 w-4" />
        </button>
        <button
          type="button"
          :class="ui.btnIcon"
          :disabled="!canRedo"
          :title="t('templates.builderRedo')"
          @click="emit('redo')"
        >
          <ArrowUturnRightIcon class="h-4 w-4" />
        </button>

        <span class="mx-1 hidden h-5 w-px bg-neutral-200 dark:bg-neutral-700 sm:inline" />

        <button
          type="button"
          :class="ui.btnGhost"
          :disabled="previewBusy"
          @click="emit('preview')"
        >
          {{ previewBusy ? t('templates.rendering') : t('templates.previewPdf') }}
        </button>
        <button
          type="button"
          :class="ui.btnPrimary"
          :disabled="saveStatus === 'saving'"
          @click="emit('save')"
        >
          {{ t('actions.save') }}
        </button>
        <button
          type="button"
          :class="ui.btnPrimary"
          :disabled="publishBusy"
          @click="emit('publish')"
        >
          {{ publishBusy ? t('templates.builderPublishing') : t('templates.publish') }}
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowLeftIcon, ArrowUturnLeftIcon, ArrowUturnRightIcon } from '@heroicons/vue/24/outline';
import { useBuilderUi } from '@/composables/useBuilderUi';

const props = defineProps({
  title: { type: String, default: '' },
  saveStatus: { type: String, default: 'saved' },
  canUndo: { type: Boolean, default: false },
  canRedo: { type: Boolean, default: false },
  previewBusy: { type: Boolean, default: false },
  publishBusy: { type: Boolean, default: false }
});

const emit = defineEmits(['back', 'undo', 'redo', 'preview', 'save', 'publish']);

const { t } = useI18n();
const ui = useBuilderUi();

const saveLabel = computed(() => {
  switch (props.saveStatus) {
    case 'saving':
      return t('templates.builderSaveStatusSaving');
    case 'dirty':
      return t('templates.builderSaveStatusDirty');
    case 'error':
      return t('templates.builderSaveStatusError');
    default:
      return t('templates.builderSaveStatusSaved');
  }
});
</script>
