<template>
  <div class="h-full flex flex-col border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
    <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('process.settingsHeading') }}</h3>
      <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{{ t('process.settingsSubtitle') }}</p>
    </div>

    <div class="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-900/40">
      <p class="text-[10px] font-semibold uppercase text-indigo-600 dark:text-indigo-400 mb-1">{{ t('process.settingsSummaryHeading') }}</p>
      <p class="text-sm text-indigo-900 dark:text-indigo-100 leading-snug">{{ scopeSentence }}</p>
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-5">
      <p v-if="!editable" class="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
        {{ t('process.settingsActiveDuplicate') }}
      </p>

      <div>
        <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          {{ t('process.settingsAppHeading') }} <span class="text-red-500">*</span>
        </label>
        <HeadlessSelect
          v-model="local.appKey"
          :options="appOptions"
          allow-empty
          :empty-label="t('process.settingsSelectApp')"
          :disabled="!editable"
          :button-class="PROCESS_SELECT_BUTTON_CLASS"
          @update:model-value="emitChange"
        />
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          {{ t('process.settingsModuleHeading') }} <span class="text-red-500">*</span>
        </label>
        <HeadlessSelect
          v-model="local.entityType"
          :options="moduleOptions"
          allow-empty
          :empty-label="t('process.settingsSelectModule')"
          :disabled="!editable"
          :button-class="PROCESS_SELECT_BUTTON_CLASS"
          @update:model-value="onModuleChange"
        />
        <p class="text-[10px] text-gray-500 mt-1">{{ t('process.settingsModuleHint') }}</p>
      </div>

      <div
        ref="startsWhenSectionRef"
        :class="[
          'rounded-lg -mx-1 px-1 py-2 transition-shadow',
          highlightStartsWhen && 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-gray-800 bg-indigo-50/50 dark:bg-indigo-900/10'
        ]"
      >
        <div v-if="!local.coreTrigger && editable" class="mb-2 flex items-center gap-2">
          <span class="text-[10px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">{{ t('process.settingsStep1Badge') }}</span>
          <span class="text-[10px] text-gray-500 dark:text-gray-400">{{ t('process.settingsStep1Hint') }}</span>
        </div>
        <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          {{ t('process.settingsStartsWhenHeading') }} <span class="text-red-500">*</span>
        </label>
        <HeadlessSelect
          id="process-starts-when"
          v-model="local.coreTrigger"
          :options="coreTriggerOptionsList"
          allow-empty
          :empty-label="startsWhenPlaceholder"
          :placeholder="startsWhenPlaceholder"
          :disabled="!editable || !local.entityType"
          :button-class="PROCESS_SELECT_BUTTON_CLASS"
          @update:model-value="onCoreTriggerChange"
        />
        <p class="text-[10px] text-gray-500 mt-1">{{ startsWhenHint }}</p>
      </div>

      <div
        v-if="local.coreTrigger === 'record_updated' && local.entityType"
        class="space-y-2 rounded-lg border border-gray-200 dark:border-gray-600 p-3"
      >
        <label class="block text-xs font-medium text-gray-700 dark:text-gray-300">{{ t('process.settingsWatchChangesHeading') }}</label>
        <HeadlessSelect
          v-model="local.updateWatchField"
          :options="watchFieldOptions"
          :disabled="!editable"
          :button-class="PROCESS_SELECT_BUTTON_CLASS"
          @update:model-value="emitChange"
        />
        <p class="text-[10px] text-gray-500">
          {{ t('process.settingsWatchIfHint') }}
        </p>
      </div>

      <div
        v-if="local.coreTrigger === 'schedule'"
        class="space-y-3 rounded-lg border border-gray-200 dark:border-gray-600 p-3"
      >
        <div>
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('process.settingsFrequencyHeading') }}</label>
          <HeadlessSelect
            v-model="local.schedule.preset"
            :options="schedulePresetOptions"
            :disabled="!editable"
            :button-class="PROCESS_SELECT_BUTTON_CLASS"
            @update:model-value="emitChange"
          />
        </div>
        <div v-if="local.schedule.preset === 'daily' || local.schedule.preset === 'weekly'" class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[10px] text-gray-500 mb-1">{{ t('process.settingsHourHeading') }}</label>
            <input
              v-model.number="local.schedule.hour"
              type="number"
              min="0"
              max="23"
              :disabled="!editable"
              class="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
              @input="emitChange"
            />
          </div>
          <div>
            <label class="block text-[10px] text-gray-500 mb-1">{{ t('process.settingsMinuteHeading') }}</label>
            <input
              v-model.number="local.schedule.minute"
              type="number"
              min="0"
              max="59"
              :disabled="!editable"
              class="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
              @input="emitChange"
            />
          </div>
        </div>
        <p class="text-[10px] text-amber-700 dark:text-amber-300">
          {{ t('process.settingsScheduleRunnerHint') }}
        </p>
      </div>

      <div v-if="local.coreTrigger === 'webhook'" class="space-y-3 rounded-lg border border-gray-200 dark:border-gray-600 p-3">
        <div>
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('process.settingsWebhookUrlHeading') }}</label>
          <div class="flex gap-1">
            <input
              :value="webhookUrl"
              readonly
              class="flex-1 px-2 py-1.5 text-[11px] font-mono rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300"
            />
            <button
              type="button"
              class="shrink-0 px-2 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
              :disabled="!webhookUrl"
              @click="copyWebhookUrl"
            >
              {{ t('actions.copy') }}
            </button>
          </div>
          <p v-if="!webhookUrl" class="text-[10px] text-gray-500 mt-1">{{ t('process.settingsWebhookSaveHint') }}</p>
        </div>

        <div class="flex items-center justify-between gap-2">
          <span class="text-xs text-gray-600 dark:text-gray-400">
            {{ secretConfigured ? t('process.settingsSecretConfigured') : t('process.settingsSecretNotSet') }}
          </span>
          <button
            v-if="editable && process._id"
            type="button"
            class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
            :disabled="rotating"
            @click="rotateSecret"
          >
            {{ rotating ? t('process.settingsRotatingSecret') : t('process.settingsRotateSecret') }}
          </button>
        </div>

        <p class="text-[10px] text-gray-500 leading-snug">
          {{ t('process.settingsWebhookAuthHint') }}
        </p>

        <div>
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('process.settingsPayloadMappingHeading') }}</label>
          <div v-for="(row, idx) in mappingRows" :key="idx" class="grid grid-cols-2 gap-1 mb-1">
            <input
              v-model="row.dataBagKey"
              :placeholder="t('process.settingsDataBagKeyPh')"
              :disabled="!editable"
              class="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
              @input="emitMapping"
            />
            <input
              v-model="row.sourcePath"
              :placeholder="t('process.settingsBodyFieldPh')"
              :disabled="!editable"
              class="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
              @input="emitMapping"
            />
          </div>
          <button
            v-if="editable"
            type="button"
            class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            @click="addMappingRow"
          >
            {{ t('process.settingsAddMapping') }}
          </button>
        </div>
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('process.settingsDescriptionHeading') }}</label>
        <textarea
          v-model="local.description"
          :disabled="!editable"
          rows="2"
          class="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 disabled:opacity-60"
          :placeholder="t('process.settingsDescriptionPh')"
          @input="emitChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import {
  getAppOptions,
  getModuleOptions,
  PROCESS_SELECT_BUTTON_CLASS,
  coreTriggerOptions,
  getSchedulePresetOptions,
  getCoreTriggerDescription,
  updateWatchFieldOptions,
  resolveCoreTriggerFromProcess,
  resolveUpdateWatchFromProcess,
  resolveScheduleFromProcess,
  coerceCoreTriggerForModule,
  applyCoreTrigger,
  buildTriggerFromCore,
  buildProcessScopeSentence
} from '@/utils/processDesignerConstants';

const { t } = useI18n();

const props = defineProps({
  process: { type: Object, required: true },
  editable: { type: Boolean, default: true },
  highlightStartsWhen: { type: Boolean, default: false }
});

const emit = defineEmits(['update', 'webhook-secret']);

const startsWhenSectionRef = ref(null);

const local = ref({
  appKey: '',
  entityType: '',
  description: '',
  coreTrigger: '',
  updateWatchField: '__any__',
  schedule: { preset: 'daily', hour: 9, minute: 0, dayOfWeek: 1, timezone: 'UTC' }
});

const mappingRows = ref([{ dataBagKey: '', sourcePath: '' }]);
const rotating = ref(false);

const appOptions = computed(() => getAppOptions(t));
const moduleOptions = computed(() => getModuleOptions(t));
const coreTriggerOptionsList = computed(() => coreTriggerOptions(t));
const schedulePresetOptions = computed(() => getSchedulePresetOptions(t));
const watchFieldOptions = computed(() => updateWatchFieldOptions(local.value.entityType, t));

function syncFromProcess() {
  const p = props.process;
  const entityType = p?.entityType || '';
  const watch = resolveUpdateWatchFromProcess(p);
  local.value = {
    appKey: p?.appKey || '',
    entityType,
    description: p?.description || '',
    coreTrigger: coerceCoreTriggerForModule(resolveCoreTriggerFromProcess(p)),
    updateWatchField: watch.watchField,
    schedule: resolveScheduleFromProcess(p)
  };
  const mapping = p?.trigger?.payloadMapping || {};
  const entries = Object.entries(mapping);
  mappingRows.value =
    entries.length > 0
      ? entries.map(([dataBagKey, sourcePath]) => ({ dataBagKey, sourcePath: String(sourcePath) }))
      : [{ dataBagKey: '', sourcePath: '' }];
}

watch(() => props.process, syncFromProcess, { immediate: true, deep: true });

watch(
  () => props.highlightStartsWhen,
  async (on) => {
    if (!on) return;
    await nextTick();
    startsWhenSectionRef.value?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }
);

const startsWhenPlaceholder = computed(() => {
  if (!local.value.entityType) return t('process.settingsSelectModuleFirst');
  return t('process.settingsChooseStart');
});

const startsWhenHint = computed(() => {
  if (!local.value.entityType) return t('process.settingsPickModuleFirst');
  return getCoreTriggerDescription(t, local.value.coreTrigger);
});

const webhookUrl = computed(() => props.process?.webhookUrl || '');
const secretConfigured = computed(() => props.process?.trigger?.secretConfigured === true);

const scopeSentence = computed(() =>
  buildProcessScopeSentence(
    {
      appKey: local.value.appKey,
      entityType: local.value.entityType,
      coreTrigger: local.value.coreTrigger,
      trigger: buildTriggerPayload()
    },
    t
  )
);

function buildPayloadMapping() {
  const out = {};
  for (const row of mappingRows.value) {
    if (row.dataBagKey?.trim() && row.sourcePath?.trim()) {
      out[row.dataBagKey.trim()] = row.sourcePath.trim();
    }
  }
  return out;
}

function buildTriggerPayload() {
  return buildTriggerFromCore(
    local.value.coreTrigger,
    local.value.entityType,
    {
      payloadMapping: buildPayloadMapping(),
      updateWatchField: local.value.updateWatchField,
      schedule: local.value.schedule
    },
    props.process?.trigger || {}
  );
}

function onModuleChange() {
  local.value.coreTrigger = coerceCoreTriggerForModule(local.value.coreTrigger);
  emitChange();
}

function onCoreTriggerChange() {
  if (local.value.coreTrigger === 'record_updated' && local.value.updateWatchField === '__any__') {
    /* keep */
  }
  emitChange();
}

function emitMapping() {
  emitChange();
}

function addMappingRow() {
  mappingRows.value.push({ dataBagKey: '', sourcePath: '' });
}

function emitChange() {
  const applied = applyCoreTrigger(local.value.coreTrigger, local.value.entityType, {
    payloadMapping: buildPayloadMapping(),
    updateWatchField: local.value.updateWatchField,
    schedule: local.value.schedule
  });
  const trigger = buildTriggerPayload();
  emit('update', {
    appKey: local.value.appKey,
    entityType: local.value.entityType,
    description: local.value.description,
    coreTrigger: local.value.coreTrigger,
    triggerConfigured: Boolean(local.value.coreTrigger),
    trigger,
    needsTriggerNode: applied.needsTriggerNode
  });
}

async function copyWebhookUrl() {
  if (!webhookUrl.value) return;
  try {
    await navigator.clipboard.writeText(webhookUrl.value);
  } catch {
    /* ignore */
  }
}

async function rotateSecret() {
  if (!props.process?._id || !props.editable) return;
  rotating.value = true;
  try {
    const res = await apiClient.post(`/admin/processes/${props.process._id}/webhook/rotate-secret`);
    if (!res.success) throw new Error(res.message);
    if (res.webhookSecret) emit('webhook-secret', res.webhookSecret);
    emit('update', {
      appKey: local.value.appKey,
      entityType: local.value.entityType,
      description: local.value.description,
      trigger: res.data?.trigger || buildTriggerFromCore('webhook', local.value.entityType, { payloadMapping: buildPayloadMapping() }, props.process?.trigger || {}),
      needsTriggerNode: true,
      processPatch: res.data
    });
    local.value.coreTrigger = 'webhook';
  } catch (e) {
    alert(e.message || t('process.settingsRotateSecretFailed'));
  } finally {
    rotating.value = false;
  }
}
</script>
