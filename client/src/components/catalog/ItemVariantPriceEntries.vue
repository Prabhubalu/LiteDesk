<template>
  <div class="mt-2 rounded-xl border border-gray-100 dark:border-gray-700/80 bg-gray-50/50 dark:bg-gray-900/20 p-4 sm:p-5">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('platform.catalogPriceEntriesTitle') }}</h4>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('platform.catalogPriceEntriesDesc') }}</p>
      </div>
      <button
        v-if="canEdit && variantId"
        type="button"
        class="text-sm px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
        @click="openForm"
      >
        {{ t('platform.catalogAddPriceEntry') }}
      </button>
    </div>

    <p v-if="entryError" class="text-sm text-red-600 dark:text-red-400 mb-2">{{ entryError }}</p>

    <div v-if="loading" class="text-sm text-gray-500">{{ t('states.loading') }}</div>
    <div
      v-else-if="!entries.length"
      class="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
    >
      {{ t('platform.catalogNoPriceEntries') }}
    </div>
    <div v-else class="overflow-x-auto -mx-1 px-1">
    <table class="w-full min-w-[320px] text-sm">
      <thead>
        <tr class="text-left text-xs text-gray-500 border-b border-gray-200 dark:border-gray-700">
          <th class="py-2 pr-2">{{ t('platform.catalogPriceBookColumn') }}</th>
          <th class="py-2 pr-2">{{ t('platform.catalogUnitPriceColumn') }}</th>
          <th class="py-2 pr-2">{{ t('platform.catalogMinQtyColumn') }}</th>
          <th class="py-2 w-8" />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in displayRows"
          :key="row._id"
          class="border-b border-gray-100 dark:border-gray-800"
        >
          <td class="py-2 pr-2 text-gray-900 dark:text-white">{{ row.bookName }}</td>
          <td class="py-2 pr-2">{{ formatEntryPrice(row) }}</td>
          <td class="py-2 pr-2">{{ row.minQty || 1 }}</td>
          <td class="py-2">
            <button
              v-if="canEdit"
              type="button"
              class="text-xs text-red-600"
              @click="removeEntry(row)"
            >
              ×
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    </div>

    <div v-if="showForm" class="mt-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
      <div>
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{{ t('platform.catalogPriceBookColumn') }}</label>
        <HeadlessSelect
          v-model="form.priceBookId"
          :options="priceBookOptions"
          allow-empty
          empty-value=""
          :empty-label="t('platform.catalogSelectPriceBook')"
          :placeholder="t('platform.catalogSelectPriceBook')"
          teleport
        />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{{ t('platform.catalogUnitPriceColumn') }}</label>
        <input
          v-model.number="form.unitPrice"
          type="number"
          min="0"
          step="0.01"
          class="w-full text-sm px-2 py-1.5 rounded border dark:bg-gray-900 dark:border-gray-600"
          :placeholder="unitPricePlaceholder"
        />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{{ t('platform.catalogMinQtyColumn') }}</label>
        <input
          v-model.number="form.minQty"
          type="number"
          min="1"
          class="w-full text-sm px-2 py-1.5 rounded border dark:bg-gray-900 dark:border-gray-600"
          :placeholder="t('platform.catalogMinQtyColumn')"
        />
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        {{ t('platform.catalogPriceEntryMinQtyHint', { qty: Math.max(1, Number(form.minQty) || 1) }) }}
      </p>
      <div class="flex justify-end gap-2">
        <button type="button" class="text-xs px-2 py-1" @click="showForm = false">{{ t('actions.cancel') }}</button>
        <button
          type="button"
          class="text-xs px-2 py-1 bg-indigo-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!canSave || saving"
          @click="saveEntry"
        >
          {{ saving ? t('states.saving') : t('actions.save') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { unwrapCatalogApiList } from '@/utils/catalogApi';
import { formatCurrencyValue } from '@/utils/currencyOptions';
import { useAuthStore } from '@/stores/authRegistry';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';

import { confirmAction } from '@/composables/useConfirmAction';
const props = defineProps({
  variantId: { type: String, default: '' },
  canEdit: { type: Boolean, default: false }
});

const { t } = useI18n();
const authStore = useAuthStore();

function formatEntryPrice(row) {
  return formatCurrencyValue(row.unitPrice, {
    currencyCode: row.currency,
    orgCurrency: authStore.organization,
  }) || '—';
}

const loading = ref(false);
const entries = ref([]);
const priceBooks = ref([]);
const showForm = ref(false);
const entryError = ref('');
const saving = ref(false);
const form = reactive({ priceBookId: '', unitPrice: null, minQty: 1 });

const priceBookOptions = computed(() =>
  priceBooks.value.map((book) => ({
    value: String(book._id),
    label: book.isDefault
      ? `${book.name} (${t('platform.catalogPriceBookDefaultBadge')})`
      : book.name
  }))
);

const bookNameById = computed(() => {
  const map = {};
  for (const book of priceBooks.value) {
    map[book._id] = book.name;
  }
  return map;
});

const displayRows = computed(() =>
  [...entries.value]
    .map((e) => ({
      ...e,
      bookName: bookNameById.value[e.priceBookId] || e.priceBookId
    }))
    .sort((a, b) => {
      const nameDiff = String(a.bookName || '').localeCompare(String(b.bookName || ''));
      if (nameDiff !== 0) return nameDiff;
      return (Number(b.minQty) || 1) - (Number(a.minQty) || 1);
    })
);

const selectedBook = computed(() => priceBooks.value.find((b) => String(b._id) === String(form.priceBookId)) || null);
const unitPricePlaceholder = computed(() => {
  const cur = selectedBook.value?.currency ? ` (${selectedBook.value.currency})` : '';
  return `${t('platform.catalogUnitPriceColumn')}${cur}`;
});

const canSave = computed(() => {
  if (!props.canEdit) return false;
  if (!props.variantId) return false;
  if (!form.priceBookId) return false;
  const price = Number(form.unitPrice);
  return Number.isFinite(price) && price >= 0;
});

function openForm() {
  showForm.value = true;
  if (!form.priceBookId) {
    const def = priceBooks.value.find((b) => b.isDefault) || priceBooks.value[0] || null;
    if (def) form.priceBookId = def._id;
  }
}

async function loadPriceBooks() {
  const res = await apiClient.get('/catalog/price-books');
  priceBooks.value = unwrapCatalogApiList(res);
  const def = priceBooks.value.find((b) => b.isDefault);
  if (def && !form.priceBookId) form.priceBookId = def._id;
}

async function loadEntries() {
  if (!props.variantId) {
    entries.value = [];
    return;
  }
  loading.value = true;
  try {
    const res = await apiClient.get(`/catalog/variants/${props.variantId}/price-entries`);
    entries.value = unwrapCatalogApiList(res);
  } finally {
    loading.value = false;
  }
}

async function saveEntry() {
  if (!canSave.value || saving.value) return;
  entryError.value = '';
  saving.value = true;
  try {
    const res = await apiClient.post(`/catalog/price-books/${form.priceBookId}/entries`, {
      variantId: props.variantId,
      unitPrice: form.unitPrice,
      minQty: form.minQty
    });
    if (res.success === false) {
      throw new Error(res.message || 'Save failed');
    }
    showForm.value = false;
    form.unitPrice = null;
    form.minQty = 1;
    await loadEntries();
  } catch (err) {
    entryError.value = err.message || 'Could not save price entry';
  } finally {
    saving.value = false;
  }
}

async function removeEntry(row) {
  if (!await confirmAction(t('platform.catalogConfirmDeletePriceEntry'))) return;
  entryError.value = '';
  try {
    await apiClient.delete(`/catalog/price-books/${row.priceBookId}/entries/${row._id}`);
    await loadEntries();
  } catch (err) {
    entryError.value = err.message || 'Could not remove price entry';
  }
}

watch(() => props.variantId, async () => {
  await loadPriceBooks();
  await loadEntries();
}, { immediate: true });
</script>
