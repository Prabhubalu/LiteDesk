<template>
  <div
    :class="[
      'flex items-center gap-2 shrink-0',
      embedded ? 'overflow-visible' : 'shrink-0 flex-wrap gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
    ]"
  >
    <div
      :class="[
        'flex items-center gap-0.5 rounded-lg border border-gray-200 dark:border-gray-600',
        embedded ? 'h-8 p-0.5' : 'p-0.5'
      ]"
    >
      <button
        type="button"
        :class="mode === 'design' ? activeTabClass : inactiveTabClass"
        @click="$emit('update:mode', 'design')"
      >
        {{ t('process.insightTabDesign') }}
      </button>
      <button
        type="button"
        :class="mode === 'insight' ? activeTabClass : inactiveTabClass"
        @click="$emit('update:mode', 'insight')"
      >
        {{ t('process.insightTabRun') }}
      </button>
    </div>

    <template v-if="mode === 'insight'">
      <HeadlessSelect
        v-model="localExecutionId"
        :options="executionOptions"
        allow-empty
        :empty-label="t('process.insightSelectRun')"
        :button-class="embedded ? PROCESS_HEADER_SELECT_BUTTON_CLASS : PROCESS_SELECT_BUTTON_CLASS"
        :options-class="embedded ? PROCESS_HEADER_SELECT_OPTIONS_CLASS : undefined"
        :wrapper-class="embedded ? 'min-w-[200px] overflow-visible' : 'min-w-[200px]'"
        :teleport="embedded"
        @update:model-value="onExecutionPick"
      />

      <button
        type="button"
        :class="[
          embedded ? PROCESS_HEADER_BTN_CLASS : 'text-sm px-3 py-1.5',
          'rounded-lg border border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
        ]"
        :disabled="testing"
        @click="$emit('test')"
      >
        {{ testing ? t('process.insightSimulating') : t('process.insightSimulateTest') }}
      </button>

      <span v-if="graphState?.dryRun" class="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
        {{ t('process.insightDryRunBadge') }}
      </span>
      <span v-else-if="graphState?.definitionVersion" class="text-xs text-gray-600 dark:text-gray-400">
        {{ t('process.insightRunVersion', { version: graphState.definitionVersion.versionNumber, status: graphState.status }) }}
      </span>
      <span v-else-if="graphState" class="text-xs text-gray-600 dark:text-gray-400">
        {{ t('process.insightRunStatus', { status: graphState.status }) }}
      </span>
    </template>
  </div>
</template>

<script setup>
import { formatUserDateTime } from '@/utils/localeFormat';
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import {
  PROCESS_SELECT_BUTTON_CLASS,
  PROCESS_HEADER_BTN_CLASS,
  PROCESS_HEADER_TAB_ACTIVE,
  PROCESS_HEADER_TAB_INACTIVE,
  PROCESS_HEADER_SELECT_BUTTON_CLASS,
  PROCESS_HEADER_SELECT_OPTIONS_CLASS
} from '@/utils/processDesignerConstants';

const { t } = useI18n();

const props = defineProps({
  mode: { type: String, default: 'design' },
  executions: { type: Array, default: () => [] },
  selectedExecutionId: { type: String, default: '' },
  graphState: { type: Object, default: null },
  testing: { type: Boolean, default: false },
  /** Inline in process designer header (no extra bar row). */
  embedded: { type: Boolean, default: false }
});

const emit = defineEmits(['update:mode', 'select-execution', 'test']);

const localExecutionId = ref(props.selectedExecutionId);

watch(() => props.selectedExecutionId, (v) => { localExecutionId.value = v; });

const activeTabClass = props.embedded
  ? `${PROCESS_HEADER_TAB_ACTIVE} rounded-md`
  : 'px-3 py-1.5 text-sm font-medium rounded-md bg-indigo-600 text-white h-8 inline-flex items-center';
const inactiveTabClass = props.embedded
  ? `${PROCESS_HEADER_TAB_INACTIVE} rounded-md`
  : 'px-3 py-1.5 text-sm font-medium rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 h-8 inline-flex items-center';

const executionOptions = computed(() =>
  (props.executions || []).map((ex) => ({
    value: ex._id,
    label: formatRunLabel(ex)
  }))
);

function formatRunLabel(ex) {
  const d = ex.startedAt ? formatUserDateTime(ex.startedAt) : t('process.insightRunUnknownTime');
  return t('process.insightRunOption', { status: ex.status, startedAt: d });
}

function onExecutionPick() {
  emit('select-execution', localExecutionId.value);
}
</script>
