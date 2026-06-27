<template>
  <footer
    class="flex shrink-0 items-center justify-between gap-4 border-t px-4 py-2 text-xs"
    :class="[ui.panel, ui.border, ui.textMuted]"
  >
    <nav v-if="breadcrumbs.length" class="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
      <template v-for="(crumb, index) in breadcrumbs" :key="crumb.id">
        <ChevronRightIcon v-if="index > 0" class="h-3 w-3 shrink-0 opacity-50" />
        <button
          type="button"
          class="shrink-0 rounded px-1 py-0.5 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          :class="index === breadcrumbs.length - 1 ? 'font-medium text-primary-700 dark:text-primary-300' : ''"
          @click="emit('select', crumb.id)"
        >
          {{ crumb.name || crumb.type }}
        </button>
      </template>
    </nav>
    <span v-else-if="selectedCount > 1" class="min-w-0 flex-1 truncate">
      {{ t('templates.builderMultiSelectHint', { count: selectedCount }) }}
    </span>
    <span v-else class="min-w-0 flex-1 truncate">{{ t('templates.builderStatusComponents', { count: componentCount }) }}</span>

    <span class="shrink-0 truncate text-neutral-400">{{ t('templates.builderPanHint') }}</span>
    <span class="shrink-0 truncate">{{ insertHint }}</span>
  </footer>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronRightIcon } from '@heroicons/vue/24/outline';
import { useBuilderUi } from '@/composables/useBuilderUi';

const props = defineProps({
  breadcrumbs: { type: Array, default: () => [] },
  componentCount: { type: Number, default: 0 },
  insertParentLabel: { type: String, default: 'Page' },
  selectedCount: { type: Number, default: 0 }
});

const emit = defineEmits(['select']);

const { t } = useI18n();
const ui = useBuilderUi();

const insertHint = computed(() =>
  t('templates.builderStatusInsertTarget', { target: props.insertParentLabel })
);
</script>
