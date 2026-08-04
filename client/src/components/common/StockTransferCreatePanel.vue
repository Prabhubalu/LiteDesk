<template>
  <div class="space-y-5">
    <p v-if="loading" class="text-sm text-gray-500">{{ t('records.xferCreateLoading') }}</p>
    <p v-else-if="loadError" class="text-sm text-red-600 dark:text-red-400">{{ loadError }}</p>

    <template v-else>
      <p class="text-sm text-gray-600 dark:text-gray-400">
        {{ t('records.xferCreateHint') }}
      </p>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="block text-sm">
          <span class="font-medium text-gray-800 dark:text-gray-200">
            {{ t('navigation.inventorySourceStockroom') }}
            <span class="text-red-500">*</span>
          </span>
          <select
            v-model="fromLocationId"
            required
            class="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option disabled value="">{{ t('actions.select') }}</option>
            <option v-for="loc in locations" :key="`f-${locKey(loc)}`" :value="locKey(loc)">
              {{ locationLabel(loc) }}
            </option>
          </select>
        </label>

        <label class="block text-sm">
          <span class="font-medium text-gray-800 dark:text-gray-200">
            {{ t('navigation.inventoryDestStockroom') }}
            <span class="text-red-500">*</span>
          </span>
          <select
            v-model="toLocationId"
            required
            class="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option disabled value="">{{ t('actions.select') }}</option>
            <option
              v-for="loc in toLocationOptions"
              :key="`t-${locKey(loc)}`"
              :value="locKey(loc)"
            >
              {{ locationLabel(loc) }}
            </option>
          </select>
        </label>
      </div>
      <p v-if="needsSecondStockroom" class="text-xs text-amber-700 dark:text-amber-400">
        {{ t('records.xferNeedSecondStockroom') }}
      </p>
      <p v-else-if="sameLocation" class="text-xs text-amber-700 dark:text-amber-400">
        {{ t('records.xferSameLocation') }}
      </p>

      <div class="space-y-3">
        <div class="flex items-center justify-between gap-2">
          <div>
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ t('records.xferLinesTitle') }}
            </h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ t('records.xferLinesHint') }}
            </p>
          </div>
          <button
            type="button"
            class="shrink-0 text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
            @click="addLine"
          >
            {{ t('records.xferAddLine') }}
          </button>
        </div>

        <div
          v-for="(line, index) in lines"
          :key="line.key"
          class="rounded-xl border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-700 dark:bg-gray-900/30"
        >
          <div class="flex items-start justify-between gap-2">
            <span class="text-xs font-medium uppercase tracking-wide text-gray-400">
              {{ t('records.xferLineN', { n: index + 1 }) }}
            </span>
            <button
              v-if="lines.length > 1"
              type="button"
              class="text-xs font-medium text-gray-500 hover:text-red-600"
              @click="removeLine(index)"
            >
              {{ t('actions.remove') }}
            </button>
          </div>

          <div class="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_9rem]">
            <div class="min-w-0">
              <span class="text-sm font-medium text-gray-800 dark:text-gray-200">
                {{ t('records.xferItem') }}
                <span class="text-red-500">*</span>
              </span>
              <button
                type="button"
                class="mt-1.5 flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm shadow-sm hover:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800"
                @click="openVariantPicker(index)"
              >
                <span
                  class="min-w-0 truncate"
                  :class="line.variantLabel ? 'text-gray-900 dark:text-white' : 'text-gray-400'"
                >
                  {{ line.variantLabel || t('records.xferPickItem') }}
                </span>
                <span class="shrink-0 text-xs text-indigo-600 dark:text-indigo-400">
                  {{ line.variantId ? t('actions.edit') : t('actions.search') }}
                </span>
              </button>
            </div>

            <label class="block text-sm">
              <span class="font-medium text-gray-800 dark:text-gray-200">
                {{ t('navigation.inventoryTransferQty') }}
                <span class="text-red-500">*</span>
              </span>
              <input
                v-model="line.quantity"
                type="number"
                min="0.0001"
                step="any"
                required
                class="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm tabular-nums shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                :placeholder="t('records.xferQtyPlaceholder')"
              />
            </label>
          </div>
        </div>
      </div>

      <label class="block text-sm">
        <span class="font-medium text-gray-800 dark:text-gray-200">{{ t('records.xferNotes') }}</span>
        <textarea
          v-model="notes"
          rows="2"
          maxlength="2000"
          class="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          :placeholder="t('records.xferNotesPlaceholder')"
        />
      </label>
    </template>

    <Teleport to="body">
      <div
        v-if="pickerOpen"
        class="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
        @click.self="closeVariantPicker"
      >
        <div
          class="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl dark:bg-gray-800 sm:rounded-xl"
        >
          <div class="border-b border-gray-100 px-4 py-3 dark:border-gray-700">
            <h4 class="text-base font-semibold text-gray-900 dark:text-white">
              {{ t('records.xferPickItemTitle') }}
            </h4>
            <input
              v-model="variantSearchQuery"
              type="search"
              autofocus
              class="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              :placeholder="t('records.xferPickItemSearch')"
              @input="debouncedVariantSearch"
            />
          </div>
          <ul class="min-h-[10rem] flex-1 overflow-y-auto px-2 py-2">
            <li v-if="variantSearchLoading" class="px-3 py-4 text-sm text-gray-500">
              {{ t('states.loading') }}
            </li>
            <li v-else-if="!variantSearchResults.length" class="px-3 py-4 text-sm text-gray-500">
              {{ t('records.xferNoItemsFound') }}
            </li>
            <li
              v-for="hit in variantSearchResults"
              :key="hit._id"
              class="cursor-pointer rounded-lg px-3 py-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
              @click="pickVariant(hit)"
            >
              <span class="block text-sm font-medium text-gray-900 dark:text-white">
                {{ variantHitLabel(hit) }}
              </span>
              <span
                v-if="hit.variant_code || hit.sku"
                class="mt-0.5 block font-mono text-xs text-gray-500"
              >
                {{ hit.variant_code || hit.sku }}
              </span>
            </li>
          </ul>
          <div class="flex justify-end border-t border-gray-100 px-4 py-3 dark:border-gray-700">
            <button
              type="button"
              class="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              @click="closeVariantPicker"
            >
              {{ t('actions.cancel') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, Teleport, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { unwrapCatalogApiData } from '@/utils/catalogApi';

let lineSeq = 0;
function newLine() {
  return {
    key: `line-${++lineSeq}`,
    variantId: '',
    variantLabel: '',
    quantity: ''
  };
}

const { t } = useI18n();
const loading = ref(false);
const loadError = ref('');
const locations = ref([]);
const fromLocationId = ref('');
const toLocationId = ref('');
const notes = ref('');
const lines = ref([newLine()]);

const pickerOpen = ref(false);
const pickerLineIndex = ref(-1);
const variantSearchQuery = ref('');
const variantSearchResults = ref([]);
const variantSearchLoading = ref(false);
let variantSearchTimer = null;

const sameLocation = computed(
  () =>
    fromLocationId.value &&
    toLocationId.value &&
    String(fromLocationId.value) === String(toLocationId.value)
);

const needsSecondStockroom = computed(() => locations.value.length < 2);

/** Destination cannot be the same stockroom as source. */
const toLocationOptions = computed(() =>
  locations.value.filter((loc) => locKey(loc) !== String(fromLocationId.value || ''))
);

watch(fromLocationId, (from) => {
  if (toLocationId.value && String(toLocationId.value) === String(from || '')) {
    toLocationId.value = '';
  }
});

function locKey(loc) {
  return String(loc?.inventoryLocationId || loc?._id || '');
}

function locationLabel(loc) {
  const name = loc?.name || loc?.locationCode || locKey(loc);
  if (loc?.isDefault) return `${name} (${t('navigation.inventoryStockroomDefaultBadge')})`;
  return name;
}

function unwrapList(res) {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res)) return res;
  return [];
}

function variantHitLabel(hit) {
  if (hit?.item_name) {
    return hit.variant_code ? `${hit.item_name} (${hit.variant_code})` : hit.item_name;
  }
  return hit?.variant_code || hit?.sku || String(hit?._id || '');
}

function addLine() {
  lines.value.push(newLine());
}

function removeLine(index) {
  if (lines.value.length <= 1) return;
  lines.value.splice(index, 1);
}

function openVariantPicker(index) {
  pickerLineIndex.value = index;
  pickerOpen.value = true;
  variantSearchQuery.value = '';
  runVariantSearch();
}

function closeVariantPicker() {
  pickerOpen.value = false;
  pickerLineIndex.value = -1;
}

function debouncedVariantSearch() {
  clearTimeout(variantSearchTimer);
  variantSearchTimer = setTimeout(runVariantSearch, 280);
}

async function runVariantSearch() {
  variantSearchLoading.value = true;
  try {
    const res = await apiClient.get('/catalog/variants/search', {
      params: { q: variantSearchQuery.value, limit: 30 }
    });
    const hits = unwrapCatalogApiData(res);
    variantSearchResults.value = Array.isArray(hits) ? hits : [];
  } catch {
    variantSearchResults.value = [];
  } finally {
    variantSearchLoading.value = false;
  }
}

function pickVariant(hit) {
  const idx = pickerLineIndex.value;
  if (idx < 0 || !lines.value[idx]) return;
  lines.value[idx].variantId = String(hit._id || '');
  lines.value[idx].variantLabel = variantHitLabel(hit);
  closeVariantPicker();
}

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    locations.value = unwrapList(
      await apiClient.get('/inventory/locations', { params: { status: 'active' } })
    );
    const first = locations.value[0];
    const second = locations.value[1];
    // Never default To to the same room as From (single-room tenants stay empty).
    if (first) fromLocationId.value = locKey(first);
    toLocationId.value = second ? locKey(second) : '';
  } catch (err) {
    loadError.value = err?.message || t('records.xferCreateLoadFailed');
  } finally {
    loading.value = false;
  }
}

onMounted(load);

defineExpose({
  getPayload() {
    const from = String(fromLocationId.value || '').trim();
    const to = String(toLocationId.value || '').trim();
    if (!from || !to || from === to) return null;

    const mappedLines = [];
    for (const line of lines.value) {
      const variantId = String(line.variantId || '').trim();
      if (!variantId) continue;
      const raw = line.quantity;
      if (raw === '' || raw == null) return null;
      const quantity = Number(raw);
      if (!Number.isFinite(quantity) || quantity <= 0) return null;
      mappedLines.push({ variantId, quantity });
    }
    if (!mappedLines.length) return null;

    return {
      fromLocationId: from,
      toLocationId: to,
      notes: String(notes.value || '').trim() || null,
      lines: mappedLines
    };
  }
});
</script>
