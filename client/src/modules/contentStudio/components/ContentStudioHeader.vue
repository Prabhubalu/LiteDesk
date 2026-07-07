<template>
  <header class="flex h-11 shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-3 dark:border-neutral-800 dark:bg-neutral-900 sm:px-4">
    <div class="flex min-w-0 items-center gap-2">
      <p class="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        {{ t('contentStudio.brand') }}
      </p>
      <span class="shrink-0 rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
        {{ modeLabel }}
      </span>
    </div>

    <div :class="[ui.toolbarCenter, 'flex-1']">
      <span :class="[ui.toolbarStatus, saveStatusClass]">
        <span :class="['h-1.5 w-1.5 rounded-full', saveDotClass]" />
        {{ saveStatusLabel }}
      </span>

      <div :class="ui.deviceGroup" role="group" :aria-label="t('contentStudio.previewDevice')">
        <button
          v-for="device in devices"
          :key="device.id"
          type="button"
          :class="[ui.deviceBtn, previewDevice === device.id ? ui.deviceBtnActive : '']"
          :title="t(device.labelKey)"
          @click="emit('update:previewDevice', device.id)"
        >
          <component :is="device.icon" class="h-4 w-4" />
        </button>
      </div>
    </div>

    <div :class="ui.toolbarActions">
      <button type="button" :class="ui.btnGhost" @click="emit('preview')">
        {{ t('contentStudio.preview') }}
      </button>
      <button type="button" :class="ui.btnSecondary" :disabled="saveBusy" @click="emit('save')">
        {{ t('contentStudio.saveDraft') }}
      </button>
      <button type="button" :class="ui.btnPrimary" :disabled="publishBusy" @click="emit('publish')">
        {{ t('contentStudio.publish') }}
      </button>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ComputerDesktopIcon,
  DeviceTabletIcon,
  DevicePhoneMobileIcon,
} from '@heroicons/vue/24/outline';
import { useBuilderUi } from '@/composables/useBuilderUi';

const props = defineProps({
  mode: { type: String, required: true },
  saveStatus: { type: String, default: 'saved' },
  previewDevice: { type: String, default: 'desktop' },
  publishBusy: { type: Boolean, default: false },
  saveBusy: { type: Boolean, default: false },
});

const emit = defineEmits(['preview', 'save', 'publish', 'update:previewDevice']);

const { t } = useI18n();
const ui = useBuilderUi();

const devices = [
  { id: 'desktop', labelKey: 'contentStudio.deviceDesktop', icon: ComputerDesktopIcon },
  { id: 'tablet', labelKey: 'contentStudio.deviceTablet', icon: DeviceTabletIcon },
  { id: 'mobile', labelKey: 'contentStudio.deviceMobile', icon: DevicePhoneMobileIcon },
];

const modeLabel = computed(() =>
  props.mode === 'articles' ? t('contentStudio.modeArticles') : t('contentStudio.modeBlog'),
);

const saveStatusLabel = computed(() => {
  if (props.saveStatus === 'saving') return t('contentStudio.savedSecondsAgo');
  if (props.saveStatus === 'dirty') return t('contentStudio.unsavedChanges');
  if (props.saveStatus === 'error') return t('contentStudio.saveFailed');
  return t('contentStudio.savedSecondsAgo');
});

const saveStatusClass = computed(() => {
  if (props.saveStatus === 'saved') return ui.toolbarStatusSaved;
  if (props.saveStatus === 'saving') return ui.toolbarStatusSaving;
  if (props.saveStatus === 'error') return ui.toolbarStatusError;
  return ui.toolbarStatusDirty;
});

const saveDotClass = computed(() => {
  if (props.saveStatus === 'saved') return ui.saveDotSaved;
  if (props.saveStatus === 'saving') return ui.saveDotSaving;
  if (props.saveStatus === 'error') return ui.saveDotError;
  return ui.saveDotDirty;
});
</script>
