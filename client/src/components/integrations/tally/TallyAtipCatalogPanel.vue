<template>
  <div class="space-y-4">
    <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">
            {{ t('settings.tallyCatalogTitle') }}
          </h2>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {{ t('settings.tallyCatalogDesc') }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-900"
            :disabled="loading || discovering || dumping"
            @click="refreshAll"
          >
            {{ loading ? t('states.loading') : t('actions.refresh') }}
          </button>
          <button
            type="button"
            class="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
            :disabled="!companyGuid || dumping || discovering || loading"
            @click="dumpLedgers"
          >
            {{ dumping ? t('states.loading') : t('settings.tallyLedgerDump') }}
          </button>
          <button
            type="button"
            class="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
            :disabled="!companyGuid || discovering || loading || dumping"
            @click="discover"
          >
            {{ discovering ? t('states.loading') : t('settings.tallyCatalogDiscover') }}
          </button>
        </div>
      </div>

      <p v-if="!companyGuid" class="mt-3 text-sm text-amber-700 dark:text-amber-300">
        {{ t('settings.tallyCompanyRequired') }}
      </p>
      <p v-if="message" class="mt-3 text-sm text-emerald-700 dark:text-emerald-300">{{ message }}</p>
      <p v-if="error" class="mt-3 text-sm text-red-700 dark:text-red-300">{{ error }}</p>
    </div>

    <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3 sm:px-6 dark:border-gray-700">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ t('settings.tallyLedgerDumpTitle') }}
          <span class="ml-2 font-normal text-gray-500">({{ ledgers.length }}{{ ledgerMeta.total != null ? ` / ${ledgerMeta.total}` : '' }})</span>
        </h3>
        <p class="text-xs text-gray-500">{{ t('settings.tallyLedgerDumpHint') }}</p>
      </div>
      <p
        v-if="!loadingLedgers && !ledgers.length"
        class="px-4 py-6 text-center text-sm text-gray-500 sm:px-6 dark:text-gray-400"
      >
        {{ t('settings.tallyLedgerDumpEmpty') }}
      </p>
      <p
        v-else-if="loadingLedgers && !ledgers.length"
        class="px-4 py-6 text-center text-sm text-gray-500 sm:px-6 dark:text-gray-400"
      >
        {{ t('states.loading') }}
      </p>
      <ul v-else-if="ledgers.length" class="divide-y divide-gray-100 dark:divide-gray-700">
        <li v-for="row in ledgers" :key="row._id || row.externalId" class="px-4 py-3 sm:px-6">
          <button
            type="button"
            class="flex w-full items-start justify-between gap-3 text-left"
            @click="toggleLedger(row._id || row.externalId)"
          >
            <div class="min-w-0">
              <div class="text-sm font-medium text-gray-900 dark:text-white">
                {{ row.name || '—' }}
              </div>
              <div class="mt-0.5 text-xs text-gray-500">
                <span v-if="row.parent">{{ row.parent }} · </span>
                {{ LEDGER_DISPLAY_FIELDS.length }} {{ t('settings.tallyCatalogFields') }}
              </div>
            </div>
            <span class="shrink-0 text-xs text-gray-500">
              {{ expandedLedgers[row._id || row.externalId] ? '▾' : '▸' }}
            </span>
          </button>
          <div v-if="expandedLedgers[row._id || row.externalId]" class="mt-3 space-y-3">
            <div
              v-for="field in ledgerDisplayRows(row)"
              :key="field.label"
              class="grid grid-cols-[minmax(10rem,16rem)_1fr] gap-2 rounded border border-gray-100 px-2 py-1.5 text-xs dark:border-gray-700"
            >
              <span class="font-medium text-gray-600 dark:text-gray-300">{{ field.label }}</span>
              <span class="break-all text-gray-900 dark:text-gray-100">{{ field.value }}</span>
            </div>
            <details class="rounded-lg border border-gray-200 dark:border-gray-700">
              <summary class="cursor-pointer px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                {{ t('settings.tallyCatalogRawJson') }}
              </summary>
              <pre class="max-h-64 overflow-auto border-t border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">{{ formatJson(row.values) }}</pre>
            </details>
          </div>
        </li>
      </ul>
    </div>

    <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div class="border-b border-gray-200 px-4 py-3 sm:px-6 dark:border-gray-700">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ t('settings.tallyCatalogObjects') }}
          <span class="ml-2 font-normal text-gray-500">({{ objects.length }})</span>
        </h3>
      </div>

      <p
        v-if="!loading && !objects.length"
        class="px-4 py-8 text-center text-sm text-gray-500 sm:px-6 dark:text-gray-400"
      >
        {{ t('settings.tallyCatalogEmpty') }}
      </p>

      <ul v-else class="divide-y divide-gray-100 dark:divide-gray-700">
        <li v-for="obj in objects" :key="obj.objectKey || obj._id" class="px-4 py-3 sm:px-6">
          <button
            type="button"
            class="flex w-full items-start justify-between gap-3 text-left"
            @click="toggle(obj.objectKey)"
          >
            <div class="min-w-0">
              <div class="text-sm font-medium text-gray-900 dark:text-white">
                {{ obj.objectName || obj.objectKey }}
              </div>
              <div class="mt-0.5 text-xs text-gray-500">
                {{ obj.objectKey }}
                <span v-if="obj.collectionName"> · {{ obj.collectionName }}</span>
                <span v-if="obj.supportTier"> · {{ obj.supportTier }}</span>
              </div>
            </div>
            <span class="shrink-0 text-xs text-gray-500">
              {{ (obj.fields || []).length }} {{ t('settings.tallyCatalogFields') }}
              {{ expanded[obj.objectKey] ? '▾' : '▸' }}
            </span>
          </button>

          <div v-if="expanded[obj.objectKey]" class="mt-3 space-y-3">
            <div
              v-if="!(obj.fields || []).length"
              class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
            >
              {{ t('settings.tallyCatalogNoFields') }}
            </div>
            <template v-else>
              <section class="space-y-1.5">
                <h4 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {{ t('settings.tallyCatalogStandardFields') }}
                  <span class="font-normal normal-case tracking-normal">
                    ({{ partitionFields(obj.fields).standard.length }})
                  </span>
                </h4>
                <p
                  v-if="!partitionFields(obj.fields).standard.length"
                  class="text-xs text-gray-500"
                >
                  {{ t('settings.tallyCatalogSectionEmpty') }}
                </p>
                <div
                  v-for="f in partitionFields(obj.fields).standard"
                  :key="`std-${f.name || f}`"
                  class="rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-700"
                  :style="{ marginLeft: `${fieldDepth(f) * 12}px` }"
                >
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-mono text-xs font-medium text-gray-900 dark:text-gray-100">
                      {{ f.name || f }}
                    </span>
                    <span
                      v-if="f.isList || f.dataType === 'list' || String(f.name || '').endsWith('.*')"
                      class="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                    >
                      {{ t('settings.tallyCatalogList') }}
                    </span>
                  </div>
                  <div
                    v-if="fieldSamples(f).length"
                    class="mt-1.5 flex flex-wrap gap-1"
                  >
                    <span
                      v-for="(s, i) in fieldSamples(f)"
                      :key="`${f.name}-${i}`"
                      class="max-w-full truncate rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
                      :title="s"
                    >
                      {{ s }}
                    </span>
                  </div>
                  <p
                    v-else-if="f.isList || f.dataType === 'list' || String(f.name || '').endsWith('.*')"
                    class="mt-1 text-[11px] text-gray-500"
                  >
                    {{
                      hasNestedChildren(obj.fields, f.name)
                        ? t('settings.tallyCatalogListHasChildren')
                        : t('settings.tallyCatalogListEmpty')
                    }}
                  </p>
                </div>
              </section>

              <section class="space-y-1.5 border-t border-gray-100 pt-3 dark:border-gray-700">
                <h4 class="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  {{ t('settings.tallyCatalogUserSpace') }}
                  <span class="font-normal normal-case tracking-normal text-gray-500 dark:text-gray-400">
                    ({{ partitionFields(obj.fields).userSpace.length }})
                  </span>
                </h4>
                <p
                  v-if="!partitionFields(obj.fields).userSpace.length"
                  class="text-xs text-gray-500"
                >
                  {{ t('settings.tallyCatalogUserSpaceEmpty') }}
                </p>
                <div
                  v-for="f in partitionFields(obj.fields).userSpace"
                  :key="`udf-${f.name || f}`"
                  class="rounded-lg border border-amber-100 bg-amber-50/40 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-950/20"
                  :style="{ marginLeft: `${fieldDepth(f) * 12}px` }"
                >
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-mono text-xs font-medium text-gray-900 dark:text-gray-100">
                      {{ f.name || f }}
                    </span>
                    <span
                      class="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
                    >
                      UDF
                    </span>
                    <span
                      v-if="f.isList || f.dataType === 'list' || String(f.name || '').endsWith('.*')"
                      class="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                    >
                      {{ t('settings.tallyCatalogList') }}
                    </span>
                  </div>
                  <div
                    v-if="fieldSamples(f).length"
                    class="mt-1.5 flex flex-wrap gap-1"
                  >
                    <span
                      v-for="(s, i) in fieldSamples(f)"
                      :key="`${f.name}-${i}`"
                      class="max-w-full truncate rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
                      :title="s"
                    >
                      {{ s }}
                    </span>
                  </div>
                  <p
                    v-else-if="f.isList || f.dataType === 'list' || String(f.name || '').endsWith('.*')"
                    class="mt-1 text-[11px] text-gray-500"
                  >
                    {{
                      hasNestedChildren(obj.fields, f.name)
                        ? t('settings.tallyCatalogListHasChildren')
                        : t('settings.tallyCatalogListEmpty')
                    }}
                  </p>
                </div>
              </section>
            </template>
            <details class="rounded-lg border border-gray-200 dark:border-gray-700">
              <summary class="cursor-pointer px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                {{ t('settings.tallyCatalogRawJson') }}
              </summary>
              <pre class="max-h-64 overflow-auto border-t border-gray-200 bg-gray-50 p-3 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">{{ formatJson(obj) }}</pre>
            </details>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  companyGuid: { type: String, default: '' },
});

const { t } = useI18n();
const objects = ref([]);
const ledgers = ref([]);
const ledgerMeta = ref({});
const loading = ref(false);
const loadingLedgers = ref(false);
const discovering = ref(false);
const dumping = ref(false);
const error = ref('');
const message = ref('');
const expanded = ref({});
const expandedLedgers = ref({});

/** Curated Tally ledger columns (UI labels → XML keys). */
const LEDGER_DISPLAY_FIELDS = [
  { label: 'Ledger Name', keys: ['NAME', 'name'] },
  { label: 'Company Name', keys: ['MAILINGNAME', 'COMPANYNAME', '_companyName'] },
  { label: 'Ledger Group', keys: ['PARENT', 'parent'] },
  { label: 'Mailing Address', keys: ['ADDRESS', 'address'], mode: 'addressJoin' },
  { label: 'Mailing Country', keys: ['COUNTRYNAME', 'COUNTRY', 'COUNTRYOFRESIDENCE'] },
  {
    label: 'Mailing State',
    keys: ['LEDSTATENAME', 'LEDGERSTATENAME', 'STATENAME', 'PRIORSTATENAME', 'STATECODE', 'STATE', 'PLACEOFSUPPLY'],
  },
  { label: 'First Address of Multiple Addresses', keys: ['ADDRESS', 'address'], mode: 'addressFirst' },
  { label: 'Pincode', keys: ['PINCODE', 'PINCODENUMBER', 'PIN'] },
  { label: 'Phone no', keys: ['LEDGERPHONE', 'PHONE', 'PHONENUMBER'] },
  { label: 'Fax', keys: ['FAX', 'LEDGERFAX', 'FAXNUMBER'] },
  { label: 'Mobile no', keys: ['LEDGERMOBILE', 'MOBILE', 'MOBILENUMBERS', 'MOBILENUMBER'] },
  { label: 'GSTIN/UIN', keys: ['PARTYGSTIN', 'GSTIN', 'GSTINNUMBER', 'GSTREGISTRATION'] },
  { label: 'PAN/IT no', keys: ['INCOMETAXNUMBER', 'PAN'] },
  { label: 'Specify Credit Limit', keys: ['CREDITLIMIT'] },
  { label: 'Credit Period', keys: ['BILLCREDITPERIOD', 'CREDITPERIOD', 'BILLWISECREDITPERIOD'] },
  { label: 'Outstanding Balance of the Ledger', keys: ['CLOSINGBALANCE', 'CLOSINGBAL'] },
  { label: 'Email', keys: ['EMAIL', 'EMAILID'] },
  { label: 'Email CC', keys: ['EMAILCC', 'CC'] },
  { label: 'Website', keys: ['WEBSITE', 'URL'] },
  { label: 'Description', keys: ['NARRATION', 'DESCRIPTION', 'NOTES'] },
];

function formatJson(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

function formatValue(v) {
  if (v == null || v === '') return '—';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** Flatten nested dump values so GSTDETAILS.GSTIN etc. are findable. */
function flattenScalars(values) {
  const out = {};
  function walk(node) {
    if (node == null) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node)) {
      const key = String(k).toUpperCase();
      if (v == null || v === '') continue;
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        const s = String(v).replace(/\s+/g, ' ').trim();
        if (s && (out[key] == null || out[key] === '')) out[key] = s;
      } else {
        walk(v);
      }
    }
  }
  walk(values);
  return out;
}

function pickRaw(values, keys) {
  const src = values || {};
  const flat = flattenScalars(src);
  for (const key of keys) {
    if (src[key] != null && src[key] !== '') return src[key];
    const upper = String(key).toUpperCase();
    if (src[upper] != null && src[upper] !== '') return src[upper];
    if (flat[upper] != null && flat[upper] !== '') return flat[upper];
  }
  return null;
}

function addressLines(raw) {
  if (raw == null || raw === '') return [];
  if (Array.isArray(raw)) {
    return raw
      .flatMap((item) => {
        if (item == null) return [];
        if (typeof item === 'string' || typeof item === 'number') return [String(item)];
        if (typeof item === 'object') {
          if (item.ADDRESS != null) return addressLines(item.ADDRESS);
          return [formatValue(item)].filter((s) => s && s !== '—');
        }
        return [];
      })
      .map((s) => String(s).replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  }
  if (typeof raw === 'object') {
    if (raw.ADDRESS != null) return addressLines(raw.ADDRESS);
    return [formatValue(raw)].filter((s) => s && s !== '—');
  }
  return String(raw)
    .split(/\n|,/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function resolveLedgerField(values, field) {
  const raw = pickRaw(values, field.keys);
  if (field.mode === 'addressJoin') {
    const lines = addressLines(raw);
    return lines.length ? lines.join(', ') : '—';
  }
  if (field.mode === 'addressFirst') {
    const lines = addressLines(raw);
    return lines[0] || '—';
  }
  return formatValue(raw);
}

function ledgerDisplayRows(row) {
  const values = row?.values || {};
  return LEDGER_DISPLAY_FIELDS.map((field) => ({
    label: field.label,
    value: resolveLedgerField(values, field),
  }));
}

function fieldSamples(f) {
  if (!f || typeof f === 'string') return [];
  const raw = f.sampleValues || f.samples || [];
  return Array.isArray(raw) ? raw.filter(Boolean).slice(0, 5) : [];
}

function sortedFields(fields) {
  return [...(fields || [])]
    .map((f) => (typeof f === 'string' ? { name: f } : f))
    .filter((f) => f.name)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

/** Tally User Space / UDF tags: UDF:… or nested …UDF:… */
function isUserSpaceField(f) {
  return /(^|\.)UDF:/i.test(String(f?.name || f || ''));
}

function partitionFields(fields) {
  const all = sortedFields(fields);
  return {
    standard: all.filter((f) => !isUserSpaceField(f)),
    userSpace: all.filter((f) => isUserSpaceField(f)),
  };
}

/** Indent nested paths (ADDRESS.*.ADDRESS under ADDRESS.*). */
function fieldDepth(f) {
  const name = String(f?.name || f || '');
  return (name.match(/\./g) || []).length;
}

function hasNestedChildren(fields, parentName) {
  const prefix = `${parentName}.`;
  return (fields || []).some((f) => {
    const n = typeof f === 'string' ? f : f.name;
    return n && n.startsWith(prefix);
  });
}

function toggle(key) {
  expanded.value = { ...expanded.value, [key]: !expanded.value[key] };
}

function toggleLedger(key) {
  expandedLedgers.value = { ...expandedLedgers.value, [key]: !expandedLedgers.value[key] };
}

async function load() {
  if (!props.companyGuid) {
    objects.value = [];
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const q = encodeURIComponent(props.companyGuid);
    const res = await apiClient.get(`/connectors/tally/atip/metadata/objects?companyGuid=${q}`);
    const data = res?.data ?? res;
    objects.value = Array.isArray(data) ? data : data?.data || data?.objects || [];
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('settings.tallyLoadFailed');
    objects.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadLedgers() {
  if (!props.companyGuid) {
    ledgers.value = [];
    ledgerMeta.value = {};
    return;
  }
  loadingLedgers.value = true;
  try {
    const q = encodeURIComponent(props.companyGuid);
    const res = await apiClient.get(`/connectors/tally/atip/ledgers?companyGuid=${q}&limit=500`);
    const data = res?.data ?? res;
    ledgers.value = Array.isArray(data) ? data : data?.data || [];
    ledgerMeta.value = res?.meta || data?.meta || {};
  } catch (err) {
    ledgers.value = [];
    ledgerMeta.value = {};
    if (!error.value) {
      error.value = err?.response?.data?.message || err?.message || t('settings.tallyLoadFailed');
    }
  } finally {
    loadingLedgers.value = false;
  }
}

async function refreshAll() {
  await Promise.all([load(), loadLedgers()]);
}

async function discover() {
  if (!props.companyGuid) return;
  discovering.value = true;
  error.value = '';
  message.value = '';
  try {
    await apiClient.post('/connectors/tally/atip/metadata/discover', {
      companyGuid: props.companyGuid,
    });
    message.value = t('settings.tallyCatalogDiscoverQueued');
    for (let i = 0; i < 8; i += 1) {
      await new Promise((r) => setTimeout(r, 2000));
      await load();
      if (objects.value.length) break;
    }
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('settings.tallyCatalogDiscoverFailed');
  } finally {
    discovering.value = false;
  }
}

async function dumpLedgers() {
  if (!props.companyGuid) return;
  dumping.value = true;
  error.value = '';
  message.value = '';
  try {
    await apiClient.post('/connectors/tally/atip/ledgers/dump', {
      companyGuid: props.companyGuid,
    });
    message.value = t('settings.tallyLedgerDumpQueued');
    for (let i = 0; i < 15; i += 1) {
      await new Promise((r) => setTimeout(r, 2000));
      await loadLedgers();
      if (ledgers.value.length) break;
    }
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('settings.tallyLedgerDumpFailed');
  } finally {
    dumping.value = false;
  }
}

watch(
  () => props.companyGuid,
  () => {
    expanded.value = {};
    expandedLedgers.value = {};
    refreshAll();
  }
);

onMounted(refreshAll);
</script>
