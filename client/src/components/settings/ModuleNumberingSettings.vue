<template>
  <SettingsScrollPanel content-class="max-w-none w-full" :save-bar-visible="view === 'edit' && !loading && !loadError && hasChanges">
    <template #header>
      <div>
        <button
          type="button"
          class="mb-2 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
          @click="onBack"
        >
          {{ t('actions.back') }}
        </button>
        <h2 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          {{ view === 'edit' ? (form.label || form.moduleKey) : t('settings.automationModuleNumbering') }}
        </h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {{ view === 'edit' ? t('settings.moduleNumberingEditDesc') : t('settings.automationModuleNumberingDesc') }}
        </p>
      </div>
    </template>

    <div v-if="loadError" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
      {{ loadError }}
    </div>

    <!-- List -->
    <ListView
      v-else-if="view === 'list'"
      hide-page-header
      module-key="settings-module-numbering"
      table-id="settings-module-numbering-table"
      row-key="moduleKey"
      :title="t('settings.automationModuleNumbering')"
      :data="listRows"
      :columns="listColumns"
      :loading="loading"
      :pagination="listPagination"
      :sort-field="listSortField"
      :sort-order="listSortOrder"
      :parent-search-query="listSearchQuery"
      :external-filters="listColumnFilters"
      :show-create="false"
      :show-import="false"
      :show-export="false"
      :show-filters="false"
      :selectable="false"
      :has-actions="true"
      row-actions-gutter="4.5rem"
      :row-can-delete="() => false"
      :search-placeholder="t('settings.moduleNumberingSearchPh')"
      :empty-title="t('settings.moduleNumberingEmptyTitle')"
      :empty-message="t('settings.moduleNumberingEmptyBody')"
      @update:search-query="handleListSearch"
      @update:filters="handleListFilters"
      @update:sort="handleListSort"
      @update:pagination="handleListPagination"
      @row-click="(row) => openEdit(row.moduleKey)"
      @edit="(row) => openEdit(row.moduleKey)"
    >
      <template #actions="{ row }">
        <button
          type="button"
          class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 dark:border-gray-600 dark:bg-white dark:text-gray-700 dark:hover:bg-gray-50"
          :title="t('actions.edit')"
          @click.stop="openEdit(row.moduleKey)"
        >
          <PencilSquareIcon class="h-4 w-4" />
        </button>
      </template>

      <template #cell-enabled="{ row }">
        <span
          class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
          :class="row.enabled
            ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'"
        >
          {{ row.enabled ? t('settings.moduleNumberingEnabled') : t('settings.moduleNumberingDisabled') }}
        </span>
      </template>

      <template #cell-format="{ value }">
        <span class="font-mono text-xs text-gray-700 dark:text-gray-200">{{ value }}</span>
      </template>

      <template #cell-updatedAt="{ value }">
        {{ formatDate(value) }}
      </template>
    </ListView>

    <!-- Edit -->
    <form v-else class="w-full space-y-5" @submit.prevent="save">
      <!-- Module + auto toggle -->
      <section class="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div class="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0">
            <p class="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {{ t('settings.moduleNumberingModule') }}
            </p>
            <p class="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-white">
              {{ form.label || form.moduleKey }}
            </p>
            <p v-if="form.numberFieldLabel || form.numberFieldKey" class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ t('settings.moduleNumberingColField') }}:
              <span class="font-medium text-gray-700 dark:text-gray-200">{{ form.numberFieldLabel || humanizeFieldKey(form.numberFieldKey) }}</span>
            </p>
          </div>
          <SwitchGroup as="div" class="flex shrink-0 items-center gap-3">
            <SwitchLabel class="text-sm font-medium text-gray-700 dark:text-gray-200 cursor-pointer">
              {{ t('settings.moduleNumberingAuto') }}
            </SwitchLabel>
            <HeadlessSwitch v-model="form.enabled" />
          </SwitchGroup>
        </div>
        <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
          {{ t('settings.moduleNumberingAutoHint') }}
        </p>
      </section>

      <!-- Pattern builder -->
      <section class="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 space-y-5">
        <div>
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.moduleNumberingPatternTitle') }}</h3>
          <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.moduleNumberingPatternHelp') }}</p>
        </div>

        <RadioGroup
          :model-value="activePresetId"
          class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4"
          @update:model-value="applyPreset"
        >
          <RadioGroupOption
            v-for="preset in formatPresets"
            :key="preset.id"
            v-slot="{ checked }"
            :value="preset.id"
            as="template"
          >
            <button
              type="button"
              class="rounded-xl border px-3.5 py-3 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
              :class="checked
                ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500/40 dark:border-indigo-400 dark:bg-indigo-950/40'
                : 'border-gray-200 bg-gray-50/80 hover:border-gray-300 hover:bg-white dark:border-gray-600 dark:bg-gray-900/40 dark:hover:border-gray-500'"
            >
              <span
                class="block text-sm font-medium"
                :class="checked ? 'text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-white'"
              >
                {{ t(preset.labelKey) }}
              </span>
              <span
                class="mt-1 block font-mono text-xs"
                :class="checked ? 'text-indigo-600 dark:text-indigo-300' : 'text-gray-500 dark:text-gray-400'"
              >
                {{ presetExample(preset.id) }}
              </span>
            </button>
          </RadioGroupOption>
        </RadioGroup>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('settings.moduleNumberingPrefix') }}</label>
            <input
              v-model="form.prefix"
              type="text"
              maxlength="32"
              class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-[border-color,box-shadow] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900/80 dark:text-white dark:placeholder:text-gray-500"
              :placeholder="t('settings.moduleNumberingPrefixPh')"
              @input="onBuilderFieldChange"
            />
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('settings.moduleNumberingSuffix') }}</label>
            <input
              v-model="form.suffix"
              type="text"
              maxlength="32"
              class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-[border-color,box-shadow] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900/80 dark:text-white dark:placeholder:text-gray-500"
              :placeholder="t('settings.moduleNumberingSuffixPh')"
              @input="onBuilderFieldChange"
            />
          </div>
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('settings.moduleNumberingSeparator') }}</label>
          <RadioGroup
            :model-value="builder.separator"
            :disabled="builder.mode === 'custom'"
            class="inline-flex w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-600 dark:bg-gray-900/60 sm:w-auto"
            @update:model-value="onSeparatorChange"
          >
            <RadioGroupOption
              v-for="opt in separatorOptions"
              :key="opt.value === '' ? 'none' : opt.value"
              v-slot="{ checked }"
              :value="opt.value"
              :disabled="builder.mode === 'custom'"
              as="template"
            >
              <button
                type="button"
                class="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:min-w-[5.5rem]"
                :class="checked
                  ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5 dark:bg-gray-800 dark:text-white dark:ring-white/10'
                  : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'"
              >
                {{ opt.label }}
              </button>
            </RadioGroupOption>
          </RadioGroup>
          <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.moduleNumberingSepHelp') }}</p>
        </div>

        <div class="rounded-xl border border-dashed border-indigo-300/80 bg-indigo-50/60 px-4 py-3 dark:border-indigo-700/60 dark:bg-indigo-950/30">
          <p class="text-xs font-medium uppercase tracking-wide text-indigo-500 dark:text-indigo-400">
            {{ t('settings.moduleNumberingPreview') }}
          </p>
          <p class="mt-1 font-mono text-base font-semibold tracking-wide text-indigo-700 dark:text-indigo-200">
            {{ livePreview }}
          </p>
        </div>

        <div>
          <button
            type="button"
            class="text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
            @click="toggleCustomFormat"
          >
            {{ showCustomFormat ? t('settings.moduleNumberingHideCustom') : t('settings.moduleNumberingShowCustom') }}
          </button>
          <div v-if="showCustomFormat" class="mt-3 space-y-2.5 rounded-xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-600 dark:bg-gray-900/40">
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.moduleNumberingCustomHelp') }}</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="token in formatTokens"
                :key="token.value"
                type="button"
                class="rounded-lg border border-gray-200 bg-white px-2.5 py-1 font-mono text-xs text-gray-700 transition-colors hover:border-indigo-400 hover:text-indigo-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-indigo-400"
                :title="t(token.hintKey)"
                @click="insertToken(token.value)"
              >
                {{ token.value }}
              </button>
            </div>
            <input
              ref="formatInputRef"
              v-model="form.format"
              type="text"
              class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-mono text-gray-900 transition-[border-color,box-shadow] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900/80 dark:text-white"
              @input="onCustomFormatInput"
            />
          </div>
          <p v-else class="mt-2 font-mono text-xs text-gray-500 dark:text-gray-400">
            {{ t('settings.moduleNumberingFormatLabel') }}: {{ form.format }}
          </p>
        </div>
      </section>

      <!-- Sequence -->
      <section class="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('settings.moduleNumberingSeqLength') }}</label>
            <input
              v-model.number="form.sequenceLength"
              type="number"
              min="1"
              max="15"
              class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 transition-[border-color,box-shadow] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900/80 dark:text-white"
            />
            <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.moduleNumberingSeqLengthHint') }}</p>
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('settings.moduleNumberingStarting') }}</label>
            <input
              v-model.number="form.startingSequence"
              type="number"
              min="1"
              class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 transition-[border-color,box-shadow] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900/80 dark:text-white"
            />
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('settings.moduleNumberingCurrent') }}</label>
            <p class="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm tabular-nums text-gray-900 dark:border-gray-600 dark:bg-gray-900/60 dark:text-white">
              {{ form.currentSequence ?? 0 }}
            </p>
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('settings.moduleNumberingReset') }}</label>
            <HeadlessSelect
              v-model="form.resetRule"
              :options="resetRuleOptions"
              :teleport="true"
            />
          </div>
        </div>
      </section>

      <div>
        <button
          type="button"
          class="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          :disabled="resyncing || hasChanges"
          :title="hasChanges ? t('settings.moduleNumberingResyncSaveFirst') : undefined"
          @click="resync"
        >
          {{ resyncing ? t('states.saving') : t('settings.moduleNumberingResync') }}
        </button>
      </div>
    </form>

    <SettingsSaveBar
      :visible="view === 'edit' && !loading && !loadError && hasChanges"
      :saving="saving"
      :error="saveError"
      @reset="resetForm"
      @save="save"
    />
  </SettingsScrollPanel>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { PencilSquareIcon } from '@heroicons/vue/24/outline';
import {
  RadioGroup,
  RadioGroupOption,
  SwitchGroup,
  SwitchLabel,
} from '@headlessui/vue';
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import SettingsSaveBar from '@/components/settings/SettingsSaveBar.vue';
import ListView from '@/components/common/ListView.vue';
import HeadlessSwitch from '@/components/ui/HeadlessSwitch.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import apiClient from '@/utils/apiClient';
import { formatUserDateTime } from '@/utils/localeFormat';
import { isFilterValueActive } from '@/platform/filters/filterValueUtils';
import {
  getThisMonthRange,
  getThisQuarterRange,
  getThisWeekRange,
  getThisYearRange,
  getTodayRange,
  parseDateFilterValue,
} from '@/utils/dateFilterOptions';

const emit = defineEmits(['back']);
const { t } = useI18n();

const view = ref('list');
const loading = ref(true);
const loadError = ref('');
const saveError = ref('');
const saving = ref(false);
const resyncing = ref(false);
const configs = ref([]);
const listSearchQuery = ref('');
/** Column-header filters from ListView (`@update:filters`); applied client-side. */
const listColumnFilters = ref({});
const listSortField = ref('label');
const listSortOrder = ref('asc');
const listPage = ref(1);
const listPerPage = ref(25);
const savedSnapshot = ref('');
const showCustomFormat = ref(false);
const formatInputRef = ref(null);
const form = ref({
  moduleKey: '',
  label: '',
  numberFieldKey: '',
  numberFieldLabel: '',
  enabled: true,
  format: '',
  prefix: '',
  suffix: '',
  sequenceLength: 6,
  startingSequence: 1,
  currentSequence: 0,
  resetRule: 'never',
});
const builder = ref({
  mode: 'simple', // simple | year | yearMonth | yearMonthDay | custom
  separator: '-',
});

const formatPresets = [
  { id: 'simple', labelKey: 'settings.moduleNumberingPresetSimple' },
  { id: 'year', labelKey: 'settings.moduleNumberingPresetYear' },
  { id: 'yearMonth', labelKey: 'settings.moduleNumberingPresetYearMonth' },
  { id: 'yearMonthDay', labelKey: 'settings.moduleNumberingPresetYearMonthDay' },
];

const formatTokens = [
  { value: '{PREFIX}', hintKey: 'settings.moduleNumberingTokenPrefix' },
  { value: '{YYYY}', hintKey: 'settings.moduleNumberingTokenYyyy' },
  { value: '{YY}', hintKey: 'settings.moduleNumberingTokenYy' },
  { value: '{MM}', hintKey: 'settings.moduleNumberingTokenMm' },
  { value: '{DD}', hintKey: 'settings.moduleNumberingTokenDd' },
  { value: '{SEQ}', hintKey: 'settings.moduleNumberingTokenSeq' },
  { value: '{SUFFIX}', hintKey: 'settings.moduleNumberingTokenSuffix' },
];

const separatorOptions = computed(() => [
  { value: '', label: t('settings.moduleNumberingSepNone') },
  { value: '-', label: t('settings.moduleNumberingSepDash') },
  { value: '/', label: t('settings.moduleNumberingSepSlash') },
]);

const resetRuleOptions = computed(() => [
  { value: 'never', label: t('settings.moduleNumberingResetNever') },
  { value: 'daily', label: t('settings.moduleNumberingResetDaily') },
  { value: 'monthly', label: t('settings.moduleNumberingResetMonthly') },
  { value: 'yearly', label: t('settings.moduleNumberingResetYearly') },
]);

const activePresetId = computed(() => (
  builder.value.mode === 'custom' ? null : builder.value.mode
));

const hasChanges = computed(() => {
  if (view.value !== 'edit' || !savedSnapshot.value) return false;
  return serializeForm() !== savedSnapshot.value;
});

const listColumns = computed(() => [
  {
    key: 'label',
    label: t('settings.moduleNumberingColModule'),
    sortable: true,
    visible: true,
    showInTable: true,
    visibility: { list: true },
    locked: true,
    minWidth: '12rem',
    dataType: 'text',
  },
  {
    key: 'numberFieldLabel',
    label: t('settings.moduleNumberingColField'),
    sortable: true,
    visible: true,
    showInTable: true,
    visibility: { list: true },
    minWidth: '12rem',
    dataType: 'text',
  },
  {
    key: 'format',
    label: t('settings.moduleNumberingColFormat'),
    sortable: true,
    visible: true,
    showInTable: true,
    visibility: { list: true },
    minWidth: '10rem',
    dataType: 'text',
  },
  {
    key: 'currentSequence',
    label: t('settings.moduleNumberingColSequence'),
    sortable: true,
    visible: true,
    showInTable: true,
    visibility: { list: true },
    minWidth: '8rem',
    dataType: 'number',
  },
  {
    key: 'enabled',
    label: t('settings.moduleNumberingColAuto'),
    sortable: true,
    visible: true,
    showInTable: true,
    visibility: { list: true },
    minWidth: '8rem',
    dataType: 'boolean',
    filterType: 'boolean',
  },
  {
    key: 'updatedAt',
    label: t('settings.moduleNumberingColUpdated'),
    sortable: true,
    visible: true,
    showInTable: true,
    visibility: { list: true },
    minWidth: '10rem',
    dataType: 'datetime',
  },
]);

const normalizedConfigs = computed(() =>
  (configs.value || []).map((row) => ({
    ...row,
    label: row.label || row.moduleKey,
    numberFieldLabel: row.numberFieldLabel || humanizeFieldKey(row.numberFieldKey),
    currentSequence: Number(row.currentSequence) || 0,
    enabled: row.enabled !== false,
  }))
);

function columnSearchHaystack(row, key) {
  if (key === 'enabled') {
    return row.enabled
      ? `${t('settings.moduleNumberingEnabled')} true yes`
      : `${t('settings.moduleNumberingDisabled')} false no`;
  }
  if (key === 'updatedAt') {
    const raw = row.updatedAt ? String(row.updatedAt) : '';
    const formatted = formatDate(row.updatedAt);
    return `${raw} ${formatted === '—' ? '' : formatted}`.trim();
  }
  if (key === 'label') {
    return [row.label, row.moduleKey].filter(Boolean).join(' ');
  }
  if (key === 'numberFieldLabel') {
    return [row.numberFieldLabel, row.numberFieldKey].filter(Boolean).join(' ');
  }
  return String(row?.[key] ?? '');
}

function resolveDateRange(parsed) {
  if (!parsed) return null;
  if (parsed.preset === 'today') return getTodayRange();
  if (parsed.preset === 'thisWeek') return getThisWeekRange();
  if (parsed.preset === 'thisMonth') return getThisMonthRange();
  if (parsed.preset === 'thisQuarter') return getThisQuarterRange();
  if (parsed.preset === 'thisYear') return getThisYearRange();
  if (parsed.op === 'on' && parsed.date) {
    const from = new Date(parsed.date);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    to.setMilliseconds(-1);
    return { from, to };
  }
  if (parsed.op === 'before' && parsed.date) {
    const to = new Date(parsed.date);
    to.setHours(23, 59, 59, 999);
    return { from: new Date(0), to };
  }
  if (parsed.op === 'after' && parsed.date) {
    const from = new Date(parsed.date);
    from.setHours(0, 0, 0, 0);
    return { from, to: new Date(8640000000000000) };
  }
  if (parsed.op === 'between' && parsed.from && parsed.to) {
    const from = new Date(parsed.from);
    from.setHours(0, 0, 0, 0);
    const to = new Date(parsed.to);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }
  if (parsed.op === 'lastDays' && parsed.days != null) {
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    const from = new Date(to);
    from.setDate(from.getDate() - Number(parsed.days));
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }
  return null;
}

/** Text column filters use `contains` → ListView emits filterQuery AST, not flat keys. */
function parseFilterQueryAst(raw) {
  if (!raw) return null;
  let current = raw;
  for (let depth = 0; depth < 2; depth += 1) {
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      return current;
    }
    if (typeof current !== 'string') return null;
    try {
      current = JSON.parse(current);
    } catch {
      return null;
    }
  }
  return current && typeof current === 'object' && !Array.isArray(current) ? current : null;
}

function collectFilterQueryRules(node, logic = 'AND', results = []) {
  if (!node || typeof node !== 'object') return results;
  if (node.fieldKey) {
    results.push({
      fieldKey: String(node.fieldKey),
      operator: String(node.operator || 'contains'),
      value: node.value,
      logic,
    });
  }
  const childLogic = node.logic === 'OR' ? 'OR' : 'AND';
  for (const child of node.children || []) {
    collectFilterQueryRules(child, childLogic, results);
  }
  return results;
}

function rowMatchesOperator(row, fieldKey, operator, value) {
  const hay = columnSearchHaystack(row, fieldKey);
  const hayLower = hay.toLowerCase();
  const empty = !String(hay ?? '').trim();

  if (operator === 'is_empty') return empty;
  if (operator === 'is_not_empty') return !empty;

  if (fieldKey === 'updatedAt' && (typeof value === 'object' || operator === 'is')) {
    return rowMatchesColumnFilter(row, fieldKey, value);
  }

  if (operator === 'is_any_of') {
    const values = Array.isArray(value) ? value : value != null && value !== '' ? [value] : [];
    if (!values.length) return true;
    return values.some((entry) => hayLower.includes(String(entry ?? '').trim().toLowerCase())
      || String(row?.[fieldKey] ?? '').toLowerCase() === String(entry ?? '').trim().toLowerCase());
  }

  if (operator === 'is_not') {
    if (value === true || value === 'true') return row.enabled !== true;
    if (value === false || value === 'false') return row.enabled !== false;
    const needle = String(value ?? '').trim().toLowerCase();
    if (!needle) return true;
    return !hayLower.includes(needle);
  }

  if (operator === 'not_contains') {
    const needle = String(value ?? '').trim().toLowerCase();
    if (!needle) return true;
    return !hayLower.includes(needle);
  }

  if (operator === 'is') {
    if (fieldKey === 'enabled') {
      if (value === true || value === 'true') return row.enabled === true;
      if (value === false || value === 'false') return row.enabled === false;
    }
    if (fieldKey === 'currentSequence') {
      return Number(row.currentSequence) === Number(value);
    }
    const needle = String(value ?? '').trim().toLowerCase();
    if (!needle) return true;
    return hayLower === needle || String(row?.[fieldKey] ?? '').toLowerCase() === needle;
  }

  // contains (default for text) and other operators: case-insensitive substring
  return rowMatchesColumnFilter(row, fieldKey, value);
}

function rowMatchesColumnFilter(row, key, value) {
  if (!isFilterValueActive(value)) return true;

  if (key === 'updatedAt' && typeof value === 'object' && !Array.isArray(value)) {
    const parsed = parseDateFilterValue(value);
    if (!parsed) return true;
    const ms = row.updatedAt ? new Date(row.updatedAt).getTime() : NaN;
    const hasValue = Number.isFinite(ms);
    if (parsed.op === 'empty') return !hasValue;
    if (parsed.op === 'notEmpty') return hasValue;
    if (!hasValue) return false;
    const range = resolveDateRange(parsed);
    if (!range) return true;
    return ms >= range.from.getTime() && ms <= range.to.getTime();
  }

  if (key === 'currentSequence') {
    const query = String(value ?? '').trim();
    if (!query) return true;
    const num = Number(row.currentSequence);
    if (!Number.isFinite(num)) return false;
    if (query === String(num)) return true;
    return String(num).includes(query);
  }

  if (key === 'enabled') {
    const query = String(value ?? '').trim().toLowerCase();
    if (!query) return true;
    if (query === 'true' || query === '1') return row.enabled === true;
    if (query === 'false' || query === '0') return row.enabled === false;
    return columnSearchHaystack(row, key).toLowerCase().includes(query);
  }

  if (Array.isArray(value)) {
    return value.some((entry) =>
      columnSearchHaystack(row, key).toLowerCase().includes(String(entry ?? '').trim().toLowerCase())
    );
  }

  const needle = String(value ?? '').trim().toLowerCase();
  if (!needle) return true;
  return columnSearchHaystack(row, key).toLowerCase().includes(needle);
}

function rowMatchesAllColumnFilters(row) {
  const filters = listColumnFilters.value || {};
  const ast = parseFilterQueryAst(filters.filterQuery);
  const astRules = collectFilterQueryRules(ast);

  if (astRules.length) {
    // Rules in the compiled AST share AND at root when ListView emits contains filters.
    const byLogic = astRules.reduce((acc, rule) => {
      const group = rule.logic || 'AND';
      if (!acc[group]) acc[group] = [];
      acc[group].push(rule);
      return acc;
    }, {});
    for (const [logic, rules] of Object.entries(byLogic)) {
      if (logic === 'OR') {
        if (!rules.some((r) => rowMatchesOperator(row, r.fieldKey, r.operator, r.value))) {
          return false;
        }
      } else if (!rules.every((r) => rowMatchesOperator(row, r.fieldKey, r.operator, r.value))) {
        return false;
      }
    }
  }

  // Flat payload keys (dates, booleans, numbers, or legacy non-AST filters)
  return Object.entries(filters).every(([key, value]) => {
    if (key === 'filterQuery') return true;
    // Skip keys already enforced via AST
    if (astRules.some((r) => r.fieldKey === key)) return true;
    return rowMatchesColumnFilter(row, key, value);
  });
}

const filteredSortedConfigs = computed(() => {
  const q = String(listSearchQuery.value || '').trim().toLowerCase();
  let rows = [...normalizedConfigs.value];
  if (q) {
    rows = rows.filter((row) => {
      const hay = [
        row.label,
        row.moduleKey,
        row.numberFieldLabel,
        row.numberFieldKey,
        row.format,
        row.enabled ? t('settings.moduleNumberingEnabled') : t('settings.moduleNumberingDisabled'),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }

  rows = rows.filter(rowMatchesAllColumnFilters);

  const field = listSortField.value || 'label';
  const dir = listSortOrder.value === 'desc' ? -1 : 1;
  rows.sort((a, b) => {
    const av = a?.[field];
    const bv = b?.[field];
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    if (typeof av === 'boolean' && typeof bv === 'boolean') return ((av === bv) ? 0 : av ? 1 : -1) * dir;
    return String(av ?? '').localeCompare(String(bv ?? ''), undefined, { sensitivity: 'base' }) * dir;
  });
  return rows;
});

const listPagination = computed(() => ({
  currentPage: listPage.value,
  limit: listPerPage.value,
  totalRecords: filteredSortedConfigs.value.length,
  totalPages: Math.max(1, Math.ceil(filteredSortedConfigs.value.length / listPerPage.value)),
}));

const listRows = computed(() => {
  const start = (listPage.value - 1) * listPerPage.value;
  return filteredSortedConfigs.value.slice(start, start + listPerPage.value);
});

function handleListSearch(query) {
  listSearchQuery.value = typeof query === 'string' ? query : String(query || '');
  listPage.value = 1;
}

function handleListFilters(payload = {}) {
  listColumnFilters.value = payload && typeof payload === 'object' ? { ...payload } : {};
  listPage.value = 1;
}

function handleListSort({ sortField: field, sortOrder: order } = {}) {
  if (field) listSortField.value = field;
  if (order) listSortOrder.value = order;
}

function handleListPagination(p = {}) {
  if (p.currentPage) listPage.value = p.currentPage;
  if (p.limit) listPerPage.value = p.limit;
}

const livePreview = computed(() => {
  try {
    const format = String(form.value.format || '');
    if (!format.includes('{SEQ}')) return format || '—';
    const len = Math.max(1, Math.min(15, Number(form.value.sequenceLength) || 6));
    const current = Math.max(0, Number(form.value.currentSequence) || 0);
    const starting = Math.max(1, Number(form.value.startingSequence) || 1);
    const next = Math.max(current + 1, starting);
    const padded = String(next).padStart(len, '0');
    const now = new Date();
    const yyyy = String(now.getUTCFullYear());
    const yy = yyyy.slice(-2);
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    return format
      .replace(/\{PREFIX\}/g, form.value.prefix || '')
      .replace(/\{SUFFIX\}/g, form.value.suffix || '')
      .replace(/\{YYYY\}/g, yyyy)
      .replace(/\{YY\}/g, yy)
      .replace(/\{MM\}/g, mm)
      .replace(/\{DD\}/g, dd)
      .replace(/\{SEQ\}/g, padded);
  } catch {
    return '—';
  }
});

/** @param {unknown} separator */
function normalizeSeparator(separator) {
  if (separator === '/') return '/';
  if (separator === '') return '';
  return '-';
}

function buildFormatFromParts(mode, separator, prefix, suffix) {
  const sep = normalizeSeparator(separator);
  const parts = [];
  if (prefix || mode !== 'custom') parts.push('{PREFIX}');
  if (mode === 'year') parts.push('{YYYY}');
  if (mode === 'yearMonth') parts.push('{YYYY}', '{MM}');
  if (mode === 'yearMonthDay') parts.push('{YYYY}', '{MM}', '{DD}');
  parts.push('{SEQ}');
  if (suffix) parts.push('{SUFFIX}');
  return parts.join(sep);
}

function detectBuilderFromFormat(format, prefix, suffix) {
  const candidates = ['simple', 'year', 'yearMonth', 'yearMonthDay'];
  const seps = ['-', '/', ''];
  for (const sep of seps) {
    for (const mode of candidates) {
      if (buildFormatFromParts(mode, sep, prefix, suffix) === format) {
        return { mode, separator: sep };
      }
    }
  }
  // Also match literal prefix baked into format (e.g. ITM-{SEQ} or ITM{SEQ})
  const literalPrefix = String(prefix || '').trim();
  if (literalPrefix) {
    for (const sep of seps) {
      for (const mode of candidates) {
        const withToken = buildFormatFromParts(mode, sep, prefix, suffix);
        const withLiteral = withToken.replace('{PREFIX}', literalPrefix);
        if (withLiteral === format) {
          return { mode, separator: sep };
        }
      }
    }
  }
  const fallbackSep = String(format || '').includes('/') ? '/' : (String(format || '').includes('-') ? '-' : '');
  return { mode: 'custom', separator: fallbackSep };
}

function applyPreset(mode) {
  if (!mode) return;
  builder.value.mode = mode;
  showCustomFormat.value = false;
  form.value.format = buildFormatFromParts(
    mode,
    builder.value.separator,
    form.value.prefix,
    form.value.suffix
  );
}

function onBuilderFieldChange() {
  if (builder.value.mode === 'custom') return;
  form.value.format = buildFormatFromParts(
    builder.value.mode,
    builder.value.separator,
    form.value.prefix,
    form.value.suffix
  );
}

function onSeparatorChange(value) {
  builder.value.separator = normalizeSeparator(value);
  onBuilderFieldChange();
}

function onCustomFormatInput() {
  builder.value.mode = 'custom';
}

function toggleCustomFormat() {
  showCustomFormat.value = !showCustomFormat.value;
  if (showCustomFormat.value) {
    builder.value.mode = 'custom';
  }
}

function insertToken(token) {
  const input = formatInputRef.value;
  const current = String(form.value.format || '');
  if (input && typeof input.selectionStart === 'number') {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    form.value.format = `${current.slice(0, start)}${token}${current.slice(end)}`;
    nextTick(() => {
      const pos = start + token.length;
      input.focus();
      input.setSelectionRange(pos, pos);
    });
  } else {
    form.value.format = `${current}${token}`;
  }
  builder.value.mode = 'custom';
}

function presetExample(mode) {
  const prefix = form.value.prefix || 'ITM';
  const suffix = form.value.suffix || '';
  const sep = normalizeSeparator(builder.value.separator);
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const seq = '000001';
  const parts = [prefix];
  if (mode === 'year') parts.push(yyyy);
  if (mode === 'yearMonth') parts.push(yyyy, mm);
  if (mode === 'yearMonthDay') parts.push(yyyy, mm, dd);
  parts.push(seq);
  if (suffix) parts.push(suffix);
  return parts.join(sep);
}

function humanizeFieldKey(fieldKey) {
  const raw = String(fieldKey || '').trim();
  if (!raw) return '—';
  if (raw === 'item_code') return 'Item Code';
  if (raw === 'caseId') return 'Case ID';
  if (raw === 'assetId') return 'Asset ID';
  return raw
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\bId\b/g, 'ID')
    .replace(/^./, (c) => c.toUpperCase());
}

function serializeForm() {
  return JSON.stringify({
    enabled: form.value.enabled === true,
    format: String(form.value.format || ''),
    prefix: String(form.value.prefix || ''),
    suffix: String(form.value.suffix || ''),
    sequenceLength: Number(form.value.sequenceLength) || 6,
    startingSequence: Number(form.value.startingSequence) || 1,
    resetRule: String(form.value.resetRule || 'never'),
  });
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return formatUserDateTime(value);
  } catch {
    return '—';
  }
}

function onBack() {
  if (view.value === 'edit') {
    view.value = 'list';
    loadList();
    return;
  }
  emit('back');
}

async function loadList() {
  loading.value = true;
  loadError.value = '';
  try {
    const res = await apiClient.get('/settings/module-numbering');
    configs.value = Array.isArray(res?.configs) ? res.configs : [];
  } catch (e) {
    loadError.value = e?.message || t('settings.moduleNumberingLoadFailed');
  } finally {
    loading.value = false;
  }
}

async function openEdit(moduleKey) {
  loading.value = true;
  loadError.value = '';
  view.value = 'edit';
  try {
    const encoded = encodeURIComponent(moduleKey);
    const res = await apiClient.get(`/settings/module-numbering/${encoded}`);
    const c = res?.config || {};
    form.value = {
      moduleKey: c.moduleKey || moduleKey,
      label: c.label || moduleKey,
      numberFieldKey: c.numberFieldKey || '',
      numberFieldLabel: c.numberFieldLabel || '',
      enabled: c.enabled !== false,
      format: String(c.format || ''),
      prefix: String(c.prefix || ''),
      suffix: String(c.suffix || ''),
      sequenceLength: Number(c.sequenceLength) || 6,
      startingSequence: Number(c.startingSequence) || 1,
      currentSequence: Number(c.currentSequence) || 0,
      resetRule: String(c.resetRule || 'never'),
    };
    const detected = detectBuilderFromFormat(
      form.value.format,
      form.value.prefix,
      form.value.suffix
    );
    builder.value = detected;
    showCustomFormat.value = detected.mode === 'custom';
    savedSnapshot.value = serializeForm();
  } catch (e) {
    loadError.value = e?.message || t('settings.moduleNumberingLoadFailed');
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  if (!savedSnapshot.value) return;
  const snap = JSON.parse(savedSnapshot.value);
  Object.assign(form.value, snap);
  const detected = detectBuilderFromFormat(snap.format, snap.prefix, snap.suffix);
  builder.value = detected;
  showCustomFormat.value = detected.mode === 'custom';
  saveError.value = '';
}

async function save() {
  saving.value = true;
  saveError.value = '';
  try {
    if (builder.value.mode !== 'custom') {
      form.value.format = buildFormatFromParts(
        builder.value.mode,
        builder.value.separator,
        form.value.prefix,
        form.value.suffix
      );
    }
    if (!String(form.value.format).includes('{SEQ}')) {
      saveError.value = t('settings.moduleNumberingFormatNeedsSeq');
      return;
    }
    const encoded = encodeURIComponent(form.value.moduleKey);
    const payload = {
      enabled: form.value.enabled === true,
      format: String(form.value.format || ''),
      prefix: String(form.value.prefix || ''),
      suffix: String(form.value.suffix || ''),
      sequenceLength: Number(form.value.sequenceLength) || 6,
      startingSequence: Number(form.value.startingSequence) || 1,
      resetRule: String(form.value.resetRule || 'never'),
      confirmLowerStarting: true,
    };
    const res = await apiClient.put(`/settings/module-numbering/${encoded}`, payload);
    const c = res?.config || {};
    form.value.currentSequence = Number(c.currentSequence) || form.value.currentSequence;
    savedSnapshot.value = serializeForm();
  } catch (e) {
    saveError.value = e?.message || t('settings.moduleNumberingSaveFailed');
  } finally {
    saving.value = false;
  }
}

async function resync() {
  resyncing.value = true;
  saveError.value = '';
  try {
    const encoded = encodeURIComponent(form.value.moduleKey);
    const res = await apiClient.post(`/settings/module-numbering/${encoded}/resync-sequence`, {});
    form.value.currentSequence = Number(res?.currentSequence) || 0;
    const snap = savedSnapshot.value ? JSON.parse(savedSnapshot.value) : null;
    if (snap) {
      savedSnapshot.value = serializeForm();
    }
  } catch (e) {
    saveError.value = e?.message || t('settings.moduleNumberingResyncFailed');
  } finally {
    resyncing.value = false;
  }
}

watch(view, (v) => {
  if (v === 'list') {
    loadError.value = '';
    saveError.value = '';
  }
});

onMounted(loadList);
</script>
