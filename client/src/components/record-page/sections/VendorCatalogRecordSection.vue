<!--
  Vendor Catalog on Organization record page.
  Always-on editor when permitted; debounced auto-save (no duplicate section title).
-->
<template>
  <div class="vendor-catalog-record-section space-y-3">
    <div v-if="loading" class="flex justify-center py-10">
      <div class="h-7 w-7 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
    </div>

    <div
      v-else-if="error"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
    >
      {{ error }}
    </div>

    <!-- Editable + auto-save -->
    <VendorCatalogSection
      v-else-if="canEdit"
      ref="editorRef"
      v-model="draftLines"
      hide-header
      :disabled="false"
      :vendor-id="vendorId()"
      :status-text="statusLabel"
      :status-tone="statusTone"
      @update:model-value="onDraftChange"
      @import-done="onImportDone"
    />

    <!-- Read-only -->
    <template v-else>
      <div
        v-if="!entries.length"
        class="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-4 py-10 text-center dark:border-gray-700 dark:bg-gray-800/40"
      >
        <CubeIcon class="mx-auto size-8 text-gray-300 dark:text-gray-600" aria-hidden="true" />
        <p class="mt-2 text-sm font-medium text-gray-900 dark:text-white">
          {{ t('organizations.vendorCatalogEmptyTitle') }}
        </p>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {{ t('organizations.vendorCatalogEmpty') }}
        </p>
      </div>

      <div
        v-else
        class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700"
      >
        <table class="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-800/80">
            <tr class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <th class="px-3 py-2.5 font-medium">{{ t('organizations.vendorCatalogColItem') }}</th>
              <th class="px-3 py-2.5 font-medium whitespace-nowrap">
                {{ t('organizations.vendorCatalogColVendorCode') }}
              </th>
              <th class="px-3 py-2.5 font-medium whitespace-nowrap">
                {{ t('organizations.vendorCatalogColVendorName') }}
              </th>
              <th class="px-3 py-2.5 font-medium whitespace-nowrap">
                {{ t('organizations.vendorCatalogColPurchasePrice') }}
              </th>
              <th class="px-3 py-2.5 font-medium whitespace-nowrap">
                {{ t('organizations.vendorCatalogColMoq') }}
              </th>
              <th class="px-3 py-2.5 font-medium whitespace-nowrap">
                {{ t('organizations.vendorCatalogColLeadTime') }}
              </th>
              <th class="px-3 py-2.5 font-medium whitespace-nowrap">
                {{ t('organizations.vendorCatalogColPreferred') }}
              </th>
              <th class="px-3 py-2.5 font-medium whitespace-nowrap">
                {{ t('organizations.vendorCatalogColLastPrice') }}
              </th>
              <th class="px-3 py-2.5 font-medium whitespace-nowrap">
                {{ t('organizations.vendorCatalogColLastDate') }}
              </th>
              <th class="px-3 py-2.5 font-medium">{{ t('organizations.vendorCatalogColStatus') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
            <tr v-for="row in entries" :key="String(row._id || row.variantId)">
              <td class="px-3 py-2.5">
                <div class="font-medium text-gray-900 dark:text-white">
                  {{ row.itemName || '—' }}
                </div>
                <div
                  v-if="row.variantCode || row.itemCode"
                  class="text-xs text-gray-500 dark:text-gray-400 font-mono"
                >
                  {{ [row.variantCode, row.itemCode].filter(Boolean).join(' · ') }}
                </div>
              </td>
              <td class="px-3 py-2.5 text-gray-700 dark:text-gray-300">
                {{ row.vendorItemCode || '—' }}
              </td>
              <td class="px-3 py-2.5 text-gray-700 dark:text-gray-300">
                {{ row.vendorItemName || '—' }}
              </td>
              <td class="px-3 py-2.5 tabular-nums text-gray-900 dark:text-white whitespace-nowrap">
                {{ formatPrice(row.purchasePrice, row.currency) }}
              </td>
              <td class="px-3 py-2.5 tabular-nums text-gray-700 dark:text-gray-300">
                {{ row.minOrderQty != null ? row.minOrderQty : '—' }}
              </td>
              <td class="px-3 py-2.5 tabular-nums text-gray-700 dark:text-gray-300">
                {{ row.leadTimeDays != null ? row.leadTimeDays : '—' }}
              </td>
              <td class="px-3 py-2.5 text-center text-gray-700 dark:text-gray-300">
                {{ row.preferredVendor ? '✓' : '—' }}
              </td>
              <td class="px-3 py-2.5 tabular-nums text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {{ formatPrice(row.lastPurchasePrice, row.currency) }}
              </td>
              <td class="px-3 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {{ formatDate(row.lastPurchaseDate) }}
              </td>
              <td class="px-3 py-2.5">
                <span
                  class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
                  :class="
                    row.status === 'Inactive'
                      ? 'bg-gray-50 text-gray-600 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600'
                      : 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800'
                  "
                >
                  {{
                    row.status === 'Inactive'
                      ? t('organizations.vendorCatalogStatusInactive')
                      : t('organizations.vendorCatalogStatusActive')
                  }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { CubeIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import VendorCatalogSection from '@/components/organizations/VendorCatalogSection.vue';

const props = defineProps({
  record: { type: Object, default: null },
  context: { type: Object, default: () => ({}) }
});

const { t, d } = useI18n();

const loading = ref(false);
const error = ref('');
const entries = ref([]);
const draftLines = ref([]);
const editorRef = ref(null);

const saveState = ref('idle'); // idle | pending | saving | saved | error
const saveError = ref('');
const lastSavedFingerprint = ref('');
const catalogRevision = ref(null);
let saveTimer = null;
let savedClearTimer = null;
let readyForAutosave = false;
let saveInFlight = false;
let resaveAfterFlight = false;

const canEdit = computed(
  () =>
    props.context?.canEditVendorCatalog === true ||
    props.context?.canEdit === true
);

const statusLabel = computed(() => {
  if (saveState.value === 'saving' || saveState.value === 'pending') {
    return t('organizations.vendorCatalogSaving');
  }
  if (saveState.value === 'saved') {
    return t('organizations.vendorCatalogAutosaved');
  }
  if (saveState.value === 'error') {
    return saveError.value || t('organizations.vendorCatalogSaveFailed');
  }
  return '';
});

const statusTone = computed(() => {
  if (saveState.value === 'saving' || saveState.value === 'pending') return 'busy';
  if (saveState.value === 'saved') return 'success';
  if (saveState.value === 'error') return 'error';
  return 'muted';
});

function vendorId() {
  const r = props.record;
  if (!r) return '';
  return String(r._id || r.id || '').trim();
}

function formatPrice(value, currency) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: (currency || 'USD').toUpperCase(),
      maximumFractionDigits: 2
    }).format(n);
  } catch {
    return String(n);
  }
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return d(new Date(value), 'short');
  } catch {
    return String(value).slice(0, 10);
  }
}

function toDraft(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    _id: row._id || row.id || null,
    variantId: row.variantId ? String(row.variantId) : null,
    itemId: row.itemId ? String(row.itemId) : null,
    itemName: row.itemName || null,
    itemCode: row.itemCode || null,
    variantCode: row.variantCode || null,
    vendorItemCode: row.vendorItemCode || '',
    vendorItemName: row.vendorItemName || '',
    purchasePrice: Number(row.purchasePrice) || 0,
    currency: row.currency || 'USD',
    lastPurchasePrice: row.lastPurchasePrice ?? null,
    lastPurchaseDate: row.lastPurchaseDate ?? null,
    status: row.status === 'Inactive' ? 'Inactive' : 'Active'
  }));
}

function fingerprint(rows) {
  const list = (Array.isArray(rows) ? rows : [])
    .filter((r) => r.variantId)
    .map((r) => ({
      v: String(r.variantId),
      c: String(r.vendorItemCode || ''),
      n: String(r.vendorItemName || ''),
      p: Number(r.purchasePrice) || 0,
      s: r.status === 'Inactive' ? 'Inactive' : 'Active',
      cur: String(r.currency || 'USD')
    }))
    .sort((a, b) => a.v.localeCompare(b.v));
  return JSON.stringify(list);
}

function resolvePayload() {
  const fromChild = editorRef.value?.getEntries?.();
  if (Array.isArray(fromChild)) return fromChild;
  return (Array.isArray(draftLines.value) ? draftLines.value : []).filter((r) => r.variantId);
}

function scheduleAutosave() {
  if (!readyForAutosave || !canEdit.value) return;
  const id = vendorId();
  if (!id) return;

  const fp = fingerprint(resolvePayload());
  if (fp === lastSavedFingerprint.value) {
    if (saveState.value === 'pending') saveState.value = 'idle';
    return;
  }

  saveState.value = 'pending';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void flushAutosave();
  }, 700);
}

async function flushAutosave() {
  const id = vendorId();
  if (!id || !canEdit.value) return;

  const payload = resolvePayload();
  const fp = fingerprint(payload);
  if (fp === lastSavedFingerprint.value) {
    saveState.value = 'idle';
    return;
  }

  if (saveInFlight) {
    resaveAfterFlight = true;
    saveState.value = 'pending';
    return;
  }

  saveInFlight = true;
  saveState.value = 'saving';
  saveError.value = '';
  try {
    const body = {
      entries: payload
    };
    if (catalogRevision.value) {
      body.expectedRevision = catalogRevision.value;
    }
    const res = await apiClient.put(`/organizations/${id}/vendor-catalog`, body);
    if (res?.success === false) {
      throw new Error(res?.message || t('organizations.vendorCatalogSaveFailed'));
    }
    const data = res?.data ?? res;
    const next = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
    if (res?.revision) catalogRevision.value = res.revision;
    // In-place sync only — do not rewrite draftLines / remount rows (that jumps scroll).
    entries.value = next;
    editorRef.value?.applyServerState?.(next);
    lastSavedFingerprint.value = fingerprint(payload);
    saveState.value = 'saved';
    clearTimeout(savedClearTimer);
    savedClearTimer = setTimeout(() => {
      if (saveState.value === 'saved') saveState.value = 'idle';
    }, 2000);
  } catch (e) {
    const code = e?.response?.data?.code || e?.code;
    if (code === 'CONFLICT' || e?.status === 409 || e?.response?.status === 409) {
      saveError.value = t('organizations.vendorCatalogConflict');
      saveState.value = 'error';
      // Offer reload of server truth without force-overwrite
      void load({ soft: true });
    } else {
      saveError.value =
        e?.response?.data?.message || e?.message || t('organizations.vendorCatalogSaveFailed');
      saveState.value = 'error';
    }
  } finally {
    saveInFlight = false;
    if (resaveAfterFlight) {
      resaveAfterFlight = false;
      scheduleAutosave();
    }
  }
}

function onDraftChange() {
  scheduleAutosave();
}

function onImportDone({ entries: rows, revision } = {}) {
  readyForAutosave = false;
  const list = Array.isArray(rows) ? rows : [];
  entries.value = list;
  draftLines.value = toDraft(list);
  lastSavedFingerprint.value = fingerprint(list);
  if (revision) catalogRevision.value = revision;
  saveState.value = 'saved';
  clearTimeout(savedClearTimer);
  savedClearTimer = setTimeout(() => {
    if (saveState.value === 'saved') saveState.value = 'idle';
  }, 2000);
  requestAnimationFrame(() => {
    readyForAutosave = true;
  });
}

async function load(options = {}) {
  const id = vendorId();
  if (!id) {
    entries.value = [];
    draftLines.value = [];
    catalogRevision.value = null;
    return;
  }
  if (!options.soft) {
    loading.value = true;
    error.value = '';
    readyForAutosave = false;
  }
  try {
    const res = await apiClient.get(`/organizations/${id}/vendor-catalog`, {
      params: { includeInactive: true }
    });
    const data = res?.data ?? res;
    const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
    if (res?.revision) catalogRevision.value = res.revision;
    else {
      // Fallback: max updatedAt from rows
      let maxMs = 0;
      for (const r of rows) {
        const ms = r?.updatedAt ? Date.parse(r.updatedAt) : 0;
        if (ms > maxMs) maxMs = ms;
      }
      catalogRevision.value = maxMs ? new Date(maxMs).toISOString() : null;
    }
    entries.value = rows;
    if (!options.soft) {
      draftLines.value = toDraft(rows);
      lastSavedFingerprint.value = fingerprint(rows);
      saveState.value = 'idle';
    } else {
      // Soft reload after conflict: preserve draft if still dirty; otherwise merge
      const curFp = fingerprint(resolvePayload());
      if (curFp === lastSavedFingerprint.value) {
        draftLines.value = toDraft(rows);
        lastSavedFingerprint.value = fingerprint(rows);
        editorRef.value?.applyServerState?.(rows);
      }
    }
  } catch (e) {
    if (!options.soft) {
      error.value = e?.message || t('organizations.vendorCatalogLoadFailed');
      entries.value = [];
      draftLines.value = [];
    }
  } finally {
    if (!options.soft) {
      loading.value = false;
      requestAnimationFrame(() => {
        readyForAutosave = true;
      });
    }
  }
}

watch(
  () => vendorId(),
  () => {
    clearTimeout(saveTimer);
    load();
  }
);

onMounted(load);

onBeforeUnmount(() => {
  clearTimeout(saveTimer);
  clearTimeout(savedClearTimer);
  // Best-effort flush pending changes when leaving the record
  if (saveState.value === 'pending' && canEdit.value) {
    void flushAutosave();
  }
});
</script>
