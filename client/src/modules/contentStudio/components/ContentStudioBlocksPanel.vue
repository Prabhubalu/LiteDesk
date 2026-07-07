<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="border-b border-neutral-200 px-3 py-3 dark:border-neutral-800">
      <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        {{ t('contentStudio.addBlocksTitle') }}
      </h2>
      <div class="relative mt-2">
        <input
          v-model="search"
          type="search"
          :class="[ui.input, 'h-9 pr-9 text-sm']"
          :placeholder="t('contentStudio.searchBlocks')"
        />
        <MagnifyingGlassIcon class="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-3 py-3">
      <section v-for="category in categories" :key="category" class="mb-5 last:mb-0">
        <h3 class="text-[10px] font-semibold uppercase tracking-wider text-sky-500 dark:text-sky-400">
          {{ t(BLOCK_CATEGORY_LABEL_KEYS[category] || category) }}
        </h3>
        <div class="mt-2 grid grid-cols-3 gap-1.5">
          <button
            v-for="block in blocksByCategory[category]"
            :key="block.type"
            type="button"
            :disabled="block.enabled === false"
            :title="block.enabled === false ? t('contentStudio.blockComingSoon') : t(block.labelKey)"
            :class="blockButtonClass(block)"
            @click="emit('add-block', block.type)"
          >
            <ContentStudioBlockIcon :icon="block.icon" />
            <span class="text-center text-[10px] font-medium leading-tight text-neutral-700 dark:text-neutral-200">
              {{ t(block.labelKey) }}
            </span>
          </button>
        </div>
      </section>

      <p v-if="categories.length === 0" class="py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
        {{ t('contentStudio.noBlocksFound') }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline';
import { useBuilderUi } from '@/composables/useBuilderUi';
import ContentStudioBlockIcon from './ContentStudioBlockIcon.vue';
import {
  BLOCK_CATEGORY_LABEL_KEYS,
  BLOCK_CATEGORY_ORDER,
  getBlocksForMode,
} from '../editor/blockRegistry';

const props = defineProps({
  mode: { type: String, required: true },
});

const emit = defineEmits(['add-block']);

const { t } = useI18n();
const ui = useBuilderUi();
const search = ref('');

const filteredBlocks = computed(() => {
  const q = search.value.trim().toLowerCase();
  const blocks = getBlocksForMode(props.mode);
  if (!q) return blocks;
  return blocks.filter((block) => {
    const label = t(block.labelKey).toLowerCase();
    return label.includes(q) || block.type.includes(q) || (block.searchTerms || []).some((term) => term.includes(q));
  });
});

const blocksByCategory = computed(() => {
  const grouped = {};
  for (const category of BLOCK_CATEGORY_ORDER) {
    grouped[category] = filteredBlocks.value.filter((block) => block.category === category);
  }
  return grouped;
});

const categories = computed(() =>
  BLOCK_CATEGORY_ORDER.filter((category) => (blocksByCategory.value[category] || []).length > 0),
);

function blockButtonClass(block) {
  const enabled = block.enabled !== false;
  return [
    'flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border bg-white p-1.5 transition-all dark:bg-neutral-900',
    enabled
      ? 'border-neutral-200 hover:border-primary-300 hover:shadow-sm dark:border-neutral-700 dark:hover:border-primary-600'
      : 'cursor-not-allowed border-neutral-100 opacity-50 dark:border-neutral-800',
  ];
}
</script>
