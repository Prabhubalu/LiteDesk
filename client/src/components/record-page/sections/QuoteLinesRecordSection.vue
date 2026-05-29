<template>
  <section v-if="record?._id" class="space-y-3">
    <p
      v-if="totalsStaleHint"
      class="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2"
    >
      {{ t('records.linesTotalsStaleHint') }}
      <button type="button" class="ml-1 underline font-medium" :disabled="busy" @click="recalculate">
        {{ t('records.linesRecalculate') }}
      </button>
    </p>

    <!-- Lines table -->
    <div class="relative rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div
        v-if="busy"
        class="absolute inset-0 z-10 flex items-center justify-center bg-white/60 dark:bg-gray-900/60 backdrop-blur-[1px]"
      >
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
      <div class="flex items-center justify-end gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/40">
        <label class="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 select-none">
          <input v-model="showPricingColumns" type="checkbox" class="rounded" />
          {{ t('records.linesShowPricingDetails') }}
        </label>
      </div>
      <div
        class="overflow-x-auto"
        :class="{ 'quote-lines-table--dragging': isReorderDragging }"
      >
        <table class="min-w-full text-sm quote-lines-table">
          <thead class="bg-gray-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300">
            <tr>
              <th v-if="linesEditable" class="px-2 py-2 w-9" :aria-label="t('records.linesReorderColumn')">
                <span class="sr-only">{{ t('records.linesReorderColumn') }}</span>
              </th>
              <th class="px-3 py-2 text-left font-normal">{{ t('records.linesSku') }}</th>
              <th class="px-3 py-2 text-left font-normal">{{ t('records.linesName') }}</th>
              <th v-if="showPricingColumns" class="px-3 py-2 text-left font-normal">{{ t('records.linesPriceBook') }}</th>
              <th v-if="showPricingColumns" class="px-3 py-2 text-left font-normal">{{ t('records.linesPriceSource') }}</th>
              <th class="px-3 py-2 text-right font-normal">{{ t('records.linesQty') }}</th>
              <th class="px-3 py-2 text-right font-normal">{{ t('records.linesUnitPrice') }}</th>
              <th v-if="linesEditable" class="px-3 py-2 text-right font-normal">{{ t('records.linesDiscount') }}</th>
              <th class="px-3 py-2 text-right font-normal">{{ t('records.linesTotal') }}</th>
              <th class="px-3 py-2 text-right font-normal w-16"></th>
            </tr>
          </thead>
          <tbody v-if="!displayLines.length" class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr class="text-gray-500 dark:text-gray-400">
              <td class="px-3 py-3" :colspan="tableColspan">{{ t('records.linesEmpty') }}</td>
            </tr>
          </tbody>
          <draggable
            v-else
            v-model="reorderableRows"
            tag="tbody"
            item-key="uid"
            handle=".quote-line-drag-handle"
            :animation="200"
            :easing="'cubic-bezier(0.2, 0, 0, 1)'"
            :force-fallback="true"
            :fallback-on-body="true"
            fallback-class="quote-line-sortable-fallback"
            ghost-class="quote-line-sortable-ghost"
            chosen-class="quote-line-sortable-chosen"
            drag-class="quote-line-sortable-drag"
            :disabled="!linesEditable || busy"
            class="divide-y divide-gray-200 dark:divide-gray-700"
            @start="onLineOrderDragStart"
            @end="onLineOrderDragEnd"
          >
            <template #item="{ element: { line, indent, isBundleParent, isOptional } }">
              <tr
                class="text-gray-900 dark:text-gray-100"
                :class="isBundleParent ? 'bg-indigo-50/40 dark:bg-indigo-900/10' : ''"
              >
              <td v-if="linesEditable" class="px-2 py-2 w-9 align-middle">
                <button
                  type="button"
                  class="quote-line-drag-handle inline-flex items-center justify-center p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-grab active:cursor-grabbing disabled:opacity-40"
                  :aria-label="t('records.linesDragHandleAria')"
                  :title="t('records.linesDragHandleAria')"
                  :disabled="busy"
                >
                  <Bars3Icon class="h-4 w-4" />
                </button>
              </td>
              <td class="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-300">
                {{ line.skuSnapshot || '—' }}
              </td>
              <td class="px-3 py-2">
                <div class="min-w-0 flex items-start gap-1" :class="indent ? 'pl-4' : ''">
                  <span v-if="indent" class="text-gray-400 shrink-0" aria-hidden="true">↳</span>
                  <div class="min-w-0">
                    <div class="truncate" :class="{ 'font-semibold': isBundleParent }">
                      <span v-if="isOptional" class="text-xs text-gray-500 mr-1">[{{ t('records.linesOptional') }}]</span>
                      {{ line.itemNameSnapshot || '—' }}
                    </div>
                    <button
                      v-if="linesEditable && isBundleParent && bundleParentHasOptionals(line)"
                      type="button"
                      class="mt-0.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                      :disabled="busy"
                      @click.stop="openBundleOptionalConfig(line)"
                    >
                      {{ t('records.linesBundleOptionalConfigure') }}
                    </button>
                  </div>
                </div>
              </td>
              <td v-if="showPricingColumns" class="px-3 py-2 text-xs text-gray-700 dark:text-gray-200">
                <span :title="priceProvenanceTitle(line)">
                  {{ line.priceBookNameSnapshot || '—' }}
                </span>
              </td>
              <td v-if="showPricingColumns" class="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                {{ pricingSourceLabel(line.pricingSourceSnapshot) }}
              </td>
              <td class="px-3 py-2 text-right">
                <input
                  v-if="linesEditable"
                  class="w-20 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-right"
                  type="number"
                  min="0"
                  step="1"
                  :value="line.quantity"
                  :disabled="busy"
                  @change="(e) => patchQty(line, e?.target?.value)"
                />
                <span v-else class="tabular-nums">{{ line.quantity }}</span>
              </td>
              <td class="px-3 py-2 text-right tabular-nums">
                {{ formatMoney(line.unitPriceSnapshot) }}
              </td>
              <td v-if="linesEditable" class="px-3 py-2 text-right">
                <div class="inline-flex items-center justify-end gap-1">
                  <select
                    class="w-14 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-1 py-1 text-xs"
                    :value="lineDiscountType(line)"
                    :disabled="busy"
                    @change="(e) => patchLineDiscount(line, { type: e.target.value })"
                  >
                    <option value="">{{ t('records.linesDiscountNone') }}</option>
                    <option value="percent">{{ t('records.linesDiscountPercent') }}</option>
                    <option value="amount">{{ t('records.linesDiscountAmount') }}</option>
                  </select>
                  <input
                    v-if="lineDiscountType(line)"
                    class="w-16 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-1.5 py-1 text-xs text-right tabular-nums"
                    type="number"
                    min="0"
                    step="any"
                    :value="lineDiscountValue(line)"
                    :disabled="busy"
                    @change="(e) => patchLineDiscount(line, { value: e.target.value })"
                  />
                </div>
              </td>
              <td class="px-3 py-2 text-right font-medium tabular-nums">
                {{ formatMoney(line.lineTotal) }}
              </td>
              <td class="px-3 py-2 text-right">
                <button
                  v-if="linesEditable"
                  type="button"
                  class="inline-flex items-center justify-center p-1.5 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                  :title="t('actions.delete')"
                  :aria-label="t('actions.delete')"
                  :disabled="busy"
                  @click="requestRemoveLine(line)"
                >
                  <TrashIcon class="h-4 w-4" />
                </button>
              </td>
              </tr>
            </template>
          </draggable>
        </table>
      </div>
    </div>

    <!-- Add line (before totals) -->
    <div
      v-if="linesEditable"
      class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 space-y-2"
    >
      <div class="text-sm font-medium text-gray-700 dark:text-gray-200">
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
          v-model="selectedPriceBookId"
          class="w-full md:w-56 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          :disabled="busy || priceBooksLoading"
        >
          <option value="">{{ t('records.linesDefaultPriceBook') }}</option>
          <option v-for="b in priceBooks" :key="b._id" :value="String(b._id)">
            {{ b.name }}
          </option>
        </select>
        <input
          v-model.number="quantity"
          class="w-28 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          type="number"
          min="1"
          step="1"
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
          {{ t('records.linesAddBundle') }}
        </button>
      </div>
    </div>

    <!-- Totals -->
    <div class="flex justify-end">
      <div
        class="w-full max-w-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-4 space-y-2"
        data-testid="quote-lines-totals"
      >
        <div class="flex items-center justify-between text-sm">
          <span class="text-gray-600 dark:text-gray-400">{{ t('records.linesTotalsSubtotal') }}</span>
          <span class="font-medium text-gray-900 dark:text-gray-100 tabular-nums">{{ formatMoney(totals.subtotal) }}</span>
        </div>
        <div v-if="totals.lineDiscountTotal > 0" class="flex items-center justify-between text-sm">
          <span class="text-gray-600 dark:text-gray-400">{{ t('records.linesTotalsLineDiscount') }}</span>
          <span class="font-medium text-gray-900 dark:text-gray-100 tabular-nums">−{{ formatMoney(totals.lineDiscountTotal) }}</span>
        </div>
        <div class="flex items-center justify-between gap-2 text-sm">
          <span class="text-gray-600 dark:text-gray-400 shrink-0">{{ t('records.linesTotalsGlobalDiscount') }}</span>
          <div class="inline-flex items-center gap-2 ml-auto">
            <div v-if="linesEditable" class="inline-flex items-center gap-1">
              <select
                v-model="globalDiscountType"
                class="w-14 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-1 py-1 text-xs"
                :disabled="busy"
                @change="saveGlobalDiscount"
              >
                <option value="">{{ t('records.linesDiscountNone') }}</option>
                <option value="percent">{{ t('records.linesDiscountPercent') }}</option>
                <option value="amount">{{ t('records.linesDiscountAmount') }}</option>
              </select>
              <input
                v-if="globalDiscountType"
                v-model.number="globalDiscountValue"
                class="w-20 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-1.5 py-1 text-xs text-right tabular-nums"
                type="number"
                min="0"
                step="any"
                :disabled="busy"
                @change="saveGlobalDiscount"
              />
            </div>
            <span
              v-if="totals.globalDiscountTotal > 0 || !linesEditable"
              class="font-medium text-gray-900 dark:text-gray-100 tabular-nums shrink-0"
            >
              −{{ formatMoney(totals.globalDiscountTotal) }}
            </span>
          </div>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-gray-600 dark:text-gray-400">{{ t('records.linesTotalsTax') }}</span>
          <span class="font-medium text-gray-900 dark:text-gray-100 tabular-nums">{{ formatMoney(totals.taxTotal) }}</span>
        </div>
        <div v-if="totals.adjustmentTotal !== 0" class="flex items-center justify-between text-sm">
          <span class="text-gray-600 dark:text-gray-400">{{ t('records.linesTotalsAdjustment') }}</span>
          <span class="font-medium text-gray-900 dark:text-gray-100 tabular-nums">{{ formatMoney(totals.adjustmentTotal) }}</span>
        </div>
        <div class="flex items-center justify-between text-base border-t border-gray-200 dark:border-gray-600 pt-2">
          <span class="font-semibold text-gray-900 dark:text-white">{{ t('records.linesTotalsGrandTotal') }}</span>
          <span class="font-semibold text-gray-900 dark:text-white tabular-nums">{{ formatMoney(totals.grandTotal) }}</span>
        </div>
        <div v-if="currencyCode" class="text-xs text-gray-500 dark:text-gray-400 text-right">
          {{ t('records.linesTotalsCurrency', { currency: currencyCode }) }}
        </div>
      </div>
    </div>

    <!-- Pickers -->
    <div v-if="showBundlePicker" class="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-5 w-full max-w-lg space-y-3 max-h-[80vh] flex flex-col">
        <h4 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('records.linesPickBundleTitle') }}</h4>
        <input
          v-model="bundleSearchQuery"
          type="search"
          class="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 dark:border-gray-600 text-sm"
          :placeholder="t('records.linesBundleSearchPlaceholder')"
          @input="debouncedBundleSearch"
        />
        <ul class="flex-1 overflow-y-auto space-y-1 min-h-[120px]">
          <li v-if="bundleSearchLoading" class="text-sm text-gray-500 px-2">{{ t('states.loading') }}</li>
          <li v-else-if="!bundleSearchResults.length" class="text-sm text-gray-500 px-2">{{ t('records.linesNoBundlesFound') }}</li>
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

    <div v-if="showBundleOptionalModal" class="fixed inset-0 z-[75] flex items-center justify-center bg-black/40 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-5 w-full max-w-lg space-y-3 max-h-[80vh] flex flex-col">
        <h4 class="text-base font-semibold text-gray-900 dark:text-white">
          {{ t('records.linesBundleOptionalTitle') }}
        </h4>
        <p class="text-sm text-gray-600 dark:text-gray-300">
          {{ bundleOptionalModalTitle }}
        </p>
        <p v-if="!bundleOptionalChoices.length" class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('records.linesBundleOptionalNone') }}
        </p>
        <ul v-else class="flex-1 overflow-y-auto space-y-2 min-h-[80px]">
          <li
            v-for="choice in bundleOptionalChoices"
            :key="choice.variantId"
            class="flex items-start gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2"
          >
            <input
              :id="`bundle-opt-${choice.variantId}`"
              v-model="bundleOptionalSelected"
              type="checkbox"
              class="mt-1 rounded"
              :value="choice.variantId"
              :disabled="busy"
            />
            <label :for="`bundle-opt-${choice.variantId}`" class="min-w-0 flex-1 cursor-pointer">
              <span class="text-sm text-gray-900 dark:text-white">{{ choice.label }}</span>
              <span class="block text-xs text-gray-500 dark:text-gray-400">
                {{ t('records.linesBundleOptionalQty', { qty: choice.quantity }) }}
              </span>
            </label>
          </li>
        </ul>
        <div class="flex justify-end gap-2 pt-1">
          <button type="button" class="px-3 py-2 text-sm" :disabled="busy" @click="closeBundleOptionalModal">
            {{ t('actions.cancel') }}
          </button>
          <button
            type="button"
            class="px-3 py-2 text-sm rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
            :disabled="busy"
            @click="confirmBundleOptionalModal"
          >
            {{ bundleOptionalModalMode === 'add' ? t('records.linesAdd') : t('actions.save') }}
          </button>
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

    <DeleteConfirmationModal
      :show="showDeleteLineModal"
      :record-name="linePendingDelete?.itemNameSnapshot || t('records.linesTitle')"
      record-type="quote line"
      :deleting="busy"
      @close="showDeleteLineModal = false"
      @confirm="confirmRemoveLine"
    />
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Bars3Icon, TrashIcon } from '@heroicons/vue/24/outline';
import draggable from 'vuedraggable';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import { unwrapCatalogApiData, unwrapCatalogApiList } from '@/utils/catalogApi';
import { useAuthStore } from '@/stores/authRegistry';
import DeleteConfirmationModal from '@/components/common/DeleteConfirmationModal.vue';
import { isCommerciallyLockedStatus } from '@/constants/quoteLifecycle';
import { formatQuoteMoney } from '@/utils/quoteMoney';
import { useQuoteLinesSession, clearQuoteLinesSession } from '@/composables/useQuoteLinesSession';

const props = defineProps({
  record: { type: Object, default: null },
  adapter: { type: Object, default: () => ({}) },
  context: { type: Object, default: () => ({}) }
});

const emit = defineEmits(['updated']);

const { t } = useI18n();
const notifications = useNotifications();
const authStore = useAuthStore();

const quoteId = computed(() => props.record?._id);
const { busy, overrideLock } = useQuoteLinesSession(quoteId);

const variantId = ref('');
const variantLabel = ref('');
const quantity = ref(1);
const showPricingColumns = ref(false);
const showDeleteLineModal = ref(false);
const linePendingDelete = ref(null);

const lines = computed(() => (Array.isArray(props.record?.lines) ? props.record.lines : []));

const currencyCode = computed(() => String(props.record?.currency || '').trim().toUpperCase());

function lineRowKey(line) {
  return String(line?.quoteLineId || line?._id || '');
}

const bundleModeByParentId = computed(() => {
  const map = new Map();
  for (const l of lines.value) {
    if (String(l?.lineType || '') === 'bundle_parent') {
      const mode = String(l?.bundleSnapshot?.pricingMode || 'fixed').toLowerCase();
      map.set(lineRowKey(l), mode);
      if (l?._id) map.set(String(l._id), mode);
      if (l?.quoteLineId) map.set(String(l.quoteLineId), mode);
    }
  }
  return map;
});

const displayLines = computed(() => {
  const modeMap = bundleModeByParentId.value;
  return lines.value
    .filter((line) => {
      if (line?.hiddenLine === true) return false;
      const type = String(line?.lineType || '');
      if (type === 'bundle_component') {
        const parentId = line.parentBundleLineId ? String(line.parentBundleLineId) : '';
        if ((modeMap.get(parentId) || 'fixed') === 'fixed') return false;
      }
      if (type === 'bundle_parent') {
        const mode = String(line?.bundleSnapshot?.pricingMode || 'fixed').toLowerCase();
        if (mode === 'rollup') return false;
      }
      return true;
    })
    .map((line) => ({
      line,
      indent: String(line?.lineType || '') === 'bundle_component',
      isBundleParent: String(line?.lineType || '') === 'bundle_parent',
      isOptional: line?.optionalLine === true || line?.bundleSnapshot?.isOptional === true
    }));
});

const tableColspan = computed(() => {
  let base = showPricingColumns.value ? 8 : 6;
  if (linesEditable.value) base += 2; // drag + discount
  return base;
});

const globalDiscountType = ref('');
const globalDiscountValue = ref(0);

watch(
  () => [props.record?.globalDiscountType, props.record?.globalDiscountValue],
  ([type, value]) => {
    if (busy.value) return;
    globalDiscountType.value = normalizeGlobalDiscountType(type);
    globalDiscountValue.value = Number(value) || 0;
  },
  { immediate: true }
);

function normalizeDiscountType(rawType) {
  const t = String(rawType || '').trim().toLowerCase();
  if (t === 'percent' || t === 'percentage') return 'percent';
  if (t === 'amount' || t === 'fixed') return 'amount';
  return '';
}

function normalizeGlobalDiscountType(rawType) {
  return normalizeDiscountType(rawType);
}

function lineDiscountType(line) {
  return normalizeDiscountType(line?.discountType);
}

function lineDiscountValue(line) {
  return Number(line?.discountValue) || 0;
}

async function patchLineDiscount(line, patch = {}) {
  if (!linesEditable.value || !props.record?._id || !line?.quoteLineId) return;

  const nextType = patch.type !== undefined ? String(patch.type || '') : lineDiscountType(line);
  const nextValue = patch.value !== undefined ? Number(patch.value) : lineDiscountValue(line);
  if (nextType && (!Number.isFinite(nextValue) || nextValue < 0)) return;

  busy.value = true;
  try {
    const body = {
      overridePricing: overrideLock.value === true,
      discountType: nextType || null,
      discountValue: nextType ? nextValue : 0
    };
    const res = await apiClient.patch(`/quotes/${props.record._id}/lines/${line.quoteLineId}`, body);
    if (res?.success && res?.data?.line) {
      emit('updated', {
        type: 'line-updated',
        line: res.data.line,
        totals: res?.data?.totals ?? null
      });
    } else {
      notifications.error(res?.message || t('records.linesDiscountUpdateFailed'));
    }
  } catch (e) {
    notifications.error(e?.message || t('records.linesDiscountUpdateFailed'));
  } finally {
    busy.value = false;
  }
}

async function saveGlobalDiscount() {
  if (!linesEditable.value || !props.record?._id) return;
  const type = globalDiscountType.value || null;
  const value = type ? Number(globalDiscountValue.value) || 0 : 0;
  if (type && value < 0) return;

  busy.value = true;
  try {
    const res = await apiClient.patch(`/quotes/${props.record._id}/discounts`, {
      globalDiscountType: type,
      globalDiscountValue: value,
      overridePricing: overrideLock.value === true
    });
    if (res?.success) {
      emit('updated', {
        type: 'quote-discounts-updated',
        quote: res?.data?.quote ?? null,
        lines: res?.data?.lines ?? null,
        totals: res?.data?.totals ?? null
      });
      return;
    }
    notifications.error(res?.message || t('records.linesGlobalDiscountUpdateFailed'));
  } catch (e) {
    notifications.error(e?.message || t('records.linesGlobalDiscountUpdateFailed'));
  } finally {
    busy.value = false;
  }
}

const reorderableRows = ref([]);
const isReorderDragging = ref(false);

watch(
  displayLines,
  (rows) => {
    if (isReorderDragging.value) return;
    reorderableRows.value = rows.map((row) => ({
      ...row,
      uid: lineRowKey(row.line)
    }));
  },
  { immediate: true, deep: true }
);

function sortedAllLines() {
  return [...lines.value].sort(
    (a, b) => (Number(a?.lineOrder) || 0) - (Number(b?.lineOrder) || 0)
  );
}

function linesInDisplayGroup(quoteLineId) {
  const all = sortedAllLines();
  const line = all.find((l) => String(l?.quoteLineId || '') === String(quoteLineId || ''));
  if (!line) return [];

  if (String(line?.lineType || '') === 'bundle_parent') {
    const mode = String(line?.bundleSnapshot?.pricingMode || 'fixed').toLowerCase();
    const parentMongoId = String(line._id || '');
    const children = all
      .filter(
        (l) =>
          String(l?.lineType || '') === 'bundle_component' &&
          parentMongoId &&
          String(l?.parentBundleLineId || '') === parentMongoId
      )
      .sort((a, b) => (Number(a?.lineOrder) || 0) - (Number(b?.lineOrder) || 0));
    if (mode === 'fixed') return [line, ...children];
    return [line];
  }

  return [line];
}

function buildOrdersFromVisibleSequence(visibleIds) {
  const all = sortedAllLines();
  const reordered = [];
  const used = new Set();

  for (const id of visibleIds) {
    for (const line of linesInDisplayGroup(id)) {
      const key = String(line?.quoteLineId || '');
      if (!key || used.has(key)) continue;
      used.add(key);
      reordered.push(line);
    }
  }

  for (const line of all) {
    const key = String(line?.quoteLineId || '');
    if (key && !used.has(key)) {
      used.add(key);
      reordered.push(line);
    }
  }

  return reordered.map((line, index) => ({
    quoteLineId: String(line.quoteLineId),
    lineOrder: index + 1
  }));
}

function onLineOrderDragStart() {
  isReorderDragging.value = true;
  document.body.classList.add('quote-lines-reorder-active');
}

async function onLineOrderDragEnd() {
  isReorderDragging.value = false;
  document.body.classList.remove('quote-lines-reorder-active');
  if (!linesEditable.value || !props.record?._id) return;

  const visibleIds = reorderableRows.value.map((row) => String(row.line?.quoteLineId || '')).filter(Boolean);
  const orders = buildOrdersFromVisibleSequence(visibleIds);
  if (!orders.length) return;

  busy.value = true;
  try {
    const res = await apiClient.patch(`/quotes/${props.record._id}/lines/reorder`, {
      orders,
      overridePricing: overrideLock.value === true
    });
    if (res?.success && Array.isArray(res?.data?.lines)) {
      emit('updated', {
        type: 'lines-recalculated',
        lines: res.data.lines,
        totals: res?.data?.totals ?? null
      });
      return;
    }
    notifications.error(res?.message || t('records.linesReorderFailed'));
    reorderableRows.value = displayLines.value.map((row) => ({
      ...row,
      uid: lineRowKey(row.line)
    }));
  } catch (e) {
    notifications.error(e?.message || t('records.linesReorderFailed'));
    reorderableRows.value = displayLines.value.map((row) => ({
      ...row,
      uid: lineRowKey(row.line)
    }));
  } finally {
    busy.value = false;
  }
}

function readMoneyField(key) {
  const n = Number(props.record?.[key]);
  return Number.isFinite(n) ? n : 0;
}

const totals = computed(() => {
  const fromRecord = {
    subtotal: readMoneyField('subtotal'),
    lineDiscountTotal: readMoneyField('lineDiscountTotal'),
    globalDiscountTotal: readMoneyField('globalDiscountTotal'),
    taxTotal: readMoneyField('taxTotal'),
    adjustmentTotal: readMoneyField('adjustmentTotal'),
    grandTotal: readMoneyField('grandTotal')
  };

  if (fromRecord.grandTotal > 0 || !lines.value.length) {
    return fromRecord;
  }
  const lineSum = lines.value.reduce((sum, line) => sum + (Number(line?.lineTotal) || 0), 0);
  if (lineSum <= 0) return fromRecord;
  return { ...fromRecord, subtotal: lineSum, grandTotal: lineSum };
});

const totalsStaleHint = computed(() => {
  const headerTotal = readMoneyField('grandTotal');
  if (headerTotal > 0 || !lines.value.length) return false;
  return lines.value.some((l) => Number(l?.lineTotal) > 0);
});

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

const showBundleOptionalModal = ref(false);
const bundleOptionalModalMode = ref('add'); // 'add' | 'configure'
const bundleOptionalAddHit = ref(null);
const bundleOptionalConfigureParent = ref(null);
const bundleOptionalChoices = ref([]);
const bundleOptionalSelected = ref([]);

const canOverrideLock = computed(() => {
  if (authStore.user?.isOwner) return true;
  const role = String(authStore.user?.role || '').toLowerCase();
  return role === 'owner' || role === 'admin';
});

const quoteStatus = computed(() => String(props.record?.status || '').trim());
const commerciallyLocked = computed(() => isCommerciallyLockedStatus(quoteStatus.value));
const linesEditable = computed(() => {
  if (!commerciallyLocked.value) return true;
  return overrideLock.value && canOverrideLock.value;
});

function formatMoney(value) {
  return formatQuoteMoney(value, currencyCode.value);
}

function variantHitLabel(hit) {
  if (hit.item_name) {
    return hit.variant_code ? `${hit.item_name} (${hit.variant_code})` : hit.item_name;
  }
  return hit.variant_code || String(hit._id);
}

function openVariantPicker() {
  if (!linesEditable.value) return;
  showVariantPicker.value = true;
  variantSearchQuery.value = '';
  runVariantSearch();
}

function openBundlePicker() {
  if (!linesEditable.value) return;
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

const bundleOptionalModalTitle = computed(() => {
  if (bundleOptionalModalMode.value === 'configure') {
    const name = bundleOptionalConfigureParent.value?.itemNameSnapshot;
    return name
      ? t('records.linesBundleOptionalConfigureHint', { name })
      : t('records.linesBundleOptionalHint');
  }
  const name = bundleOptionalAddHit.value?.item_name || bundleOptionalAddHit.value?.variant_code;
  return name
    ? t('records.linesBundleOptionalAddHint', { name })
    : t('records.linesBundleOptionalHint');
});

function bundleParentHasOptionals(parentLine) {
  if (!parentLine || String(parentLine?.lineType || '') !== 'bundle_parent') return false;
  const parentMongoId = String(parentLine._id || '');
  const hasChildOptionals = lines.value.some(
    (l) =>
      String(l?.lineType || '') === 'bundle_component' &&
      String(l?.parentBundleLineId || '') === parentMongoId &&
      (l?.optionalLine === true || l?.bundleSnapshot?.isOptional === true)
  );
  if (hasChildOptionals) return true;
  const snap = parentLine?.bundleSnapshot?.components;
  return Array.isArray(snap) && snap.some((c) => c?.isOptional === true);
}

function optionalChoicesForParent(parentLine) {
  const parentMongoId = String(parentLine?._id || '');
  const fromLines = lines.value
    .filter(
      (l) =>
        String(l?.lineType || '') === 'bundle_component' &&
        String(l?.parentBundleLineId || '') === parentMongoId &&
        (l?.optionalLine === true || l?.bundleSnapshot?.isOptional === true)
    )
    .sort((a, b) => (Number(a?.lineOrder) || 0) - (Number(b?.lineOrder) || 0));

  if (fromLines.length) {
    return fromLines.map((l) => ({
      variantId: String(l.variantId),
      label: l.itemNameSnapshot || l.skuSnapshot || String(l.variantId),
      quantity: Number(l.quantity) || 0,
      included: l.hiddenLine !== true
    }));
  }

  const snap = parentLine?.bundleSnapshot?.components;
  if (!Array.isArray(snap)) return [];
  return snap
    .filter((c) => c?.isOptional === true)
    .map((c) => ({
      variantId: String(c.componentVariantId),
      label: String(c.componentVariantId),
      quantity: Number(c.quantity) || 0,
      included: false
    }));
}

function catalogOptionalChoices(components) {
  return (Array.isArray(components) ? components : [])
    .filter((c) => c?.isOptional === true)
    .map((c) => ({
      variantId: String(c.componentVariantId),
      label: c.item_name || c.variant_code || String(c.componentVariantId),
      quantity: Number(c.quantity) || 0,
      included: false
    }));
}

function closeBundleOptionalModal() {
  showBundleOptionalModal.value = false;
  bundleOptionalAddHit.value = null;
  bundleOptionalConfigureParent.value = null;
  bundleOptionalChoices.value = [];
  bundleOptionalSelected.value = [];
}

async function pickBundle(hit) {
  showBundlePicker.value = false;
  busy.value = true;
  try {
    const res = await apiClient.get(`/catalog/variants/${hit._id}/bundle-components`);
    const data = unwrapCatalogApiData(res);
    const optional = catalogOptionalChoices(data?.components);
    if (optional.length) {
      bundleOptionalModalMode.value = 'add';
      bundleOptionalAddHit.value = hit;
      bundleOptionalConfigureParent.value = null;
      bundleOptionalChoices.value = optional;
      bundleOptionalSelected.value = [];
      showBundleOptionalModal.value = true;
      return;
    }
    await submitAddBundle(hit, []);
  } catch (e) {
    notifications.error(e?.message || t('records.linesAddBundleFailed'));
  } finally {
    busy.value = false;
  }
}

function openBundleOptionalConfig(parentLine) {
  if (!linesEditable.value || !parentLine?.quoteLineId) return;
  const choices = optionalChoicesForParent(parentLine);
  if (!choices.length) return;
  bundleOptionalModalMode.value = 'configure';
  bundleOptionalConfigureParent.value = parentLine;
  bundleOptionalAddHit.value = null;
  bundleOptionalChoices.value = choices;
  bundleOptionalSelected.value = choices.filter((c) => c.included).map((c) => c.variantId);
  showBundleOptionalModal.value = true;
}

async function confirmBundleOptionalModal() {
  if (bundleOptionalModalMode.value === 'add') {
    const hit = bundleOptionalAddHit.value;
    if (!hit) return;
    await submitAddBundle(hit, [...bundleOptionalSelected.value]);
    closeBundleOptionalModal();
    return;
  }

  const parent = bundleOptionalConfigureParent.value;
  if (!parent?.quoteLineId || !props.record?._id) return;

  busy.value = true;
  try {
    const res = await apiClient.patch(
      `/quotes/${props.record._id}/bundles/${parent.quoteLineId}/optionals`,
      {
        includedComponentVariantIds: [...bundleOptionalSelected.value],
        overridePricing: overrideLock.value === true
      }
    );
    if (!res?.success) {
      throw new Error(res?.message || t('records.linesBundleOptionalUpdateFailed'));
    }
    notifications.success(t('records.linesBundleOptionalUpdateSuccess'));
    emit('updated', {
      type: 'lines-recalculated',
      lines: res?.data?.lines ?? null,
      totals: res?.data?.totals ?? null
    });
    closeBundleOptionalModal();
  } catch (e) {
    notifications.error(e?.message || t('records.linesBundleOptionalUpdateFailed'));
  } finally {
    busy.value = false;
  }
}

async function submitAddBundle(hit, includedOptionalComponentVariantIds) {
  if (!props.record?._id) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/quotes/${props.record._id}/bundles`, {
      bundleVariantId: String(hit._id),
      priceBookId: selectedPriceBookId.value ? String(selectedPriceBookId.value) : null,
      quantity: quantity.value > 0 ? quantity.value : 1,
      asOfDate: props.record?.quoteDate ?? null,
      includedOptionalComponentVariantIds: includedOptionalComponentVariantIds,
      overridePricing: overrideLock.value === true
    });
    if (!res?.success) {
      throw new Error(res?.message || t('records.linesAddBundleFailed'));
    }
    notifications.success(t('records.linesAddBundleSuccess'));
    const parent = res?.data?.parent;
    const components = Array.isArray(res?.data?.components) ? res.data.components : [];
    const addedLines = [parent, ...components].filter(Boolean);
    if (addedLines.length) {
      emit('updated', {
        type: 'lines-added',
        lines: addedLines,
        totals: res?.data?.totals ?? null
      });
    } else {
      await refresh();
    }
  } catch (e) {
    notifications.error(e?.message || t('records.linesAddBundleFailed'));
  } finally {
    busy.value = false;
  }
}

async function refresh() {
  emit('updated', { type: 'soft-refresh' });
}

async function addLine() {
  if (!linesEditable.value || !props.record?._id || !variantId.value) return;
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
      const line = res?.data?.line;
      if (line) {
        emit('updated', {
          type: 'lines-added',
          lines: [line],
          totals: res?.data?.totals ?? null
        });
      } else {
        await refresh();
      }
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
  if (!linesEditable.value || !props.record?._id || !line?.quoteLineId) return;
  const q = Number(raw);
  if (!Number.isFinite(q) || q <= 0) return;
  busy.value = true;
  try {
    const res = await apiClient.patch(`/quotes/${props.record._id}/lines/${line.quoteLineId}`, {
      quantity: q,
      overridePricing: overrideLock.value === true
    });
    if (res?.success) {
      const updatedLine = res?.data?.line;
      if (updatedLine) {
        emit('updated', {
          type: 'line-updated',
          line: updatedLine,
          totals: res?.data?.totals ?? null
        });
      } else {
        await refresh();
      }
    } else {
      notifications.error(res?.message || t('records.linesUpdateFailed'));
    }
  } catch (e) {
    notifications.error(e?.message || t('records.linesUpdateFailed'));
  } finally {
    busy.value = false;
  }
}

function requestRemoveLine(line) {
  if (!linesEditable.value) return;
  linePendingDelete.value = line;
  showDeleteLineModal.value = true;
}

async function confirmRemoveLine() {
  const line = linePendingDelete.value;
  showDeleteLineModal.value = false;
  if (!props.record?._id || !line?.quoteLineId) return;
  busy.value = true;
  try {
    const res = await apiClient.delete(`/quotes/${props.record._id}/lines/${line.quoteLineId}`, {
      data: { overridePricing: overrideLock.value === true }
    });
    if (res?.success) {
      emit('updated', {
        type: 'line-deleted',
        deletedLine: line,
        totals: res?.data?.totals ?? null
      });
    } else {
      notifications.error(res?.message || t('records.linesDeleteFailed'));
    }
  } catch (e) {
    notifications.error(e?.message || t('records.linesDeleteFailed'));
  } finally {
    busy.value = false;
    linePendingDelete.value = null;
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
      const lines = res?.data?.lines;
      if (Array.isArray(lines)) {
        emit('updated', {
          type: 'lines-recalculated',
          lines,
          totals: res?.data?.totals ?? null
        });
      } else {
        await refresh();
      }
    } else {
      notifications.error(res?.message || t('records.linesRecalculateFailed'));
    }
  } catch (e) {
    notifications.error(e?.message || t('records.linesRecalculateFailed'));
  } finally {
    busy.value = false;
  }
}

async function loadPriceBooks() {
  priceBooksLoading.value = true;
  try {
    const res = await apiClient.get('/catalog/price-books');
    priceBooks.value = unwrapCatalogApiList(res);
  } catch {
    priceBooks.value = [];
  } finally {
    priceBooksLoading.value = false;
  }
}

onMounted(() => {
  loadPriceBooks();
});

onUnmounted(() => {
  document.body.classList.remove('quote-lines-reorder-active');
  clearQuoteLinesSession(quoteId.value);
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

<style scoped>
.quote-lines-table--dragging {
  user-select: none;
}

:deep(.quote-line-sortable-chosen) {
  opacity: 0.35;
}

:deep(.quote-line-sortable-ghost) {
  opacity: 1;
  background-color: rgb(238 242 255) !important;
}

:deep(.quote-line-sortable-ghost td) {
  background-color: rgb(238 242 255) !important;
  border-top: 2px dashed rgb(129 140 248);
  border-bottom: 2px dashed rgb(129 140 248);
}

:global(.dark) :deep(.quote-line-sortable-ghost),
:global(.dark) :deep(.quote-line-sortable-ghost td) {
  background-color: rgb(30 27 75 / 0.5) !important;
  border-color: rgb(129 140 248);
}
</style>

<style>
/* Drag clone is appended to document.body (fallback-on-body). */
.quote-lines-reorder-active {
  cursor: grabbing !important;
}

.quote-line-sortable-fallback {
  display: table !important;
  table-layout: fixed;
  width: max-content;
  min-width: 640px;
  max-width: min(100vw - 2rem, 960px);
  background-color: rgb(255 255 255) !important;
  opacity: 1 !important;
  cursor: grabbing !important;
  z-index: 10000;
  border-radius: 0.5rem;
  border: 1px solid rgb(229 231 235);
  box-shadow:
    0 20px 25px -5px rgb(0 0 0 / 0.12),
    0 8px 10px -6px rgb(0 0 0 / 0.08);
}

.quote-line-sortable-fallback td {
  background-color: rgb(255 255 255) !important;
  padding: 0.5rem 0.75rem;
  white-space: nowrap;
}

.dark .quote-line-sortable-fallback,
.dark .quote-line-sortable-fallback td {
  background-color: rgb(17 24 39) !important;
  border-color: rgb(55 65 81);
  box-shadow:
    0 20px 25px -5px rgb(0 0 0 / 0.45),
    0 8px 10px -6px rgb(0 0 0 / 0.3);
}

.quote-line-sortable-drag {
  opacity: 1 !important;
}
</style>
