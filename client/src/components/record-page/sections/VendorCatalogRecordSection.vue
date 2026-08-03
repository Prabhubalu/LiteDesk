<!--
  Vendor Catalog on Organization record page.
  Read view by default; inline edit when user can edit organizations.
-->
<template>
  <div class="vendor-catalog-record-section space-y-3">
    <div class="flex flex-wrap items-center justify-end gap-2">
      <template v-if="canEdit && !editing">
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          @click="startEdit"
        >
          <PencilSquareIcon class="size-3.5" aria-hidden="true" />
          {{ entries.length ? t('organizations.vendorCatalogEdit') : t('organizations.vendorCatalogAddItem') }}
        </button>
      </template>
      <template v-else-if="canEdit && editing">
        <button
          type="button"
          class="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-50 dark:text-gray-200 dark:ring-gray-600 dark:hover:bg-gray-800"
          :disabled="saving"
          @click="cancelEdit"
        >
          {{ t('actions.cancel') }}
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 dark:bg-indigo-500"
          :disabled="saving"
          @click="saveEdit"
        >
          {{ saving ? t('states.saving') : t('actions.save') }}
        </button>
      </template>
    </div>

    <div v-if="loading" class="flex justify-center py-10">
      <div class="h-7 w-7 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
    </div>

    <div
      v-else-if="error"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
    >
      {{ error }}
    </div>

    <template v-else-if="editing">
      <VendorCatalogSection
        ref="editorRef"
        v-model="draftLines"
        :disabled="saving"
        :vendor-id="vendorId()"
      />
      <p v-if="saveError" class="text-sm text-red-600 dark:text-red-400">{{ saveError }}</p>
    </template>

    <div
      v-else-if="!entries.length"
      class="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-4 py-10 text-center dark:border-gray-700 dark:bg-gray-800/40"
    >
      <CubeIcon class="mx-auto size-8 text-gray-300 dark:text-gray-600" aria-hidden="true" />
      <p class="mt-2 text-sm font-medium text-gray-900 dark:text-white">
        {{ t('organizations.vendorCatalogEmptyTitle') }}
      </p>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {{ t('organizations.vendorCatalogEmpty') }}
      </p>
      <button
        v-if="canEdit"
        type="button"
        class="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        @click="startEdit"
      >
        {{ t('organizations.vendorCatalogAddFirst') }}
      </button>
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

    <p v-if="!editing" class="text-xs text-gray-500 dark:text-gray-400">
      {{ t('organizations.vendorCatalogHint') }}
    </p>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, computed, watch, onMounted } from 'vue';
import { CubeIcon, PencilSquareIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import VendorCatalogSection from '@/components/organizations/VendorCatalogSection.vue';
import { useNotifications } from '@/composables/useNotifications';

const props = defineProps({
  record: { type: Object, default: null },
  context: { type: Object, default: () => ({}) }
});

const emit = defineEmits(['updated']);

const { t, d } = useI18n();
const notifications = useNotifications();

const loading = ref(false);
const saving = ref(false);
const error = ref('');
const saveError = ref('');
const entries = ref([]);
const editing = ref(false);
const draftLines = ref([]);
const editorRef = ref(null);

const canEdit = computed(
  () =>
    props.context?.canEditVendorCatalog === true ||
    props.context?.canEdit === true
);

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

function startEdit() {
  draftLines.value = toDraft(entries.value);
  saveError.value = '';
  editing.value = true;
}

function cancelEdit() {
  editing.value = false;
  draftLines.value = [];
  saveError.value = '';
}

async function saveEdit() {
  const id = vendorId();
  if (!id) return;
  const entriesPayload =
    editorRef.value?.getEntries?.() ??
    (Array.isArray(draftLines.value) ? draftLines.value : []);
  saving.value = true;
  saveError.value = '';
  try {
    const res = await apiClient.put(`/organizations/${id}/vendor-catalog`, {
      entries: entriesPayload
    });
    const data = res?.data ?? res;
    entries.value = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
    editing.value = false;
    draftLines.value = [];
    notifications.success(t('organizations.vendorCatalogSaved'));
    emit('updated', { type: 'vendor-catalog', entries: entries.value });
  } catch (e) {
    saveError.value =
      e?.response?.data?.message || e?.message || t('organizations.vendorCatalogSaveFailed');
  } finally {
    saving.value = false;
  }
}

async function load() {
  const id = vendorId();
  if (!id) {
    entries.value = [];
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const res = await apiClient.get(`/organizations/${id}/vendor-catalog`, {
      params: { includeInactive: true }
    });
    const data = res?.data ?? res;
    entries.value = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
  } catch (e) {
    error.value = e?.message || t('organizations.vendorCatalogLoadFailed');
    entries.value = [];
  } finally {
    loading.value = false;
  }
}

watch(() => vendorId(), () => {
  editing.value = false;
  load();
});
onMounted(load);
</script>
