<template>
  <div class="ld-builder-line-item">
    <div
      v-if="isSelected"
      class="pointer-events-none mb-1 rounded-md border border-dashed border-primary-300 bg-primary-50/40 px-2 py-1 text-[11px] text-primary-700 dark:border-primary-700 dark:bg-primary-950/30 dark:text-primary-300"
    >
      {{ t('templates.builderLineItemHint') }}
    </div>
    <BuilderCanvasTable
      :node-id="nodeId"
      :node="previewTableNode"
      :is-selected="isSelected"
      :hidden-class="hiddenClass"
      readonly
      @select="emit('select', $event)"
      @patch="onTablePatch"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BuilderCanvasTable from '@/components/templates/builder/BuilderCanvasTable.vue';
import {
  lineItemNodeToPreviewTableNode,
  mergeLineItemTableWidthPatch
} from '@/constants/lineItemDefaults';

const props = defineProps({
  nodeId: { type: String, required: true },
  node: { type: Object, required: true },
  isSelected: { type: Boolean, default: false },
  hiddenClass: { type: String, default: '' }
});

const emit = defineEmits(['select', 'patch']);

const { t } = useI18n();

const previewTableNode = computed(() => lineItemNodeToPreviewTableNode(props.node));

function onTablePatch({ patch }) {
  if (!patch?.bindings) return;
  const bindings = mergeLineItemTableWidthPatch(
    props.node?.bindings || {},
    patch.bindings
  );
  emit('patch', { nodeId: props.nodeId, patch: { bindings } });
}
</script>
