<template>
  <div class="h-full w-full process-flow-canvas">
    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      :node-types="nodeTypes"
      :nodes-draggable="editable && !graphState"
      :nodes-connectable="editable && !graphState"
      :elements-selectable="true"
      :elevate-edges-on-select="true"
      :delete-key-code="editable && !graphState ? ['Backspace', 'Delete'] : null"
      fit-view-on-init
      @nodes-change="onNodesChange"
      @edges-change="onEdgesChange"
      @connect="onConnect"
      @node-click="onNodeClick"
      @pane-click="onPaneClick"
    >
      <Background pattern-color="#94a3b8" :gap="16" />
      <Controls />
      <MiniMap />
    </VueFlow>
  </div>
</template>

<script setup>
import { markRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  VueFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge
} from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import '@vue-flow/minimap/dist/style.css';

import ProcessFlowNode from './ProcessFlowNode.vue';
import { generateId } from '@/composables/useProcessGraph';
import { buildNodeSentence } from '@/utils/processSentenceBuilder';
import { applyGraphStateToFlow } from '@/composables/useProcessExecutionOverlay';
import { validateFlowConnection } from '@/utils/processGraphValidation';

const { t } = useI18n();

const nodeTypes = { processFlow: markRaw(ProcessFlowNode) };

const nodes = defineModel('nodes', { type: Array, default: () => [] });
const edges = defineModel('edges', { type: Array, default: () => [] });

const props = defineProps({
  editable: { type: Boolean, default: true },
  process: { type: Object, default: null },
  graphState: { type: Object, default: null }
});

const emit = defineEmits(['select-node', 'clear-selection', 'connection-rejected', 'graph-changed']);

function refreshSentences() {
  if (!props.process) return;
  nodes.value = nodes.value.map((n) => {
    const processNode = {
      id: n.id,
      type: n.data.processType,
      config: n.data.config,
      version: n.data.version
    };
    return {
      ...n,
      data: {
        ...n.data,
        sentence: buildNodeSentence(processNode, props.process)
      }
    };
  });
}

watch(() => props.process?.trigger, refreshSentences, { deep: true });

function applyOverlay() {
  const baseNodes = nodes.value.map((n) => {
    const { executionStatus, executionMessage, executionDurationMs, ...data } = n.data || {};
    return { ...n, class: '', data };
  });
  const baseEdges = edges.value.map((e) => ({ ...e, class: '', animated: false, style: undefined }));
  const applied = applyGraphStateToFlow(baseNodes, baseEdges, props.graphState);
  nodes.value = applied.nodes;
  edges.value = applied.edges;
}

watch(() => props.graphState, applyOverlay, { deep: true });

function onNodesChange(changes) {
  nodes.value = applyNodeChanges(changes, nodes.value);
  emit('graph-changed');
}

function onEdgesChange(changes) {
  edges.value = applyEdgeChanges(changes, edges.value);
  if (changes.some((c) => c.type === 'remove' || c.type === 'add')) {
    emit('graph-changed');
  }
}

function onConnect(connection) {
  const check = validateFlowConnection(props.process, nodes.value, edges.value, connection);
  if (!check.valid) {
    emit('connection-rejected', check.message);
    return;
  }

  let condition = null;
  if (connection.sourceHandle === 'true') condition = true;
  if (connection.sourceHandle === 'false') condition = false;

  const edge = {
    ...connection,
    id: generateId('edge'),
    label: condition === true ? t('process.edgeYes') : condition === false ? t('process.edgeNo') : undefined,
    data: { condition },
    selectable: true,
    deletable: true
  };
  edges.value = addEdge(edge, edges.value);
  emit('graph-changed');
}

function onNodeClick({ node }) {
  emit('select-node', node);
}

function onPaneClick() {
  emit('clear-selection');
}

defineExpose({ refreshSentences });
</script>

<style scoped>
.process-flow-canvas :deep(.vue-flow) {
  height: 100%;
  width: 100%;
  background: rgb(249 250 251);
}
:global(.dark) .process-flow-canvas :deep(.vue-flow) {
  background: rgb(17 24 39);
}
.process-flow-canvas :deep(.process-node--invalid) {
  box-shadow: 0 0 0 2px rgb(239 68 68);
}
</style>
