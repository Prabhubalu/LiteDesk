<template>
  <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
    <div class="border-b border-gray-200 bg-gray-50/80 px-5 py-4 dark:border-gray-700 dark:bg-gray-900/40">
      <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.helpdeskExecNavSla') }}</h3>
      <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.helpdeskExecSlaHubIntro') }}</p>
    </div>

    <!-- Standard SLA -->
    <article class="border-b border-gray-200 p-5 dark:border-gray-700">
      <div class="mb-4 flex items-start gap-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
          <ClockIcon class="h-5 w-5" />
        </div>
        <div>
          <h4 class="font-semibold text-gray-900 dark:text-white">{{ t('settings.helpdeskExecStandardSlaTitle') }}</h4>
          <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.helpdeskExecStandardSlaHint') }}</p>
        </div>
      </div>

      <HelpdeskSlaTargetGrid
        v-model:targets="standardTargets"
        :priorities="priorities"
        :priority-label="priorityLabel"
      />

      <div class="mt-6 space-y-4 rounded-xl border border-gray-100 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/30">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.helpdeskExecBusinessHours') }}</p>
            <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.helpdeskExecBusinessHoursHint') }}</p>
          </div>
          <button
            type="button"
            class="text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50 dark:text-indigo-400"
            :disabled="recalculatingSlas"
            @click="$emit('recalculate')"
          >
            {{ recalculatingSlas ? t('settings.helpdeskExecRecalculating') : t('settings.helpdeskExecRecalculateSlas') }}
          </button>
        </div>
        <p v-if="recalculateMessage" class="text-xs text-emerald-700 dark:text-emerald-300">{{ recalculateMessage }}</p>
        <HelpdeskSlaScheduleSection v-model:business-hours="businessHours" />
      </div>

      <div class="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-100 dark:divide-gray-800 dark:border-gray-800">
        <ToggleRow
          v-for="item in slaAlertItems"
          :key="item.key"
          :title="item.title"
          :description="item.description"
          :model-value="notifications[item.key]"
          @update:model-value="updateNotification(item.key, $event)"
        />
      </div>
    </article>

    <!-- Enabled case types (feeds which cases enter SLA flow) -->
    <article class="border-b border-gray-200 p-5 dark:border-gray-700">
      <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.helpdeskExecEnabledCaseTypes') }}</h4>
      <p class="mt-1 mb-3 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.helpdeskExecCaseTypesSlaHint') }}</p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="type in caseTypes"
          :key="type"
          type="button"
          class="rounded-full px-3.5 py-1.5 text-sm font-medium transition-all"
          :class="enabledCaseTypes.includes(type)
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'"
          @click="toggleCaseType(type)"
        >
          {{ caseTypeLabel(type) }}
        </button>
      </div>
    </article>

    <!-- Custom SLA rules -->
    <article class="p-5">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.helpdeskExecCustomSlaTitle') }}</h4>
          <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.helpdeskExecCustomSlaHint') }}</p>
        </div>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900"
          @click="openNew"
        >
          <PlusIcon class="h-4 w-4" />
          {{ t('settings.helpdeskExecSlaPolicyAdd') }}
        </button>
      </div>

      <div v-if="!policies.length" class="rounded-xl border border-dashed border-gray-300 py-8 text-center dark:border-gray-700">
        <p class="text-sm text-gray-500">{{ t('settings.helpdeskExecSlaPoliciesEmpty') }}</p>
      </div>

      <div v-else class="space-y-3">
        <article
          v-for="(policy, index) in policies"
          :key="policy.key || index"
          class="rounded-xl border p-4 transition-opacity dark:border-gray-700"
          :class="policy.enabled === false
            ? 'border-gray-200 bg-gray-50 opacity-60 dark:bg-gray-900/40'
            : 'border-gray-200 bg-white dark:bg-gray-800/80'"
        >
          <div class="flex items-start gap-3">
            <button
              type="button"
              class="mt-1 shrink-0"
              :title="policy.enabled === false ? t('settings.helpdeskExecSlaPolicyEnable') : t('settings.helpdeskExecSlaPolicyDisable')"
              @click="togglePolicyEnabled(index)"
            >
              <span
                class="relative inline-flex h-6 w-11"
              >
                <span
                  class="h-6 w-11 rounded-full transition"
                  :class="policy.enabled !== false ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'"
                />
                <span
                  class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition"
                  :class="policy.enabled !== false ? 'translate-x-5' : ''"
                />
              </span>
            </button>

            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-medium text-gray-900 dark:text-white">{{ policy.name || t('settings.helpdeskExecSlaPolicyUntitled') }}</p>
                <span
                  v-if="defaultPolicyKey === policy.key"
                  class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                >
                  {{ t('settings.helpdeskExecSlaPolicyDefaultBadge') }}
                </span>
                <span
                  v-if="policy.enabled === false"
                  class="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                >
                  {{ t('settings.helpdeskExecSlaPolicyOffBadge') }}
                </span>
              </div>

              <div class="mt-2 flex flex-wrap gap-1.5">
                <span
                  v-for="pill in scopePills(policy)"
                  :key="pill"
                  class="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                >
                  {{ pill }}
                </span>
              </div>

              <p class="mt-2 text-xs text-gray-400">{{ targetPreview(policy) }}</p>
            </div>

            <div class="flex shrink-0 items-center gap-1">
              <button
                type="button"
                class="rounded-lg p-1.5 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                :title="t('settings.helpdeskExecSlaPolicyMakeDefault')"
                @click="toggleDefault(policy.key)"
              >
                <StarIcon class="h-5 w-5" :class="defaultPolicyKey === policy.key ? 'fill-current' : 'opacity-40'" />
              </button>
              <button
                type="button"
                class="rounded-lg px-2 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                @click="openEdit(index)"
              >
                {{ t('actions.edit') }}
              </button>
            </div>
          </div>
        </article>
      </div>
    </article>

    <HelpdeskSlaPolicyDrawer
      :open="drawerOpen"
      :is-new="drawerIsNew"
      :initial-policy="drawerPolicy"
      :priorities="priorities"
      :case-types="caseTypes"
      :channels="channels"
      :case-type-label="caseTypeLabel"
      :priority-label="priorityLabel"
      :standard-targets="standardTargets"
      @close="closeDrawer"
      @save="saveDrawer"
      @remove="removeDrawer"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ClockIcon, PlusIcon, StarIcon } from '@heroicons/vue/24/outline';
import HelpdeskSlaTargetGrid from '@/components/settings/helpdesk/HelpdeskSlaTargetGrid.vue';
import HelpdeskSlaPolicyDrawer from '@/components/settings/helpdesk/HelpdeskSlaPolicyDrawer.vue';
import HelpdeskSlaScheduleSection from '@/components/settings/HelpdeskSlaScheduleSection.vue';
import ToggleRow from '@/components/settings/helpdesk/HelpdeskSettingsToggleRow.vue';

const props = defineProps({
  priorities: { type: Array, required: true },
  caseTypes: { type: Array, required: true },
  channels: { type: Array, required: true },
  caseTypeLabel: { type: Function, required: true },
  priorityLabel: { type: Function, required: true },
  notifications: { type: Object, required: true },
  recalculatingSlas: { type: Boolean, default: false },
  recalculateMessage: { type: String, default: '' }
});

defineEmits(['recalculate']);

const standardTargets = defineModel('standardTargets', { type: Object, required: true });
const businessHours = defineModel('businessHours', { type: Object, required: true });
const enabledCaseTypes = defineModel('enabledCaseTypes', { type: Array, required: true });
const policies = defineModel('policies', { type: Array, default: () => [] });
const defaultPolicyKey = defineModel('defaultPolicyKey', { type: String, default: '' });

const { t } = useI18n();

const slaAlertItems = computed(() => [
  {
    key: 'notifyOnSlaWarning',
    title: t('settings.helpdeskExecNotifyOnSlaWarning'),
    description: t('settings.helpdeskExecNotifyOnSlaWarningDesc')
  },
  {
    key: 'notifyOnSlaBreach',
    title: t('settings.helpdeskExecNotifyOnSlaBreach'),
    description: t('settings.helpdeskExecNotifyOnSlaBreachDesc')
  }
]);

const drawerOpen = ref(false);
const drawerIsNew = ref(true);
const drawerIndex = ref(-1);
const drawerPolicy = ref(null);

function minutesToHours(minutes) {
  return Math.max(1, Math.round(Number(minutes || 0) / 60));
}

function updateNotification(key, value) {
  props.notifications[key] = value;
}

function toggleCaseType(type) {
  const idx = enabledCaseTypes.value.indexOf(type);
  if (idx >= 0) enabledCaseTypes.value.splice(idx, 1);
  else enabledCaseTypes.value.push(type);
}

function scopePills(policy) {
  const pills = [];
  if (policy.channels?.length) pills.push(...policy.channels);
  else pills.push(t('settings.helpdeskExecSlaPolicyAnyChannel'));
  if (policy.caseTypes?.length) pills.push(...policy.caseTypes.map(props.caseTypeLabel));
  if (policy.priorities?.length) pills.push(...policy.priorities.map(props.priorityLabel));
  return pills;
}

function targetPreview(policy) {
  const sample = policy.priorityTargets?.Critical || policy.priorityTargets?.High || policy.priorityTargets?.Medium;
  if (!sample) return '';
  return t('settings.helpdeskExecSlaPolicyPreview', {
    response: minutesToHours(sample.firstResponseMinutes),
    resolution: minutesToHours(sample.resolutionMinutes)
  });
}

function toggleDefault(key) {
  defaultPolicyKey.value = defaultPolicyKey.value === key ? '' : key;
}

function togglePolicyEnabled(index) {
  const policy = policies.value[index];
  if (!policy) return;
  policy.enabled = policy.enabled === false;
}

function openNew() {
  drawerIsNew.value = true;
  drawerIndex.value = -1;
  drawerPolicy.value = null;
  drawerOpen.value = true;
}

function openEdit(index) {
  drawerIsNew.value = false;
  drawerIndex.value = index;
  drawerPolicy.value = policies.value[index];
  drawerOpen.value = true;
}

function closeDrawer() {
  drawerOpen.value = false;
}

function saveDrawer(payload) {
  let key = payload.key;
  const existingKeys = policies.value
    .map((p) => p.key)
    .filter((_, i) => !(drawerIsNew.value === false && i === drawerIndex.value));
  if (existingKeys.includes(key)) {
    const base = key;
    let n = 2;
    while (existingKeys.includes(key)) key = `${base}-${n++}`;
  }
  payload.key = key;
  if (payload.enabled === undefined) payload.enabled = true;

  if (drawerIsNew.value) policies.value.push(payload);
  else if (drawerIndex.value >= 0) policies.value[drawerIndex.value] = payload;
  closeDrawer();
}

function removeDrawer() {
  if (drawerIndex.value >= 0) removePolicy(drawerIndex.value);
  closeDrawer();
}

function removePolicy(index) {
  const removed = policies.value[index];
  policies.value.splice(index, 1);
  if (defaultPolicyKey.value === removed?.key) defaultPolicyKey.value = '';
}

defineExpose({
  syncAllPolicyTargetsFromDisplay() {},
  validate() {
    const keys = new Set();
    for (const policy of policies.value) {
      if (policy.enabled === false) continue;
      if (!String(policy.name || '').trim()) return t('settings.helpdeskExecSlaPolicyNameRequired');
      if (!String(policy.key || '').trim()) return t('settings.helpdeskExecSlaPolicyKeyRequired');
      if (keys.has(policy.key)) return t('settings.helpdeskExecSlaPolicyDuplicateKey', { key: policy.key });
      keys.add(policy.key);
    }
    if (defaultPolicyKey.value && !policies.value.some((p) => p.key === defaultPolicyKey.value && p.enabled !== false)) {
      return t('settings.helpdeskExecSlaPolicyInvalidDefault');
    }
    return null;
  }
});
</script>
