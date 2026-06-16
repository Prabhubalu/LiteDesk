<template>
  <div class="space-y-4" :class="{ 'pointer-events-none opacity-90': readOnly }">
    <!-- Drawer (mockup middle column) -->
    <template v-if="inDrawer">
      <!-- 1. General -->
      <section class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/30">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h4 class="text-sm font-semibold text-gray-900 dark:text-white">1. {{ t('settings.slaSectionGeneral') }}</h4>
            <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.slaMockupGeneralHint') }}</p>
          </div>
        </div>

        <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.helpdeskExecSlaPolicyName') }}</label>
            <input v-model.trim="draft.name" type="text" class="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('settings.slaPolicyStatus') }}</label>
            <select v-model="statusModel" class="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white">
              <option value="active">{{ t('settings.slaStatusActive') }}</option>
              <option value="draft">{{ t('settings.slaStatusDraft') }}</option>
            </select>
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('settings.slaScopeModule') }}</label>
            <select
              v-model="draft.scope.moduleKey"
              :disabled="lockModule"
              class="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:disabled:bg-gray-950/30"
              @change="onModuleChange"
            >
              <option v-if="!lockModule" value="">{{ t('settings.slaScopeModuleSelect') }}</option>
              <option v-for="mod in modules" :key="mod.moduleKey" :value="mod.moduleKey">
                {{ moduleOptionLabel(mod) }}
              </option>
            </select>
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('settings.slaTriggerType') }}</label>
            <select v-model="draft.trigger.type" class="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white">
              <option v-for="type in metadata.triggerTypes" :key="type" :value="type">{{ triggerTypeLabel(type) }}</option>
            </select>
          </div>

          <div>
            <p class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('settings.slaSectionCalendar') }}</p>
            <div class="flex flex-wrap gap-4">
              <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input v-model="draft.calendar.mode" type="radio" value="business" class="border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                {{ t('settings.slaPolicyBusinessHours') }}
              </label>
              <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input v-model="draft.calendar.mode" type="radio" value="calendar24x7" class="border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                {{ t('settings.slaPolicyCalendarHours') }}
              </label>
            </div>
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {{ draft.calendar.mode === 'calendar24x7' ? t('settings.slaPolicyCalendarHoursInfo') : t('settings.slaPolicyBusinessHoursInfo') }}
            </p>
          </div>

          <template v-if="draft.trigger.type === 'field_change'">
            <div>
              <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('settings.slaTriggerField') }}</label>
              <select v-model="draft.trigger.field" class="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white">
                <option value="">{{ t('settings.slaConditionFieldPh') }}</option>
                <option v-for="f in scopeFields" :key="f.key" :value="f.key">{{ f.label }}</option>
              </select>
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('settings.slaTriggerToValue') }}</label>
              <input v-model="draft.trigger.toValue" type="text" class="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
            </div>
          </template>

          <div v-else-if="draft.trigger.type === 'custom_event'" class="md:col-span-2">
            <label class="mb-1 block text-xs font-medium text-gray-500">{{ t('settings.slaTriggerEventName') }}</label>
            <input v-model.trim="draft.trigger.eventName" type="text" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
          </div>

          <div class="md:col-span-2">
            <label class="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.slaPolicyDescription') }}</label>
            <textarea v-model.trim="draft.description" rows="2" class="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
          </div>
        </div>
      </section>

      <!-- 2. Entry criteria -->
      <section class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/30">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h4 class="text-sm font-semibold text-gray-900 dark:text-white">2. {{ t('settings.slaSectionEntryCriteria') }}</h4>
            <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.slaSectionEntryCriteriaHint') }}</p>
          </div>
        </div>
        <div class="mt-4">
          <SlaConditionBuilder v-model="draft.entryCriteria" :fields="conditionFields" :operators="metadata.conditionOperators" />
        </div>
      </section>

      <!-- 3. Targets -->
      <section class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/30">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 class="text-sm font-semibold text-gray-900 dark:text-white">3. {{ t('settings.slaSectionTargets') }}</h4>
            <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ targetsHint }}</p>
          </div>
        </div>

        <div class="mt-4">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('settings.slaTargetDimensionField') }}</label>
              <select
                v-model="targetDimensionFieldModel"
                class="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                <option v-for="f in picklistFields" :key="f.key" :value="f.key">{{ f.label || f.key }}</option>
              </select>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.slaTargetDimensionFieldHint') }}</p>
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('settings.slaMilestones') }}</label>
              <div class="flex items-center gap-2">
                <input
                  v-model.trim="milestoneDraft"
                  type="text"
                  :placeholder="t('settings.slaMilestoneAddPlaceholder')"
                  class="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  @keydown.enter.prevent="addMilestone()"
                />
                <button type="button" class="rounded-lg bg-indigo-600 px-3 py-2.5 text-xs font-medium text-white hover:bg-indigo-700" @click="addMilestone()">
                  {{ t('actions.add') }}
                </button>
              </div>
              <div class="mt-2 flex flex-wrap gap-2">
                <span v-for="m in milestonesModel" :key="m" class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">
                  {{ m }}
                  <button type="button" class="text-red-600" @click="removeMilestone(m)">×</button>
                </span>
              </div>
            </div>
          </div>

          <div class="mt-4 overflow-x-auto">
            <table class="min-w-max">
              <thead>
                <tr class="text-left text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  <th class="sticky left-0 z-10 min-w-[220px] bg-white pb-2 pr-4 dark:bg-gray-900/30">{{ targetDimensionLabel }}</th>
                  <th v-for="m in milestonesModel" :key="m" class="min-w-[220px] pb-2 pr-4">{{ m }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                <tr v-for="row in dimensionValueOptions" :key="row.value">
                  <td class="sticky left-0 z-10 min-w-[220px] bg-white py-2.5 pr-4 dark:bg-gray-900/30">
                    <span class="text-sm font-medium text-gray-900 dark:text-white">{{ row.label }}</span>
                  </td>
                  <td v-for="m in milestonesModel" :key="m" class="py-2.5 pr-4">
                    <div class="flex items-center gap-2">
                      <div class="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-2 dark:border-gray-600 dark:bg-gray-900">
                        <div class="flex items-center gap-1">
                          <input
                            :value="gridTimeValue(row.value, m).hh"
                            type="number"
                            min="0"
                            class="w-16 bg-transparent text-sm text-gray-900 outline-none dark:text-white"
                            @input="setGridTimeValue(row.value, m, $event.target.value, gridTimeValue(row.value, m).mm)"
                          />
                          <span class="text-xs text-gray-400">HH</span>
                        </div>
                        <div class="h-4 w-px bg-gray-200 dark:bg-gray-700" />
                        <div class="flex items-center gap-1">
                          <input
                            :value="gridTimeValue(row.value, m).mm"
                            type="number"
                            min="0"
                            max="59"
                            class="w-16 bg-transparent text-sm text-gray-900 outline-none dark:text-white"
                            @input="setGridTimeValue(row.value, m, gridTimeValue(row.value, m).hh, $event.target.value)"
                          />
                          <span class="text-xs text-gray-400">MM</span>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- 4. Pause / Resume -->
      <section class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/30">
        <div>
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white">4. {{ t('settings.slaSectionPauseResume') }}</h4>
        </div>
        <div class="mt-4 space-y-6">
          <div>
            <p class="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('settings.slaPauseConditions') }}</p>
            <SlaConditionBuilder v-model="pauseConditionsModel" :fields="conditionFields" :operators="metadata.conditionOperators" />
          </div>

          <div>
            <p class="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('settings.slaResumeConditions') }}</p>
            <SlaConditionBuilder v-model="resumeConditionsModel" :fields="conditionFields" :operators="metadata.conditionOperators" />
          </div>
        </div>
      </section>

      <!-- 5. Success & breach -->
      <section class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/30">
        <div>
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white">5. {{ t('settings.slaSectionSuccess') }}</h4>
        </div>
        <div class="mt-4">
          <SlaConditionBuilder v-model="draft.successCriteria" :fields="conditionFields" :operators="metadata.conditionOperators" />
        </div>
      </section>

      <!-- 6. Notifications -->
      <section v-if="isCasesModule" class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/30">
        <div>
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white">6. {{ t('settings.slaSectionAlerts') }}</h4>
        </div>
        <div class="mt-4">
          <HelpdeskSlaAlertCards
            v-model:alerts="alertsModel"
            :priorities="casePriorities"
            :priority-label="priorityLabel"
            :sla-policy-options="alertCardsOptions"
          />
        </div>
      </section>

      <!-- 7. Escalations -->
      <section v-if="isCasesModule" class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/30">
        <div>
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white">7. {{ t('settings.slaSectionEscalation') }}</h4>
          <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.slaSectionEscalationHint') }}</p>
        </div>
        <div class="mt-4 space-y-3">
          <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input v-model="draft.escalations.enabled" type="checkbox" class="rounded border-gray-300 text-indigo-600" />
            {{ t('settings.slaSectionEscalation') }}
          </label>

          <div v-if="draft.escalations.enabled" class="space-y-3">
            <div class="flex flex-wrap items-center gap-3">
              <div>
                <label class="mb-1 block text-xs font-medium text-gray-500">{{ t('settings.slaEscalationCooldown') }}</label>
                <div class="flex items-center gap-2">
                  <input v-model.number="draft.escalations.cooldownMinutes" type="number" min="0" class="w-24 rounded-lg border border-gray-200 px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                  <span class="text-xs text-gray-400">{{ t('settings.slaAlertMinutesShort') }}</span>
                </div>
              </div>
              <button type="button" class="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:border-indigo-400 hover:text-indigo-600 dark:border-gray-600 dark:text-gray-300" @click="addEscalationStep">
                {{ t('settings.slaEscalationAddStep') }}
              </button>
            </div>

            <div v-if="draft.escalations.steps.length" class="space-y-2">
              <div v-for="(step, index) in draft.escalations.steps" :key="index" class="grid grid-cols-12 items-end gap-2 rounded-lg border border-gray-100 p-3 dark:border-gray-800">
                <div class="col-span-6">
                  <label class="mb-1 block text-xs font-medium text-gray-500">{{ t('settings.slaEscalationRole') }}</label>
                  <select v-model="step.role" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white">
                    <option v-for="opt in escalationRoleOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  </select>
                </div>
                <div class="col-span-4">
                  <label class="mb-1 block text-xs font-medium text-gray-500">{{ t('settings.slaEscalationDelay') }}</label>
                  <div class="flex items-center gap-2">
                    <input v-model.number="step.delayMinutes" type="number" min="0" class="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                    <span class="text-xs text-gray-400">{{ t('settings.slaAlertMinutesShort') }}</span>
                  </div>
                </div>
                <div class="col-span-2 flex justify-end">
                  <button type="button" class="text-xs font-medium text-red-600 hover:underline" @click="removeEscalationStep(index)">{{ t('actions.remove') }}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 8. Coverage preview -->
      <section class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/30">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h4 class="text-sm font-semibold text-gray-900 dark:text-white">8. {{ t('settings.slaSectionCoverage') }}</h4>
            <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.slaCoverageSimulateHint') }}</p>
          </div>
          <button type="button" class="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium dark:border-gray-700" :disabled="simulating" @click="runSimulation">
            {{ simulating ? t('states.loading') : t('settings.slaRunSimulation') }}
          </button>
        </div>
        <div v-if="simulationResult" class="mt-3 rounded-lg bg-gray-50 p-3 text-xs dark:bg-gray-800">
          <p class="font-medium text-gray-900 dark:text-white">{{ t('settings.slaSimulationMatches', { count: simulationResult.matches?.length || 0 }) }}</p>
        </div>
      </section>

      <!-- 9. Advanced -->
      <section class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/30">
        <div>
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white">9. {{ t('settings.slaSectionAdvanced') }}</h4>
        </div>
        <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('settings.slaTargetDimensionField') }}</label>
            <select v-model="draft.advanced.targetDimensionFieldKey" class="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white">
              <option value="">{{ t('settings.slaTargetDimensionFieldDefault') }}</option>
              <option v-for="f in picklistFields" :key="f.key" :value="f.key">{{ f.label || f.key }}</option>
            </select>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.slaTargetDimensionFieldHint') }}</p>
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('settings.slaExecutionMode') }}</label>
            <select v-model="draft.executionMode" class="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white">
              <option v-for="mode in metadata.executionModes" :key="mode" :value="mode">{{ executionModeLabel(mode) }}</option>
            </select>
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('settings.slaPrecedence') }}</label>
            <input v-model.number="draft.precedence" type="number" min="0" class="w-32 rounded-lg border border-gray-200 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
          </div>
        </div>
      </section>
    </template>

    <!-- Non-drawer: keep existing behavior (simple/advanced toggle) -->
    <template v-else>
      <div class="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900/30 dark:text-gray-200">
        {{ t('settings.slaMockupDrawerOnly') }}
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import HelpdeskSlaTargetGrid from '@/components/settings/helpdesk/HelpdeskSlaTargetGrid.vue';
import HelpdeskSlaAlertCards from '@/components/settings/helpdesk/HelpdeskSlaAlertCards.vue';
import SlaConditionBuilder from '@/components/settings/sla/SlaConditionBuilder.vue';
import { emptyConditionGroup, resolveSlaPolicyMetadata } from '@/constants/slaPolicy';
import {
  CASE_PRIORITIES,
  buildPriorityTargetGrid,
  priorityGridToTargets,
  genericCompletionHours,
  completionHoursToTargets
} from '@/components/settings/sla/slaTargetUtils';
import { normalizeSlaAlerts } from '@/components/settings/helpdesk/slaPolicyNormalize.js';
import { getModuleLabelKey } from '@/utils/navigationLabels';

const props = defineProps({
  policyKey: { type: String, default: '' },
  initialPolicy: { type: Object, default: null },
  isNew: { type: Boolean, default: false },
  readOnly: { type: Boolean, default: false },
  inDrawer: { type: Boolean, default: false },
  fixedModuleKey: { type: String, default: '' },
  modules: { type: Array, default: () => [] },
  metadata: { type: Object, default: () => resolveSlaPolicyMetadata(null) },
  moduleFields: { type: Array, default: () => [] }
});

const emit = defineEmits(['module-change']);

const { t } = useI18n();

// Pause/Resume are stored as arrays in the policy model,
// but the mockup UX uses a single condition group each.
const simplePriorityTargets = ref({});
const simpleCompletionHours = ref(8);
const milestoneDraft = ref('');
const simulating = ref(false);
const simulationResult = ref(null);

const draft = reactive(createEmptyDraft());

const lockModule = computed(() => Boolean(props.fixedModuleKey));
const isCasesModule = computed(() => draft.scope.moduleKey === 'cases');
const casePriorities = CASE_PRIORITIES;

const picklistFields = computed(() => {
  return (props.moduleFields || [])
    .filter((f) => ['picklist', 'multi-picklist'].includes(String(f?.dataType || '').toLowerCase()))
    .map((f) => ({ key: f.key, label: f.label || f.key, options: f.options || [] }));
});

const targetDimensionFieldModel = computed({
  get: () => {
    const configured = String(draft.advanced?.targetDimensionFieldKey || '').trim();
    if (configured) return configured;
    // default to first picklist (prefer priority-like keys)
    const prefer = picklistFields.value.find((f) => f.key === 'priority') || picklistFields.value[0];
    return prefer?.key || 'priority';
  },
  set: (value) => {
    if (!draft.advanced) draft.advanced = {};
    draft.advanced.targetDimensionFieldKey = String(value || '').trim();
  }
});

const targetDimensionLabel = computed(() => {
  const field = (picklistFields.value || []).find((f) => f.key === targetDimensionFieldModel.value);
  return field?.label || targetDimensionFieldModel.value;
});

const dimensionValueOptions = computed(() => {
  const field = (picklistFields.value || []).find((f) => f.key === targetDimensionFieldModel.value);
  const opts = Array.isArray(field?.options) ? field.options : [];
  const normalized = opts.map((o) => (typeof o === 'string' ? { value: o, label: o } : { value: o.value, label: o.label || o.value })).filter((o) => o.value != null);
  if (normalized.length) return normalized;

  // fallback: existing values already used in targets
  const used = Array.from(new Set((draft.targets || []).map((t) => String(t.priorityKey || '').trim()).filter(Boolean)));
  return used.map((v) => ({ value: v, label: v }));
});

const milestonesModel = computed({
  get: () => {
    const existing = Array.isArray(draft.advanced?.milestones) ? draft.advanced.milestones : null;
    const fromTargets = Array.from(new Set((draft.targets || []).map((t) => String(t.milestoneKey || '').trim()).filter(Boolean)));
    const base = existing && existing.length ? existing : (fromTargets.length ? fromTargets : []);
    // keep stable, non-empty
    return base.map((m) => String(m).trim()).filter(Boolean);
  },
  set: (value) => {
    if (!draft.advanced) draft.advanced = {};
    draft.advanced.milestones = Array.isArray(value) ? value.map((m) => String(m).trim()).filter(Boolean) : [];
  }
});

function addMilestone() {
  const key = String(milestoneDraft.value || '').trim();
  if (!key) return;
  const next = Array.from(new Set([...milestonesModel.value, key]));
  milestonesModel.value = next;
  milestoneDraft.value = '';
}

function removeMilestone(key) {
  const k = String(key || '').trim();
  if (!k) return;
  milestonesModel.value = milestonesModel.value.filter((m) => m !== k);
  // also prune targets for that milestone
  draft.targets = (draft.targets || []).filter((t) => String(t.milestoneKey || '').trim() !== k);
}

function gridTimeValue(dimensionValue, milestoneKey) {
  const dim = String(dimensionValue || '').trim();
  const m = String(milestoneKey || '').trim();
  const found = (draft.targets || []).find((t) => String(t.priorityKey || '').trim() === dim && String(t.milestoneKey || '').trim() === m);
  const minutes = Number(found?.durationMinutes || 0);
  if (!Number.isFinite(minutes) || minutes <= 0) return { hh: '', mm: '' };
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return { hh: String(hh), mm: String(mm) };
}

function normalizeInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.floor(n);
}

function setGridTimeValue(dimensionValue, milestoneKey, rawHh, rawMm) {
  const dim = String(dimensionValue || '').trim();
  const m = String(milestoneKey || '').trim();
  const hh = Math.max(0, normalizeInt(rawHh));
  const mm = Math.min(59, Math.max(0, normalizeInt(rawMm)));
  const minutes = hh * 60 + mm;

  const targets = Array.isArray(draft.targets) ? [...draft.targets] : [];
  const idx = targets.findIndex((t) => String(t.priorityKey || '').trim() === dim && String(t.milestoneKey || '').trim() === m);

  if (!minutes) {
    if (idx >= 0) targets.splice(idx, 1);
    draft.targets = targets;
    return;
  }

  const row = { milestoneKey: m, priorityKey: dim, durationMinutes: minutes };
  if (idx >= 0) targets[idx] = { ...targets[idx], ...row };
  else targets.push(row);
  draft.targets = targets;
}

const scopeFields = computed(() => {
  if (props.moduleFields.length > 0) {
    // IMPORTANT: keep dataType/options so condition builder can render proper value controls
    return props.moduleFields.map((field) => ({
      key: field.key,
      label: field.label || field.key,
      dataType: field.dataType || 'text',
      options: Array.isArray(field.options) ? field.options : []
    }));
  }
  if (isCasesModule.value) {
    return [
      { key: 'priority', label: t('settings.helpdeskExecSlaPriorityColumn'), dataType: 'picklist', options: [] },
      { key: 'caseType', label: t('settings.helpdeskExecEnabledCaseTypes'), dataType: 'picklist', options: [] },
      { key: 'channel', label: t('settings.helpdeskExecSlaPolicyChannels'), dataType: 'picklist', options: [] },
      { key: 'status', label: t('settings.slaFieldStatus'), dataType: 'picklist', options: [] }
    ];
  }
  return [
    { key: 'status', label: t('settings.slaFieldStatus'), dataType: 'picklist', options: [] },
    { key: 'priority', label: t('settings.helpdeskExecSlaPriorityColumn'), dataType: 'picklist', options: [] }
  ];
});

const conditionFields = computed(() => {
  // Keep the field list user-friendly: default to picklists (and multi-picklists/boolean)
  // which are the most common for SLA scoping.
  return (scopeFields.value || []).filter((f) => {
    const dt = String(f?.dataType || '').toLowerCase();
    return dt === 'picklist' || dt === 'multi-picklist' || dt === 'boolean';
  });
});

const caseTypeOptions = computed(() => {
  const field = props.moduleFields.find((row) => row.key === 'caseType');
  if (field?.options?.length) {
    return field.options.map((opt) => (typeof opt === 'string' ? opt : opt.value)).filter(Boolean);
  }
  return [];
});

const selectedCaseTypes = computed(() => {
  const clause = draft.entryCriteria?.clauses?.find((row) => row.field === 'caseType' && row.operator === 'in');
  return Array.isArray(clause?.value) ? clause.value : [];
});

const simpleHint = computed(() => (
  isCasesModule.value
    ? t('settings.slaSimpleDrawerHint')
    : t('settings.slaGenericSimpleDrawerHint')
));

const targetsHint = computed(() => (
  isCasesModule.value
    ? t('settings.slaSimpleTargetsHint')
    : t('settings.slaModuleCompletionTargetHint')
));

const coverageSummary = computed(() => {
  if (!selectedCaseTypes.value.length) return t('settings.slaSimpleAppliesToAll');
  return t('settings.slaSimpleAppliesToSelected', {
    count: selectedCaseTypes.value.length,
    types: selectedCaseTypes.value.join(', ')
  });
});

function createEmptyDraft() {
  const moduleKey = props.fixedModuleKey || '';
  const moduleRow = moduleKey ? props.modules.find((row) => row.moduleKey === moduleKey) : null;
  return {
    policyKey: props.policyKey || '',
    name: '',
    description: '',
    active: true,
    isDefault: false,
    precedence: 0,
    executionMode: 'first_match',
    scope: {
      moduleKey,
      appKey: moduleRow?.appKey || (moduleKey === 'cases' ? 'HELPDESK' : null),
      recordType: ''
    },
    entryCriteria: emptyConditionGroup(),
    trigger: { type: 'record_created', field: '', toValue: '', eventName: '' },
    targets: [],
    pauseConditions: [],
    resumeConditions: [],
    successCriteria: emptyConditionGroup(),
    notifications: [],
    escalations: { enabled: false, cooldownMinutes: 15, steps: [] },
    calendar: { mode: 'business' }
    ,
    advanced: { targetDimensionFieldKey: '' }
  };
}

function priorityLabel(priority) {
  return priority;
}

function moduleOptionLabel(mod) {
  const moduleKey = mod?.moduleKey || '';
  const canonicalKey = getModuleLabelKey(moduleKey);
  if (canonicalKey) return t(canonicalKey);
  if (mod?.labelKey) return t(mod.labelKey);
  const label = mod?.label || '';
  if (label && !label.includes('.')) return label;
  return moduleKey;
}

function syncModuleAppKey() {
  const row = props.modules.find((mod) => mod.moduleKey === draft.scope.moduleKey);
  if (row?.appKey) draft.scope.appKey = row.appKey;
}

function onModuleChange() {
  if (!draft.scope.moduleKey) {
    draft.scope.appKey = null;
    return;
  }
  syncModuleAppKey();
  emit('module-change', draft.scope.moduleKey);
}

function executionModeLabel(mode) {
  const key = `settings.slaExecMode_${mode}`;
  const label = t(key);
  return label === key ? mode : label;
}

function triggerTypeLabel(type) {
  const key = `settings.slaTrigger_${type}`;
  const label = t(key);
  return label === key ? type : label;
}

function pillClass(list, value) {
  const active = Array.isArray(list) && list.includes(value);
  return active
    ? 'bg-indigo-600 text-white shadow-sm'
    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300';
}

function toggleCaseType(type) {
  const next = [...selectedCaseTypes.value];
  const idx = next.indexOf(type);
  if (idx >= 0) next.splice(idx, 1);
  else next.push(type);

  const clauses = (draft.entryCriteria?.clauses || []).filter((row) => row.field !== 'caseType');
  if (next.length) {
    clauses.push({ field: 'caseType', operator: 'in', value: next });
  }
  draft.entryCriteria = { combinator: 'all', clauses, groups: [] };
}

function addTarget() {
  draft.targets.push({
    milestoneKey: props.metadata.milestoneKeys?.[0] || 'resolution',
    priorityKey: '',
    durationMinutes: 60
  });
}

function removeTarget(idx) {
  draft.targets.splice(idx, 1);
}

function conditionGroupIsEmpty(group) {
  if (!group || typeof group !== 'object') return true;
  const clauses = Array.isArray(group.clauses) ? group.clauses : [];
  const groups = Array.isArray(group.groups) ? group.groups : [];
  return clauses.length === 0 && groups.length === 0;
}

const pauseConditionsModel = computed({
  get: () => {
    const first = Array.isArray(draft.pauseConditions) ? draft.pauseConditions[0] : null;
    return first || emptyConditionGroup();
  },
  set: (value) => {
    if (conditionGroupIsEmpty(value)) {
      draft.pauseConditions = [];
      return;
    }
    draft.pauseConditions = [value];
  }
});

const resumeConditionsModel = computed({
  get: () => {
    const first = Array.isArray(draft.resumeConditions) ? draft.resumeConditions[0] : null;
    return first || emptyConditionGroup();
  },
  set: (value) => {
    if (conditionGroupIsEmpty(value)) {
      draft.resumeConditions = [];
      return;
    }
    draft.resumeConditions = [value];
  }
});

function loadSimpleTargetsFromPolicy(policy) {
  if (!policy) return;
  if (policy.scope?.moduleKey === 'cases') {
    simplePriorityTargets.value = buildPriorityTargetGrid(policy.targets || [], casePriorities);
    return;
  }
  simpleCompletionHours.value = genericCompletionHours(policy.targets || []);
}

function loadFromPolicy(policy) {
  if (!policy) return;
  Object.assign(draft, createEmptyDraft(), {
    ...policy,
    scope: { ...createEmptyDraft().scope, ...policy.scope },
    entryCriteria: policy.entryCriteria || emptyConditionGroup(),
    trigger: { ...createEmptyDraft().trigger, ...policy.trigger },
    successCriteria: policy.successCriteria || emptyConditionGroup(),
    calendar: { ...createEmptyDraft().calendar, ...policy.calendar },
    pauseConditions: Array.isArray(policy.pauseConditions) ? [...policy.pauseConditions] : [],
    resumeConditions: Array.isArray(policy.resumeConditions) ? [...policy.resumeConditions] : [],
    notifications: Array.isArray(policy.notifications) ? [...policy.notifications] : [],
    escalations: policy.escalations && typeof policy.escalations === 'object'
      ? { ...createEmptyDraft().escalations, ...policy.escalations, steps: Array.isArray(policy.escalations?.steps) ? [...policy.escalations.steps] : [] }
      : { ...createEmptyDraft().escalations },
    advanced: policy.advanced && typeof policy.advanced === 'object'
      ? { ...createEmptyDraft().advanced, ...policy.advanced }
      : { ...createEmptyDraft().advanced },
    targets: Array.isArray(policy.targets) ? policy.targets.map((row) => ({ ...row })) : []
  });
  syncModuleAppKey();
  loadSimpleTargetsFromPolicy(policy);
}

function validate() {
  if (!String(draft.name || '').trim()) return t('settings.helpdeskExecSlaPolicyNameRequired');
  if (!lockModule.value && !String(draft.scope.moduleKey || '').trim()) {
    return t('settings.slaScopeModuleRequired');
  }
  if (!draft.targets.length) return t('settings.slaTargetsRequired');
  return null;
}

function buildPayload() {
  return {
    policyKey: props.policyKey || draft.policyKey,
    name: draft.name,
    description: draft.description,
    active: draft.active !== false,
    isDefault: draft.isDefault,
    precedence: Number(draft.precedence) || 0,
    executionMode: draft.executionMode,
    scope: {
      moduleKey: draft.scope.moduleKey,
      appKey: draft.scope.appKey || null,
      recordType: draft.scope.recordType || null
    },
    entryCriteria: draft.entryCriteria,
    trigger: draft.trigger,
    targets: draft.targets,
    pauseConditions: draft.pauseConditions,
    resumeConditions: draft.resumeConditions,
    successCriteria: draft.successCriteria,
    notifications: draft.notifications,
    escalations: draft.escalations,
    calendar: draft.calendar,
    advanced: draft.advanced
  };
}

const statusModel = computed({
  get: () => (draft.active === false ? 'draft' : 'active'),
  set: (value) => { draft.active = value !== 'draft'; }
});

const escalationRoleOptions = computed(() => ([
  { value: 'assigned_user', label: t('settings.slaAlertRecipientAssigned') },
  { value: 'manager', label: t('settings.slaAlertRecipientManager') },
  { value: 'record_owner', label: t('settings.slaAlertRecipientOwner') }
]));

const alertCardsOptions = computed(() => {
  return {
    alertRecipients: props.metadata.alertRecipients || ['assigned_user', 'manager', 'record_owner', 'assigned_group'],
    alertChannels: props.metadata.alertChannels || ['inApp', 'email', 'push'],
    alertTimingModes: ['before', 'after', 'immediately'],
    alertTypes: ['warning', 'breach'],
    defaultAlertTimingMinutes: 30,
    defaultAlerts: [
      { type: 'warning', timingMode: 'before', timingMinutes: 30 },
      { type: 'breach', timingMode: 'immediately', timingMinutes: 0 }
    ]
  };
});

function channelsListToMap(list = []) {
  const map = {};
  for (const key of (props.metadata.alertChannels || ['inApp', 'email', 'push'])) {
    map[key] = Array.isArray(list) ? list.includes(key) : false;
  }
  return map;
}

function channelsMapToList(map = {}) {
  const list = [];
  for (const [key, value] of Object.entries(map || {})) {
    if (value) list.push(key);
  }
  return list;
}

function notificationsToAlertCards(notifications = []) {
  const alerts = [];
  for (const row of (notifications || [])) {
    const type = row?.timing === 'at' ? 'breach' : 'warning';
    const timingMode = row?.timing === 'at' ? 'immediately' : (row?.timing === 'after' ? 'after' : 'before');
    alerts.push({
      type,
      priorities: Array.isArray(row?.priorityKeys) && row.priorityKeys.length ? [...row.priorityKeys] : [...casePriorities],
      recipients: Array.isArray(row?.recipients) ? [...row.recipients] : [],
      timingMode,
      timingMinutes: Number.isFinite(Number(row?.offsetMinutes)) ? Number(row.offsetMinutes) : 30,
      channels: channelsListToMap(row?.channels || [])
    });
  }
  return normalizeSlaAlerts(alerts, casePriorities, alertCardsOptions.value);
}

function alertCardsToNotifications(alerts = []) {
  return (alerts || []).map((alert) => {
    const timing = alert?.timingMode === 'immediately' ? 'at' : (alert?.timingMode === 'after' ? 'after' : 'before');
    const offsetMinutes = timing === 'at' ? 0 : Math.max(0, Number(alert?.timingMinutes || 0));
    return {
      milestoneKey: null,
      timing,
      offsetMinutes,
      recipients: Array.isArray(alert?.recipients) ? [...alert.recipients] : [],
      channels: channelsMapToList(alert?.channels || {}),
      priorityKeys: Array.isArray(alert?.priorities) ? [...alert.priorities] : []
    };
  });
}

const alertsModel = computed({
  get: () => notificationsToAlertCards(draft.notifications || []),
  set: (value) => {
    draft.notifications = alertCardsToNotifications(value || []);
  }
});

const advancedPriorityTargets = computed({
  get: () => buildPriorityTargetGrid(draft.targets || [], casePriorities),
  set: (value) => {
    draft.targets = priorityGridToTargets(value || {}, casePriorities);
  }
});

const advancedCompletionHours = computed({
  get: () => genericCompletionHours(draft.targets || []),
  set: (value) => {
    const next = Number(value);
    if (Number.isFinite(next) && next > 0) {
      draft.targets = completionHoursToTargets(next, props.metadata.milestoneKeys?.[0] || 'resolution');
    }
  }
});

async function runSimulation() {
  simulating.value = true;
  simulationResult.value = null;
  try {
    const data = await apiClient('/settings/automation/sla-policies/simulate', {
      method: 'POST',
      body: JSON.stringify({
        moduleKey: draft.scope.moduleKey,
        sampleRecord: {
          priority: 'High',
          status: 'Open',
          caseType: 'Support Ticket',
          channel: 'Email'
        },
        event: { type: draft.trigger.type }
      })
    });
    if (data?.success) simulationResult.value = data;
  } finally {
    simulating.value = false;
  }
}

function addEscalationStep() {
  draft.escalations.steps.push({
    role: 'manager',
    actionType: 'notify_hierarchy',
    delayMinutes: 30,
    config: {}
  });
}

function removeEscalationStep(index) {
  draft.escalations.steps.splice(index, 1);
}

watch(() => props.initialPolicy, (policy) => loadFromPolicy(policy), { immediate: true });

watch(() => props.fixedModuleKey, (value) => {
  if (value) {
    draft.scope.moduleKey = value;
    syncModuleAppKey();
  }
}, { immediate: true });

defineExpose({ validate, buildPayload, loadFromPolicy });
</script>
