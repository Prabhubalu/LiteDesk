<template>
  <div
    :class="[
      'process-flow-node px-3 py-2 rounded-lg border-2 min-w-[160px] max-w-[220px] shadow-sm bg-white dark:bg-gray-800',
      selected ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-gray-200 dark:border-gray-600',
      data.validationMessage ? 'border-red-500' : '',
      executionClass
    ]"
  >
    <Handle
      v-if="showTarget"
      type="target"
      :position="Position.Top"
      class="!w-2 !h-2 !bg-gray-400"
    />
    <div class="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {{ data.label }}
    </div>
    <div class="text-xs text-gray-900 dark:text-white mt-1 line-clamp-3">
      {{ data.sentence }}
    </div>
    <div v-if="data.validationMessage" class="text-[9px] font-medium mt-1 text-red-600 dark:text-red-400 line-clamp-2">
      {{ data.validationMessage }}
    </div>
    <div v-else-if="data.executionStatus" class="text-[9px] font-medium mt-1" :class="executionTextClass">
      {{ executionLabel }}
    </div>
    <div v-else-if="data.version" class="text-[9px] text-gray-400 mt-1">v{{ data.version }}</div>
    <Handle
      v-if="data.processType === 'condition'"
      id="true"
      type="source"
      :position="Position.Bottom"
      :style="{ left: '30%' }"
      class="!w-2 !h-2 !bg-green-500"
    />
    <Handle
      v-if="data.processType === 'condition'"
      id="false"
      type="source"
      :position="Position.Bottom"
      :style="{ left: '70%' }"
      class="!w-2 !h-2 !bg-red-400"
    />
    <Handle
      v-else-if="showSource"
      type="source"
      :position="Position.Bottom"
      class="!w-2 !h-2 !bg-indigo-500"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Handle, Position } from '@vue-flow/core';

const { t } = useI18n();

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, required: true },
  selected: { type: Boolean, default: false }
});

const showTarget = computed(() => props.data.processType !== 'trigger');
const showSource = computed(() => props.data.processType !== 'end');

const executionClass = computed(() => {
  const s = props.data.executionStatus;
  if (s === 'completed') return 'execution-node--completed';
  if (s === 'running') return 'execution-node--running';
  if (s === 'failed') return 'execution-node--failed';
  if (s === 'skipped') return 'execution-node--skipped';
  return '';
});

const executionTextClass = computed(() => {
  const s = props.data.executionStatus;
  if (s === 'completed') return 'text-green-700 dark:text-green-400';
  if (s === 'running') return 'text-blue-700 dark:text-blue-400';
  if (s === 'failed') return 'text-red-700 dark:text-red-400';
  if (s === 'skipped') return 'text-gray-500';
  return 'text-gray-400';
});

const executionLabel = computed(() => {
  const s = props.data.executionStatus;
  const labels = {
    completed: t('process.execCompleted'),
    running: t('process.execRunning'),
    failed: t('process.execFailed'),
    skipped: t('process.execSkipped')
  };
  const base = labels[s] || s;
  if (props.data.executionDurationMs != null && s === 'completed') {
    return t('process.execCompletedDuration', {
      status: base,
      durationMs: props.data.executionDurationMs
    });
  }
  return base;
});
</script>

<style scoped>
.process-flow-node :deep(.vue-flow__handle) {
  border: 2px solid white;
}
.execution-node--completed {
  border-color: #22c55e !important;
  box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.25);
}
.execution-node--running {
  border-color: #3b82f6 !important;
  animation: pulse-ring 1.5s ease-in-out infinite;
}
.execution-node--failed {
  border-color: #ef4444 !important;
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
}
.execution-node--skipped {
  border-color: #9ca3af !important;
  opacity: 0.55;
}
@keyframes pulse-ring {
  0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.35); }
  50% { box-shadow: 0 0 0 6px rgba(59, 130, 246, 0); }
}
</style>
