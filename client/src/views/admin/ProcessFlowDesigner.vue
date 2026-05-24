<template>
  <div class="h-[calc(100vh-4rem)] flex flex-col bg-gray-50 dark:bg-gray-900">
    <!-- Header -->
    <header class="relative z-30 shrink-0 flex flex-nowrap items-center gap-2 sm:gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-visible">
      <button
        type="button"
        class="shrink-0 p-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
        :aria-label="t('process.designerGoBack')"
        @click="goBack"
      >
        <ArrowLeftIcon class="w-5 h-5" aria-hidden="true" />
      </button>

      <div class="flex items-center gap-2 flex-1 min-w-0">
        <input
          v-if="editable"
          v-model="process.name"
          type="text"
          :title="process.name"
          :placeholder="t('process.designerNamePh')"
          :class="PROCESS_TITLE_INPUT_CLASS"
        />
        <h1
          v-else
          class="min-w-0 text-lg font-semibold text-gray-900 dark:text-white truncate"
          :title="process.name"
        >
          {{ process.name }}
        </h1>
        <span
          :class="[
            'shrink-0 text-xs px-2 py-0.5 rounded-full font-medium',
            process.status === 'active'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
              : process.status === 'draft'
              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
          ]"
        >
          {{ process.status }}
        </span>
        <span class="hidden md:inline shrink-0 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {{ process.appKey }} · {{ moduleLabel }}
          <template v-if="process.status === 'active' && process.publishedDefinition">
            · v{{ process.publishedDefinition.versionNumber }}
          </template>
        </span>
      </div>

      <ProcessRunInsightBar
        v-if="processId && !loading && !loadError"
        embedded
        :mode="designerMode"
        :executions="executions"
        :selected-execution-id="selectedExecutionId"
        :graph-state="graphState"
        :testing="testing"
        @update:mode="onModeChange"
        @select-execution="loadExecutionOverlay"
        @test="showTestModal = true"
      />

      <div class="flex items-center gap-2 shrink-0">
        <button
          v-if="process.status === 'active'"
          type="button"
          class="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
          @click="duplicateAndEdit"
        >
          {{ t('process.designerDuplicateEdit') }}
        </button>
        <button
          v-if="editable && designerMode === 'design'"
          type="button"
          class="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
          @click="tidyLayout"
        >
          {{ t('process.designerTidyLayout') }}
        </button>
        <button
          v-if="editable"
          type="button"
          :disabled="saving || !isDirty"
          :title="isDirty ? undefined : t('process.designerNoChanges')"
          class="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          @click="saveProcess"
        >
          {{ saving ? t('states.saving') : t('actions.save') }}
        </button>
        <button
          v-if="process.status === 'draft' && processId"
          type="button"
          class="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg"
          @click="activateProcess"
        >
          {{ t('process.designerActivate') }}
        </button>
      </div>
    </header>

    <div v-if="loadError" class="p-4 text-sm text-red-600">{{ loadError }}</div>
    <div v-else-if="loading" class="flex-1 flex items-center justify-center text-gray-500">{{ t('process.designerLoading') }}</div>

    <template v-else>
      <div
        v-if="graphState?.newerVersionAvailable && designerMode === 'insight'"
        class="shrink-0 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-100"
      >
        <p>
          {{ t('process.designerVersionRun', { runVersion: graphState.definitionVersion?.versionNumber ?? '?' }) }}
          {{ t('process.designerVersionCurrent', { currentVersion: graphState.currentPublishVersion }) }}
          {{ t('process.designerVersionCanvas') }}
        </p>
      </div>

      <div
        v-if="needsTriggerSetup && designerMode === 'design'"
        class="shrink-0 px-4 py-3 bg-indigo-50 dark:bg-indigo-900/25 border-b border-indigo-200 dark:border-indigo-800"
        role="status"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-medium text-indigo-900 dark:text-indigo-100">
              {{ t('process.designerTriggerBannerTitle') }}
            </p>
            <p class="text-xs text-indigo-800/90 dark:text-indigo-200/90 mt-0.5 max-w-2xl">
              {{ t('process.designerTriggerBannerBody') }}
            </p>
          </div>
          <button
            type="button"
            class="shrink-0 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
            @click="focusTriggerSetup"
          >
            {{ t('process.designerTriggerBannerCta') }}
          </button>
        </div>
      </div>

      <div
        v-if="saveBlockedMessage && designerMode === 'design'"
        class="shrink-0 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-100"
      >
        <p>{{ saveBlockedMessage }}</p>
      </div>

      <div
        v-if="graphErrors.length && designerMode === 'design'"
        class="shrink-0 px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 text-sm text-red-800 dark:text-red-200"
      >
        <p class="font-medium">{{ t('process.designerGraphErrorsTitle') }}</p>
        <ul class="mt-1 list-disc list-inside text-xs space-y-0.5 max-h-24 overflow-y-auto">
          <li v-for="(err, idx) in graphErrors" :key="idx">{{ err.message }}</li>
        </ul>
      </div>

    <div class="flex-1 flex min-h-0">
      <ProcessNodePalette
        class="w-52 shrink-0"
        :metadata="designerMetadata"
        :editable="editable && designerMode === 'design'"
        :blocked="needsTriggerSetup"
        @add="addNode"
      />
      <div class="flex-1 min-w-0 relative">
        <div
          v-if="needsTriggerSetup && !flowNodes.length"
          class="absolute inset-0 z-10 flex items-center justify-center pointer-events-none px-8"
        >
          <div class="max-w-md text-center rounded-xl border border-dashed border-indigo-300 dark:border-indigo-600 bg-white/90 dark:bg-gray-800/90 px-6 py-8 shadow-sm pointer-events-auto">
            <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('process.designerEmptyCanvasTitle') }}</p>
            <ol class="mt-3 text-left text-sm text-gray-600 dark:text-gray-400 space-y-2 list-decimal list-inside">
              <li>{{ t('process.designerEmptyCanvasStep1') }}</li>
              <li>{{ t('process.designerEmptyCanvasStep2') }}</li>
            </ol>
            <button
              type="button"
              class="mt-5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
              @click="focusTriggerSetup"
            >
              {{ t('process.designerChooseTrigger') }}
            </button>
          </div>
        </div>
        <ProcessFlowCanvas
          ref="canvasRef"
          v-model:nodes="flowNodes"
          v-model:edges="flowEdges"
          :process="process"
          :editable="editable && designerMode === 'design'"
          :graph-state="designerMode === 'insight' ? graphState : null"
          @select-node="onSelectNode"
          @clear-selection="clearNodeSelection"
          @graph-changed="reapplyNodeDrafts"
          @connection-rejected="onConnectionRejected"
        />
      </div>
      <ProcessSettingsPanel
        v-if="!selectedFlowNode"
        class="w-80 shrink-0"
        :process="process"
        :editable="editable && designerMode === 'design'"
        :highlight-starts-when="highlightStartsWhen"
        @update="applyProcessSettings"
        @webhook-secret="onWebhookSecret"
      />
      <ProcessNodeInspector
        v-else-if="inspectorNode"
        :key="inspectorNode.id"
        class="w-80 shrink-0"
        :node-id="inspectorNode.id"
        :process-type="inspectorNode.data.processType"
        :node-label="inspectorNode.data.label"
        :node-version="inspectorNode.data.version || 1"
        :config="inspectorNode.data.config"
        :process="process"
        :editable="editable && designerMode === 'design'"
        :execution-detail="selectedExecutionDetail"
        :module-field-meta="moduleFieldMetaByKey"
        :condition-fields-loading="moduleFieldsLoading"
        :designer-metadata="designerMetadata"
        @update-node="updateNodeConfig"
        @delete-node="removeNode"
        @deselect="clearNodeSelection"
      />
    </div>
    </template>

    <ProcessTestModal
      v-if="showTestModal"
      :default-entity-type="process.entityType"
      @close="showTestModal = false"
      @run="runTestSimulation"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { ArrowLeftIcon } from '@heroicons/vue/24/outline';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import ProcessFlowCanvas from '@/components/process-flow/ProcessFlowCanvas.vue';
import ProcessNodePalette from '@/components/process-flow/ProcessNodePalette.vue';
import ProcessNodeInspector from '@/components/process-flow/ProcessNodeInspector.vue';
import ProcessSettingsPanel from '@/components/process-flow/ProcessSettingsPanel.vue';
import ProcessRunInsightBar from '@/components/process-flow/ProcessRunInsightBar.vue';
import ProcessTestModal from '@/components/process-flow/ProcessTestModal.vue';
import { applyGraphStateToFlow } from '@/composables/useProcessExecutionOverlay';
import {
  processToFlow,
  flowToProcess,
  createFlowNode,
  syncTriggerNodeOnGraph,
  tidyFlowLayout,
  generateId
} from '@/composables/useProcessGraph';
import { graphErrorsByElement } from '@/utils/processGraphValidation';
import { useProcessModuleFields } from '@/composables/useProcessModuleFields';
import { useProcessNodeDrafts } from '@/composables/useProcessNodeDrafts';
import { useNotifications } from '@/composables/useNotifications';
import {
  isTriggerSelectionPending,
  PROCESS_TITLE_INPUT_CLASS
} from '@/utils/processDesignerConstants';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { success: notifySuccess, error: notifyError } = useNotifications();

const processId = computed(() => route.params.id);

const loading = ref(true);
const loadError = ref(null);
const saving = ref(false);
const designerMetadata = ref(null);
const canvasRef = ref(null);

const process = ref({
  name: '',
  description: '',
  appKey: '',
  entityType: '',
  status: 'draft',
  trigger: { type: 'manual', eventType: null },
  triggerConfigured: false,
  nodes: [],
  edges: []
});

const flowNodes = ref([]);
const flowEdges = ref([]);
const selectedFlowNode = ref(null);
const designerMode = ref('design');
const graphState = ref(null);
const executions = ref([]);
const selectedExecutionId = ref('');
const showTestModal = ref(false);
const testing = ref(false);
const graphErrors = ref([]);
const highlightStartsWhen = ref(false);

const {
  loadFromFlowNodes,
  mergeFromFlowNodes,
  setDraft,
  removeDraft,
  applyToFlowNodes,
  nodeForInspector
} = useProcessNodeDrafts();

const editable = computed(() => process.value.status === 'draft');

/** JSON snapshot of last loaded/saved state — used to enable Save only when dirty. */
const savedSnapshot = ref('');

function buildComparablePayload() {
  const nodes = applyToFlowNodes(flowNodes.value);
  const synced = flowToProcess(process.value, nodes, flowEdges.value);
  return JSON.stringify({
    name: (synced.name || '').trim(),
    description: synced.description || '',
    appKey: synced.appKey || '',
    entityType: synced.entityType || '',
    triggerConfigured: !!synced.triggerConfigured,
    trigger: synced.trigger,
    nodes: (synced.nodes || []).map((n) => ({
      id: n.id,
      type: n.type,
      version: n.version ?? 1,
      config: n.config || {},
      layout: n.layout || { x: 0, y: 0 },
      meta: n.meta || {}
    })),
    edges: (synced.edges || []).map((e) => ({
      id: e.id,
      fromNodeId: e.fromNodeId,
      toNodeId: e.toNodeId,
      condition: e.condition ?? null
    }))
  });
}

function resetSavedSnapshot() {
  savedSnapshot.value = buildComparablePayload();
}

const isDirty = computed(() => {
  if (!editable.value || loading.value || !savedSnapshot.value) return false;
  return buildComparablePayload() !== savedSnapshot.value;
});

const needsTriggerSetup = computed(
  () =>
    editable.value &&
    designerMode.value === 'design' &&
    isTriggerSelectionPending(process.value)
);

const saveBlockedMessage = computed(() => {
  if (!editable.value || designerMode.value !== 'design') return '';
  if (needsTriggerSetup.value) {
    return t('process.designerSaveBlockedTrigger');
  }
  if (!process.value.appKey || !process.value.entityType) {
    return t('process.designerSaveBlockedScope');
  }
  return '';
});

const entityTypeForFields = computed(() => process.value.entityType);
const { fieldMetaByKey: moduleFieldMetaByKey, loading: moduleFieldsLoading } =
  useProcessModuleFields(entityTypeForFields);

function formatDurationMs(ms) {
  if (ms == null || Number.isNaN(ms)) return null;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatInsightNodeDetail(info) {
  if (!info) return '';
  const dur = formatDurationMs(info.durationMs);
  const msg = info.message || '';
  if (info.status === 'failed') {
    return dur
      ? t('process.designerInsightFailed', { duration: dur, message: msg ? `: ${msg}` : '' })
      : msg || t('process.designerInsightStepFailed');
  }
  if (info.status === 'completed') {
    return dur
      ? t('process.designerInsightCompleted', { duration: dur, message: msg ? `: ${msg}` : '' })
      : msg || t('process.designerInsightStepCompleted');
  }
  if (info.status === 'skipped') return t('process.designerInsightSkipped');
  if (info.status === 'running') return t('process.designerInsightRunning');
  return msg;
}

/** Inspector reads config from draft store + latest canvas node shell. */
const inspectorNode = computed(() => {
  const id = selectedFlowNode.value?.id;
  if (!id) return null;
  const n = flowNodes.value.find((node) => node.id === id);
  return n ? nodeForInspector(n) : null;
});

const selectedExecutionDetail = computed(() => {
  if (designerMode.value !== 'insight' || !selectedFlowNode.value || !graphState.value) return '';
  const info = graphState.value.nodes?.[selectedFlowNode.value.id];
  return formatInsightNodeDetail(info);
});

const moduleLabel = computed(() => {
  const m = {
    people: t('process.designerModulePeople'),
    organization: t('process.designerModuleOrganization'),
    deal: t('process.designerModuleDeal')
  };
  return m[process.value.entityType] || t('process.designerModuleUnknown');
});

function onWebhookSecret(secret) {
  alert(t('process.designerWebhookSecret', { secret }));
}

function focusTriggerSetup() {
  selectedFlowNode.value = null;
  highlightStartsWhen.value = true;
}

watch(
  () => process.value.triggerConfigured,
  (configured) => {
    if (configured) highlightStartsWhen.value = false;
  }
);

function applyProcessSettings(settings) {
  process.value.appKey = settings.appKey;
  process.value.entityType = settings.entityType;
  process.value.description = settings.description;
  if (settings.triggerConfigured === false) {
    process.value.triggerConfigured = false;
  } else if (settings.coreTrigger && settings.trigger) {
    process.value.triggerConfigured = true;
    process.value.trigger = settings.trigger;
  } else if (settings.triggerConfigured === true && settings.trigger) {
    process.value.triggerConfigured = true;
    process.value.trigger = settings.trigger;
  }
  // Module field options reload via useProcessModuleFields watch
  if (settings.processPatch) {
    Object.assign(process.value, settings.processPatch);
  }

  const synced = syncTriggerNodeOnGraph(process.value, flowNodes.value, flowEdges.value);
  flowNodes.value = synced.nodes;
  flowEdges.value = synced.edges;
  syncProcessFromFlow();

  const entityType = settings.entityType || process.value.entityType || 'deal';
  for (const n of flowNodes.value) {
    const t = n.data.processType;
    if (!['field_rule', 'ownership_rule', 'status_guard'].includes(t)) continue;
    const cfg = {
      ...(n.data.config || {}),
      entityType
    };
    setDraft(n.id, t, cfg, n.data.sentence);
  }
  flowNodes.value = applyToFlowNodes(flowNodes.value);
  syncProcessFromFlow();
}

function applyValidationHighlights() {
  const { byNode } = graphErrorsByElement(graphErrors.value);
  flowNodes.value = flowNodes.value.map((n) => {
    const msgs = byNode.get(n.id);
    const invalid = !!msgs?.length;
    return {
      ...n,
      class: invalid ? 'process-node--invalid' : '',
      data: {
        ...n.data,
        validationMessage: invalid ? msgs[0] : null
      }
    };
  });
}

function clearValidationHighlights() {
  graphErrors.value = [];
  flowNodes.value = flowNodes.value.map((n) => ({
    ...n,
    class: '',
    data: { ...n.data, validationMessage: null }
  }));
}

function onConnectionRejected(message) {
  alert(message || t('process.designerInvalidConnection'));
}

function tidyLayout() {
  flowNodes.value = tidyFlowLayout(flowNodes.value, flowEdges.value);
  syncProcessFromFlow();
}

function syncFlowFromProcess() {
  if (!process.value.entityType) {
    const fromNode = process.value.nodes?.find((n) => n.config?.entityType);
    if (fromNode) process.value.entityType = fromNode.config.entityType;
  }
  const { nodes, edges } = processToFlow(process.value);
  flowNodes.value = nodes;
  flowEdges.value = edges;
  loadFromFlowNodes(flowNodes.value);
  flowNodes.value = applyToFlowNodes(flowNodes.value);
  if (designerMode.value === 'insight' && graphState.value) {
    applyInsightOverlay();
  }
}

function applyInsightOverlay() {
  const applied = applyGraphStateToFlow(flowNodes.value, flowEdges.value, graphState.value);
  flowNodes.value = applied.nodes;
  flowEdges.value = applied.edges;
}

/** Run insight uses the published snapshot that was bound at execution start. */
function syncInsightGraphFromSnapshot(processGraph) {
  if (!processGraph) return;
  const merged = {
    ...process.value,
    trigger: processGraph.trigger ?? process.value.trigger,
    nodes: processGraph.nodes || [],
    edges: processGraph.edges || [],
    appKey: processGraph.appKey || process.value.appKey,
    entityType: processGraph.entityType || process.value.entityType
  };
  const { nodes, edges } = processToFlow(merged);
  flowNodes.value = nodes;
  flowEdges.value = edges;
  applyInsightOverlay();
}

function onModeChange(mode) {
  designerMode.value = mode;
  if (mode === 'design') {
    graphState.value = null;
    syncFlowFromProcess();
  } else {
    loadExecutionsList();
    if (executions.value.length && !selectedExecutionId.value) {
      loadExecutionOverlay(executions.value[0]._id);
    }
  }
}

async function loadExecutionsList() {
  if (!process.value._id) return;
  try {
    const res = await apiClient.get(`/admin/processes/${process.value._id}/executions`, { params: { limit: 20 } });
    if (res.success) executions.value = res.data || [];
  } catch (e) {
    console.warn('Executions list:', e);
  }
}

async function loadExecutionOverlay(executionId) {
  if (!executionId || !process.value._id) return;
  selectedExecutionId.value = executionId;
  try {
    const res = await apiClient.get(
      `/admin/processes/${process.value._id}/executions/${executionId}/graph-state`
    );
    if (res.success) {
      graphState.value = res.data;
      designerMode.value = 'insight';
      if (res.data.processGraph) {
        syncInsightGraphFromSnapshot(res.data.processGraph);
      } else {
        syncFlowFromProcess();
        applyInsightOverlay();
      }
    }
  } catch (e) {
    alert(e.message || t('process.designerLoadExecutionFailed'));
  }
}

async function runTestSimulation(payload) {
  showTestModal.value = false;
  testing.value = true;
  try {
    const res = await apiClient.post(`/admin/processes/${process.value._id}/test`, payload);
    if (!res.success) throw new Error(res.message);
    graphState.value = { ...res.data.graphState, dryRun: true };
    designerMode.value = 'insight';
    syncFlowFromProcess();
    applyInsightOverlay();
  } catch (e) {
    alert(e.message || t('process.designerTestFailed'));
  } finally {
    testing.value = false;
  }
}

function syncProcessFromFlow() {
  process.value = flowToProcess(process.value, flowNodes.value, flowEdges.value);
}

async function loadMetadata() {
  try {
    const res = await apiClient.get('/admin/processes/designer-metadata');
    if (res.success) designerMetadata.value = res.data;
  } catch (e) {
    console.warn('Designer metadata:', e);
  }
}

function ensureTriggerNodeOnCanvas() {
  const synced = syncTriggerNodeOnGraph(process.value, flowNodes.value, flowEdges.value);
  flowNodes.value = synced.nodes;
  flowEdges.value = synced.edges;
  mergeFromFlowNodes(flowNodes.value);
  flowNodes.value = applyToFlowNodes(flowNodes.value);
  syncProcessFromFlow();
}

async function loadProcess() {
  if (!processId.value) {
    await router.replace({ name: 'process-designer-new' });
    return;
  }

  const res = await apiClient.get(`/admin/processes/${processId.value}`);
  if (!res.success) throw new Error(res.message || t('process.designerNotFound'));
  process.value = res.data;
  syncFlowFromProcess();
  ensureTriggerNodeOnCanvas();
  resetSavedSnapshot();
}

function reapplyNodeDrafts() {
  flowNodes.value = applyToFlowNodes(flowNodes.value);
  syncProcessFromFlow();
}

function clearNodeSelection() {
  reapplyNodeDrafts();
  selectedFlowNode.value = null;
}

function onSelectNode(node) {
  if (!node?.id) return;
  selectedFlowNode.value = flowNodes.value.find((n) => n.id === node.id) || node;
}

/** Pick Yes/No branch when auto-wiring from an IF step. */
function pickConditionForSource(sourceId) {
  const sourceNode = flowNodes.value.find((n) => n.id === sourceId);
  if (sourceNode?.data?.processType !== 'condition') return null;

  const outEdges = flowEdges.value.filter((e) => e.source === sourceId);
  const hasTrue = outEdges.some(
    (e) => e.data?.condition === true || e.data?.condition === 'true'
  );
  const hasFalse = outEdges.some(
    (e) => e.data?.condition === false || e.data?.condition === 'false'
  );
  if (!hasTrue) return true;
  if (!hasFalse) return false;
  return null;
}

/** Wire a newly added step into the flow when it has no incoming edge yet. */
function autoConnectNewNode(newNodeId) {
  if (flowEdges.value.some((e) => e.target === newNodeId)) return;

  const outgoing = new Set(flowEdges.value.map((e) => e.source));
  const tails = flowNodes.value.filter((n) => n.id !== newNodeId && !outgoing.has(n.id));

  let sourceId = null;
  const selected = selectedFlowNode.value;
  if (selected?.id && selected.id !== newNodeId && tails.some((t) => t.id === selected.id)) {
    sourceId = selected.id;
  } else if (tails.length === 1) {
    sourceId = tails[0].id;
  }

  if (!sourceId) return;

  const condition = pickConditionForSource(sourceId);
  if (condition === null && flowNodes.value.find((n) => n.id === sourceId)?.data?.processType === 'condition') {
    return;
  }

  const edge = {
    id: generateId('edge'),
    source: sourceId,
    target: newNodeId,
    data: { condition: condition ?? null }
  };
  if (condition === true) {
    edge.sourceHandle = 'true';
    edge.label = t('process.edgeYes');
  } else if (condition === false) {
    edge.sourceHandle = 'false';
    edge.label = t('process.edgeNo');
  }
  flowEdges.value = [...flowEdges.value, edge];
}

function addNode(type) {
  if (!editable.value) return;
  if (needsTriggerSetup.value) {
    focusTriggerSetup();
    return;
  }
  const y = 80 + flowNodes.value.length * 120;
  const partial = ['field_rule', 'ownership_rule', 'status_guard'].includes(type)
    ? { entityType: process.value.entityType }
    : {};
  const vfNode = createFlowNode(type, { x: 280, y }, partial);
  flowNodes.value = [...flowNodes.value, vfNode];
  autoConnectNewNode(vfNode.id);
  setDraft(vfNode.id, type, vfNode.data.config, vfNode.data.sentence);
  flowNodes.value = applyToFlowNodes(flowNodes.value);
  selectedFlowNode.value = flowNodes.value.find((n) => n.id === vfNode.id) || vfNode;
  syncProcessFromFlow();
}

function updateNodeConfig({ nodeId, processType, config, sentence }) {
  const node = flowNodes.value.find((n) => n.id === nodeId);
  const type = processType || node?.data?.processType || 'action';
  setDraft(nodeId, type, config, sentence);
  flowNodes.value = applyToFlowNodes(flowNodes.value);
  if (selectedFlowNode.value?.id === nodeId) {
    selectedFlowNode.value = flowNodes.value.find((n) => n.id === nodeId) || selectedFlowNode.value;
  }
  syncProcessFromFlow();
}

function removeNode(nodeId) {
  removeDraft(nodeId);
  flowNodes.value = flowNodes.value.filter((n) => n.id !== nodeId);
  flowEdges.value = flowEdges.value.filter((e) => e.source !== nodeId && e.target !== nodeId);
  if (selectedFlowNode.value?.id === nodeId) selectedFlowNode.value = null;
  syncProcessFromFlow();
}

async function saveProcess() {
  if (!isDirty.value) return;
  if (saveBlockedMessage.value) {
    if (needsTriggerSetup.value) focusTriggerSetup();
    else selectedFlowNode.value = null;
    return;
  }
  saving.value = true;
  syncProcessFromFlow();
  try {
    const res = await apiClient.put(`/admin/processes/${process.value._id}`, process.value);
    if (!res.success) {
      if (Array.isArray(res.errors) && res.errors.length) {
        graphErrors.value = res.errors;
        applyValidationHighlights();
      }
      throw new Error(res.message || t('process.designerSaveFailed'));
    }
    clearValidationHighlights();
    process.value = res.data;
    if (res.webhookSecret) onWebhookSecret(res.webhookSecret);
    syncFlowFromProcess();
    ensureTriggerNodeOnCanvas();
    resetSavedSnapshot();
    notifySuccess(t('process.designerSaved'));
  } catch (e) {
    if (Array.isArray(e.errors) && e.errors.length) {
      graphErrors.value = e.errors;
      applyValidationHighlights();
    }
    notifyError(e.message || t('process.designerSaveError'));
  } finally {
    saving.value = false;
  }
}

async function activateProcess() {
  if (needsTriggerSetup.value) {
    focusTriggerSetup();
    return;
  }
  await saveProcess();
  if (graphErrors.value.length || needsTriggerSetup.value) return;
  try {
    const res = await apiClient.put(`/admin/processes/${process.value._id}/status`, { status: 'active' });
    if (!res.success) {
      if (Array.isArray(res.errors) && res.errors.length) {
        graphErrors.value = res.errors;
        applyValidationHighlights();
      }
      throw new Error(res.message);
    }
    process.value = res.data || process.value;
    process.value.status = 'active';
    syncFlowFromProcess();
    ensureTriggerNodeOnCanvas();
    resetSavedSnapshot();
    clearValidationHighlights();
    notifySuccess(
      res.message ||
        (res.publishedVersion != null
          ? t('process.designerActivatedVersion', { version: res.publishedVersion })
          : t('process.designerActivated'))
    );
  } catch (e) {
    if (Array.isArray(e.errors) && e.errors.length) {
      graphErrors.value = e.errors;
      applyValidationHighlights();
    }
    notifyError(e.message || t('process.designerActivateFailed'));
  }
}

async function duplicateAndEdit() {
  try {
    const res = await apiClient.post(`/admin/processes/${process.value._id}/duplicate`);
    if (!res.success) throw new Error(res.message);
    router.push({ name: 'process-designer', params: { id: res.data._id } });
    process.value = res.data;
    syncFlowFromProcess();
    ensureTriggerNodeOnCanvas();
    resetSavedSnapshot();
  } catch (e) {
    alert(e.message || t('process.designerDuplicateFailed'));
  }
}

function goBack() {
  router.push({ name: 'settings-automation-processes' });
}

watch(processId, async (id) => {
  if (route.name === 'process-designer' && id) {
    loading.value = true;
    try {
      await loadProcess();
    } catch (e) {
      loadError.value = e.message;
    } finally {
      loading.value = false;
    }
  }
});

onMounted(async () => {
  document.title = t('process.designerPageTitle');
  if (route.name !== 'process-designer' || !processId.value) {
    await router.replace({ name: 'process-designer-new' });
    return;
  }
  loading.value = true;
  loadError.value = null;
  try {
    await loadMetadata();
    await loadProcess();
    await loadExecutionsList();
  } catch (e) {
    loadError.value = e.message || t('process.designerLoadFailed');
  } finally {
    loading.value = false;
  }
});
</script>
