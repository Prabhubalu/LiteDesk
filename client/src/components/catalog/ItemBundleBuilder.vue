<template>
  <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white">
            {{ t('platform.catalogBundleTitle') }}
          </h4>
          <span
            v-if="revision > 1"
            class="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
          >
            {{ t('platform.catalogBundleRevision', { n: revision }) }}
          </span>
          <span
            v-if="saving"
            class="text-[10px] text-gray-400"
          >{{ t('states.saving') }}</span>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {{ t('platform.catalogBundleDesc') }}
        </p>
      </div>
      <button
        v-if="canEdit"
        type="button"
        class="text-xs px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
        @click="openPicker"
      >
        {{ t('platform.catalogBundleAddComponent') }}
      </button>
    </div>

    <!-- Type -->
    <div class="grid gap-3 sm:grid-cols-2">
      <div>
        <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {{ t('platform.catalogBundleType') }}
        </label>
        <div class="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
          <button
            type="button"
            class="flex-1 text-xs px-3 py-2 transition-colors"
            :class="bundleType === 'fixed'
              ? 'bg-indigo-600 text-white'
              : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'"
            :disabled="!canEdit || saving"
            @click="setBundleType('fixed')"
          >
            {{ t('platform.catalogBundleTypeFixed') }}
          </button>
          <button
            type="button"
            class="flex-1 text-xs px-3 py-2 transition-colors border-l border-gray-200 dark:border-gray-600"
            :class="bundleType === 'flexible'
              ? 'bg-indigo-600 text-white'
              : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'"
            :disabled="!canEdit || saving"
            @click="setBundleType('flexible')"
          >
            {{ t('platform.catalogBundleTypeFlexible') }}
          </button>
        </div>
        <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
          {{ bundleType === 'fixed'
            ? t('platform.catalogBundleTypeFixedHint')
            : t('platform.catalogBundleTypeFlexibleHint') }}
        </p>
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {{ t('platform.catalogBundlePricingMode') }}
        </label>
        <select
          v-model="pricingMode"
          :disabled="!canEdit || saving"
          class="w-full text-sm px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-900"
          @change="onPricingModeChange"
        >
          <option value="fixed">{{ t('platform.catalogBundlePricingFixed') }}</option>
          <option value="rollup">{{ t('platform.catalogBundlePricingRollup') }}</option>
          <option value="discount">{{ t('platform.catalogBundlePricingDiscount') }}</option>
        </select>
        <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
          {{ pricingHint }}
        </p>
      </div>
    </div>

    <!-- Discount + effectiveness + flexible rules -->
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <template v-if="pricingMode === 'discount'">
        <div>
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ t('platform.catalogBundleDiscountType') }}
          </label>
          <select
            v-model="discountType"
            :disabled="!canEdit || saving"
            class="w-full text-sm px-2 py-1.5 rounded-lg border dark:bg-gray-900 dark:border-gray-600"
            @change="scheduleSaveBundle"
          >
            <option value="percent">{{ t('platform.catalogBundleDiscountPercent') }}</option>
            <option value="amount">{{ t('platform.catalogBundleDiscountAmount') }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ t('platform.catalogBundleDiscountValue') }}
          </label>
          <input
            v-model.number="discountValue"
            type="number"
            min="0"
            step="any"
            :disabled="!canEdit || saving"
            class="w-full text-sm px-2 py-1.5 rounded-lg border dark:bg-gray-900 dark:border-gray-600"
            @change="scheduleSaveBundle"
          >
        </div>
      </template>

      <div>
        <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          {{ t('platform.catalogBundleEffectiveFrom') }}
        </label>
        <input
          v-model="effectiveFrom"
          type="date"
          :disabled="!canEdit || saving"
          class="w-full text-sm px-2 py-1.5 rounded-lg border dark:bg-gray-900 dark:border-gray-600"
          @change="scheduleSaveBundle"
        >
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          {{ t('platform.catalogBundleEffectiveUntil') }}
        </label>
        <input
          v-model="effectiveUntil"
          type="date"
          :disabled="!canEdit || saving"
          class="w-full text-sm px-2 py-1.5 rounded-lg border dark:bg-gray-900 dark:border-gray-600"
          @change="scheduleSaveBundle"
        >
      </div>

      <template v-if="bundleType === 'flexible'">
        <div>
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ t('platform.catalogBundleMinOptional') }}
          </label>
          <input
            v-model.number="minOptionalSelection"
            type="number"
            min="0"
            step="1"
            :disabled="!canEdit || saving"
            class="w-full text-sm px-2 py-1.5 rounded-lg border dark:bg-gray-900 dark:border-gray-600"
            @change="scheduleSaveBundle"
          >
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ t('platform.catalogBundleMaxOptional') }}
          </label>
          <input
            v-model.number="maxOptionalSelection"
            type="number"
            min="0"
            step="1"
            :disabled="!canEdit || saving"
            class="w-full text-sm px-2 py-1.5 rounded-lg border dark:bg-gray-900 dark:border-gray-600"
            @change="scheduleSaveBundle"
          >
        </div>
      </template>
    </div>

    <div v-if="loading" class="text-sm text-gray-500">{{ t('states.loading') }}</div>
    <div v-else-if="!components.length" class="text-sm text-gray-500 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 px-4 py-6 text-center">
      {{ t('platform.catalogBundleEmpty') }}
    </div>
    <template v-else>
      <p v-if="bundleError" class="text-sm text-red-600 dark:text-red-400">{{ bundleError }}</p>

      <div class="overflow-x-auto -mx-1 px-1">
        <table class="w-full min-w-[720px] text-sm">
          <thead>
            <tr class="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-200 dark:border-gray-700">
              <th class="py-2 pr-2 font-medium">{{ t('platform.catalogBundleComponent') }}</th>
              <th class="py-2 pr-2 font-medium w-20">{{ t('platform.catalogBundleQty') }}</th>
              <th v-if="bundleType === 'flexible'" class="py-2 pr-2 font-medium">{{ t('platform.catalogBundleRole') }}</th>
              <th v-if="bundleType === 'flexible'" class="py-2 pr-2 font-medium text-center">{{ t('platform.catalogBundleDefaultOn') }}</th>
              <th class="py-2 pr-2 font-medium text-center">{{ t('platform.catalogBundleEditableQty') }}</th>
              <th class="py-2 pr-2 font-medium w-16">{{ t('platform.catalogBundleMinQty') }}</th>
              <th class="py-2 pr-2 font-medium w-16">{{ t('platform.catalogBundleMaxQty') }}</th>
              <th class="py-2 pr-2 font-medium">{{ t('platform.catalogBundleRemarks') }}</th>
              <th class="py-2 w-8" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, idx) in components"
              :key="row.componentVariantId"
              class="border-b border-gray-100 dark:border-gray-800 align-top"
            >
              <td class="py-2.5 pr-2">
                <span class="text-gray-900 dark:text-white font-medium">{{ row.item_name || row.variant_code }}</span>
                <span v-if="row.variant_code" class="block text-xs text-gray-500 font-mono">{{ row.variant_code }}</span>
              </td>
              <td class="py-2.5 pr-2">
                <input
                  v-model.number="row.quantity"
                  type="number"
                  min="0.0001"
                  step="any"
                  :disabled="!canEdit"
                  class="w-16 text-sm px-1.5 py-1 rounded border dark:bg-gray-900 dark:border-gray-600"
                  @change="scheduleSaveBundle"
                >
              </td>
              <td v-if="bundleType === 'flexible'" class="py-2.5 pr-2">
                <select
                  :value="row.isOptional ? 'optional' : 'mandatory'"
                  :disabled="!canEdit"
                  class="text-xs px-1.5 py-1 rounded border dark:bg-gray-900 dark:border-gray-600"
                  @change="row.isOptional = $event.target.value === 'optional'; onOptionalChange(row)"
                >
                  <option value="mandatory">{{ t('platform.catalogBundleMandatory') }}</option>
                  <option value="optional">{{ t('platform.catalogBundleOptional') }}</option>
                </select>
              </td>
              <td v-if="bundleType === 'flexible'" class="py-2.5 pr-2 text-center">
                <input
                  v-model="row.defaultSelected"
                  type="checkbox"
                  :disabled="!canEdit || !row.isOptional"
                  @change="scheduleSaveBundle"
                >
              </td>
              <td class="py-2.5 pr-2 text-center">
                <input
                  v-model="row.editableQuantity"
                  type="checkbox"
                  :disabled="!canEdit"
                  @change="scheduleSaveBundle"
                >
              </td>
              <td class="py-2.5 pr-2">
                <input
                  v-model.number="row.minQuantity"
                  type="number"
                  min="0.0001"
                  step="any"
                  :disabled="!canEdit || !row.editableQuantity"
                  class="w-14 text-sm px-1 py-1 rounded border dark:bg-gray-900 dark:border-gray-600 disabled:opacity-40"
                  @change="scheduleSaveBundle"
                >
              </td>
              <td class="py-2.5 pr-2">
                <input
                  v-model.number="row.maxQuantity"
                  type="number"
                  min="0.0001"
                  step="any"
                  :disabled="!canEdit || !row.editableQuantity"
                  class="w-14 text-sm px-1 py-1 rounded border dark:bg-gray-900 dark:border-gray-600 disabled:opacity-40"
                  @change="scheduleSaveBundle"
                >
              </td>
              <td class="py-2.5 pr-2">
                <input
                  v-model="row.remarks"
                  type="text"
                  maxlength="500"
                  :disabled="!canEdit"
                  class="w-full min-w-[100px] text-xs px-1.5 py-1 rounded border dark:bg-gray-900 dark:border-gray-600"
                  :placeholder="t('platform.catalogBundleRemarksPlaceholder')"
                  @change="scheduleSaveBundle"
                >
              </td>
              <td class="py-2.5">
                <button
                  v-if="canEdit"
                  type="button"
                  class="text-xs text-red-600 hover:text-red-700 px-1"
                  :aria-label="t('actions.remove')"
                  @click="removeAt(idx)"
                >
                  ×
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <div class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        class="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-indigo-600 dark:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-800"
        :disabled="loadingPreview || !components.length"
        @click="loadPreview"
      >
        {{ loadingPreview ? t('states.loading') : t('platform.catalogBundlePreview') }}
      </button>
    </div>

    <div
      v-if="preview"
      class="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-sm space-y-2"
    >
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <p class="font-medium text-gray-900 dark:text-white">
          {{ t('platform.catalogBundlePreviewTotal') }}:
          <span class="tabular-nums">{{ formatMoney(preview.bundleUnitPrice) }} {{ preview.currency }}</span>
        </p>
        <span class="text-[11px] text-gray-500">
          {{ preview.bundleType }} · {{ preview.pricingMode }}
          <template v-if="preview.discountApplied">
            · −{{ formatMoney(preview.discountApplied) }}
          </template>
        </span>
      </div>
      <ul class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
        <li
          v-for="line in preview.lines"
          :key="line.componentVariantId"
          :class="{ 'opacity-40 line-through': !line.included }"
        >
          {{ line.item_name }} × {{ line.quantity }}
          <template v-if="line.included"> — {{ formatMoney(line.lineTotal) }} {{ line.currency }}</template>
          <span v-if="line.isOptional" class="ml-1 text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400">
            {{ t('platform.catalogBundleOptional') }}
          </span>
        </li>
      </ul>
    </div>

    <div v-if="showPicker" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-5 w-full max-w-lg space-y-3 max-h-[80vh] flex flex-col shadow-xl">
        <h4 class="text-base font-semibold text-gray-900 dark:text-white">
          {{ t('platform.catalogBundlePickVariant') }}
        </h4>
        <input
          v-model="searchQuery"
          type="search"
          class="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 dark:border-gray-600 text-sm"
          :placeholder="t('platform.catalogBundleSearchPlaceholder')"
          @input="debouncedSearch"
        >
        <ul class="flex-1 overflow-y-auto space-y-1 min-h-[120px]">
          <li v-if="searchLoading" class="text-sm text-gray-500 px-2">{{ t('states.loading') }}</li>
          <li
            v-for="hit in searchResults"
            :key="hit._id"
            class="px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm"
            @click="addComponent(hit)"
          >
            <span class="font-medium text-gray-900 dark:text-white">{{ hit.item_name }}</span>
            <span class="text-xs text-gray-500 ml-2 font-mono">{{ hit.variant_code }}</span>
          </li>
          <li v-if="!searchLoading && !searchResults.length" class="text-sm text-gray-500 px-2">
            {{ t('platform.catalogBundleNoResults') }}
          </li>
        </ul>
        <div class="flex justify-end">
          <button type="button" class="text-sm px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" @click="showPicker = false">
            {{ t('actions.close') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { unwrapCatalogApiData } from '@/utils/catalogApi';
import { confirmAction } from '@/composables/useConfirmAction';

const props = defineProps({
  variantId: { type: String, required: true },
  canEdit: { type: Boolean, default: false }
});

const { t } = useI18n();

const loading = ref(false);
const saving = ref(false);
const pricingMode = ref('fixed');
const bundleType = ref('fixed');
const discountType = ref('percent');
const discountValue = ref(0);
const minOptionalSelection = ref(null);
const maxOptionalSelection = ref(null);
const effectiveFrom = ref('');
const effectiveUntil = ref('');
const revision = ref(1);
const components = ref([]);
const preview = ref(null);
const loadingPreview = ref(false);
const bundleError = ref('');
const showPicker = ref(false);
const searchQuery = ref('');
const searchResults = ref([]);
const searchLoading = ref(false);

let searchTimer = null;
let saveTimer = null;

const pricingHint = computed(() => {
  if (pricingMode.value === 'rollup') return t('platform.catalogBundlePricingRollupHint');
  if (pricingMode.value === 'discount') return t('platform.catalogBundlePricingDiscountHint');
  return t('platform.catalogBundlePricingFixedHint');
});

function formatMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function toDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function mapComponent(c) {
  return {
    componentVariantId: c.componentVariantId,
    quantity: c.quantity ?? 1,
    isOptional: c.isOptional === true,
    defaultSelected: c.defaultSelected === true,
    editableQuantity: c.editableQuantity === true,
    minQuantity: c.minQuantity ?? null,
    maxQuantity: c.maxQuantity ?? null,
    remarks: c.remarks || '',
    sortOrder: c.sortOrder ?? 0,
    variant_code: c.variant_code,
    item_name: c.item_name,
    item_code: c.item_code
  };
}

function applyPayload(payload) {
  pricingMode.value = payload.pricingMode || 'fixed';
  bundleType.value = payload.bundleType || 'fixed';
  discountType.value = payload.discountType || 'percent';
  discountValue.value = payload.discountValue ?? 0;
  minOptionalSelection.value = payload.minOptionalSelection ?? null;
  maxOptionalSelection.value = payload.maxOptionalSelection ?? null;
  effectiveFrom.value = toDateInput(payload.effectiveFrom);
  effectiveUntil.value = toDateInput(payload.effectiveUntil);
  revision.value = payload.revision || 1;
  components.value = (payload.components || []).map(mapComponent);
}

async function loadBundle() {
  if (!props.variantId) return;
  loading.value = true;
  bundleError.value = '';
  try {
    const res = await apiClient.get(`/catalog/variants/${props.variantId}/bundle-components`);
    const payload = unwrapCatalogApiData(res) || {};
    applyPayload(payload);
    preview.value = null;
  } catch (err) {
    if (err?.response?.status === 404) {
      components.value = [];
    }
  } finally {
    loading.value = false;
  }
}

function scheduleSaveBundle() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveBundle, 400);
}

function buildSaveBody() {
  return {
    pricingMode: pricingMode.value,
    bundleType: bundleType.value,
    minOptionalSelection:
      bundleType.value === 'flexible' && minOptionalSelection.value !== '' && minOptionalSelection.value != null
        ? Number(minOptionalSelection.value)
        : null,
    maxOptionalSelection:
      bundleType.value === 'flexible' && maxOptionalSelection.value !== '' && maxOptionalSelection.value != null
        ? Number(maxOptionalSelection.value)
        : null,
    discountType: pricingMode.value === 'discount' ? discountType.value : null,
    discountValue: pricingMode.value === 'discount' ? Number(discountValue.value) || 0 : null,
    effectiveFrom: effectiveFrom.value || null,
    effectiveUntil: effectiveUntil.value || null,
    components: components.value.map((c, index) => ({
      componentVariantId: c.componentVariantId,
      quantity: c.quantity,
      isOptional: bundleType.value === 'flexible' ? c.isOptional === true : false,
      defaultSelected: bundleType.value === 'flexible' && c.isOptional === true ? c.defaultSelected === true : false,
      editableQuantity: c.editableQuantity === true,
      minQuantity: c.editableQuantity && c.minQuantity != null && c.minQuantity !== '' ? c.minQuantity : null,
      maxQuantity: c.editableQuantity && c.maxQuantity != null && c.maxQuantity !== '' ? c.maxQuantity : null,
      remarks: c.remarks || '',
      sortOrder: index
    }))
  };
}

async function saveBundle() {
  if (!props.canEdit || !props.variantId) return;
  saving.value = true;
  bundleError.value = '';
  try {
    const res = await apiClient.put(
      `/catalog/variants/${props.variantId}/bundle-components`,
      buildSaveBody()
    );
    if (res.success === false) {
      throw new Error(res.message || 'Save failed');
    }
    const payload = unwrapCatalogApiData(res) || {};
    applyPayload(payload);
    preview.value = null;
  } catch (err) {
    bundleError.value = err?.response?.data?.message || err.message || t('platform.catalogBundleSaveFailed');
  } finally {
    saving.value = false;
  }
}

function setBundleType(next) {
  if (!props.canEdit || bundleType.value === next) return;
  bundleType.value = next;
  if (next === 'fixed') {
    for (const row of components.value) {
      row.isOptional = false;
      row.defaultSelected = false;
    }
    minOptionalSelection.value = null;
    maxOptionalSelection.value = null;
  }
  scheduleSaveBundle();
}

function onPricingModeChange() {
  if (pricingMode.value === 'discount' && !discountType.value) {
    discountType.value = 'percent';
  }
  scheduleSaveBundle();
}

function onOptionalChange(row) {
  if (row.isOptional !== true) {
    row.defaultSelected = false;
  }
  scheduleSaveBundle();
}

async function loadPreview() {
  loadingPreview.value = true;
  try {
    const res = await apiClient.get(`/catalog/variants/${props.variantId}/bundle-expand`);
    preview.value = unwrapCatalogApiData(res) || null;
  } catch (err) {
    bundleError.value = err?.response?.data?.message || err.message || t('platform.catalogBundlePreviewFailed');
    preview.value = null;
  } finally {
    loadingPreview.value = false;
  }
}

function openPicker() {
  showPicker.value = true;
  searchQuery.value = '';
  runSearch();
}

function debouncedSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 300);
}

async function runSearch() {
  searchLoading.value = true;
  try {
    const res = await apiClient.get('/catalog/variants/search', {
      params: {
        q: searchQuery.value,
        excludeVariantId: props.variantId,
        limit: 25
      }
    });
    const existing = new Set(components.value.map((c) => String(c.componentVariantId)));
    const hits = unwrapCatalogApiData(res);
    searchResults.value = (Array.isArray(hits) ? hits : []).filter((v) => !existing.has(String(v._id)));
  } finally {
    searchLoading.value = false;
  }
}

function addComponent(hit) {
  components.value.push({
    componentVariantId: hit._id,
    quantity: 1,
    isOptional: false,
    defaultSelected: false,
    editableQuantity: false,
    minQuantity: null,
    maxQuantity: null,
    remarks: '',
    sortOrder: components.value.length,
    variant_code: hit.variant_code,
    item_name: hit.item_name,
    item_code: hit.item_code
  });
  showPicker.value = false;
  saveBundle();
}

async function removeAt(index) {
  if (!await confirmAction(t('platform.catalogConfirmRemoveBundleComponent'))) return;
  components.value.splice(index, 1);
  scheduleSaveBundle();
}

watch(() => props.variantId, loadBundle, { immediate: true });
</script>
