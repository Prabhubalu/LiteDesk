<template>
  <div class="space-y-5">
    <!-- Summary stats -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div class="rounded-xl border border-gray-200 bg-white px-5 py-4 dark:border-gray-700 dark:bg-gray-800">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.slaStatTotalPolicies') }}</p>
        <p class="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{{ stats.total }}</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white px-5 py-4 dark:border-gray-700 dark:bg-gray-800">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.slaStatActivePolicies') }}</p>
        <p class="mt-1 text-3xl font-bold text-emerald-600 dark:text-emerald-400">{{ stats.active }}</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white px-5 py-4 dark:border-gray-700 dark:bg-gray-800">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.slaStatAlertsConfigured') }}</p>
        <p class="mt-1 text-3xl font-bold text-indigo-600 dark:text-indigo-400">{{ stats.alerts }}</p>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="relative min-w-[200px] flex-1">
        <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          v-model="searchQuery"
          type="search"
          :placeholder="t('settings.slaPolicySearchPh')"
          class="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
      </div>

      <select
        v-model="statusFilter"
        class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
      >
        <option value="all">{{ t('settings.slaPolicyFilterAll') }}</option>
        <option value="active">{{ t('settings.slaPolicyFilterActive') }}</option>
        <option value="inactive">{{ t('settings.slaPolicyFilterInactive') }}</option>
      </select>

      <div class="flex overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors"
          :class="viewMode === 'card' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'"
          @click="viewMode = 'card'"
        >
          <Squares2X2Icon class="h-4 w-4" />
          {{ t('settings.slaPolicyViewCards') }}
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 border-l border-gray-200 px-3 py-2 text-sm font-medium transition-colors dark:border-gray-700"
          :class="viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'"
          @click="viewMode = 'table'"
        >
          <TableCellsIcon class="h-4 w-4" />
          {{ t('settings.slaPolicyViewTable') }}
        </button>
      </div>

      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="$emit('create')"
      >
        <PlusIcon class="h-4 w-4" />
        {{ t('settings.slaPolicyNew') }}
      </button>
    </div>

    <!-- Empty state -->
    <div
      v-if="filteredPolicies.length === 0"
      class="rounded-2xl border border-dashed border-gray-300 px-6 py-14 text-center dark:border-gray-600"
    >
      <ClockIcon class="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
      <p class="mt-3 text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.slaPolicyEmptyTitle') }}</p>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.slaPolicyEmptyHint') }}</p>
      <button
        type="button"
        class="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="$emit('create')"
      >
        <PlusIcon class="h-4 w-4" />
        {{ t('settings.slaPolicyCreate') }}
      </button>
    </div>

    <!-- Card view -->
    <div v-else-if="viewMode === 'card'" class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="policy in filteredPolicies"
        :key="policy.id"
        class="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
        :class="{ 'opacity-60': !policy.active }"
      >
        <div class="p-5 pb-4">
          <div class="mb-3 flex items-start gap-3">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
              :class="policy.iconBg"
            >
              <ClockIcon class="h-5 w-5" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <h4 class="font-semibold text-gray-900 dark:text-white">{{ policy.name }}</h4>
                <span
                  v-if="policy.isDefault"
                  class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                >
                  {{ t('settings.helpdeskExecSlaPolicyDefaultBadge') }}
                </span>
                <span
                  class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                  :class="policy.active
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'"
                >
                  {{ policy.active ? t('settings.slaPolicyStatusActive') : t('settings.slaPolicyStatusInactive') }}
                </span>
              </div>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ policy.description }}</p>
            </div>
          </div>

          <div class="space-y-2.5 border-t border-gray-100 pt-4 dark:border-gray-700/60">
            <div class="flex items-start gap-2.5 text-sm">
              <ClockIcon class="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div>
                <span class="font-medium text-gray-900 dark:text-white">{{ policy.hoursLabel }}</span>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ policy.hoursDetail }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2.5 text-sm">
              <FlagIcon class="h-4 w-4 shrink-0 text-gray-400" />
              <span class="text-gray-700 dark:text-gray-300">
                {{ t('settings.slaCardPriorities', { count: policy.priorityCount }) }}
              </span>
            </div>
            <div class="flex items-center gap-2.5 text-sm">
              <BellAlertIcon class="h-4 w-4 shrink-0 text-gray-400" />
              <span class="text-gray-700 dark:text-gray-300">
                {{ t('settings.slaCardAlertRules', { count: policy.alertCount }) }}
              </span>
            </div>
            <div class="flex items-start gap-2.5 text-sm">
              <TagIcon class="h-4 w-4 mt-0.5 shrink-0 text-gray-400" />
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="pill in policy.coveragePills.slice(0, 4)"
                  :key="pill"
                  class="rounded-full px-2 py-0.5 text-[11px] font-medium"
                  :class="pillColorClass(pill)"
                >
                  {{ pill }}
                </span>
                <span v-if="policy.coveragePills.length > 4" class="text-xs text-gray-400">
                  +{{ policy.coveragePills.length - 4 }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-auto flex items-center justify-between gap-2 border-t border-gray-100 px-5 py-3 dark:border-gray-700/60">
          <button
            type="button"
            class="rounded-lg px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
            @click="$emit('edit', policy.id)"
          >
            {{ t('actions.edit') }}
          </button>
          <Menu v-if="!policy.isStandard" as="div" class="relative">
            <MenuButton class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700">
              <EllipsisVerticalIcon class="h-5 w-5" />
            </MenuButton>
            <MenuItems class="absolute bottom-full right-0 z-10 mb-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
              <MenuItem v-slot="{ active }">
                <button
                  type="button"
                  :class="['block w-full px-3 py-2 text-left text-sm', active ? 'bg-gray-100 dark:bg-gray-800' : '']"
                  @click="$emit('toggle-default', policy.id)"
                >
                  {{ t('settings.helpdeskExecSlaPolicyMakeDefault') }}
                </button>
              </MenuItem>
              <MenuItem v-slot="{ active }">
                <button
                  type="button"
                  :class="['block w-full px-3 py-2 text-left text-sm', active ? 'bg-gray-100 dark:bg-gray-800' : '']"
                  @click="$emit('toggle-enabled', policy.id)"
                >
                  {{ policy.active ? t('settings.helpdeskExecSlaPolicyDisable') : t('settings.helpdeskExecSlaPolicyEnable') }}
                </button>
              </MenuItem>
              <MenuItem v-slot="{ active }">
                <button
                  type="button"
                  :class="['block w-full px-3 py-2 text-left text-sm text-red-600', active ? 'bg-gray-100 dark:bg-gray-800' : '']"
                  @click="$emit('delete', policy.id)"
                >
                  {{ t('actions.remove') }}
                </button>
              </MenuItem>
            </MenuItems>
          </Menu>
        </div>
      </article>
    </div>

    <!-- Table view -->
    <div v-else class="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900/50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('settings.slaPolicyColPolicy') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('settings.slaPolicyColHours') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('settings.slaPolicyColAlerts') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('settings.slaPolicyColCoverage') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('settings.slaPolicyColStatus') }}</th>
            <th class="px-4 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-800">
          <tr
            v-for="policy in filteredPolicies"
            :key="policy.id"
            class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-900/40"
            :class="{ 'opacity-60': !policy.active }"
          >
            <td class="px-4 py-3">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ policy.name }}</span>
                <span
                  v-if="policy.isDefault"
                  class="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                >
                  {{ t('settings.helpdeskExecSlaPolicyDefaultBadge') }}
                </span>
              </div>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ policy.hoursLabel }}</td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ policy.alertCount }}</td>
            <td class="px-4 py-3">
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="pill in policy.coveragePills.slice(0, 3)"
                  :key="pill"
                  class="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                >
                  {{ pill }}
                </span>
                <span v-if="policy.coveragePills.length > 3" class="text-[10px] text-gray-400">+{{ policy.coveragePills.length - 3 }}</span>
              </div>
            </td>
            <td class="px-4 py-3">
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium"
                :class="policy.active
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'"
              >
                {{ policy.active ? t('settings.slaPolicyStatusActive') : t('settings.slaPolicyStatusInactive') }}
              </span>
            </td>
            <td class="px-4 py-3 text-right">
              <button
                type="button"
                class="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                @click="$emit('edit', policy.id)"
              >
                {{ t('actions.edit') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import {
  BellAlertIcon,
  ClockIcon,
  EllipsisVerticalIcon,
  FlagIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  Squares2X2Icon,
  TableCellsIcon,
  TagIcon
} from '@heroicons/vue/24/outline';
import { SLA_STANDARD_POLICY_ID as STANDARD_ID } from '@/components/settings/helpdesk/slaPolicyConstants.js';

const props = defineProps({
  standardPolicy: { type: Object, required: true },
  policies: { type: Array, default: () => [] },
  defaultPolicyKey: { type: String, default: '' },
  caseTypeLabel: { type: Function, required: true },
  businessHoursEnabled: { type: Boolean, default: false },
  businessHours: { type: Object, default: () => ({}) },
  priorityCount: { type: Number, default: 4 }
});

defineEmits(['create', 'edit', 'delete', 'toggle-enabled', 'toggle-default']);

const { t } = useI18n();

const searchQuery = ref('');
const statusFilter = ref('all');
const viewMode = ref('card');

const CARD_COLORS = [
  'bg-indigo-600',
  'bg-violet-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-cyan-600'
];

const COVERAGE_COLORS = [
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
];

function pillColorClass(pill) {
  const idx = Math.abs(hashString(pill)) % COVERAGE_COLORS.length;
  return COVERAGE_COLORS[idx];
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = ((hash << 5) - hash) + value.charCodeAt(i);
  return hash;
}

function countAlerts(policy) {
  if (Array.isArray(policy.alerts)) return policy.alerts.length;
  let count = 0;
  if (policy.notifyOnSlaWarning) count += 1;
  if (policy.notifyOnSlaBreach) count += 1;
  return count;
}

function coveragePillsForPolicy(policy, isStandard) {
  const pills = [];
  if (isStandard) {
    if (policy.caseTypes?.length) pills.push(...policy.caseTypes.map(props.caseTypeLabel));
    else pills.push(t('settings.slaPolicyCoverageAllCases'));
    return pills;
  }
  if (policy.caseTypes?.length) pills.push(...policy.caseTypes.map(props.caseTypeLabel));
  if (policy.channels?.length) pills.push(...policy.channels.slice(0, 2));
  if (policy.priorities?.length) pills.push(...policy.priorities.slice(0, 2));
  return pills.length ? pills : [t('settings.slaPolicyCoverageAllCases')];
}

function hoursLabel() {
  return props.businessHoursEnabled
    ? t('settings.slaPolicyHoursBusiness')
    : t('settings.slaPolicyHoursCalendar');
}

function hoursDetail() {
  if (!props.businessHoursEnabled) return t('settings.slaCardHours24x7');
  const bh = props.businessHours || {};
  if (bh.scheduleSource === 'inherit' || bh.scheduleSource === 'custom') {
    return t('settings.slaCardHoursFromSchedule');
  }
  const days = Array.isArray(bh.workingDays) ? bh.workingDays.length : 5;
  return t('settings.slaCardHoursWeekdays', { days, start: bh.startTime || '09:00', end: bh.endTime || '18:00' });
}

function policyPriorityCount(policy, isStandard) {
  if (isStandard) return props.priorityCount;
  if (Array.isArray(policy.priorities) && policy.priorities.length) return policy.priorities.length;
  return props.priorityCount;
}

function policyDescription(policy, isStandard) {
  if (policy.description) return policy.description;
  if (isStandard) return t('settings.slaCardDescStandard');
  return t('settings.slaCardDescCustom');
}

const displayPolicies = computed(() => {
  const custom = (props.policies || []).map((policy, index) => ({
    id: policy.key,
    isStandard: false,
    name: policy.name || t('settings.helpdeskExecSlaPolicyUntitled'),
    description: policyDescription(policy, false),
    active: policy.enabled !== false,
    isDefault: props.defaultPolicyKey === policy.key,
    hoursLabel: policy.useCalendarTime ? t('settings.slaPolicyHoursCalendar') : hoursLabel(),
    hoursDetail: policy.useCalendarTime ? t('settings.slaCardHours24x7') : hoursDetail(),
    priorityCount: policyPriorityCount(policy, false),
    alertCount: countAlerts(policy),
    coveragePills: coveragePillsForPolicy(policy, false),
    iconBg: CARD_COLORS[(index + 1) % CARD_COLORS.length],
    searchText: String(policy.name || '').toLowerCase()
  }));

  return custom;
});

const stats = computed(() => {
  const all = displayPolicies.value;
  return {
    total: all.length,
    active: all.filter((p) => p.active).length,
    alerts: all.reduce((sum, p) => sum + p.alertCount, 0)
  };
});

const filteredPolicies = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return displayPolicies.value.filter((policy) => {
    if (statusFilter.value === 'active' && !policy.active) return false;
    if (statusFilter.value === 'inactive' && policy.active) return false;
    if (q && !policy.searchText.includes(q)) return false;
    return true;
  });
});
</script>
