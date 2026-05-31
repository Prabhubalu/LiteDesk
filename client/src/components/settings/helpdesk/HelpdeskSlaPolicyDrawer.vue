<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
    >
      <div class="absolute inset-0 bg-gray-900/40 backdrop-blur-[1px]" @click="requestClose" />
      <div class="relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl dark:bg-gray-900">
        <div class="flex items-start justify-between gap-3 border-b border-gray-200 px-6 py-5 dark:border-gray-800">
          <div>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ isNew ? t('settings.helpdeskExecSlaDrawerNewTitle') : t('settings.helpdeskExecSlaDrawerEditTitle') }}
            </h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ t('settings.helpdeskExecSlaDrawerSubtitle') }}
            </p>
          </div>
          <button
            type="button"
            class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
            @click="requestClose"
          >
            <span class="sr-only">{{ t('actions.close') }}</span>
            ✕
          </button>
        </div>

        <div class="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <div class="flex items-center justify-between gap-4 rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700">
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.helpdeskExecSlaPolicyEnabled') }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.helpdeskExecSlaPolicyEnabledHint') }}</p>
            </div>
            <span class="relative inline-flex h-6 w-11 shrink-0">
              <input v-model="draft.enabled" type="checkbox" class="peer sr-only" />
              <span class="h-6 w-11 rounded-full bg-gray-200 transition peer-checked:bg-indigo-600 dark:bg-gray-700" />
              <span class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
            </span>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {{ t('settings.helpdeskExecSlaPolicyName') }}
            </label>
            <input
              v-model.trim="draft.name"
              type="text"
              :placeholder="t('settings.helpdeskExecSlaDrawerNamePh')"
              class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div class="space-y-4">
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.helpdeskExecSlaDrawerScope') }}</p>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.helpdeskExecSlaDrawerScopeHint') }}</p>
            </div>

            <div>
              <p class="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">{{ t('settings.helpdeskExecSlaPolicyChannels') }}</p>
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

            <div>
              <p class="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">{{ t('settings.helpdeskExecEnabledCaseTypes') }}</p>
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

            <div>
              <p class="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">{{ t('settings.helpdeskExecSlaPriorityColumn') }}</p>
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
          </div>

          <div>
            <div class="flex items-center justify-between gap-3 mb-3">
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.helpdeskExecSlaPolicyTargets') }}</p>
              <button
                type="button"
                class="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                @click="copyFromStandard"
              >
                {{ t('settings.helpdeskExecSlaPolicyCopyDefault') }}
              </button>
            </div>
            <HelpdeskSlaTargetGrid
              v-model:targets="draft.targets"
              :priorities="priorities"
              :priority-label="priorityLabel"
            />
          </div>
        </div>

        <div class="border-t border-gray-200 px-6 py-4 flex items-center justify-between gap-3 dark:border-gray-800">
          <button
            v-if="!isNew"
            type="button"
            class="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400"
            @click="$emit('remove')"
          >
            {{ t('actions.remove') }}
          </button>
          <div v-else />
          <div class="flex gap-2">
            <button
              type="button"
              class="rounded-xl px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              @click="requestClose"
            >
              {{ t('actions.cancel') }}
            </button>
            <button
              type="button"
              class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              @click="save"
            >
              {{ t('settings.helpdeskExecSlaDrawerSave') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import HelpdeskSlaTargetGrid from '@/components/settings/helpdesk/HelpdeskSlaTargetGrid.vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  isNew: { type: Boolean, default: true },
  priorities: { type: Array, required: true },
  caseTypes: { type: Array, required: true },
  channels: { type: Array, required: true },
  caseTypeLabel: { type: Function, required: true },
  priorityLabel: { type: Function, required: true },
  standardTargets: { type: Object, default: () => ({}) },
  initialPolicy: { type: Object, default: null }
});

const emit = defineEmits(['close', 'save', 'remove']);

const { t } = useI18n();

const draft = reactive(createEmptyDraft());

function createEmptyDraft() {
  return {
    key: '',
    name: '',
    enabled: true,
    channels: [],
    caseTypes: [],
    priorities: [],
    targets: {}
  };
}

function minutesToHours(minutes) {
  return Math.max(1, Math.round(Number(minutes || 0) / 60));
}

function hoursToMinutes(hours) {
  return Math.max(1, Math.round(Number(hours || 0) * 60));
}

function buildTargetsFromPolicy(policy) {
  const targets = {};
  for (const priority of props.priorities) {
    const source = policy?.priorityTargets?.[priority] || props.standardTargets[priority] || {};
    targets[priority] = {
      responseHours: minutesToHours(source.firstResponseMinutes || 240),
      resolutionHours: minutesToHours(source.resolutionMinutes || 2880)
    };
  }
  return targets;
}

function buildTargetsFromStandard() {
  const targets = {};
  for (const priority of props.priorities) {
    const source = props.standardTargets?.[priority] || {};
    targets[priority] = {
      responseHours: Number(source.responseHours) || minutesToHours(source.firstResponseMinutes || 240),
      resolutionHours: Number(source.resolutionHours) || minutesToHours(source.resolutionMinutes || 2880)
    };
  }
  return targets;
}

function loadDraft(policy) {
  const base = policy || createEmptyDraft();
  draft.key = base.key || '';
  draft.name = base.name || '';
  draft.enabled = base.enabled !== false;
  draft.channels = [...(base.channels || [])];
  draft.caseTypes = [...(base.caseTypes || [])];
  draft.priorities = [...(base.priorities || [])];
  draft.targets = policy ? buildTargetsFromPolicy(policy) : buildTargetsFromStandard();
}

watch(
  () => [props.open, props.initialPolicy, props.isNew],
  () => {
    if (props.open) loadDraft(props.isNew ? null : props.initialPolicy);
  },
  { immediate: true }
);

function pillClass(list, value) {
  const active = Array.isArray(list) && list.includes(value);
  return active
    ? 'bg-indigo-600 text-white shadow-sm'
    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700';
}

function toggleValue(list, value) {
  const idx = list.indexOf(value);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(value);
}

function copyFromStandard() {
  draft.targets = buildTargetsFromStandard();
}

function slugifyKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function requestClose() {
  emit('close');
}

function save() {
  if (!String(draft.name || '').trim()) return;
  const priorityTargets = {};
  for (const priority of props.priorities) {
    const row = draft.targets[priority] || { responseHours: 4, resolutionHours: 48 };
    priorityTargets[priority] = {
      firstResponseMinutes: hoursToMinutes(row.responseHours),
      resolutionMinutes: hoursToMinutes(row.resolutionHours)
    };
  }
  emit('save', {
    key: draft.key || slugifyKey(draft.name) || `policy-${Date.now()}`,
    name: draft.name.trim(),
    enabled: draft.enabled !== false,
    channels: [...draft.channels],
    caseTypes: [...draft.caseTypes],
    priorities: [...draft.priorities],
    priorityTargets
  });
}
</script>
