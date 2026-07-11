<template>
  <nav
    class="flex w-10 shrink-0 flex-col items-center gap-1 border-r border-neutral-200 bg-white py-2 dark:border-neutral-800 dark:bg-neutral-900"
    :aria-label="t('contentStudio.workspacePanels')"
  >
    <button
      v-for="item in items"
      :key="item.id"
      type="button"
      :class="[ui.iconRailBtn, activePanel === item.id ? ui.iconRailBtnActive : '']"
      :title="t(item.labelKey)"
      @click="emit('update:activePanel', item.id)"
    >
      <component :is="item.icon" class="h-4 w-4" />
    </button>
  </nav>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import {
  Squares2X2Icon,
  Bars3BottomLeftIcon,
  CubeIcon,
  PhotoIcon,
  SparklesIcon,
  DocumentDuplicateIcon,
  ChartBarIcon,
  Cog6ToothIcon,
} from '@heroicons/vue/24/outline';
import { useBuilderUi } from '@/composables/useBuilderUi';

defineProps({
  activePanel: { type: String, default: 'blocks' },
});

const emit = defineEmits(['update:activePanel']);

const { t } = useI18n();
const ui = useBuilderUi();

const items = [
  { id: 'blocks', labelKey: 'contentStudio.panelBlocks', icon: Squares2X2Icon },
  { id: 'outline', labelKey: 'contentStudio.panelOutline', icon: Bars3BottomLeftIcon },
  { id: 'components', labelKey: 'contentStudio.panelComponents', icon: CubeIcon },
  { id: 'media', labelKey: 'contentStudio.panelMedia', icon: PhotoIcon },
  { id: 'ai', labelKey: 'contentStudio.panelAi', icon: SparklesIcon },
  { id: 'templates', labelKey: 'contentStudio.panelTemplates', icon: DocumentDuplicateIcon },
  { id: 'seo', labelKey: 'contentStudio.panelSeo', icon: ChartBarIcon },
  { id: 'settings', labelKey: 'contentStudio.panelSettings', icon: Cog6ToothIcon },
];
</script>
