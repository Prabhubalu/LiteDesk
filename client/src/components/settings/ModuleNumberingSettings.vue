<template>
  <SettingsScrollPanel content-class="max-w-none w-full" :save-bar-visible="view === 'edit' && !loading && !loadError && hasChanges">
    <template #header>
      <div>
        <button
          type="button"
          class="text-sm text-indigo-600 dark:text-indigo-400 hover:underline mb-2"
          @click="onBack"
        >
          {{ t('actions.back') }}
        </button>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
          {{ view === 'edit' ? (form.label || form.moduleKey) : t('settings.automationModuleNumbering') }}
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {{ view === 'edit' ? t('settings.moduleNumberingEditDesc') : t('settings.automationModuleNumberingDesc') }}
        </p>
      </div>
    </template>

    <div v-if="loadError" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
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
    <form v-else class="space-y-6" @submit.prevent="save">
      <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('settings.moduleNumberingModule') }}</label>
          <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ form.label || form.moduleKey }}</p>
          <p v-if="form.numberFieldLabel || form.numberFieldKey" class="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {{ t('settings.moduleNumberingColField') }}:
            <span class="font-medium text-gray-900 dark:text-white">{{ form.numberFieldLabel || humanizeFieldKey(form.numberFieldKey) }}</span>
          </p>
        </div>

        <label class="flex items-start gap-3 cursor-pointer">
          <input v-model="form.enabled" type="checkbox" class="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
          <span class="text-sm text-gray-700 dark:text-gray-200">
            <span class="font-medium text-gray-900 dark:text-white block">{{ t('settings.moduleNumberingAuto') }}</span>
            <span class="text-gray-500 dark:text-gray-400">{{ t('settings.moduleNumberingAutoHint') }}</span>
          </span>
        </label>

        <!-- Easy format builder -->
        <div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-900/40 space-y-4">
          <div>
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.moduleNumberingPatternTitle') }}</h3>
            <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.moduleNumberingPatternHelp') }}</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              v-for="preset in formatPresets"
              :key="preset.id"
              type="button"
              class="rounded-lg border px-3 py-2.5 text-left transition-colors"
              :class="activePresetId === preset.id
                ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500 dark:border-indigo-400 dark:bg-indigo-950/40'
                : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800'"
              @click="applyPreset(preset.id)"
            >
              <span class="block text-sm font-medium text-gray-900 dark:text-white">{{ t(preset.labelKey) }}</span>
              <span class="mt-0.5 block font-mono text-xs text-indigo-600 dark:text-indigo-300">{{ presetExample(preset.id) }}</span>
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{{ t('settings.moduleNumberingPrefix') }}</label>
              <input
                v-model="form.prefix"
                type="text"
                maxlength="32"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                :placeholder="t('settings.moduleNumberingPrefixPh')"
                @input="onBuilderFieldChange"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{{ t('settings.moduleNumberingSuffix') }}</label>
              <input
                v-model="form.suffix"
                type="text"
                maxlength="32"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                :placeholder="t('settings.moduleNumberingSuffixPh')"
                @input="onBuilderFieldChange"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{{ t('settings.moduleNumberingSeparator') }}</label>
              <select
                v-model="builder.separator"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                :disabled="builder.mode === 'custom'"
                @change="onBuilderFieldChange"
              >
                <option value="-">{{ t('settings.moduleNumberingSepDash') }}</option>
                <option value="/">{{ t('settings.moduleNumberingSepSlash') }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{{ t('settings.moduleNumberingPreview') }}</label>
              <p class="rounded-lg border border-dashed border-indigo-300 bg-white px-3 py-2 font-mono text-sm text-indigo-700 dark:border-indigo-700 dark:bg-gray-900 dark:text-indigo-300">
                {{ livePreview }}
              </p>
            </div>
          </div>

          <div>
            <button
              type="button"
              class="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              @click="toggleCustomFormat"
            >
              {{ showCustomFormat ? t('settings.moduleNumberingHideCustom') : t('settings.moduleNumberingShowCustom') }}
            </button>
            <div v-if="showCustomFormat" class="mt-3 space-y-2">
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.moduleNumberingCustomHelp') }}</p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="token in formatTokens"
                  :key="token.value"
                  type="button"
                  class="rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-xs text-gray-700 hover:border-indigo-400 hover:text-indigo-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
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
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                @input="onCustomFormatInput"
              />
            </div>
            <p v-else class="mt-2 font-mono text-xs text-gray-500 dark:text-gray-400">
              {{ t('settings.moduleNumberingFormatLabel') }}: {{ form.format }}
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{{ t('settings.moduleNumberingSeqLength') }}</label>
            <input v-model.number="form.sequenceLength" type="number" min="1" max="15" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
            <p class="mt-1 text-xs text-gray-500">{{ t('settings.moduleNumberingSeqLengthHint') }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{{ t('settings.moduleNumberingStarting') }}</label>
            <input v-model.number="form.startingSequence" type="number" min="1" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{{ t('settings.moduleNumberingCurrent') }}</label>
            <p class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white">
              {{ form.currentSequence ?? 0 }}
            </p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{{ t('settings.moduleNumberingReset') }}</label>
            <select v-model="form.resetRule" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white">
              <option value="never">{{ t('settings.moduleNumberingResetNever') }}</option>
              <option value="daily">{{ t('settings.moduleNumberingResetDaily') }}</option>
              <option value="monthly">{{ t('settings.moduleNumberingResetMonthly') }}</option>
              <option value="yearly">{{ t('settings.moduleNumberingResetYearly') }}</option>
            </select>
          </div>
        </div>

        <label class="flex items-start gap-3 cursor-pointer">
          <input v-model="form.allowManualEdit" type="checkbox" class="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
          <span class="text-sm text-gray-700 dark:text-gray-200">
            <span class="font-medium text-gray-900 dark:text-white block">{{ t('settings.moduleNumberingManual') }}</span>
            <span class="text-gray-500 dark:text-gray-400">{{ t('settings.moduleNumberingManualHint') }}</span>
          </span>
        </label>
      </section>

      <div>
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600 disabled:opacity-50"
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
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import SettingsSaveBar from '@/components/settings/SettingsSaveBar.vue';
import ListView from '@/components/common/ListView.vue';
import apiClient from '@/utils/apiClient';

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
  allowManualEdit: false,
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
    dataType: 'text',
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
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }

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

function buildFormatFromParts(mode, separator, prefix, suffix) {
  const sep = separator === '/' ? '/' : '-';
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
  const sep = String(format || '').includes('/') ? '/' : '-';
  const candidates = ['simple', 'year', 'yearMonth', 'yearMonthDay'];
  for (const mode of candidates) {
    if (buildFormatFromParts(mode, sep, prefix, suffix) === format) {
      return { mode, separator: sep };
    }
  }
  // Also match literal prefix baked into format (e.g. ITM-{SEQ})
  const literalPrefix = String(prefix || '').trim();
  if (literalPrefix) {
    for (const mode of candidates) {
      const withToken = buildFormatFromParts(mode, sep, prefix, suffix);
      const withLiteral = withToken.replace('{PREFIX}', literalPrefix);
      if (withLiteral === format) {
        return { mode, separator: sep };
      }
    }
  }
  return { mode: 'custom', separator: sep };
}

function applyPreset(mode) {
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
  const sep = builder.value.separator === '/' ? '/' : '-';
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
    allowManualEdit: form.value.allowManualEdit === true,
  });
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
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
      allowManualEdit: c.allowManualEdit === true,
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
      allowManualEdit: form.value.allowManualEdit === true,
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
    // Keep snapshot in sync so resync alone does not trip dirty state
    const snap = savedSnapshot.value ? JSON.parse(savedSnapshot.value) : null;
    if (snap) {
      // currentSequence is display-only / server-owned; refresh snapshot after resync
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
