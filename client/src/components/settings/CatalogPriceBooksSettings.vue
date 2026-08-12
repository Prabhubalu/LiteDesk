<template>
  <div class="space-y-4">
    <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.catalogPriceBooksDesc') }}</p>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <!-- Price books -->
      <section class="flex min-h-[28rem] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/40">
        <div class="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <div class="min-w-0">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.catalogPriceBookList') }}</h3>
            <p v-if="!loading && priceBooks.length" class="mt-0.5 text-xs text-gray-400">
              {{ t('settings.catalogPriceBookCount', { count: priceBooks.length }) }}
            </p>
          </div>
          <button
            type="button"
            class="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            @click="openCreateBook"
          >
            <PlusIcon class="h-3.5 w-3.5" aria-hidden="true" />
            {{ t('settings.catalogAddPriceBook') }}
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-2">
          <div v-if="loading" class="flex justify-center py-12">
            <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
          </div>

          <div
            v-else-if="loadError"
            class="mx-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-300"
          >
            {{ loadError }}
          </div>

          <div
            v-else-if="!priceBooks.length"
            class="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 px-4 py-12 text-center dark:border-gray-600"
          >
            <div class="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
              <BanknotesIcon class="h-5 w-5" aria-hidden="true" />
            </div>
            <p class="mt-3 text-sm font-medium text-gray-800 dark:text-gray-100">{{ t('settings.catalogPriceBooksEmpty') }}</p>
            <p class="mt-1 max-w-xs text-xs text-gray-500">{{ t('settings.catalogPriceBooksEmptyHint') }}</p>
            <button
              type="button"
              class="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              @click="openCreateBook"
            >
              <PlusIcon class="h-4 w-4" aria-hidden="true" />
              {{ t('settings.catalogAddPriceBook') }}
            </button>
          </div>

          <ul v-else class="space-y-0.5">
            <li
              v-for="book in priceBooks"
              :key="book._id"
              class="group/row flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors"
              :class="selectedBookId === book._id
                ? 'bg-indigo-50 dark:bg-indigo-900/25'
                : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'"
              @click="selectBook(book._id)"
            >
              <span
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                :class="selectedBookId === book._id
                  ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'"
                aria-hidden="true"
              >
                <BanknotesIcon class="h-3.5 w-3.5" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex min-w-0 items-center gap-1.5">
                  <span
                    class="truncate text-sm"
                    :class="selectedBookId === book._id
                      ? 'font-medium text-indigo-900 dark:text-indigo-100'
                      : 'text-gray-900 dark:text-white'"
                  >
                    {{ book.name }}
                  </span>
                  <span
                    v-if="book.isDefault"
                    class="shrink-0 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
                  >
                    {{ t('settings.catalogPriceBookDefault') }}
                  </span>
                </div>
                <p class="truncate text-xs text-gray-400">{{ book.currency }}</p>
              </div>
              <div
                class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100"
                :class="{ 'opacity-100': selectedBookId === book._id }"
              >
                <button
                  type="button"
                  class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:border-indigo-500 dark:hover:bg-gray-600 dark:hover:text-indigo-300"
                  :title="t('actions.edit')"
                  :aria-label="t('actions.edit')"
                  @click.stop="openEditBook(book)"
                >
                  <PencilSquareIcon class="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  v-if="!book.isDefault"
                  type="button"
                  class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:border-red-700 dark:hover:bg-red-950/60 dark:hover:text-red-300"
                  :title="t('actions.delete')"
                  :aria-label="t('actions.delete')"
                  @click.stop="removeBook(book._id)"
                >
                  <TrashIcon class="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </li>
          </ul>
        </div>
      </section>

      <!-- Entries -->
      <section class="flex min-h-[28rem] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/40">
        <div class="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <div class="min-w-0">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.catalogPriceBookEntries') }}</h3>
            <p v-if="selectedBook" class="mt-0.5 truncate text-xs text-gray-400">
              {{ entries.length && !entriesLoading
                ? t('settings.catalogEntriesForBookWithCount', { name: selectedBook.name, count: entries.length })
                : t('settings.catalogEntriesForBook', { name: selectedBook.name }) }}
            </p>
          </div>
          <button
            v-if="selectedBookId"
            type="button"
            class="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            @click="openEntryForm"
          >
            <PlusIcon class="h-3.5 w-3.5" aria-hidden="true" />
            {{ t('settings.catalogAddPriceEntry') }}
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-4">
          <div
            v-if="!selectedBookId"
            class="flex h-full flex-col items-center justify-center px-4 py-12 text-center"
          >
            <div class="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500">
              <TagIcon class="h-5 w-5" aria-hidden="true" />
            </div>
            <p class="mt-3 text-sm font-medium text-gray-800 dark:text-gray-100">{{ t('settings.catalogSelectPriceBookTitle') }}</p>
            <p class="mt-1 max-w-xs text-xs text-gray-500">{{ t('settings.catalogSelectPriceBookHint') }}</p>
          </div>

          <div v-else-if="entriesLoading" class="flex justify-center py-12">
            <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
          </div>

          <div
            v-else-if="!entries.length"
            class="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 px-4 py-12 text-center dark:border-gray-600"
          >
            <div class="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
              <TagIcon class="h-5 w-5" aria-hidden="true" />
            </div>
            <p class="mt-3 text-sm font-medium text-gray-800 dark:text-gray-100">{{ t('settings.catalogNoPriceEntries') }}</p>
            <p class="mt-1 max-w-xs text-xs text-gray-500">{{ t('settings.catalogNoPriceEntriesHint') }}</p>
            <button
              type="button"
              class="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              @click="openEntryForm"
            >
              <PlusIcon class="h-4 w-4" aria-hidden="true" />
              {{ t('settings.catalogAddPriceEntry') }}
            </button>
          </div>

          <template v-else>
            <label v-if="entries.length > 4" class="relative mb-3 block">
              <span class="sr-only">{{ t('settings.catalogEntrySearch') }}</span>
              <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <input
                v-model="entrySearchQuery"
                type="search"
                :placeholder="t('settings.catalogEntrySearch')"
                class="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </label>

            <p
              v-if="entrySearchQuery && !filteredEntries.length"
              class="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-600"
            >
              {{ t('settings.catalogEntrySearchEmpty') }}
            </p>

            <ul v-else class="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
              <li
                v-for="entry in filteredEntries"
                :key="entry._id"
                class="group/entry flex items-center gap-3 bg-white px-3 py-2.5 transition-colors hover:bg-gray-50/90 dark:bg-gray-800/40 dark:hover:bg-gray-800/70"
              >
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-gray-900 dark:text-white">
                    {{ entryPrimaryLabel(entry) }}
                  </p>
                  <p v-if="entrySecondaryLabel(entry)" class="truncate text-xs font-mono text-gray-500">
                    {{ entrySecondaryLabel(entry) }}
                  </p>
                </div>
                <div class="shrink-0 text-right">
                  <p class="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                    {{ formatEntryPrice(entry) }}
                  </p>
                  <p v-if="entry.minQty && entry.minQty > 1" class="text-[11px] text-gray-400">
                    {{ t('settings.catalogEntryMinQty', { qty: entry.minQty }) }}
                  </p>
                </div>
                <button
                  type="button"
                  class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 opacity-0 transition-opacity hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus-within:opacity-100 group-hover/entry:opacity-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:border-red-700 dark:hover:bg-red-950/60 dark:hover:text-red-300"
                  :title="t('actions.delete')"
                  :aria-label="t('actions.delete')"
                  @click="removeEntry(entry._id)"
                >
                  <TrashIcon class="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            </ul>
          </template>
        </div>
      </section>
    </div>

    <!-- Create price book -->
    <div
      v-if="showBookForm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="showBookForm = false"
    >
      <div
        class="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="bookDialogTitleId"
      >
        <h4 :id="bookDialogTitleId" class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ editingBookId ? t('settings.catalogEditPriceBook') : t('settings.catalogNewPriceBook') }}
        </h4>
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.catalogPriceBookNamePlaceholder') }}</span>
          <input
            ref="bookNameInput"
            v-model="bookForm.name"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            :placeholder="t('settings.catalogPriceBookNamePlaceholder')"
            @keydown.enter.prevent="saveBook"
            @keydown.esc.prevent="showBookForm = false"
          />
        </label>
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.catalogPriceBookCurrency') }}</span>
          <HeadlessSelect
            v-model="bookForm.currency"
            :options="currencySelectOptions"
            teleport
            :searchable="currencySelectOptions.length > 7"
          />
        </label>
        <div class="space-y-2">
          <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.catalogPriceBookCustomerTypes') }}</span>
          <div class="grid grid-cols-2 gap-2">
            <label
              v-for="ct in customerTypeOptions"
              :key="ct"
              class="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-2 text-xs text-gray-700 dark:border-gray-600 dark:text-gray-300"
            >
              <HeadlessCheckbox
                :model-value="bookForm.customerTypes.includes(ct)"
                size="sm"
                @update:model-value="toggleCustomerType(ct, $event)"
              />
              {{ ct }}
            </label>
          </div>
        </div>
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.catalogPriceBookRegions') }}</span>
          <input
            v-model="bookForm.regionCodesRaw"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            :placeholder="t('settings.catalogPriceBookRegionsPlaceholder')"
          />
        </label>
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.catalogPriceBookPriority') }}</span>
          <input
            v-model.number="bookForm.priority"
            type="number"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          />
        </label>
        <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <HeadlessCheckbox
            v-model="bookForm.isDefault"
            size="sm"
            :disabled="editingBookId && bookForm.isDefault && editingWasDefault"
          />
          {{ t('settings.catalogPriceBookSetDefault') }}
        </label>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            @click="showBookForm = false"
          >
            {{ t('actions.cancel') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!bookForm.name.trim()"
            @click="saveBook"
          >
            {{ t('actions.save') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Add entry -->
    <div
      v-if="showEntryForm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="showEntryForm = false"
    >
      <div
        class="w-full max-w-md space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="entryDialogTitleId"
      >
        <h4 :id="entryDialogTitleId" class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('settings.catalogNewPriceEntry') }}
        </h4>
        <div class="space-y-1.5">
          <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.catalogPickVariantForEntry') }}</span>
          <button
            type="button"
            class="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-left text-sm hover:bg-gray-50 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:hover:bg-gray-800"
            @click="openVariantPicker"
          >
            <span :class="entryForm.variantLabel ? 'text-gray-900 dark:text-white' : 'text-gray-500'">
              {{ entryForm.variantLabel || t('settings.catalogPickVariantForEntry') }}
            </span>
            <MagnifyingGlassIcon class="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
          </button>
          <p v-if="entryForm.variantId && !entryForm.variantLabel" class="truncate text-xs font-mono text-gray-400">
            {{ entryForm.variantId }}
          </p>
        </div>
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.catalogUnitPricePlaceholder') }}</span>
          <input
            v-model.number="entryForm.unitPrice"
            type="number"
            min="0"
            step="0.01"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            :placeholder="t('settings.catalogUnitPricePlaceholder')"
          />
        </label>
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.catalogMinQtyPlaceholder') }}</span>
          <input
            v-model.number="entryForm.minQty"
            type="number"
            min="1"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            :placeholder="t('settings.catalogMinQtyPlaceholder')"
          />
        </label>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            @click="showEntryForm = false"
          >
            {{ t('actions.cancel') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!entryForm.variantId || entryForm.unitPrice <= 0"
            @click="saveEntry"
          >
            {{ t('actions.save') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Variant picker -->
    <div
      v-if="showVariantPicker"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      @click.self="showVariantPicker = false"
    >
      <div class="flex max-h-[80vh] w-full max-w-lg flex-col space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-800">
        <h4 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('platform.catalogBundlePickVariant') }}</h4>
        <label class="relative block">
          <span class="sr-only">{{ t('platform.catalogBundleSearchPlaceholder') }}</span>
          <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            v-model="variantSearchQuery"
            type="search"
            class="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            :placeholder="t('platform.catalogBundleSearchPlaceholder')"
            @input="debouncedVariantSearch"
          />
        </label>
        <ul class="min-h-[120px] flex-1 space-y-0.5 overflow-y-auto">
          <li v-if="variantSearchLoading" class="px-2 py-8 text-center text-sm text-gray-500">{{ t('states.loading') }}</li>
          <li v-else-if="!variantSearchResults.length" class="px-2 py-8 text-center text-sm text-gray-500">{{ t('settings.catalogNoVariantsFound') }}</li>
          <li
            v-for="hit in variantSearchResults"
            :key="hit._id"
            class="cursor-pointer rounded-lg px-3 py-2.5 transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
            @click="pickVariant(hit)"
          >
            <span class="text-sm font-medium text-gray-900 dark:text-white">{{ hit.item_name || hit.variant_code }}</span>
            <span v-if="hit.variant_code && hit.item_name" class="block text-xs font-mono text-gray-500">{{ hit.variant_code }}</span>
          </li>
        </ul>
        <div class="flex justify-end">
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            @click="showVariantPicker = false"
          >
            {{ t('actions.cancel') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  BanknotesIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  TagIcon,
  TrashIcon,
} from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { unwrapCatalogApiData, unwrapCatalogApiList } from '@/utils/catalogApi';
import {
  formatCurrencyValue,
  getEnabledCurrencyOptions,
  resolveOrgCurrencyCode,
} from '@/utils/currencyOptions';
import { useAuthStore } from '@/stores/authRegistry';
import { confirmAction } from '@/composables/useConfirmAction';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';

const { t } = useI18n();
const authStore = useAuthStore();

const bookDialogTitleId = 'catalog-price-book-dialog-title';
const entryDialogTitleId = 'catalog-price-entry-dialog-title';
const bookNameInput = ref(null);

const orgCurrency = computed(() => resolveOrgCurrencyCode(authStore.organization));
const currencyOptions = computed(() => getEnabledCurrencyOptions(authStore.organization));
const currencySelectOptions = computed(() =>
  currencyOptions.value.map((opt) => ({
    value: opt.code,
    label: `${opt.symbol || opt.code} ${opt.code} — ${opt.name}`,
  }))
);

function formatEntryPrice(entry) {
  return formatCurrencyValue(entry.unitPrice, {
    currencyCode: entry.currency || selectedBook.value?.currency || orgCurrency.value,
    orgCurrency: authStore.organization,
  }) || '—';
}

const loading = ref(false);
const loadError = ref('');
const priceBooks = ref([]);
const selectedBookId = ref('');
const entries = ref([]);
const entriesLoading = ref(false);
const entrySearchQuery = ref('');
const showBookForm = ref(false);
const editingBookId = ref(null);
const editingWasDefault = ref(false);
const showEntryForm = ref(false);
const showVariantPicker = ref(false);
const variantSearchQuery = ref('');
const variantSearchResults = ref([]);
const variantSearchLoading = ref(false);
let variantSearchTimer;

const bookForm = reactive({
  name: '',
  currency: resolveOrgCurrencyCode(),
  isDefault: false,
  customerTypes: [],
  regionCodesRaw: '',
  priority: 100,
});
const customerTypeOptions = ['RETAIL', 'DEALER', 'DISTRIBUTOR', 'CORPORATE'];
const entryForm = reactive({ variantId: '', variantLabel: '', unitPrice: 0, minQty: 1 });

const selectedBook = computed(() => priceBooks.value.find((b) => b._id === selectedBookId.value));

const filteredEntries = computed(() => {
  const query = entrySearchQuery.value.trim().toLowerCase();
  if (!query) return entries.value;
  return entries.value.filter((entry) => {
    const haystack = [
      entryPrimaryLabel(entry),
      entrySecondaryLabel(entry),
      entry.variantId,
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(query);
  });
});

function entryPrimaryLabel(entry) {
  return entry.item_name || entry.variant_code || entry.variantId || '—';
}

function entrySecondaryLabel(entry) {
  if (entry.item_name && entry.variant_code) return entry.variant_code;
  if (!entry.item_name && !entry.variant_code && entry.variantId) return entry.variantId;
  return '';
}

function variantHitLabel(hit) {
  if (hit.item_name) {
    return hit.variant_code ? `${hit.item_name} (${hit.variant_code})` : hit.item_name;
  }
  return hit.variant_code || String(hit._id);
}

function toggleCustomerType(type, checked) {
  if (checked) {
    if (!bookForm.customerTypes.includes(type)) bookForm.customerTypes.push(type);
    return;
  }
  bookForm.customerTypes = bookForm.customerTypes.filter((value) => value !== type);
}

function openEntryForm() {
  entryForm.variantId = '';
  entryForm.variantLabel = '';
  entryForm.unitPrice = 0;
  entryForm.minQty = 1;
  showEntryForm.value = true;
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
      params: { q: variantSearchQuery.value, limit: 25 },
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
  entrySearchQuery.value = '';
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
  editingBookId.value = null;
  editingWasDefault.value = false;
  bookForm.name = '';
  bookForm.currency = orgCurrency.value;
  bookForm.isDefault = false;
  bookForm.customerTypes = [];
  bookForm.regionCodesRaw = '';
  bookForm.priority = 100;
  showBookForm.value = true;
}

function openEditBook(book) {
  editingBookId.value = String(book._id);
  editingWasDefault.value = !!book.isDefault;
  bookForm.name = book.name || '';
  bookForm.currency = book.currency || orgCurrency.value;
  bookForm.isDefault = !!book.isDefault;
  bookForm.customerTypes = [...(book.customerTypes || [])];
  bookForm.regionCodesRaw = (book.regionCodes || []).join(', ');
  bookForm.priority = Number.isFinite(Number(book.priority)) ? Number(book.priority) : 100;
  showBookForm.value = true;
}

watch(showBookForm, async (open) => {
  if (!open) {
    editingBookId.value = null;
    editingWasDefault.value = false;
    return;
  }
  await nextTick();
  bookNameInput.value?.focus?.();
});

async function saveBook() {
  if (!bookForm.name.trim()) return;
  const regionCodes = String(bookForm.regionCodesRaw || '')
    .split(/[\s,]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const payload = {
    name: bookForm.name.trim(),
    currency: bookForm.currency,
    customerTypes: bookForm.customerTypes,
    regionCodes,
    priority: bookForm.priority,
  };
  // Never unset default from this form; promote another book to default instead.
  if (bookForm.isDefault) payload.isDefault = true;

  if (editingBookId.value) {
    await apiClient.put(`/catalog/price-books/${editingBookId.value}`, payload);
  } else {
    await apiClient.post('/catalog/price-books', payload);
  }
  showBookForm.value = false;
  await loadBooks();
  if (selectedBookId.value) await loadEntries();
}

async function removeBook(id) {
  if (!await confirmAction(t('settings.catalogConfirmDeletePriceBook'))) return;
  await apiClient.delete(`/catalog/price-books/${id}`);
  if (selectedBookId.value === id) {
    selectedBookId.value = '';
    entries.value = [];
  }
  await loadBooks();
}

async function saveEntry() {
  if (!entryForm.variantId || entryForm.unitPrice <= 0) return;
  await apiClient.post(`/catalog/price-books/${selectedBookId.value}/entries`, {
    variantId: entryForm.variantId,
    unitPrice: entryForm.unitPrice,
    minQty: entryForm.minQty,
  });
  showEntryForm.value = false;
  entryForm.variantId = '';
  entryForm.variantLabel = '';
  entryForm.unitPrice = 0;
  entryForm.minQty = 1;
  await loadEntries();
}

async function removeEntry(entryId) {
  if (!await confirmAction(t('settings.catalogConfirmDeletePriceEntry'))) return;
  await apiClient.delete(`/catalog/price-books/${selectedBookId.value}/entries/${entryId}`);
  await loadEntries();
}

onMounted(loadBooks);
</script>
