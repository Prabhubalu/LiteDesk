<template>
  <div class="min-h-0 flex-1 overflow-y-auto p-3">
    <p v-if="!headings.length" class="text-sm text-neutral-500 dark:text-neutral-400">
      {{ t('contentStudio.outlineEmpty') }}
    </p>
    <ul v-else class="space-y-1">
      <li v-for="heading in headings" :key="heading.index">
        <button
          type="button"
          class="w-full rounded-md px-2 py-1.5 text-left text-sm text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
          :class="headingIndentClass(heading.level)"
          @click="scrollToHeading(heading.index)"
        >
          {{ heading.text }}
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { extractHeadingsFromBlocks } from '../utils/documentStats';

const props = defineProps({
  editor: { type: Object, default: null },
  blocks: { type: Object, default: null },
});

const { t } = useI18n();

const headings = computed(() => {
  if (props.blocks) return extractHeadingsFromBlocks(props.blocks);
  const json = props.editor?.getJSON?.();
  return extractHeadingsFromBlocks(json);
});

function headingIndentClass(level) {
  if (level <= 1) return 'font-semibold';
  if (level === 2) return 'pl-2';
  if (level === 3) return 'pl-4 text-neutral-600 dark:text-neutral-300';
  return 'pl-6 text-neutral-500 dark:text-neutral-400';
}

function scrollToHeading(targetIndex) {
  const ed = props.editor;
  if (!ed) return;
  let headingIndex = 0;
  ed.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') return;
    if (headingIndex === targetIndex) {
      ed.chain().focus().setTextSelection(pos + 1).scrollIntoView().run();
      return false;
    }
    headingIndex += 1;
    return undefined;
  });
}
</script>
