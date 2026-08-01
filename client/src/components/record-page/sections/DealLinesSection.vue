<template>
  <section class="deal-lines-section space-y-3" data-testid="deal-lines-section">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap items-center gap-3 min-w-0">
        <h3
          v-if="showHeading"
          class="text-sm font-semibold tracking-wide text-gray-900 dark:text-white uppercase"
        >
          {{ t('records.dealLinesSectionTitle') }}
        </h3>
        <div class="inline-flex items-center rounded-md border border-gray-200 dark:border-gray-600 p-0.5 bg-gray-50 dark:bg-gray-800/80">
          <button
            type="button"
            class="px-2.5 py-1 text-xs font-medium rounded transition-colors"
            :class="amountMode === 'MANUAL'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'"
            :disabled="!editable || busy"
            @click="setAmountMode('MANUAL')"
          >
            {{ t('records.dealAmountModeManual') }}
          </button>
          <button
            type="button"
            class="px-2.5 py-1 text-xs font-medium rounded transition-colors"
            :class="amountMode === 'AUTO'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'"
            :disabled="!editable || busy"
            @click="setAmountMode('AUTO')"
          >
            {{ t('records.dealAmountModeAuto') }}
          </button>
        </div>
      </div>
      <p v-if="amountMode === 'AUTO'" class="text-xs text-gray-500 dark:text-gray-400">
        {{ t('records.dealAmountModeAutoHint') }}
      </p>
    </div>

    <div
      class="relative rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden shadow-sm ring-1 ring-gray-950/5 dark:ring-white/10"
    >
      <div
        v-if="busy"
        class="absolute inset-0 z-10 flex items-center justify-center bg-white/60 dark:bg-gray-900/60 backdrop-blur-[1px]"
      >
        <div class="animate-spin rounded-full h-7 w-7 border-b-2 border-indigo-600" />
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-gray-50 dark:bg-gray-800/60 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            <tr>
              <th class="px-3 py-2.5">{{ t('records.linesName') }}</th>
              <th class="px-3 py-2.5 w-24">{{ t('records.linesQty') }}</th>
              <th class="px-3 py-2.5 w-32 text-right">{{ t('records.linesUnitPrice') }}</th>
              <th class="px-3 py-2.5 w-28 text-right">{{ t('records.dealLinesDiscount') }}</th>
              <th class="px-3 py-2.5 w-32 text-right">{{ t('records.linesTotal') }}</th>
              <th v-if="editable" class="px-3 py-2.5 w-10" />
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            <tr v-if="!lines.length">
              <td :colspan="editable ? 6 : 5" class="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                {{ t('records.dealLinesEmpty') }}
              </td>
            </tr>
            <tr
              v-for="line in lines"
              :key="lineKey(line)"
              class="text-gray-900 dark:text-gray-100"
            >
              <td class="px-3 py-2.5 align-middle min-w-[12rem]">
                <div class="font-medium truncate">{{ line.nameSnapshot || '—' }}</div>
                <div v-if="line.skuSnapshot" class="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                  {{ line.skuSnapshot }}
                </div>
              </td>
              <td class="px-3 py-2.5 align-middle">
                <input
                  v-if="editable"
                  type="number"
                  min="0"
                  step="any"
                  class="w-20 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
                  :value="line.quantity"
                  :disabled="busy"
                  @change="onQtyChange(line, $event)"
                />
                <span v-else>{{ line.quantity }}</span>
              </td>
              <td class="px-3 py-2.5 align-middle text-right tabular-nums">
                <input
                  v-if="editable"
                  type="number"
                  min="0"
                  step="any"
                  class="w-28 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-right"
                  :value="line.expectedUnitPrice"
                  :disabled="busy"
                  @change="onUnitPriceChange(line, $event)"
                />
                <span v-else>{{ formatMoney(line.expectedUnitPrice) }}</span>
              </td>
              <td class="px-3 py-2.5 align-middle text-right tabular-nums">
                <input
                  v-if="editable"
                  type="number"
                  min="0"
                  step="any"
                  class="w-24 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-right"
                  :value="line.discountAmount || 0"
                  :disabled="busy"
                  @change="onDiscountChange(line, $event)"
                />
                <span v-else class="text-gray-600 dark:text-gray-300">{{ formatMoney(line.discountAmount || 0) }}</span>
              </td>
              <td class="px-3 py-2.5 align-middle text-right tabular-nums font-medium">
                {{ formatMoney(line.lineTotal) }}
              </td>
              <td v-if="editable" class="px-3 py-2.5 align-middle text-right">
                <button
                  type="button"
                  class="text-gray-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
                  :disabled="busy"
                  :title="t('actions.delete')"
                  @click="removeLine(line)"
                >
                  <TrashIcon class="h-4 w-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-if="editable"
        class="border-t border-gray-200 dark:border-gray-700 px-3 py-2.5 bg-gray-50/80 dark:bg-gray-800/40 space-y-2"
      >
        <div ref="searchRootRef" class="deal-lines-search relative">
          <input
            v-model="searchQuery"
            type="search"
            class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            :placeholder="t('records.dealLinesAddProductPlaceholder')"
            :disabled="busy"
            @input="onSearchInput"
            @focus="onSearchFocus"
            @keydown.escape.prevent="closeSearchDropdown"
          />
          <ul
            v-if="showHits && (hits.length || searchLoading || browseLoaded)"
            class="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg"
          >
            <li v-if="searchLoading" class="px-3 py-2 text-sm text-gray-500">
              {{ t('states.loading') }}
            </li>
            <li
              v-for="hit in hits"
              :key="hit._id"
              class="px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
              @mousedown.prevent="addFromHit(hit)"
            >
              <div class="font-medium text-gray-900 dark:text-white truncate">
                {{ hitLabel(hit) }}
              </div>
              <div v-if="hit.variant_code || hit.sku" class="text-xs text-gray-500 font-mono">
                {{ hit.variant_code || hit.sku }}
              </div>
            </li>
            <li
              v-if="!searchLoading && !hits.length"
              class="px-3 py-2 text-sm text-gray-500"
            >
              {{ searchQuery.trim() ? t('records.dealLinesNoCatalogHits') : t('records.linesNoVariantsFound') }}
            </li>
          </ul>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
            :disabled="busy"
            @click="openCatalogPicker"
          >
            {{ t('records.dealLinesBrowseCatalog') }}
          </button>
          <button
            type="button"
            class="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
            :disabled="busy"
            @click="openMiscModal"
          >
            {{ t('records.dealLinesAddMisc') }}
          </button>
        </div>
      </div>

      <div
        class="flex flex-wrap items-center justify-end gap-4 border-t border-gray-200 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-900"
      >
        <div class="text-right">
          <div class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {{ t('records.linesTotalsGrandTotal') }}
          </div>
          <div class="text-lg font-semibold tabular-nums text-gray-900 dark:text-white" data-testid="deal-lines-grand-total">
            {{ formatMoney(grandTotal) }}
          </div>
        </div>
        <div v-if="amountMode === 'AUTO'" class="text-right min-w-[8rem]">
          <div class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {{ t('records.dealExpectedValue') }}
          </div>
          <div class="text-sm font-medium tabular-nums text-indigo-700 dark:text-indigo-300">
            {{ formatMoney(dealAmount) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Browse catalog picker -->
    <Teleport to="body">
      <div
        v-if="showCatalogPicker"
        class="fixed inset-0 z-[11000] flex items-center justify-center bg-black/40 p-4"
        @click.self="closeCatalogPicker"
      >
        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 w-full max-w-lg space-y-3 max-h-[80vh] flex flex-col shadow-xl">
          <h4 class="text-base font-semibold text-gray-900 dark:text-white">
            {{ t('records.linesPickVariantTitle') }}
          </h4>
          <input
            v-model="pickerQuery"
            type="search"
            class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            :placeholder="t('records.linesVariantSearchPlaceholder')"
            @input="onPickerSearchInput"
          />
          <ul class="flex-1 overflow-y-auto space-y-1 min-h-[160px]">
            <li v-if="pickerLoading" class="text-sm text-gray-500 px-2 py-1">
              {{ t('states.loading') }}
            </li>
            <li
              v-else-if="!pickerHits.length"
              class="text-sm text-gray-500 px-2 py-1"
            >
              {{ t('records.linesNoVariantsFound') }}
            </li>
            <li
              v-for="hit in pickerHits"
              :key="hit._id"
              class="px-3 py-2 rounded-lg cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
              @click="pickFromCatalog(hit)"
            >
              <span class="text-sm text-gray-900 dark:text-white">{{ hitLabel(hit) }}</span>
              <span
                v-if="hit.variant_code || hit.sku"
                class="block text-xs text-gray-500 font-mono"
              >
                {{ hit.variant_code || hit.sku }}
              </span>
            </li>
          </ul>
          <div class="flex justify-end">
            <button
              type="button"
              class="px-3 py-2 text-sm text-gray-700 dark:text-gray-200"
              @click="closeCatalogPicker"
            >
              {{ t('actions.cancel') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Misc charge modal (replaces window.prompt) -->
    <Teleport to="body">
      <div
        v-if="showMiscModal"
        class="fixed inset-0 z-[11000] flex items-center justify-center bg-black/40 p-4"
        @click.self="closeMiscModal"
      >
        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 w-full max-w-md space-y-4 shadow-xl">
          <h4 class="text-base font-semibold text-gray-900 dark:text-white">
            {{ t('records.dealLinesMiscTitle') }}
          </h4>
          <div class="space-y-3">
            <label class="block space-y-1">
              <span class="text-xs font-medium text-gray-600 dark:text-gray-300">
                {{ t('records.dealLinesMiscNamePrompt') }}
              </span>
              <input
                ref="miscNameInputRef"
                v-model="miscName"
                type="text"
                class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                @keydown.enter.prevent="confirmMiscLine"
                @keydown.escape.prevent="closeMiscModal"
              />
            </label>
            <label class="block space-y-1">
              <span class="text-xs font-medium text-gray-600 dark:text-gray-300">
                {{ t('records.linesUnitPrice') }}
              </span>
              <input
                v-model.number="miscUnitPrice"
                type="number"
                min="0"
                step="any"
                class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                @keydown.enter.prevent="confirmMiscLine"
              />
            </label>
          </div>
          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="px-3 py-2 text-sm text-gray-700 dark:text-gray-200"
              @click="closeMiscModal"
            >
              {{ t('actions.cancel') }}
            </button>
            <button
              type="button"
              class="px-3 py-2 text-sm rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
              :disabled="!String(miscName || '').trim() || busy"
              @click="confirmMiscLine"
            >
              {{ t('actions.add') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { TrashIcon } from '@heroicons/vue/24/outline';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { unwrapCatalogApiData } from '@/utils/catalogApi';
import { useLocale } from '@/composables/useLocale';
import { resolveOrgCurrencyCode, DEFAULT_CURRENCY_CODE, formatCurrencyValue } from '@/utils/currencyOptions';

const props = defineProps({
  /** Persisted deal record (needs _id for API mode) */
  record: { type: Object, default: null },
  /** When true without record._id, lines stay local until create submit */
  draftMode: { type: Boolean, default: false },
  editable: { type: Boolean, default: true },
  showTitle: { type: Boolean, default: true },
  currency: { type: String, default: '' },
  /** Initial amount mode for draft / before load */
  initialAmountMode: { type: String, default: 'MANUAL' },
  context: { type: Object, default: null }
});

const emit = defineEmits(['updated', 'draft-change']);

const { t } = useI18n();
const { currency: localeCurrency } = useLocale();

const lines = ref([]);
const amountMode = ref(String(props.initialAmountMode || 'MANUAL').toUpperCase() === 'AUTO' ? 'AUTO' : 'MANUAL');
const dealAmount = ref(Number(props.record?.amount) || 0);
const busy = ref(false);
const searchQuery = ref('');
const hits = ref([]);
const showHits = ref(false);
const searchLoading = ref(false);
const browseLoaded = ref(false);
const searchRootRef = ref(null);
const showCatalogPicker = ref(false);
const pickerQuery = ref('');
const pickerHits = ref([]);
const pickerLoading = ref(false);
const showMiscModal = ref(false);
const miscName = ref('');
const miscUnitPrice = ref(0);
const miscNameInputRef = ref(null);
let searchTimer = null;
let pickerTimer = null;
let draftSeq = 0;

const editable = computed(() => {
  if (props.editable === false) return false;
  if (props.context?.canEdit === false) return false;
  if (typeof props.context?.canEditDetails === 'function') {
    return props.context.canEditDetails(props.record) !== false;
  }
  return true;
});

/** SectionStack already renders the section title on the record page */
const showHeading = computed(
  () => props.showTitle && !props.context?.sectionKey
);

const isApiMode = computed(() => Boolean(props.record?._id) && !props.draftMode);

const grandTotal = computed(() =>
  lines.value.reduce((sum, l) => sum + (Number(l.lineTotal) || 0), 0)
);

const currencyCode = computed(() => {
  const fromRecord = String(props.record?.currency || '').trim();
  const fromProp = String(props.currency || '').trim();
  return (
    resolveOrgCurrencyCode(fromRecord || fromProp || localeCurrency.value) ||
    DEFAULT_CURRENCY_CODE
  );
});

function formatMoney(value) {
  return formatCurrencyValue(value, { currencyCode: currencyCode.value }) ?? '—';
}

function lineKey(line) {
  return line._id || line.dealLineId || line._draftId;
}

function hitLabel(hit) {
  return hit.item_name || hit.name || hit.variant_code || hit._id;
}

function localLineTotal(line) {
  const qty = Number(line.quantity) || 0;
  const unit = Number(line.expectedUnitPrice) || 0;
  const discount = Number(line.discountAmount) || 0;
  return Math.max(0, qty * unit - discount);
}

function emitDraft() {
  if (!props.draftMode && isApiMode.value) return;
  emit('draft-change', {
    amountMode: amountMode.value,
    lines: lines.value.map((l) => ({
      lineType: l.lineType || 'product',
      itemId: l.itemId || null,
      variantId: l.variantId || null,
      quantity: Number(l.quantity) || 0,
      expectedUnitPrice: Number(l.expectedUnitPrice) || 0,
      nameSnapshot: l.nameSnapshot || null,
      skuSnapshot: l.skuSnapshot || null,
      discountType: l.discountType || null,
      discountValue: Number(l.discountValue) || 0,
      discountAmount: Number(l.discountAmount) || 0,
      unitOfMeasureSnapshot: l.unitOfMeasureSnapshot || null
    })),
    grandTotal: grandTotal.value,
    amount: amountMode.value === 'AUTO' ? grandTotal.value : dealAmount.value
  });
}

function applyApiPayload(data) {
  if (!data) return;
  lines.value = Array.isArray(data.lines) ? data.lines : [];
  if (data.deal) {
    if (data.deal.amountMode) amountMode.value = data.deal.amountMode;
    if (data.deal.amount != null) dealAmount.value = Number(data.deal.amount) || 0;
  }
  emit('updated', {
    deal: data.deal,
    lines: lines.value,
    totals: data.totals
  });
}

async function loadLines() {
  if (!isApiMode.value) return;
  busy.value = true;
  try {
    const res = await apiClient.get(`/deals/${props.record._id}/lines`);
    applyApiPayload(res.data?.data || res.data);
  } catch (err) {
    console.error('[DealLinesSection] load failed', err);
  } finally {
    busy.value = false;
  }
}

async function setAmountMode(mode) {
  if (!props.editable || busy.value) return;
  const next = mode === 'AUTO' ? 'AUTO' : 'MANUAL';
  if (next === amountMode.value) return;

  if (!isApiMode.value) {
    amountMode.value = next;
    if (next === 'AUTO') dealAmount.value = grandTotal.value;
    emitDraft();
    return;
  }

  busy.value = true;
  try {
    const res = await apiClient.patch(`/deals/${props.record._id}/amount-mode`, {
      amountMode: next
    });
    const data = res.data?.data || res.data;
    if (data?.deal) {
      amountMode.value = data.deal.amountMode || next;
      dealAmount.value = Number(data.deal.amount) || 0;
    } else {
      amountMode.value = next;
    }
    if (Array.isArray(data?.lines)) lines.value = data.lines;
    emit('updated', { deal: data?.deal, lines: lines.value, totals: data?.totals });
  } catch (err) {
    console.error('[DealLinesSection] amount-mode failed', err);
  } finally {
    busy.value = false;
  }
}

async function addFromHit(hit) {
  showHits.value = false;
  searchQuery.value = '';
  hits.value = [];
  if (!props.editable) return;

  const variantId = hit._id;
  const payload = {
    lineType: 'product',
    variantId,
    itemId: hit.itemId || hit.item_id || null,
    quantity: 1
  };

  if (!isApiMode.value) {
    const unit = Number(hit.selling_price ?? hit.unitPrice ?? 0) || 0;
    const draft = {
      _draftId: `draft-${++draftSeq}`,
      ...payload,
      nameSnapshot: hitLabel(hit),
      skuSnapshot: hit.variant_code || hit.sku || null,
      expectedUnitPrice: unit,
      discountAmount: 0,
      lineTotal: unit
    };
    draft.lineTotal = localLineTotal(draft);
    lines.value = [...lines.value, draft];
    if (amountMode.value === 'AUTO') dealAmount.value = grandTotal.value;
    emitDraft();
    return;
  }

  busy.value = true;
  try {
    const res = await apiClient.post(`/deals/${props.record._id}/lines`, payload);
    applyApiPayload(res.data?.data || res.data);
  } catch (err) {
    console.error('[DealLinesSection] add failed', err);
  } finally {
    busy.value = false;
  }
}

function openMiscModal() {
  if (!props.editable) return;
  closeSearchDropdown();
  miscName.value = '';
  miscUnitPrice.value = 0;
  showMiscModal.value = true;
  nextTick(() => {
    miscNameInputRef.value?.focus?.();
  });
}

function closeMiscModal() {
  showMiscModal.value = false;
  miscName.value = '';
  miscUnitPrice.value = 0;
}

function confirmMiscLine() {
  if (!props.editable || busy.value) return;
  const name = String(miscName.value || '').trim();
  if (!name) return;

  const unitPrice = Number(miscUnitPrice.value);
  const expectedUnitPrice = Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0;

  const payload = {
    lineType: 'misc',
    nameSnapshot: name,
    quantity: 1,
    expectedUnitPrice
  };

  closeMiscModal();

  if (!isApiMode.value) {
    const draft = {
      _draftId: `draft-${++draftSeq}`,
      ...payload,
      discountAmount: 0,
      lineTotal: expectedUnitPrice
    };
    lines.value = [...lines.value, draft];
    if (amountMode.value === 'AUTO') dealAmount.value = grandTotal.value;
    emitDraft();
    return;
  }

  busy.value = true;
  apiClient
    .post(`/deals/${props.record._id}/lines`, payload)
    .then((res) => applyApiPayload(res.data?.data || res.data))
    .catch((err) => console.error('[DealLinesSection] add misc failed', err))
    .finally(() => {
      busy.value = false;
    });
}

async function patchLine(line, patch) {
  if (!props.editable) return;

  if (!isApiMode.value) {
    const next = lines.value.map((l) => {
      if (lineKey(l) !== lineKey(line)) return l;
      const merged = { ...l, ...patch };
      merged.lineTotal = localLineTotal(merged);
      return merged;
    });
    lines.value = next;
    if (amountMode.value === 'AUTO') dealAmount.value = grandTotal.value;
    emitDraft();
    return;
  }

  busy.value = true;
  try {
    const id = line._id || line.dealLineId;
    const res = await apiClient.patch(`/deals/${props.record._id}/lines/${id}`, patch);
    applyApiPayload(res.data?.data || res.data);
  } catch (err) {
    console.error('[DealLinesSection] patch failed', err);
  } finally {
    busy.value = false;
  }
}

function onQtyChange(line, event) {
  const quantity = Number(event?.target?.value);
  if (!Number.isFinite(quantity) || quantity < 0) return;
  patchLine(line, { quantity });
}

function onUnitPriceChange(line, event) {
  const expectedUnitPrice = Number(event?.target?.value);
  if (!Number.isFinite(expectedUnitPrice) || expectedUnitPrice < 0) return;
  patchLine(line, { expectedUnitPrice });
}

function onDiscountChange(line, event) {
  const discountAmount = Number(event?.target?.value);
  if (!Number.isFinite(discountAmount) || discountAmount < 0) return;
  patchLine(line, {
    discountType: discountAmount > 0 ? 'amount' : null,
    discountValue: discountAmount,
    discountAmount
  });
}

async function removeLine(line) {
  if (!props.editable) return;

  if (!isApiMode.value) {
    lines.value = lines.value.filter((l) => lineKey(l) !== lineKey(line));
    if (amountMode.value === 'AUTO') dealAmount.value = grandTotal.value;
    emitDraft();
    return;
  }

  busy.value = true;
  try {
    const id = line._id || line.dealLineId;
    const res = await apiClient.delete(`/deals/${props.record._id}/lines/${id}`);
    applyApiPayload(res.data?.data || res.data);
  } catch (err) {
    console.error('[DealLinesSection] delete failed', err);
  } finally {
    busy.value = false;
  }
}

async function fetchCatalogHits(q, limit = 25) {
  const res = await apiClient.get('/catalog/variants/search', {
    params: { q: q || '', limit }
  });
  const data = unwrapCatalogApiData(res);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function closeSearchDropdown() {
  showHits.value = false;
}

function onSearchFocus() {
  showHits.value = true;
  if (!searchQuery.value.trim() && !hits.value.length) {
    loadBrowseHits();
  }
}

async function loadBrowseHits() {
  searchLoading.value = true;
  browseLoaded.value = true;
  showHits.value = true;
  try {
    hits.value = await fetchCatalogHits('', 25);
  } catch (err) {
    console.error('[DealLinesSection] browse failed', err);
    hits.value = [];
  } finally {
    searchLoading.value = false;
  }
}

function onSearchInput() {
  clearTimeout(searchTimer);
  const q = searchQuery.value.trim();
  searchTimer = setTimeout(async () => {
    searchLoading.value = true;
    showHits.value = true;
    browseLoaded.value = true;
    try {
      hits.value = await fetchCatalogHits(q, q ? 12 : 25);
    } catch (err) {
      console.error('[DealLinesSection] search failed', err);
      hits.value = [];
    } finally {
      searchLoading.value = false;
    }
  }, 250);
}

async function openCatalogPicker() {
  closeSearchDropdown();
  showCatalogPicker.value = true;
  pickerQuery.value = '';
  pickerLoading.value = true;
  try {
    pickerHits.value = await fetchCatalogHits('', 50);
  } catch (err) {
    console.error('[DealLinesSection] picker load failed', err);
    pickerHits.value = [];
  } finally {
    pickerLoading.value = false;
  }
}

function closeCatalogPicker() {
  showCatalogPicker.value = false;
  pickerQuery.value = '';
  pickerHits.value = [];
}

function onPickerSearchInput() {
  clearTimeout(pickerTimer);
  pickerTimer = setTimeout(async () => {
    pickerLoading.value = true;
    try {
      pickerHits.value = await fetchCatalogHits(pickerQuery.value.trim(), 50);
    } catch (err) {
      console.error('[DealLinesSection] picker search failed', err);
      pickerHits.value = [];
    } finally {
      pickerLoading.value = false;
    }
  }, 250);
}

function pickFromCatalog(hit) {
  closeCatalogPicker();
  addFromHit(hit);
}

/** Capture-phase: Headless UI Dialog often stops bubble-phase document clicks. */
function onPointerDownOutside(e) {
  if (!showHits.value || showCatalogPicker.value || showMiscModal.value) return;
  const root = searchRootRef.value;
  if (root && e.target instanceof Node && root.contains(e.target)) return;
  closeSearchDropdown();
}

watch(
  () => props.record?._id,
  (id) => {
    if (id && !props.draftMode) loadLines();
  }
);

watch(
  () => props.record?.amountMode,
  (mode) => {
    if (mode && isApiMode.value) amountMode.value = String(mode).toUpperCase() === 'AUTO' ? 'AUTO' : 'MANUAL';
  }
);

watch(
  () => props.initialAmountMode,
  (mode) => {
    if (!isApiMode.value && mode) {
      amountMode.value = String(mode).toUpperCase() === 'AUTO' ? 'AUTO' : 'MANUAL';
    }
  }
);

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDownOutside, true);
  if (isApiMode.value) loadLines();
  else if (props.draftMode) emitDraft();
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDownOutside, true);
  clearTimeout(searchTimer);
  clearTimeout(pickerTimer);
});

defineExpose({
  getDraftPayload: () => ({
    amountMode: amountMode.value,
    lines: lines.value.map((l) => ({
      lineType: l.lineType || 'product',
      itemId: l.itemId || null,
      variantId: l.variantId || null,
      quantity: Number(l.quantity) || 0,
      expectedUnitPrice: Number(l.expectedUnitPrice) || 0,
      nameSnapshot: l.nameSnapshot || null,
      skuSnapshot: l.skuSnapshot || null,
      discountType: l.discountType || null,
      discountValue: Number(l.discountValue) || 0,
      discountAmount: Number(l.discountAmount) || 0
    })),
    grandTotal: grandTotal.value,
    amount: amountMode.value === 'AUTO' ? grandTotal.value : undefined
  }),
  reload: loadLines
});
</script>
