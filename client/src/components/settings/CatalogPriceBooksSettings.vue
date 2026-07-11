<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.catalogPriceBooksDesc') }}</p>
      <button
        type="button"
        class="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
        @click="openCreateBook"
      >
        {{ t('settings.catalogAddPriceBook') }}
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('settings.catalogPriceBookList') }}</h3>
        <div v-if="loading" class="text-sm text-gray-500">{{ t('states.loading') }}</div>
        <p v-else-if="loadError" class="text-sm text-red-600 dark:text-red-400">{{ loadError }}</p>
        <p v-else-if="!priceBooks.length" class="text-sm text-gray-500">{{ t('settings.catalogNoPriceBooks') }}</p>
        <ul v-else class="space-y-1">
          <li
            v-for="book in priceBooks"
            :key="book._id"
            class="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer"
            :class="selectedBookId === book._id ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'"
            @click="selectBook(book._id)"
          >
            <span class="flex-1 text-sm text-gray-900 dark:text-white">
              {{ book.name }}
              <span v-if="book.isDefault" class="ml-1 text-xs text-indigo-600">({{ t('settings.catalogPriceBookDefault') }})</span>
            </span>
            <span class="text-xs text-gray-500">{{ book.currency }}</span>
            <button
              v-if="!book.isDefault"
              type="button"
              class="text-xs text-red-600"
              @click.stop="removeBook(book._id)"
            >
              ×
            </button>
          </li>
        </ul>
      </div>

      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.catalogPriceBookEntries') }}</h3>
          <button
            v-if="selectedBookId"
            type="button"
            class="text-xs px-2 py-1 bg-indigo-600 text-white rounded"
            @click="showEntryForm = true"
          >
            {{ t('settings.catalogAddPriceEntry') }}
          </button>
        </div>

        <p v-if="!selectedBookId" class="text-sm text-gray-500">{{ t('settings.catalogSelectPriceBookHint') }}</p>
        <div v-else-if="entriesLoading" class="text-sm text-gray-500">{{ t('states.loading') }}</div>
        <div v-else class="space-y-2 max-h-96 overflow-y-auto">
          <div
            v-for="entry in entries"
            :key="entry._id"
            class="flex items-center justify-between gap-2 p-2 rounded border border-gray-200 dark:border-gray-700 text-sm"
          >
            <div class="min-w-0 flex-1">
              <span class="block truncate text-gray-900 dark:text-white">{{ entryDisplayLabel(entry) }}</span>
              <span
                v-if="entry.variant_code && entry.item_name"
                class="block text-xs text-gray-500 font-mono truncate"
              >
                {{ entry.variant_code }}
              </span>
              <span
                v-else-if="!entry.item_name && !entry.variant_code"
                class="block text-xs text-gray-400 font-mono truncate"
              >
                {{ entry.variantId }}
              </span>
            </div>
            <span class="shrink-0 text-gray-700 dark:text-gray-300">{{ entry.unitPrice }} {{ entry.currency || selectedBook?.currency }}</span>
            <button type="button" class="text-xs text-red-600 shrink-0" @click="removeEntry(entry._id)">×</button>
          </div>
          <p v-if="!entries.length" class="text-sm text-gray-500">{{ t('settings.catalogNoPriceEntries') }}</p>
        </div>
      </div>
    </div>

    <div v-if="showBookForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md space-y-4">
        <h4 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('settings.catalogNewPriceBook') }}</h4>
        <input v-model="bookForm.name" class="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 dark:border-gray-600" :placeholder="t('settings.catalogPriceBookNamePlaceholder')" />
        <input v-model="bookForm.currency" class="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 dark:border-gray-600" placeholder="USD" />
        <label class="inline-flex items-center gap-2 text-sm">
          <input v-model="bookForm.isDefault" type="checkbox" />
          {{ t('settings.catalogPriceBookSetDefault') }}
        </label>
        <div class="flex justify-end gap-2">
          <button type="button" class="px-3 py-2 text-sm" @click="showBookForm = false">{{ t('actions.cancel') }}</button>
          <button type="button" class="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg" @click="saveBook">{{ t('actions.save') }}</button>
        </div>
      </div>
    </div>

    <div v-if="showEntryForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md space-y-4">
        <h4 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('settings.catalogNewPriceEntry') }}</h4>
        <div class="space-y-2">
          <button
            type="button"
            class="w-full px-3 py-2 text-left text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/40"
            @click="openVariantPicker"
          >
            <span v-if="entryForm.variantLabel" class="text-gray-900 dark:text-white">{{ entryForm.variantLabel }}</span>
            <span v-else class="text-gray-500">{{ t('settings.catalogPickVariantForEntry') }}</span>
          </button>
          <p v-if="entryForm.variantId && !entryForm.variantLabel" class="text-xs text-gray-400 font-mono truncate">{{ entryForm.variantId }}</p>
        </div>
        <input v-model.number="entryForm.unitPrice" type="number" min="0" step="0.01" class="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 dark:border-gray-600" :placeholder="t('settings.catalogUnitPricePlaceholder')" />
        <input v-model.number="entryForm.minQty" type="number" min="1" class="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 dark:border-gray-600" :placeholder="t('settings.catalogMinQtyPlaceholder')" />
        <div class="flex justify-end gap-2">
          <button type="button" class="px-3 py-2 text-sm" @click="showEntryForm = false">{{ t('actions.cancel') }}</button>
          <button type="button" class="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg" @click="saveEntry">{{ t('actions.save') }}</button>
        </div>
      </div>
    </div>

    <div v-if="showVariantPicker" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-5 w-full max-w-lg space-y-3 max-h-[80vh] flex flex-col">
        <h4 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('platform.catalogBundlePickVariant') }}</h4>
        <input
          v-model="variantSearchQuery"
          type="search"
          class="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 dark:border-gray-600 text-sm"
          :placeholder="t('platform.catalogBundleSearchPlaceholder')"
          @input="debouncedVariantSearch"
        />
        <ul class="flex-1 overflow-y-auto space-y-1 min-h-[120px]">
          <li v-if="variantSearchLoading" class="text-sm text-gray-500 px-2">{{ t('states.loading') }}</li>
          <li v-else-if="!variantSearchResults.length" class="text-sm text-gray-500 px-2">{{ t('settings.catalogNoVariantsFound') }}</li>
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
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { unwrapCatalogApiData, unwrapCatalogApiList } from '@/utils/catalogApi';
import { resolveOrgCurrencyCode } from '@/utils/currencyOptions';
import { useAuthStore } from '@/stores/authRegistry';

const { t } = useI18n();
const authStore = useAuthStore();
const orgCurrency = computed(() => resolveOrgCurrencyCode(authStore.organization));

const loading = ref(false);
const loadError = ref('');
const priceBooks = ref([]);
const selectedBookId = ref('');
const entries = ref([]);
const entriesLoading = ref(false);
const showBookForm = ref(false);
const showEntryForm = ref(false);
const showVariantPicker = ref(false);
const variantSearchQuery = ref('');
const variantSearchResults = ref([]);
const variantSearchLoading = ref(false);
let variantSearchTimer;

const bookForm = reactive({ name: '', currency: resolveOrgCurrencyCode(), isDefault: false });
const entryForm = reactive({ variantId: '', variantLabel: '', unitPrice: 0, minQty: 1 });

function entryDisplayLabel(entry) {
  if (entry.item_name) {
    return entry.variant_code ? `${entry.item_name} (${entry.variant_code})` : entry.item_name;
  }
  return entry.variant_code || entry.variantId;
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

function debouncedVariantSearch() {
  clearTimeout(variantSearchTimer);
  variantSearchTimer = setTimeout(runVariantSearch, 300);
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

function pickVariant(hit) {
  entryForm.variantId = String(hit._id);
  entryForm.variantLabel = variantHitLabel(hit);
  showVariantPicker.value = false;
}

const selectedBook = computed(() => priceBooks.value.find((b) => b._id === selectedBookId.value));

async function loadBooks() {
  loading.value = true;
  loadError.value = '';
  try {
    const res = await apiClient.get('/catalog/price-books');
    priceBooks.value = unwrapCatalogApiList(res);
    if (!selectedBookId.value && priceBooks.value.length) {
      const def = priceBooks.value.find((b) => b.isDefault) || priceBooks.value[0];
      selectedBookId.value = String(def._id);
      await loadEntries();
    }
  } catch (err) {
    console.error('loadBooks error:', err);
    loadError.value = err?.message || t('settings.catalogPriceBooksLoadFailed');
    priceBooks.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadEntries() {
  if (!selectedBookId.value) return;
  entriesLoading.value = true;
  try {
    const res = await apiClient.get(`/catalog/price-books/${selectedBookId.value}/entries`);
    entries.value = unwrapCatalogApiList(res);
  } finally {
    entriesLoading.value = false;
  }
}

function selectBook(id) {
  selectedBookId.value = id;
  loadEntries();
}

function openCreateBook() {
  bookForm.name = '';
  bookForm.currency = orgCurrency.value;
  bookForm.isDefault = false;
  showBookForm.value = true;
}

async function saveBook() {
  await apiClient.post('/catalog/price-books', {
    name: bookForm.name,
    currency: bookForm.currency,
    isDefault: bookForm.isDefault
  });
  showBookForm.value = false;
  await loadBooks();
}

async function removeBook(id) {
  if (!confirm(t('settings.catalogConfirmDeletePriceBook'))) return;
  await apiClient.delete(`/catalog/price-books/${id}`);
  if (selectedBookId.value === id) {
    selectedBookId.value = '';
    entries.value = [];
  }
  await loadBooks();
}

async function saveEntry() {
  if (!entryForm.variantId) return;
  await apiClient.post(`/catalog/price-books/${selectedBookId.value}/entries`, {
    variantId: entryForm.variantId,
    unitPrice: entryForm.unitPrice,
    minQty: entryForm.minQty
  });
  showEntryForm.value = false;
  entryForm.variantId = '';
  entryForm.variantLabel = '';
  entryForm.unitPrice = 0;
  entryForm.minQty = 1;
  await loadEntries();
}

async function removeEntry(entryId) {
  await apiClient.delete(`/catalog/price-books/${selectedBookId.value}/entries/${entryId}`);
  await loadEntries();
}

onMounted(loadBooks);
</script>
