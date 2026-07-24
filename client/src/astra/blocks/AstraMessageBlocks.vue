<template>
  <div class="space-y-3">
    <template v-for="(block, idx) in safeBlocks" :key="`${block.type}-${idx}`">
      <AstraMetricsBlock
        v-if="block.type === 'metrics'"
        :items="block.items || []"
      />
      <AstraChartBlock
        v-else-if="block.type === 'chart' && Array.isArray(block.series) && block.series.length"
        :title="block.title"
        :chart-type="block.chartType || 'bar'"
        :series="block.series || []"
      />
      <AstraRecordListBlock
        v-else-if="block.type === 'record_list'"
        :title="block.title"
        :entity="block.entity"
        :total="block.total"
        :items="block.items || []"
        @action="onAction"
      />
      <AstraEmptyBlock
        v-else-if="block.type === 'empty'"
        :title="block.title"
        :description="block.description"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AstraMetricsBlock from '@/astra/blocks/AstraMetricsBlock.vue';
import AstraChartBlock from '@/astra/blocks/AstraChartBlock.vue';
import AstraRecordListBlock from '@/astra/blocks/AstraRecordListBlock.vue';
import AstraEmptyBlock from '@/astra/blocks/AstraEmptyBlock.vue';
import type { AstraUiBlock } from '@/astra/blocks/types';

const props = defineProps<{
  lead?: string;
  blocks?: AstraUiBlock[];
}>();

const emit = defineEmits<{
  action: [prompt: string];
}>();

const safeBlocks = computed(() =>
  Array.isArray(props.blocks) ? props.blocks.filter((b) => b && typeof b === 'object' && 'type' in b) : [],
);

function onAction(prompt: string) {
  emit('action', prompt);
}
</script>
