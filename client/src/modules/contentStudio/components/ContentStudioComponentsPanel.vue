<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
      <input
        v-model="search"
        type="search"
        :class="ui.input"
        :placeholder="t('contentStudio.searchComponents')"
      />
    </div>
    <div class="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
      <button
        v-for="component in filtered"
        :key="component.id"
        type="button"
        class="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-left transition hover:border-primary-300 hover:bg-primary-50/40 dark:border-neutral-700 dark:bg-neutral-800/50 dark:hover:border-primary-700"
        @click="emit('insert-component', component)"
      >
        <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">{{ t(component.labelKey) }}</p>
        <p class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{{ t(component.descriptionKey) }}</p>
      </button>
      <p v-if="!filtered.length" class="text-sm text-neutral-500">{{ t('contentStudio.emptyComponents') }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { getArticleComponentsForMode } from '../editor/articleComponents';

const props = defineProps({
  mode: { type: String, default: 'articles' },
});

const emit = defineEmits(['insert-component']);

const { t } = useI18n();
const ui = useBuilderUi();
const search = ref('');

const filtered = computed(() => {
  const items = getArticleComponentsForMode(props.mode === 'blog' ? 'blog' : 'articles');
  const q = search.value.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (item) =>
      t(item.labelKey).toLowerCase().includes(q) ||
      t(item.descriptionKey).toLowerCase().includes(q) ||
      item.id.includes(q),
  );
});
</script>
