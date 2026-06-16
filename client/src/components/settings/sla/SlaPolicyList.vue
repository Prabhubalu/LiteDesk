<template>
  <div class="space-y-5">
    <div v-if="showStats" class="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

    <div class="flex flex-wrap items-center gap-2">
      <select
        v-if="showModuleSelect"
        v-model="internalModuleKey"
        class="shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        @change="$emit('module-change', internalModuleKey)"
      >
        <option value="">{{ t('common.filterAll') }}</option>
        <option v-for="mod in modules" :key="mod.moduleKey" :value="mod.moduleKey">
          {{ moduleLabel(mod) }}
        </option>
      </select>

      <div class="relative w-52 shrink-0 sm:w-64">
        <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          v-model="searchQuery"
          type="search"
          :placeholder="t('settings.slaPolicySearchPh')"
          class="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
      </div>

      <div class="ml-auto flex flex-wrap items-center justify-end gap-2">
        <select
          v-model="statusFilter"
          class="shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        >
          <option value="all">{{ t('settings.slaPolicyFilterAll') }}</option>
          <option value="active">{{ t('settings.slaPolicyFilterActive') }}</option>
          <option value="inactive">{{ t('settings.slaPolicyFilterInactive') }}</option>
        </select>

        <div class="relative flex h-[34px] shrink-0 items-stretch rounded-lg border border-gray-200/80 bg-gray-100 p-[0.1rem] shadow-inner dark:border-gray-600 dark:bg-gray-700/90">
          <button
            type="button"
            class="relative z-10 flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-0 text-xs font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-100 dark:ring-offset-gray-800 sm:text-sm"
            :class="viewMode === 'card' ? 'bg-white text-indigo-600 dark:bg-gray-800 dark:text-indigo-400' : 'text-gray-600 hover:bg-gray-200/50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-600/50 dark:hover:text-gray-200'"
            @click="viewMode = 'card'"
          >
            <Squares2X2Icon class="h-4 w-4 shrink-0" />
            {{ t('settings.slaPolicyViewCards') }}
          </button>
          <button
            type="button"
            class="relative z-10 flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-0 text-xs font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-100 dark:ring-offset-gray-800 sm:text-sm"
            :class="viewMode === 'table' ? 'bg-white text-indigo-600 dark:bg-gray-800 dark:text-indigo-400' : 'text-gray-600 hover:bg-gray-200/50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-600/50 dark:hover:text-gray-200'"
            @click="viewMode = 'table'"
          >
            <TableCellsIcon class="h-4 w-4 shrink-0" />
            {{ t('settings.slaPolicyViewTable') }}
          </button>
        </div>

        <button
          v-if="showCreateButton"
          type="button"
          class="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          @click="$emit('create')"
        >
          <PlusIcon class="h-4 w-4" />
          {{ t('settings.slaPolicyNew') }}
        </button>
      </div>
    </div>

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

    <div v-else-if="viewMode === 'card'" class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="policy in filteredPolicies"
        :key="policy.policyKey"
        class="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
        :class="{ 'opacity-60': !policy.active }"
      >
        <div class="absolute right-4 top-4 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            class="rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            @click="$emit('preview', policy.policyKey)"
          >
            {{ t('settings.slaPolicyPreview') }}
          </button>
          <button
            type="button"
            class="rounded-lg px-2.5 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
            @click="$emit('edit', policy.policyKey)"
          >
            {{ t('actions.edit') }}
          </button>
        </div>

        <div class="p-5 pb-4">
          <div class="mb-3 flex items-start gap-3 pr-24">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" :class="policy.iconBg">
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
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ policy.policyKey }}</p>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ policy.description }}</p>
            </div>
          </div>

          <div class="space-y-2.5 border-t border-gray-100 pt-4 dark:border-gray-700/60">
            <div class="flex items-center gap-2.5 text-sm">
              <TagIcon class="h-4 w-4 shrink-0 text-gray-400" />
              <span class="text-gray-700 dark:text-gray-300">{{ policy.moduleLabel }}</span>
            </div>
            <div class="flex items-center gap-2.5 text-sm">
              <FlagIcon class="h-4 w-4 shrink-0 text-gray-400" />
              <span class="text-gray-700 dark:text-gray-300">{{ t('settings.slaPolicyTargetsCount', { count: policy.targetsCount }) }}</span>
            </div>
            <div class="flex items-center gap-2.5 text-sm">
              <AdjustmentsHorizontalIcon class="h-4 w-4 shrink-0 text-gray-400" />
              <span class="text-gray-700 dark:text-gray-300">
                {{ t('settings.slaPolicyConditionsCount', { count: policy.conditionCount }) }}
              </span>
            </div>
            <div class="flex items-center gap-2.5 text-sm">
              <ArrowTrendingUpIcon class="h-4 w-4 shrink-0 text-gray-400" />
              <span class="text-gray-700 dark:text-gray-300">{{ t('settings.slaPolicyPrecedenceValue', { value: policy.precedence }) }}</span>
            </div>
          </div>
        </div>

        <div
          v-if="!policy.isDefault && !policy.isBuiltinDefault"
          class="mt-auto flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3 dark:border-gray-700/60"
        >
          <button
            type="button"
            class="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
            @click="$emit('make-default', policy.policyKey)"
          >
            {{ t('settings.helpdeskExecSlaPolicyMakeDefault') }}
          </button>
        </div>
      </article>
    </div>

    <div v-else class="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900/50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('settings.slaPolicyColPolicy') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('settings.slaPolicyColModule') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('settings.slaPolicyColTargets') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('settings.slaPolicyColPrecedence') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('settings.slaPolicyColStatus') }}</th>
            <th class="px-4 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-800">
          <tr
            v-for="policy in filteredPolicies"
            :key="policy.policyKey"
            class="group transition-colors hover:bg-gray-50 dark:hover:bg-gray-900/40"
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
              <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ policy.policyKey }}</p>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ policy.moduleLabel }}</td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ policy.targetsCount }}</td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ policy.precedence }}</td>
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
              <div class="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <button
                  type="button"
                  class="rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  @click="$emit('preview', policy.policyKey)"
                >
                  {{ t('settings.slaPolicyPreview') }}
                </button>
                <button
                  type="button"
                  class="rounded-lg px-2.5 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                  @click="$emit('edit', policy.policyKey)"
                >
                  {{ t('actions.edit') }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  AdjustmentsHorizontalIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  FlagIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  Squares2X2Icon,
  TableCellsIcon,
  TagIcon
} from '@heroicons/vue/24/outline';
import { DEFAULT_SLA_POLICY_KEY } from '@/constants/slaPolicy';
import { getModuleLabelKey } from '@/utils/navigationLabels';

const props = defineProps({
  policies: { type: Array, default: () => [] },
  modules: { type: Array, default: () => [] },
  selectedModuleKey: { type: String, default: '' },
  showModuleSelect: { type: Boolean, default: false },
  showStats: { type: Boolean, default: true },
  showCreateButton: { type: Boolean, default: true }
});

defineEmits(['create', 'preview', 'edit', 'make-default', 'module-change']);

const { t } = useI18n();

const searchQuery = ref('');
const statusFilter = ref('all');
const viewMode = ref('card');
const internalModuleKey = ref(props.selectedModuleKey);

watch(() => props.selectedModuleKey, (value) => {
  internalModuleKey.value = value;
});

const CARD_COLORS = [
  'bg-indigo-600',
  'bg-violet-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-cyan-600'
];

function moduleLabel(mod) {
  const moduleKey = mod?.moduleKey || '';
  const canonicalKey = getModuleLabelKey(moduleKey);
  if (canonicalKey) return t(canonicalKey);
  if (mod?.labelKey) return t(mod.labelKey);
  const label = mod?.label || '';
  if (label && !label.includes('.')) return label;
  return moduleKey;
}

function moduleLabelForKey(moduleKey) {
  const canonicalKey = getModuleLabelKey(moduleKey);
  if (canonicalKey) return t(canonicalKey);
  const row = props.modules.find((m) => m.moduleKey === moduleKey);
  return moduleLabel(row) || moduleKey || '';
}

function countConditions(group) {
  if (!group || typeof group !== 'object') return 0;
  const clauses = Array.isArray(group.clauses) ? group.clauses.length : 0;
  const groups = Array.isArray(group.groups) ? group.groups : [];
  return clauses + groups.reduce((sum, g) => sum + countConditions(g), 0);
}

const displayPolicies = computed(() => {
  const rows = (props.policies || []).map((policy, index) => ({
    policyKey: policy.policyKey,
    name: policy.name || policy.policyKey,
    description: policy.description || '',
    active: policy.active !== false,
    isDefault: Boolean(policy.isDefault),
    isBuiltinDefault: policy.policyKey === DEFAULT_SLA_POLICY_KEY,
    moduleKey: policy?.scope?.moduleKey || '',
    moduleLabel: moduleLabelForKey(policy?.scope?.moduleKey),
    targetsCount: Array.isArray(policy.targets) ? policy.targets.length : 0,
    conditionCount: countConditions(policy.entryCriteria),
    precedence: Number.isFinite(Number(policy.precedence)) ? Number(policy.precedence) : 0,
    iconBg: CARD_COLORS[index % CARD_COLORS.length],
    searchText: `${policy.name || ''} ${policy.policyKey || ''}`.toLowerCase()
  }));

  return rows.sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    if (a.isBuiltinDefault !== b.isBuiltinDefault) return a.isBuiltinDefault ? -1 : 1;
    return (b.precedence || 0) - (a.precedence || 0);
  });
});

const stats = computed(() => {
  const all = displayPolicies.value;
  return {
    total: all.length,
    active: all.filter((p) => p.active).length,
    alerts: 0
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

