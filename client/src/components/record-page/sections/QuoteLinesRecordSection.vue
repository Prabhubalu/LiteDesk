<template>
  <section v-if="record?._id" class="space-y-3">
    <div class="flex items-center justify-between gap-2">
      <div class="text-sm font-normal text-gray-900 dark:text-white">
        {{ t('records.linesTitle') }}
      </div>
      <div class="flex items-center gap-2">
        <div
          v-if="approvalBannerVisible"
          class="hidden md:flex items-center gap-2 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 text-sm text-amber-900 dark:text-amber-200"
        >
          <span>{{ approvalBannerText }}</span>
          <button
            v-if="canSubmitForApproval"
            type="button"
            class="ml-2 inline-flex items-center rounded bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 text-xs"
            :disabled="busy"
            @click="submitForApproval"
          >
            Submit
          </button>
          <button
            v-if="canApproveOrReject"
            type="button"
            class="ml-2 inline-flex items-center rounded bg-green-600 hover:bg-green-700 text-white px-2.5 py-1 text-xs"
            :disabled="busy"
            @click="approve"
          >
            Approve
          </button>
          <button
            v-if="canApproveOrReject"
            type="button"
            class="inline-flex items-center rounded bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 text-xs"
            :disabled="busy"
            @click="reject"
          >
            Reject
          </button>
        </div>
        <label
          v-if="canOverrideLock"
          class="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 select-none"
        >
          <input type="checkbox" v-model="overrideLock" :disabled="busy" />
          <span>{{ t('records.linesOverrideLock') }}</span>
        </label>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          :disabled="busy"
          @click="recalculate"
        >
          {{ t('records.linesRecalculate') }}
        </button>
        <button
          v-if="canRevise"
          type="button"
          class="inline-flex items-center gap-2 rounded-md border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
          :disabled="busy"
          @click="revise"
        >
          Create revision
        </button>
        <button
          v-if="canConvert"
          type="button"
          class="inline-flex items-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-sm"
          :disabled="busy"
          @click="convert"
        >
          Convert
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          :disabled="busy"
          @click="generatePdf"
        >
          Generate PDF
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          :disabled="busy"
          @click="copyShareLink"
        >
          Copy link
        </button>
        <button
          v-if="hasShareToken"
          type="button"
          class="inline-flex items-center gap-2 rounded-md border border-red-200 dark:border-red-800 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
          :disabled="busy"
          @click="revokeShareLink"
        >
          Revoke link
        </button>
      </div>
    </div>

    <div class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-gray-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300">
            <tr>
              <th class="px-3 py-2 text-left font-normal">{{ t('records.linesSku') }}</th>
              <th class="px-3 py-2 text-left font-normal">{{ t('records.linesName') }}</th>
              <th class="px-3 py-2 text-left font-normal">{{ t('records.linesPriceBook') }}</th>
              <th class="px-3 py-2 text-left font-normal">{{ t('records.linesPriceSource') }}</th>
              <th class="px-3 py-2 text-right font-normal">{{ t('records.linesQty') }}</th>
              <th class="px-3 py-2 text-right font-normal">{{ t('records.linesUnitPrice') }}</th>
              <th class="px-3 py-2 text-right font-normal">{{ t('records.linesTotal') }}</th>
              <th class="px-3 py-2 text-right font-normal"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-if="!lines.length" class="text-gray-500 dark:text-gray-400">
              <td class="px-3 py-3" colspan="8">{{ t('records.linesEmpty') }}</td>
            </tr>
            <tr v-for="line in lines" :key="line.quoteLineId" class="text-gray-900 dark:text-gray-100">
              <td class="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-300">
                {{ line.skuSnapshot || '—' }}
              </td>
              <td class="px-3 py-2">
                <div class="min-w-0">
                  <div class="truncate">{{ line.itemNameSnapshot || '—' }}</div>
                </div>
              </td>
              <td class="px-3 py-2 text-xs text-gray-700 dark:text-gray-200">
                <span :title="priceProvenanceTitle(line)">
                  {{ line.priceBookNameSnapshot || '—' }}
                </span>
              </td>
              <td class="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                {{ pricingSourceLabel(line.pricingSourceSnapshot) }}
              </td>
              <td class="px-3 py-2 text-right">
                <input
                  class="w-20 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-right"
                  type="number"
                  min="0"
                  step="1"
                  :value="line.quantity"
                  :disabled="busy"
                  @change="(e) => patchQty(line, e?.target?.value)"
                />
              </td>
              <td class="px-3 py-2 text-right">
                {{ formatMoney(line.unitPriceSnapshot) }}
              </td>
              <td class="px-3 py-2 text-right font-medium">
                {{ formatMoney(line.lineTotal) }}
              </td>
              <td class="px-3 py-2 text-right">
                <button
                  type="button"
                  class="text-sm text-red-600 dark:text-red-400 hover:underline"
                  :disabled="busy"
                  @click="removeLine(line)"
                >
                  {{ t('actions.delete') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 space-y-2">
      <div class="text-sm font-normal text-gray-700 dark:text-gray-200">
        {{ t('records.linesAddOne') }}
      </div>
      <div class="flex flex-col md:flex-row gap-2">
        <button
          type="button"
          class="flex-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-800/60"
          :disabled="busy"
          @click="openVariantPicker"
        >
          <span v-if="variantLabel" class="text-gray-900 dark:text-gray-100">{{ variantLabel }}</span>
          <span v-else class="text-gray-500 dark:text-gray-400">{{ t('records.linesPickVariant') }}</span>
        </button>
        <select
          class="w-full md:w-56 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          v-model="selectedPriceBookId"
          :disabled="busy || priceBooksLoading"
        >
          <option value="">{{ t('records.linesDefaultPriceBook') }}</option>
          <option v-for="b in priceBooks" :key="b._id" :value="String(b._id)">
            {{ b.name }}
          </option>
        </select>
        <input
          class="w-28 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          type="number"
          min="1"
          step="1"
          v-model.number="quantity"
          :disabled="busy"
        />
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm"
          :disabled="busy || !variantId"
          @click="addLine"
        >
          {{ t('records.linesAdd') }}
        </button>
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-md border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-gray-900 text-indigo-700 dark:text-indigo-300 px-4 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
          :disabled="busy"
          @click="openBundlePicker"
        >
          Add bundle
        </button>
      </div>
    </div>

    <div v-if="showBundlePicker" class="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-5 w-full max-w-lg space-y-3 max-h-[80vh] flex flex-col">
        <h4 class="text-base font-semibold text-gray-900 dark:text-white">Pick bundle</h4>
        <input
          v-model="bundleSearchQuery"
          type="search"
          class="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 dark:border-gray-600 text-sm"
          placeholder="Search bundles…"
          @input="debouncedBundleSearch"
        />
        <ul class="flex-1 overflow-y-auto space-y-1 min-h-[120px]">
          <li v-if="bundleSearchLoading" class="text-sm text-gray-500 px-2">{{ t('states.loading') }}</li>
          <li v-else-if="!bundleSearchResults.length" class="text-sm text-gray-500 px-2">No bundles found</li>
          <li
            v-for="hit in bundleSearchResults"
            :key="hit._id"
            class="px-3 py-2 rounded-lg cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
            @click="pickBundle(hit)"
          >
            <span class="text-sm text-gray-900 dark:text-white">{{ hit.item_name || hit.variant_code }}</span>
            <span v-if="hit.variant_code" class="block text-xs text-gray-500 font-mono">{{ hit.variant_code }}</span>
          </li>
        </ul>
        <div class="flex justify-end">
          <button type="button" class="px-3 py-2 text-sm" @click="showBundlePicker = false">{{ t('actions.cancel') }}</button>
        </div>
      </div>
    </div>

    <div v-if="showVariantPicker" class="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-5 w-full max-w-lg space-y-3 max-h-[80vh] flex flex-col">
        <h4 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('records.linesPickVariantTitle') }}</h4>
        <input
          v-model="variantSearchQuery"
          type="search"
          class="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 dark:border-gray-600 text-sm"
          :placeholder="t('records.linesVariantSearchPlaceholder')"
          @input="debouncedVariantSearch"
        />
        <ul class="flex-1 overflow-y-auto space-y-1 min-h-[120px]">
          <li v-if="variantSearchLoading" class="text-sm text-gray-500 px-2">{{ t('states.loading') }}</li>
          <li v-else-if="!variantSearchResults.length" class="text-sm text-gray-500 px-2">{{ t('records.linesNoVariantsFound') }}</li>
          <li
            v-for="hit in variantSearchResults"
            :key="hit._id"
            class="px-3 py-2 rounded-lg cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
            @click="pickVariant(hit)"
          >
            <span class="text-sm text-gray-900 dark:text-white">{{ hit.item_name || hit.variant_code }}</span>
            <span v-if="hit.variant_code" class="block text-xs text-gray-500 font-mono">{{ hit.variant_code }}</span>
          </li>
        </ul>
        <div class="flex justify-end">
          <button type="button" class="px-3 py-2 text-sm" @click="showVariantPicker = false">{{ t('actions.cancel') }}</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import { unwrapCatalogApiData, unwrapCatalogApiList } from '@/utils/catalogApi';
import { useAuthStore } from '@/stores/authRegistry';

const props = defineProps({
  record: { type: Object, default: null },
  adapter: { type: Object, default: () => ({}) },
  context: { type: Object, default: () => ({}) }
});

const emit = defineEmits(['updated']);

const { t } = useI18n();
const notifications = useNotifications();
const authStore = useAuthStore();
const router = useRouter();

const busy = ref(false);
const variantId = ref('');
const variantLabel = ref('');
const quantity = ref(1);
const overrideLock = ref(false);

const lines = computed(() => (Array.isArray(props.record?.lines) ? props.record.lines : []));

const priceBooksLoading = ref(false);
const priceBooks = ref([]);
const selectedPriceBookId = ref('');

const showVariantPicker = ref(false);
const variantSearchQuery = ref('');
const variantSearchResults = ref([]);
const variantSearchLoading = ref(false);
let variantSearchTimer;

const showBundlePicker = ref(false);
const bundleSearchQuery = ref('');
const bundleSearchResults = ref([]);
const bundleSearchLoading = ref(false);
let bundleSearchTimer;

const canOverrideLock = computed(() => {
  if (authStore.user?.isOwner) return true;
  const role = String(authStore.user?.role || '').toLowerCase();
  return role === 'owner' || role === 'admin';
});

const quoteStatus = computed(() => String(props.record?.status || '').trim());
const approvalLocked = computed(() => props.record?.approvalLocked === true);
const canApproveOrReject = computed(() => canOverrideLock.value && quoteStatus.value === 'Pending Approval');
const canSubmitForApproval = computed(() => quoteStatus.value === 'Draft');
const hasShareToken = computed(() => Boolean(props.record?.publicShareToken));

const approvalBannerVisible = computed(() => (
  quoteStatus.value === 'Pending Approval' || approvalLocked.value === true || quoteStatus.value === 'Draft'
));

const approvalBannerText = computed(() => {
  if (quoteStatus.value === 'Pending Approval') return 'Pending approval';
  if (approvalLocked.value) return 'Approval locked';
  if (quoteStatus.value === 'Draft') return 'Draft (optional approval)';
  return '';
});

const canRevise = computed(() => {
  const s = String(props.record?.status || '');
  return ['Sent', 'Viewed', 'Accepted', 'Partially Accepted', 'Converted', 'Expired', 'Rejected', 'Cancelled'].includes(s);
});

const canConvert = computed(() => {
  const s = String(props.record?.status || '');
  if (s !== 'Accepted' && s !== 'Partially Accepted') return false;
  return props.record?.converted !== true;
});

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(2);
}

function variantHitLabel(hit) {
  if (hit.item_name) {
    return hit.variant_code ? `${hit.item_name} (${hit.variant_code})` : hit.item_name;
  }
  return hit.variant_code || String(hit._id);
}

function openVariantPicker() {
  showVariantPicker.value = true;
  variantSearchQuery.value = '';
  runVariantSearch();
}

function openBundlePicker() {
  showBundlePicker.value = true;
  bundleSearchQuery.value = '';
  runBundleSearch();
}

function debouncedVariantSearch() {
  clearTimeout(variantSearchTimer);
  variantSearchTimer = setTimeout(runVariantSearch, 300);
}

function debouncedBundleSearch() {
  clearTimeout(bundleSearchTimer);
  bundleSearchTimer = setTimeout(runBundleSearch, 300);
}

async function runVariantSearch() {
  variantSearchLoading.value = true;
  try {
    const res = await apiClient.get('/catalog/variants/search', {
      params: { q: variantSearchQuery.value, limit: 25 }
    });
    const hits = unwrapCatalogApiData(res);
    variantSearchResults.value = Array.isArray(hits) ? hits : [];
  } finally {
    variantSearchLoading.value = false;
  }
}

async function runBundleSearch() {
  bundleSearchLoading.value = true;
  try {
    const res = await apiClient.get('/catalog/variants/search', {
      params: { q: bundleSearchQuery.value, limit: 25 }
    });
    const hits = unwrapCatalogApiData(res);
    const rows = Array.isArray(hits) ? hits : [];
    bundleSearchResults.value = rows.filter((r) => String(r?.item_type || '').toLowerCase() === 'bundle');
  } finally {
    bundleSearchLoading.value = false;
  }
}

function pickVariant(hit) {
  variantId.value = String(hit._id);
  variantLabel.value = variantHitLabel(hit);
  showVariantPicker.value = false;
}

async function pickBundle(hit) {
  showBundlePicker.value = false;
  busy.value = true;
  try {
    const res = await apiClient.post(`/quotes/${props.record._id}/bundles`, {
      bundleVariantId: String(hit._id),
      priceBookId: selectedPriceBookId.value ? String(selectedPriceBookId.value) : null,
      quantity: 1,
      asOfDate: props.record?.quoteDate ?? null,
      overridePricing: overrideLock.value === true
    });
    if (!res?.success) {
      throw new Error(res?.message || 'Failed to add bundle');
    }
    notifications.success('Bundle added');
    await refresh();
  } catch (e) {
    notifications.error(e?.message || 'Failed to add bundle');
  } finally {
    busy.value = false;
  }
}

async function refresh() {
  emit('updated');
}

async function addLine() {
  if (!props.record?._id || !variantId.value) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/quotes/${props.record._id}/lines`, {
      variantId: variantId.value,
      quantity: quantity.value,
      priceBookId: selectedPriceBookId.value || null,
      overridePricing: overrideLock.value === true
    });
    if (res?.success) {
      variantId.value = '';
      variantLabel.value = '';
      quantity.value = 1;
      await refresh();
    } else {
      notifications.error(res?.message || t('records.linesAddFailed'));
    }
  } catch (e) {
    notifications.error(e?.message || t('records.linesAddFailed'));
  } finally {
    busy.value = false;
  }
}

async function patchQty(line, raw) {
  if (!props.record?._id || !line?.quoteLineId) return;
  const q = Number(raw);
  if (!Number.isFinite(q) || q <= 0) return;
  busy.value = true;
  try {
    const res = await apiClient.patch(`/quotes/${props.record._id}/lines/${line.quoteLineId}`, {
      quantity: q,
      overridePricing: overrideLock.value === true
    });
    if (res?.success) {
      await refresh();
    } else {
      notifications.error(res?.message || t('records.linesUpdateFailed'));
    }
  } catch (e) {
    notifications.error(e?.message || t('records.linesUpdateFailed'));
  } finally {
    busy.value = false;
  }
}

async function removeLine(line) {
  if (!props.record?._id || !line?.quoteLineId) return;
  if (!window.confirm(t('records.linesConfirmDelete'))) return;
  busy.value = true;
  try {
    const res = await apiClient.delete(`/quotes/${props.record._id}/lines/${line.quoteLineId}`, {
      data: { overridePricing: overrideLock.value === true }
    });
    if (res?.success) {
      await refresh();
    } else {
      notifications.error(res?.message || t('records.linesDeleteFailed'));
    }
  } catch (e) {
    notifications.error(e?.message || t('records.linesDeleteFailed'));
  } finally {
    busy.value = false;
  }
}

async function recalculate() {
  if (!props.record?._id) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/quotes/${props.record._id}/recalculate`, {
      overridePricing: overrideLock.value === true
    });
    if (res?.success) {
      await refresh();
    } else {
      notifications.error(res?.message || t('records.linesRecalculateFailed'));
    }
  } catch (e) {
    notifications.error(e?.message || t('records.linesRecalculateFailed'));
  } finally {
    busy.value = false;
  }
}

async function revise() {
  if (!props.record?._id) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/quotes/${props.record._id}/revise`, {});
    if (res?.success && res?.data?._id) {
      notifications.success('Revision created');
      router.push({ name: 'quote-detail', params: { id: res.data._id } });
      return;
    }
    notifications.error(res?.message || 'Failed to create revision');
  } catch (e) {
    notifications.error(e?.message || 'Failed to create revision');
  } finally {
    busy.value = false;
  }
}

async function submitForApproval() {
  if (!props.record?._id) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/quotes/${props.record._id}/submit-for-approval`, {});
    if (res?.success) {
      notifications.success('Submitted for approval');
      await refresh();
      return;
    }
    notifications.error(res?.message || 'Failed to submit for approval');
  } catch (e) {
    notifications.error(e?.message || 'Failed to submit for approval');
  } finally {
    busy.value = false;
  }
}

async function approve() {
  if (!props.record?._id) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/quotes/${props.record._id}/approve`, {});
    if (res?.success) {
      notifications.success('Approved');
      await refresh();
      return;
    }
    notifications.error(res?.message || 'Failed to approve');
  } catch (e) {
    notifications.error(e?.message || 'Failed to approve');
  } finally {
    busy.value = false;
  }
}

async function reject() {
  if (!props.record?._id) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/quotes/${props.record._id}/reject`, {});
    if (res?.success) {
      notifications.success('Rejected');
      await refresh();
      return;
    }
    notifications.error(res?.message || 'Failed to reject');
  } catch (e) {
    notifications.error(e?.message || 'Failed to reject');
  } finally {
    busy.value = false;
  }
}

async function generatePdf() {
  if (!props.record?._id) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/quotes/${props.record._id}/documents/generate`, {});
    if (res?.success && res?.data?.filePath) {
      notifications.success('PDF generated');
      // Open in new tab (static file served by server /public)
      window.open(res.data.filePath, '_blank');
      await refresh();
      return;
    }
    notifications.error(res?.message || 'Failed to generate PDF');
  } catch (e) {
    notifications.error(e?.message || 'Failed to generate PDF');
  } finally {
    busy.value = false;
  }
}

async function convert() {
  if (!props.record?._id) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/quotes/${props.record._id}/convert`, {});
    if (res?.success) {
      notifications.success('Converted');
      await refresh();
      return;
    }
    notifications.error(res?.message || 'Failed to convert');
  } catch (e) {
    notifications.error(e?.message || 'Failed to convert');
  } finally {
    busy.value = false;
  }
}

async function copyShareLink() {
  if (!props.record?._id) return;
  if (quoteStatus.value === 'Draft') {
    notifications.error('Cannot share from Draft. Approve the quote first (Approved → Sent).');
    return;
  }
  busy.value = true;
  try {
    const res = await apiClient.post(`/quotes/${props.record._id}/share`, { rotateToken: false });
    if (!res?.success || !res?.data?.publicShareToken) {
      notifications.error(res?.message || 'Failed to create link');
      return;
    }
    const token = res.data.publicShareToken;
    // Copy the public APP URL (not the API JSON endpoint)
    const url = `${window.location.origin}/public/quotes/${token}`;
    await navigator.clipboard.writeText(url);
    notifications.success('Link copied');
    await refresh();
  } catch (e) {
    notifications.error(e?.message || 'Failed to copy link');
  } finally {
    busy.value = false;
  }
}

async function revokeShareLink() {
  if (!props.record?._id) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/quotes/${props.record._id}/share/revoke`, {});
    if (res?.success) {
      notifications.success('Link revoked');
      await refresh();
      return;
    }
    notifications.error(res?.message || 'Failed to revoke link');
  } catch (e) {
    notifications.error(e?.message || 'Failed to revoke link');
  } finally {
    busy.value = false;
  }
}

async function loadPriceBooks() {
  priceBooksLoading.value = true;
  try {
    const res = await apiClient.get('/catalog/price-books');
    priceBooks.value = unwrapCatalogApiList(res);
  } catch (e) {
    priceBooks.value = [];
  } finally {
    priceBooksLoading.value = false;
  }
}

onMounted(() => {
  loadPriceBooks();
});

function pricingSourceLabel(source) {
  const s = String(source || '').trim();
  if (!s) return '—';
  if (s === 'price_book') return t('records.linesPriceSourcePriceBook');
  if (s === 'variant_fallback') return t('records.linesPriceSourceVariantFallback');
  return s;
}

function priceProvenanceTitle(line) {
  const book = line?.priceBookNameSnapshot || '—';
  const source = pricingSourceLabel(line?.pricingSourceSnapshot);
  const entry = line?.priceBookEntryIdSnapshot ? String(line.priceBookEntryIdSnapshot) : '—';
  const asOf = line?.pricingAsOfDateSnapshot ? new Date(line.pricingAsOfDateSnapshot).toLocaleDateString() : '—';
  const effectiveFrom = line?.pricingEffectiveFromSnapshot ? new Date(line.pricingEffectiveFromSnapshot).toLocaleDateString() : '—';
  const effectiveTo = line?.pricingEffectiveToSnapshot ? new Date(line.pricingEffectiveToSnapshot).toLocaleDateString() : '—';
  const minQty = Number.isFinite(Number(line?.pricingMinQtySnapshot)) ? String(line.pricingMinQtySnapshot) : '—';

  return t('records.linesPriceProvenanceTooltip', {
    book,
    source,
    entry,
    asOf,
    effectiveFrom,
    effectiveTo,
    minQty
  });
}
</script>

