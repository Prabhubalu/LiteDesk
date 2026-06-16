<template>
  <div class="space-y-8">
    <!-- Policy -->
    <section class="space-y-4">
      <div>
        <label class="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">
          {{ t('settings.helpdeskExecSlaPolicyName') }}
        </label>
        <input
          v-model.trim="draft.name"
          type="text"
          :placeholder="t('settings.helpdeskExecSlaDrawerNamePh')"
          class="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        />
      </div>

      <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input v-model="draft.isDefault" type="checkbox" class="rounded border-gray-300 text-indigo-600" />
        {{ t('settings.slaPolicyUseAsDefault') }}
      </label>

      <div>
        <p class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('settings.slaPolicyTimeCalculation') }}</p>
        <div class="flex flex-wrap gap-4">
          <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input v-model="timeMode" type="radio" value="calendar" class="border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            {{ t('settings.slaPolicyCalendarHours') }}
          </label>
          <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input v-model="timeMode" type="radio" value="business" class="border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            {{ t('settings.slaPolicyBusinessHours') }}
          </label>
        </div>
        <p v-if="timeMode === 'calendar'" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {{ t('settings.slaPolicyCalendarHoursInfo') }}
        </p>
      </div>

      <div v-if="timeMode === 'business'">
        <HelpdeskSlaScheduleSection v-model:business-hours="businessHoursModel" always-expanded />
      </div>
    </section>

    <!-- Targets -->
    <section class="space-y-3 border-t border-gray-100 pt-6 dark:border-gray-800">
      <div class="flex items-center justify-between gap-2">
        <div>
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.slaSectionTargets') }}</h4>
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.slaSectionTargetsHint') }}</p>
        </div>
        <button
          v-if="!isStandard"
          type="button"
          class="shrink-0 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          @click="copyFromStandard"
        >
          {{ t('settings.helpdeskExecSlaPolicyCopyDefault') }}
        </button>
      </div>
      <HelpdeskSlaTargetGrid
        v-model:targets="draft.targets"
        :priorities="priorities"
        :priority-label="priorityLabel"
        :standard-targets="standardTargets"
        :hour-override-modes="slaPolicyOptions.hourOverrideModes"
        show-override-hours
      />
    </section>

    <!-- Coverage -->
    <section class="space-y-4 border-t border-gray-100 pt-6 dark:border-gray-800">
      <div>
        <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.slaSectionCoverage') }}</h4>
        <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.slaSectionCoverageHint') }}</p>
      </div>

      <div>
        <p class="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('settings.helpdeskExecEnabledCaseTypes') }}</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="type in caseTypes"
            :key="type"
            type="button"
            class="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
            :class="pillClass(draft.caseTypes, type)"
            @click="toggleValue(draft.caseTypes, type)"
          >
            {{ caseTypeLabel(type) }}
          </button>
        </div>
      </div>

      <div v-if="!isStandard">
        <p class="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('settings.helpdeskExecSlaPolicyChannels') }}</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="channel in channels"
            :key="channel"
            type="button"
            class="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
            :class="pillClass(draft.channels, channel)"
            @click="toggleValue(draft.channels, channel)"
          >
            {{ channel }}
          </button>
        </div>
      </div>

      <div v-if="!isStandard">
        <p class="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('settings.helpdeskExecSlaPriorityColumn') }}</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="priority in priorities"
            :key="priority"
            type="button"
            class="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
            :class="pillClass(draft.priorities, priority)"
            @click="toggleValue(draft.priorities, priority)"
          >
            {{ priorityLabel(priority) }}
          </button>
        </div>
      </div>
    </section>

    <!-- Alerts -->
    <section class="space-y-3 border-t border-gray-100 pt-6 dark:border-gray-800">
      <div>
        <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.slaSectionAlerts') }}</h4>
        <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.slaSectionAlertsHint') }}</p>
      </div>
      <HelpdeskSlaAlertCards
        v-model:alerts="draft.alerts"
        :priorities="priorities"
        :priority-label="priorityLabel"
        :sla-policy-options="slaPolicyOptions"
      />
    </section>

    <!-- Escalation -->
    <section class="space-y-3 border-t border-gray-100 pt-6 dark:border-gray-800">
      <div>
        <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.slaSectionEscalation') }}</h4>
        <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.slaSectionEscalationHint') }}</p>
      </div>
      <HelpdeskSlaEscalationTimeline
        v-model:steps="draft.escalationSteps"
        v-model:cooldown-minutes="draft.escalationCooldownMinutes"
        :sla-policy-options="slaPolicyOptions"
      />
    </section>

    <!-- Business hour overrides -->
    <section class="space-y-3 border-t border-gray-100 pt-6 dark:border-gray-800">
      <div>
        <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.slaSectionOverrides') }}</h4>
        <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.slaSectionOverridesHint') }}</p>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full">
          <thead>
            <tr class="text-left text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
              <th class="pb-2 pr-4">{{ t('settings.helpdeskExecSlaPriorityColumn') }}</th>
              <th class="pb-2">{{ t('settings.slaSectionOverridesHours') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            <tr v-for="priority in priorities" :key="priority">
              <td class="py-2.5 pr-4">
                <span class="inline-flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                  <span class="h-2 w-2 rounded-full" :class="priorityDotClass(priority)" />
                  {{ priorityLabel(priority) }}
                </span>
              </td>
              <td class="py-2.5">
                <select
                  v-model="draft.priorityHourOverrides[priority]"
                  class="rounded-lg border border-gray-200 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                >
                  <option v-for="mode in overrideModeOptions" :key="mode.value" :value="mode.value">
                    {{ mode.label }}
                  </option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import HelpdeskSlaTargetGrid from '@/components/settings/helpdesk/HelpdeskSlaTargetGrid.vue';
import HelpdeskSlaScheduleSection from '@/components/settings/HelpdeskSlaScheduleSection.vue';
import HelpdeskSlaAlertCards from '@/components/settings/helpdesk/HelpdeskSlaAlertCards.vue';
import HelpdeskSlaEscalationTimeline from '@/components/settings/helpdesk/HelpdeskSlaEscalationTimeline.vue';
import { SLA_STANDARD_POLICY_ID } from '@/components/settings/helpdesk/slaPolicyConstants.js';
import { priorityDotClass as resolvePriorityDotClass, targetRowFromStandard } from '@/constants/helpdeskSlaPolicy';
import { buildOverrideModeOptions } from '@/components/settings/helpdesk/slaPolicyOptionLabels.js';
import {
  ensurePriorityTargets,
  normalizeEscalationSteps,
  normalizeSlaAlerts
} from '@/components/settings/helpdesk/slaPolicyNormalize.js';

const props = defineProps({
  inDrawer: { type: Boolean, default: false },
  policyId: { type: String, default: '' },
  isNew: { type: Boolean, default: false },
  isStandard: { type: Boolean, default: false },
  initialPolicy: { type: Object, default: null },
  priorities: { type: Array, required: true },
  caseTypes: { type: Array, required: true },
  channels: { type: Array, required: true },
  slaPolicyOptions: { type: Object, required: true },
  caseTypeLabel: { type: Function, required: true },
  priorityLabel: { type: Function, required: true },
  standardTargets: { type: Object, default: () => ({}) },
  businessHours: { type: Object, required: true },
  enabledCaseTypes: { type: Array, default: () => [] },
  recalculatingSlas: { type: Boolean, default: false },
  recalculateMessage: { type: String, default: '' }
});

const emit = defineEmits(['back', 'save', 'remove', 'recalculate', 'update:businessHours', 'update:enabledCaseTypes']);

const { t } = useI18n();

const timeMode = ref('business');
const draft = reactive(createEmptyDraft());

const businessHoursModel = computed({
  get: () => props.businessHours,
  set: (value) => emit('update:businessHours', value)
});

const overrideModeOptions = computed(() => buildOverrideModeOptions(
  props.slaPolicyOptions.hourOverrideModes,
  t
));

function priorityDotClass(priority) {
  return resolvePriorityDotClass(props.priorities, priority);
}

function defaultOverrideMode() {
  return props.slaPolicyOptions.hourOverrideModes?.[0] || 'default';
}

function createEmptyDraft() {
  const priorityHourOverrides = {};
  const defaultMode = defaultOverrideMode();
  for (const p of props.priorities) priorityHourOverrides[p] = defaultMode;
  return {
    key: '',
    name: '',
    description: '',
    enabled: true,
    isDefault: false,
    caseTypes: [],
    channels: [],
    priorities: [],
    targets: {},
    alerts: [],
    escalationSteps: [],
    escalationCooldownMinutes: props.slaPolicyOptions.defaultEscalationCooldownMinutes,
    priorityHourOverrides
  };
}

function minutesToHours(minutes) {
  return Math.max(1, Math.round(Number(minutes || 0) / 60));
}

function buildTargetsFromPolicy(policy) {
  const targets = {};
  for (const priority of props.priorities) {
    const source = policy?.priorityTargets?.[priority];
    const merged = source
      ? {
        responseHours: minutesToHours(source.firstResponseMinutes),
        resolutionHours: minutesToHours(source.resolutionMinutes),
        overrideHours: source.overrideHours
      }
      : targetRowFromStandard(priority, props.standardTargets, props.priorities);
    targets[priority] = merged;
  }
  return ensurePriorityTargets(targets, props.priorities, props.standardTargets);
}

function buildTargetsFromStandard() {
  const targets = {};
  for (const priority of props.priorities) {
    targets[priority] = targetRowFromStandard(priority, props.standardTargets, props.priorities);
  }
  return ensurePriorityTargets(targets, props.priorities, props.standardTargets);
}

function loadDraft() {
  const base = createEmptyDraft();
  const policy = props.initialPolicy;

  if (props.isStandard) {
    draft.key = SLA_STANDARD_POLICY_ID;
    draft.name = policy?.name || t('settings.slaPolicyStandardName');
    draft.description = policy?.description || '';
    draft.isDefault = true;
    draft.caseTypes = [...(props.enabledCaseTypes || [])];
    draft.targets = buildTargetsFromStandard();
    draft.alerts = normalizeSlaAlerts(policy?.alerts, props.priorities, props.slaPolicyOptions);
    draft.escalationSteps = normalizeEscalationSteps(policy?.escalationSteps, props.slaPolicyOptions);
    draft.escalationCooldownMinutes = policy?.escalationCooldownMinutes
      ?? props.slaPolicyOptions.defaultEscalationCooldownMinutes;
    draft.priorityHourOverrides = policy?.priorityHourOverrides || base.priorityHourOverrides;
    timeMode.value = props.businessHours?.enabled ? 'business' : 'calendar';
    return;
  }

  if (!policy && props.isNew) {
    Object.assign(draft, base);
    draft.targets = buildTargetsFromStandard();
    draft.alerts = normalizeSlaAlerts([], props.priorities, props.slaPolicyOptions);
    draft.escalationSteps = normalizeEscalationSteps([], props.slaPolicyOptions);
    return;
  }

  draft.key = policy?.key || '';
  draft.name = policy?.name || '';
  draft.description = policy?.description || '';
  draft.enabled = policy?.enabled !== false;
  draft.isDefault = false;
  draft.caseTypes = [...(policy?.caseTypes || [])];
  draft.channels = [...(policy?.channels || [])];
  draft.priorities = [...(policy?.priorities || [])];
  draft.targets = buildTargetsFromPolicy(policy);
  draft.alerts = normalizeSlaAlerts(policy?.alerts, props.priorities, props.slaPolicyOptions);
  draft.escalationSteps = normalizeEscalationSteps(policy?.escalationSteps, props.slaPolicyOptions);
  draft.escalationCooldownMinutes = policy?.escalationCooldownMinutes
    ?? props.slaPolicyOptions.defaultEscalationCooldownMinutes;
  draft.priorityHourOverrides = policy?.priorityHourOverrides || base.priorityHourOverrides;
  timeMode.value = policy?.useCalendarTime ? 'calendar' : 'business';
}

watch(
  () => [props.policyId, props.initialPolicy, props.isNew],
  () => loadDraft(),
  { immediate: true }
);

watch(timeMode, (mode) => {
  if (mode === 'business') {
    const next = { ...props.businessHours, enabled: true };
    if (!props.businessHours?.enabled && (!next.scheduleSource || next.scheduleSource === 'legacy')) {
      next.scheduleSource = 'inherit';
    }
    emit('update:businessHours', next);
  } else if (props.isStandard) {
    emit('update:businessHours', { ...props.businessHours, enabled: false });
  }
});

function pillClass(list, value) {
  const active = Array.isArray(list) && list.includes(value);
  return active
    ? 'bg-indigo-600 text-white shadow-sm'
    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300';
}

function toggleValue(list, value) {
  const idx = list.indexOf(value);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(value);
}

function copyFromStandard() {
  draft.targets = buildTargetsFromStandard();
}

function hoursToMinutes(hours) {
  return Math.max(1, Math.round(Number(hours || 0) * 60));
}

function slugifyKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function buildSavePayload() {
  const priorityTargets = {};
  for (const priority of props.priorities) {
    const row = draft.targets[priority] || targetRowFromStandard(priority, props.standardTargets, props.priorities);
    priorityTargets[priority] = {
      firstResponseMinutes: hoursToMinutes(row.responseHours),
      resolutionMinutes: hoursToMinutes(row.resolutionHours),
      overrideHours: row.overrideHours || defaultOverrideMode()
    };
  }

  return {
    key: draft.key || slugifyKey(draft.name) || `policy-${Date.now()}`,
    name: draft.name.trim(),
    description: draft.description.trim(),
    enabled: draft.enabled !== false,
    isDefault: draft.isDefault,
    caseTypes: [...draft.caseTypes],
    channels: [...draft.channels],
    priorities: [...draft.priorities],
    priorityTargets,
    alerts: JSON.parse(JSON.stringify(draft.alerts)),
    escalationSteps: JSON.parse(JSON.stringify(draft.escalationSteps)),
    escalationCooldownMinutes: draft.escalationCooldownMinutes,
    priorityHourOverrides: { ...draft.priorityHourOverrides },
    useCalendarTime: timeMode.value === 'calendar'
  };
}

function validate() {
  if (!String(draft.name || '').trim()) return t('settings.helpdeskExecSlaPolicyNameRequired');
  return null;
}

defineExpose({
  validate,
  getPayload: buildSavePayload,
  getDraft: () => draft
});
</script>
