<template>
  <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
    <div class="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div>
        <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('platform.catalogBundleTitle') }}</h4>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('platform.catalogBundleDesc') }}</p>
      </div>
      <button
        v-if="canEdit"
        type="button"
        class="text-xs px-2 py-1 bg-indigo-600 text-white rounded"
        @click="openPicker"
      >
        {{ t('platform.catalogBundleAddComponent') }}
      </button>
    </div>

    <div class="mb-4 flex flex-wrap items-center gap-3">
      <label class="text-xs font-medium text-gray-700 dark:text-gray-300">{{ t('platform.catalogBundlePricingMode') }}</label>
      <select
        v-model="pricingMode"
        :disabled="!canEdit || saving"
        class="text-sm px-2 py-1 rounded border dark:bg-gray-900 dark:border-gray-600"
        @change="scheduleSaveBundle"
      >
        <option value="fixed">{{ t('platform.catalogBundlePricingFixed') }}</option>
        <option value="rollup">{{ t('platform.catalogBundlePricingRollup') }}</option>
      </select>
      <button
        type="button"
        class="text-xs text-indigo-600"
        :disabled="loadingPreview"
        @click="loadPreview"
      >
        {{ loadingPreview ? t('states.loading') : t('platform.catalogBundlePreview') }}
      </button>
    </div>

    <div v-if="loading" class="text-sm text-gray-500">{{ t('states.loading') }}</div>
    <div v-else-if="!components.length" class="text-sm text-gray-500">{{ t('platform.catalogBundleEmpty') }}</div>
    <template v-else>
    <p v-if="bundleError" class="text-sm text-red-600 dark:text-red-400 mb-2">{{ bundleError }}</p>
    <div class="overflow-x-auto -mx-1 px-1 mb-4">
    <table class="w-full min-w-[360px] text-sm">
      <thead>
        <tr class="text-left text-xs text-gray-500 border-b border-gray-200 dark:border-gray-700">
          <th class="py-2 pr-2">{{ t('platform.catalogBundleComponent') }}</th>
          <th class="py-2 pr-2">{{ t('platform.catalogBundleQty') }}</th>
          <th class="py-2 pr-2">{{ t('platform.catalogBundleOptional') }}</th>
          <th class="py-2 w-8" />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, idx) in components"
          :key="row.componentVariantId"
          class="border-b border-gray-100 dark:border-gray-800"
        >
          <td class="py-2 pr-2">
            <span class="text-gray-900 dark:text-white">{{ row.item_name || row.variant_code }}</span>
            <span v-if="row.variant_code" class="block text-xs text-gray-500 font-mono">{{ row.variant_code }}</span>
          </td>
          <td class="py-2 pr-2">
            <input
              v-model.number="row.quantity"
              type="number"
              min="0.0001"
              step="any"
              :disabled="!canEdit"
              class="w-20 text-sm px-1 py-0.5 rounded border dark:bg-gray-900 dark:border-gray-600"
              @change="scheduleSaveBundle"
            />
          </td>
          <td class="py-2 pr-2">
            <input
              v-model="row.isOptional"
              type="checkbox"
              :disabled="!canEdit"
              @change="scheduleSaveBundle"
            />
          </td>
          <td class="py-2">
            <button
              v-if="canEdit"
              type="button"
              class="text-xs text-red-600"
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

    <div
      v-if="preview"
      class="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-sm space-y-2"
    >
      <p class="font-medium text-gray-900 dark:text-white">
        {{ t('platform.catalogBundlePreviewTotal') }}:
        {{ preview.bundleUnitPrice }} {{ preview.currency }}
        <span class="text-xs font-normal text-gray-500">({{ preview.pricingMode }})</span>
      </p>
      <ul class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
        <li v-for="line in preview.lines" :key="line.componentVariantId">
          {{ line.item_name }} × {{ line.quantity }} — {{ line.lineTotal }} {{ line.currency }}
        </li>
      </ul>
    </div>

  <div v-if="showPicker" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-5 w-full max-w-lg space-y-3 max-h-[80vh] flex flex-col">
        <h4 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('platform.catalogBundlePickVariant') }}</h4>
        <input
          v-model="searchQuery"
          type="search"
          class="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 dark:border-gray-600 text-sm"
          :placeholder="t('platform.catalogBundleSearchPlaceholder')"
          @input="debouncedSearch"
        />
        <ul class="flex-1 overflow-y-auto space-y-1 min-h-[120px]">
          <li v-if="searchLoading" class="text-sm text-gray-500 px-2">{{ t('states.loading') }}</li>
          <li
            v-for="hit in searchResults"
            :key="hit._id"
            class="px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm"
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
          <button type="button" class="text-sm px-3 py-1.5" @click="showPicker = false">{{ t('actions.close') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
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

async function loadBundle() {
  if (!props.variantId) return;
  loading.value = true;
  try {
    const res = await apiClient.get(`/catalog/variants/${props.variantId}/bundle-components`);
    const payload = unwrapCatalogApiData(res) || {};
    pricingMode.value = payload.pricingMode || 'fixed';
    components.value = (payload.components || []).map((c) => ({ ...c }));
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

async function saveBundle() {
  if (!props.canEdit || !props.variantId) return;
  saving.value = true;
  bundleError.value = '';
  try {
    const res = await apiClient.put(`/catalog/variants/${props.variantId}/bundle-components`, {
      pricingMode: pricingMode.value,
      components: components.value.map((c, index) => ({
        componentVariantId: c.componentVariantId,
        quantity: c.quantity,
        isOptional: c.isOptional === true,
        sortOrder: index
      }))
    });
    if (res.success === false) {
      throw new Error(res.message || 'Save failed');
    }
    const payload = unwrapCatalogApiData(res) || {};
    components.value = payload.components || [];
    pricingMode.value = payload.pricingMode || pricingMode.value;
    preview.value = null;
  } catch (err) {
    bundleError.value = err.message || 'Could not save bundle';
  } finally {
    saving.value = false;
  }
}

async function loadPreview() {
  loadingPreview.value = true;
  try {
    const res = await apiClient.get(`/catalog/variants/${props.variantId}/bundle-expand`);
    preview.value = unwrapCatalogApiData(res) || null;
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
