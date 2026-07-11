<template>
  <footer class="flex shrink-0 items-center justify-between border-t border-neutral-200 bg-white px-4 py-2 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
    <div class="flex items-center gap-3">
      <span>{{ saveLabel }}</span>
      <span :class="ui.toolbarDivider" class="!mx-0 !h-3" />
      <span>{{ t('contentStudio.wordCount', { count: wordCount }) }}</span>
      <span>{{ t('contentStudio.readTime', { minutes: readMinutes }) }}</span>
    </div>
    <span class="hidden sm:inline">{{ t('contentStudio.keyboardHint') }}</span>
  </footer>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBuilderUi } from '@/composables/useBuilderUi';

const props = defineProps({
  saveStatus: { type: String, default: 'saved' },
  wordCount: { type: Number, default: 0 },
  readMinutes: { type: Number, default: 1 },
});

const { t } = useI18n();
const ui = useBuilderUi();

const saveLabel = computed(() => {
  if (props.saveStatus === 'saving') return t('contentStudio.statusSaving');
  if (props.saveStatus === 'dirty') return t('contentStudio.unsavedChanges');
  if (props.saveStatus === 'error') return t('contentStudio.saveFailed');
  return t('contentStudio.savedSecondsAgo');
});
</script>
