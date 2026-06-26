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
        <select
          :value="zoom"
          :class="[ui.input, 'w-auto py-1.5 text-xs']"
          :aria-label="t('templates.builderZoom')"
          @change="emit('update:zoom', Number($event.target.value))"
        >
          <option v-for="level in zoomLevels" :key="level" :value="level">
            {{ Math.round(level * 100) }}%
          </option>
        </select>

        <span class="hidden h-5 w-px bg-neutral-200 dark:bg-neutral-700 lg:inline" />

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
          @click="emit('open-print-preview')"
        >
          <EyeIcon class="h-4 w-4" />
          {{ t('templates.builderTogglePreview') }}
        </button>
        <button
          type="button"
          :class="ui.btnGhost"
          :disabled="validateBusy"
          @click="emit('validate')"
        >
          <CheckBadgeIcon class="h-4 w-4" />
          {{ validateBusy ? t('states.loading') : t('templates.validate') }}
        </button>
        <button
          type="button"
          :class="ui.btnGhost"
          :disabled="previewBusy"
          @click="emit('preview')"
        >
          <DocumentArrowDownIcon class="h-4 w-4" />
          {{ previewBusy ? t('templates.rendering') : t('templates.previewPdf') }}
        </button>
        <button
          type="button"
          :class="ui.btnGhost"
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
          {{ publishBusy ? t('states.loading') : t('templates.publish') }}
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ArrowLeftIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  CheckBadgeIcon,
  DocumentArrowDownIcon,
  EyeIcon
} from '@heroicons/vue/24/outline';
import { useBuilderUi } from '@/composables/useBuilderUi';

const props = defineProps({
  title: { type: String, default: '' },
  saveStatus: { type: String, default: 'saved' },
  canUndo: { type: Boolean, default: false },
  canRedo: { type: Boolean, default: false },
  previewBusy: { type: Boolean, default: false },
  validateBusy: { type: Boolean, default: false },
  publishBusy: { type: Boolean, default: false },
  zoom: { type: Number, default: 1 }
});

const emit = defineEmits([
  'back',
  'undo',
  'redo',
  'preview',
  'save',
  'validate',
  'publish',
  'open-print-preview',
  'update:zoom'
]);

const zoomLevels = [0.75, 1, 1.25, 1.5];

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
