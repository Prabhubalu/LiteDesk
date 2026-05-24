<template>
  <div class="h-full flex flex-col border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
    <div v-if="!nodeId" class="flex-1 flex items-center justify-center p-6 text-center">
      <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('process.inspectorSelectStep') }}</p>
    </div>
    <template v-else>
      <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ nodeLabel }}</h3>
          <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{{ t('process.inspectorSchemaVersion', { version: nodeVersion }) }}</p>
        </div>
        <button
          type="button"
          class="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
          @click="$emit('deselect')"
        >
          {{ t('process.inspectorProcessSettings') }}
        </button>
      </div>

      <div class="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-900/40">
        <p class="text-[10px] font-semibold uppercase text-indigo-600 dark:text-indigo-400 mb-1">{{ t('process.inspectorSummaryHeading') }}</p>
        <p class="text-sm text-indigo-900 dark:text-indigo-100 leading-snug">{{ sentence }}</p>
        <p v-if="executionDetail" class="text-xs text-red-700 dark:text-red-300 mt-2">{{ executionDetail }}</p>
      </div>

      <div v-if="editable" class="flex-1 overflow-y-auto p-4 space-y-4">
        <div v-if="processType === 'trigger'" class="space-y-2">
          <p class="text-xs text-gray-600 dark:text-gray-400">
            {{ t('process.inspectorTriggerConfigured') }}
            <button type="button" class="text-indigo-600 underline" @click="$emit('deselect')">{{ t('process.inspectorOpenProcessSettings') }}</button>.
          </p>
          <p class="text-xs font-medium text-gray-800 dark:text-gray-200">{{ sentence }}</p>
        </div>

        <div v-else-if="processType === 'condition'" class="space-y-3">
          <p class="text-[10px] text-gray-500">{{ t('process.inspectorAppliesToModule', { module: moduleLabel }) }}</p>
          <div>
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('process.inspectorFieldHeading') }}</label>
            <HeadlessSelect
              v-model="conditionFieldKey"
              :options="conditionFieldSelectOptions"
              allow-empty
              :empty-label="t('process.inspectorSelectField')"
              :button-class="PROCESS_SELECT_BUTTON_CLASS"
              @update:model-value="emitConditionUpdate"
            />
            <input
              v-if="conditionFieldKey === '_custom'"
              v-model="customFieldPath"
              type="text"
              :placeholder="t('process.inspectorCustomPathPh')"
              class="mt-2 w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
              @input="emitConditionUpdate"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('process.inspectorOperatorHeading') }}</label>
            <HeadlessSelect
              v-model="localConfig.condition.operator"
              :options="conditionOperatorOptions"
              :button-class="PROCESS_SELECT_BUTTON_CLASS"
              @update:model-value="emitConditionUpdate"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('process.inspectorValueHeading') }}</label>
            <HeadlessSelect
              v-if="conditionValueInputType === 'select'"
              v-model="localConfig.condition.value"
              :options="conditionValueOptions"
              allow-empty
              :empty-label="t('process.inspectorSelectValue')"
              :button-class="PROCESS_SELECT_BUTTON_CLASS"
              @update:model-value="onConditionValueChange"
            />
            <input
              v-else-if="conditionValueInputType === 'number'"
              v-model.number="localConfig.condition.value"
              type="number"
              class="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
              @input="emitConditionUpdate"
            />
            <HeadlessSelect
              v-else-if="conditionValueInputType === 'boolean'"
              v-model="conditionBooleanValue"
              :options="booleanValueOptions"
              allow-empty
              :empty-label="t('process.inspectorSelectGeneric')"
              :button-class="PROCESS_SELECT_BUTTON_CLASS"
              @update:model-value="onConditionBooleanChange"
            />
            <input
              v-else
              v-model="localConfig.condition.value"
              type="text"
              :placeholder="t('process.inspectorEnterValuePh')"
              class="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
              @input="emitConditionUpdate"
            />
            <p v-if="conditionFieldsLoading" class="text-[10px] text-gray-500 mt-1">{{ t('process.inspectorLoadingFieldOptions') }}</p>
            <p v-else-if="conditionValueInputType === 'select' && !conditionValueOptions.length" class="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
              {{ t('process.inspectorNoPicklistOptions') }}
            </p>
          </div>
          <p class="text-[10px] text-gray-500">{{ t('process.inspectorConnectHandles') }}</p>
        </div>

        <div v-else-if="processType === 'field_rule'" class="space-y-3">
          <p class="text-[10px] text-gray-500">{{ t('process.inspectorModulePrefix', { module: moduleLabel }) }}</p>
          <div>
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('process.inspectorFieldHeading') }}</label>
            <HeadlessSelect
              v-if="conditionFields.length"
              v-model="localConfig.fieldKey"
              :options="conditionFields"
              allow-empty
              :empty-label="t('process.inspectorSelectGeneric')"
              :button-class="PROCESS_SELECT_BUTTON_CLASS"
              @update:model-value="emitUpdate"
            />
            <input
              v-else
              v-model="localConfig.fieldKey"
              type="text"
              class="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
              @input="emitUpdate"
            />
          </div>
          <HeadlessSelect
            v-model="localConfig.rule"
            :options="fieldRuleOptions"
            :button-class="PROCESS_SELECT_BUTTON_CLASS"
            @update:model-value="emitUpdate"
          />
          <input
            v-if="localConfig.rule === 'default'"
            v-model="localConfig.value"
            type="text"
            :placeholder="t('process.inspectorDefaultValuePh')"
            class="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
            @input="emitUpdate"
          />
        </div>

        <div v-else-if="processType === 'ownership_rule'" class="space-y-3">
          <HeadlessSelect
            v-model="localConfig.assignment"
            :options="ownershipAssignmentOptions"
            :button-class="PROCESS_SELECT_BUTTON_CLASS"
            @update:model-value="emitUpdate"
          />
          <input v-model="localConfig.target" :placeholder="t('process.inspectorOwnerTargetPh')" class="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" @input="emitUpdate" />
        </div>

        <div v-else-if="processType === 'status_guard'" class="space-y-3">
          <HeadlessSelect
            v-model="localConfig.field"
            :options="statusGuardFieldOptions"
            :button-class="PROCESS_SELECT_BUTTON_CLASS"
            @update:model-value="emitUpdate"
          />
          <div class="grid grid-cols-2 gap-2">
            <input v-model="statusFrom" :placeholder="t('process.inspectorStatusFromPh')" class="px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" @input="emitStatusGuard" />
            <input v-model="statusTo" :placeholder="t('process.inspectorStatusToPh')" class="px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" @input="emitStatusGuard" />
          </div>
          <input v-model="localConfig.blockReason" :placeholder="t('process.inspectorBlockReasonPh')" class="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" @input="emitUpdate" />
        </div>

        <div v-else-if="processType === 'action'" class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('process.inspectorActionHeading') }}</label>
            <HeadlessSelect
              :model-value="localConfig.actionType"
              :options="actionTypeOptions"
              allow-empty
              :empty-label="t('process.inspectorSelectAction')"
              :placeholder="t('process.inspectorSelectAction')"
              :button-class="PROCESS_SELECT_BUTTON_CLASS"
              @update:model-value="onActionTypeChange"
            />
          </div>
          <ProcessActionFields
            v-if="selectedActionDef"
            :action-def="selectedActionDef"
            :params="localConfig.params || {}"
            @update:params="onActionParamsChange"
          />
        </div>

        <div v-else-if="processType === 'approval_gate'" class="space-y-3">
          <input v-model="localConfig.approvers.role" :placeholder="t('process.inspectorApproverRolePh')" class="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" @input="emitUpdate" />
          <input v-model.number="localConfig.timeoutHours" type="number" :placeholder="t('process.inspectorTimeoutHoursPh')" class="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" @input="emitUpdate" />
        </div>

        <div v-else-if="processType === 'wait'" class="space-y-3">
          <p class="text-[11px] text-gray-500 dark:text-gray-400">{{ t('process.inspectorWaitHint') }}</p>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="preset in waitPresets"
              :key="preset.label"
              type="button"
              class="px-2 py-1 text-[11px] rounded-md border border-gray-200 dark:border-gray-600 hover:border-indigo-500 dark:hover:border-indigo-400"
              @click="applyWaitPreset(preset.duration, preset.unit)"
            >
              {{ preset.label }}
            </button>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <input
              v-model.number="localConfig.duration"
              type="number"
              min="1"
              :placeholder="t('process.inspectorDurationPh')"
              class="px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
              @input="emitUpdate"
            />
            <HeadlessSelect
              v-model="localConfig.unit"
              :options="waitUnitOptions"
              :button-class="PROCESS_SELECT_BUTTON_CLASS"
              @update:model-value="emitUpdate"
            />
          </div>
        </div>

        <div v-else class="text-xs text-gray-500">{{ t('process.inspectorNoConfig') }}</div>

        <button
          v-if="processType !== 'trigger'"
          type="button"
          class="w-full text-sm text-red-600 dark:text-red-400 hover:underline"
          @click="$emit('delete-node', nodeId)"
        >
          {{ t('process.inspectorRemoveStep') }}
        </button>
      </div>
      <div v-else class="flex-1 p-4 text-xs text-gray-500">
        {{ t('process.inspectorDuplicateToEdit') }}
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import ProcessActionFields from '@/components/process-flow/ProcessActionFields.vue';
import { buildNodeSentence } from '@/utils/processSentenceBuilder';
import {
  getConditionFieldsByModule,
  getConditionOperatorOptions,
  getBooleanValueOptions,
  getFieldRuleOptions,
  getOwnershipAssignmentOptions,
  getStatusGuardFieldOptions,
  getWaitUnitOptions,
  getWaitPresets,
  PROCESS_SELECT_BUTTON_CLASS,
  conditionFieldToPath,
  conditionPathToField,
  getModuleLabel
} from '@/utils/processDesignerConstants';

const { t } = useI18n();

const props = defineProps({
  nodeId: { type: String, default: null },
  processType: { type: String, default: '' },
  nodeLabel: { type: String, default: '' },
  nodeVersion: { type: Number, default: 1 },
  config: { type: Object, default: () => ({}) },
  process: { type: Object, default: null },
  editable: { type: Boolean, default: true },
  executionDetail: { type: String, default: '' },
  moduleFieldMeta: { type: Object, default: () => ({}) },
  conditionFieldsLoading: { type: Boolean, default: false },
  designerMetadata: { type: Object, default: null }
});

const emit = defineEmits(['update-node', 'delete-node', 'deselect']);

const localConfig = ref({});
const isHydrating = ref(false);
const conditionFieldKey = ref('');
const customFieldPath = ref('');
const statusFrom = ref('');
const statusTo = ref('');

const conditionOperatorOptions = computed(() => getConditionOperatorOptions(t));
const booleanValueOptions = computed(() => getBooleanValueOptions(t));
const fieldRuleOptions = computed(() => getFieldRuleOptions(t));
const ownershipAssignmentOptions = computed(() => getOwnershipAssignmentOptions(t));
const statusGuardFieldOptions = computed(() => getStatusGuardFieldOptions(t));
const waitUnitOptions = computed(() => getWaitUnitOptions(t));
const waitPresets = computed(() => getWaitPresets(t));

const displayNodeLabel = computed(() => props.nodeLabel || t('process.inspectorStepDefault'));
const nodeLabel = displayNodeLabel;

const moduleLabel = computed(() => {
  return (
    getModuleLabel(t, props.process?.entityType, { plural: true }) ||
    props.process?.entityType ||
    t('process.inspectorRecordsFallback')
  );
});

const conditionFields = computed(() => {
  const fromModule = Object.values(props.moduleFieldMeta || {})
    .filter((m) => m?.key)
    .map((m) => ({ value: m.key, label: m.label || m.key }));
  if (fromModule.length) return fromModule;
  return getConditionFieldsByModule(t, props.process?.entityType);
});

const conditionFieldSelectOptions = computed(() => [
  ...conditionFields.value,
  { value: '_custom', label: t('process.inspectorCustomPathOption') }
]);

const processActions = computed(() => props.designerMetadata?.processActions || []);

const actionTypeOptions = computed(() =>
  processActions.value.map((a) => ({ value: a.actionType, label: a.label }))
);

const selectedActionDef = computed(() =>
  processActions.value.find((a) => a.actionType === localConfig.value.actionType) || null
);

function defaultParamsForAction(actionType) {
  const def = processActions.value.find((a) => a.actionType === actionType);
  if (!def) return {};
  const out = {};
  for (const field of def.params || []) {
    if (field.defaultValue !== undefined) out[field.key] = field.defaultValue;
    else if (field.type === 'text' || field.type === 'textarea') out[field.key] = '';
    else if (field.type === 'number') out[field.key] = null;
  }
  return out;
}

function onActionTypeChange(newType) {
  if (isHydrating.value || !newType || newType === localConfig.value.actionType) return;
  localConfig.value.actionType = newType;
  localConfig.value.params = defaultParamsForAction(newType);
  emitUpdate();
}

function onActionParamsChange(params) {
  localConfig.value.params = params;
  emitUpdate();
}

const selectedConditionFieldMeta = computed(() => {
  if (!conditionFieldKey.value || conditionFieldKey.value === '_custom') return null;
  return props.moduleFieldMeta[conditionFieldKey.value] || null;
});

const conditionValueOptions = computed(() => selectedConditionFieldMeta.value?.options || []);

const conditionValueInputType = computed(() => {
  const meta = selectedConditionFieldMeta.value;
  if (meta?.valueInputType) return meta.valueInputType;
  if (meta?.options?.length) return 'select';
  return 'text';
});

const conditionBooleanValue = computed({
  get() {
    const v = localConfig.value.condition?.value;
    if (v === true || v === 'true') return 'true';
    if (v === false || v === 'false') return 'false';
    return '';
  },
  set(val) {
    if (!localConfig.value.condition) return;
    if (val === 'true') localConfig.value.condition.value = true;
    else if (val === 'false') localConfig.value.condition.value = false;
    else localConfig.value.condition.value = '';
  }
});

function buildEmitConfig() {
  const type = props.processType;
  const config = { ...localConfig.value };
  if (['field_rule', 'ownership_rule', 'status_guard'].includes(type)) {
    config.entityType = props.process?.entityType || config.entityType;
  }
  if (type === 'condition') {
    return { condition: localConfig.value.condition };
  }
  return config;
}

function buildEmitSentence(config) {
  if (!props.processType) return '';
  return buildNodeSentence({ type: props.processType, config }, props.process);
}

function hydrateFromProps() {
  if (!props.nodeId) return;
  isHydrating.value = true;
  const c = props.config || {};
  const entityType = props.process?.entityType || c.entityType || 'deal';

  if (props.processType === 'condition') {
    const cond = c.condition || c;
    const path = cond.field || '';
    const key = conditionPathToField(path);
    const known = conditionFields.value.some((f) => f.value === key);
    conditionFieldKey.value = known ? key : (path ? '_custom' : '');
    customFieldPath.value = known ? '' : path;
    localConfig.value = {
      condition: {
        field: cond.field || '',
        operator: cond.operator || 'equals',
        value: cond.value ?? ''
      }
    };
  } else if (props.processType === 'action') {
    const actionType = c.actionType || '';
    const savedParams = { ...(c.params || {}) };
    localConfig.value = {
      actionType,
      params:
        actionType && processActions.value.length
          ? { ...defaultParamsForAction(actionType), ...savedParams }
          : savedParams
    };
  } else if (props.processType === 'approval_gate') {
    localConfig.value = {
      approvers: { ...(c.approvers || { role: 'manager' }) },
      timeoutHours: c.timeoutHours ?? 48
    };
  } else if (props.processType === 'wait') {
    localConfig.value = {
      duration: c.duration ?? 2,
      unit: c.unit || 'days'
    };
  } else if (props.processType === 'status_guard') {
    const tr = c.allowedTransitions?.[0] || '';
    const parts = tr.split('→').map((s) => s.trim());
    statusFrom.value = parts[0] || '';
    statusTo.value = parts[1] || '';
    localConfig.value = { ...c, entityType, field: c.field || 'stage' };
  } else if (['field_rule', 'ownership_rule'].includes(props.processType)) {
    localConfig.value = { ...c, entityType };
  } else {
    localConfig.value = { ...c };
  }
  queueMicrotask(() => {
    isHydrating.value = false;
  });
}

watch(
  () => [props.nodeId, props.processType],
  () => hydrateFromProps(),
  { immediate: true }
);

onBeforeUnmount(() => {
  if (props.nodeId && props.editable) emitUpdate();
});

const sentence = computed(() => buildEmitSentence(buildEmitConfig()));

function emitUpdate() {
  if (!props.nodeId) return;
  const config = buildEmitConfig();
  emit('update-node', {
    nodeId: props.nodeId,
    processType: props.processType,
    config,
    sentence: buildEmitSentence(config)
  });
}

function emitConditionUpdate() {
  let field = localConfig.value.condition?.field || '';
  if (conditionFieldKey.value && conditionFieldKey.value !== '_custom') {
    field = conditionFieldToPath(conditionFieldKey.value, props.process?.entityType);
  } else if (conditionFieldKey.value === '_custom') {
    field = customFieldPath.value;
  }
  localConfig.value.condition.field = field;
  emitUpdate();
}

function onConditionValueChange() {
  emitConditionUpdate();
}

function onConditionBooleanChange() {
  emitConditionUpdate();
}

watch(conditionFieldKey, (key, prev) => {
  if (isHydrating.value || key === prev || !localConfig.value.condition) return;
  if (key === '_custom') return;
  const meta = props.moduleFieldMeta[key];
  if (meta?.valueInputType === 'select' && meta.options?.length) {
    const current = localConfig.value.condition.value;
    const allowed = new Set(meta.options.map((o) => o.value));
    if (current != null && current !== '' && !allowed.has(String(current))) {
      localConfig.value.condition.value = '';
      emitConditionUpdate();
    }
  }
});

function emitStatusGuard() {
  localConfig.value.allowedTransitions = [`${statusFrom.value} → ${statusTo.value}`];
  emitUpdate();
}

function applyWaitPreset(duration, unit) {
  localConfig.value = { duration, unit };
  emitUpdate();
}
</script>
