import { computed, ref, watch } from 'vue';

export const QUOTE_LINES_COLUMN_PREFS_KEY = 'arivu:quote-lines:column-prefs:v1';

/** Always-visible core columns (not user-toggleable). */
export const QUOTE_LINES_CORE_COLUMNS = Object.freeze([
  { id: 'name', labelKey: 'records.linesName' },
  { id: 'qty', labelKey: 'records.linesQty' },
  { id: 'unitPrice', labelKey: 'records.linesUnitPrice' },
  { id: 'total', labelKey: 'records.linesTotal' }
]);

/** Optional columns / options users can enable. */
export const QUOTE_LINES_OPTIONAL_COLUMNS = Object.freeze([
  { id: 'sku', labelKey: 'records.linesColOptSku', descriptionKey: 'records.linesColOptSkuDesc' },
  {
    id: 'discount',
    labelKey: 'records.linesColOptItemDiscount',
    descriptionKey: 'records.linesColOptItemDiscountDesc'
  },
  {
    id: 'pricing',
    labelKey: 'records.linesColOptPricingDetails',
    descriptionKey: 'records.linesColOptPricingDetailsDesc'
  }
]);

export const QUOTE_LINES_DEFAULT_PREFS = Object.freeze({
  sku: false,
  discount: false,
  pricing: false
});

function readPrefs() {
  if (typeof localStorage === 'undefined') return { ...QUOTE_LINES_DEFAULT_PREFS };
  try {
    const raw = localStorage.getItem(QUOTE_LINES_COLUMN_PREFS_KEY);
    if (!raw) return { ...QUOTE_LINES_DEFAULT_PREFS };
    const parsed = JSON.parse(raw);
    return {
      sku: parsed?.sku === true,
      discount: parsed?.discount === true,
      pricing: parsed?.pricing === true
    };
  } catch {
    return { ...QUOTE_LINES_DEFAULT_PREFS };
  }
}

function writePrefs(prefs) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(QUOTE_LINES_COLUMN_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Shared across QuoteLinesRecordSection + QuoteLinesColumnOptions. */
const prefs = ref(readPrefs());
let persistBound = false;

function ensurePersistWatcher() {
  if (persistBound) return;
  persistBound = true;
  watch(
    prefs,
    (next) => {
      writePrefs({
        sku: next.sku === true,
        discount: next.discount === true,
        pricing: next.pricing === true
      });
    },
    { deep: true }
  );
}

/**
 * Quote lines table column preferences (per browser).
 * Core: Name, Qty, Unit price, Total.
 * Optional: SKU, item-level discount, pricing details.
 */
export function useQuoteLinesColumnPrefs() {
  ensurePersistWatcher();

  const showSkuColumn = computed(() => prefs.value.sku === true);
  const showDiscountColumn = computed(() => prefs.value.discount === true);
  const showPricingColumns = computed(() => prefs.value.pricing === true);

  function setColumn(id, enabled) {
    if (!(id in QUOTE_LINES_DEFAULT_PREFS)) return;
    prefs.value = { ...prefs.value, [id]: enabled === true };
  }

  function toggleColumn(id) {
    if (!(id in QUOTE_LINES_DEFAULT_PREFS)) return;
    prefs.value = { ...prefs.value, [id]: !prefs.value[id] };
  }

  function resetToDefaults() {
    prefs.value = { ...QUOTE_LINES_DEFAULT_PREFS };
  }

  return {
    prefs,
    showSkuColumn,
    showDiscountColumn,
    showPricingColumns,
    setColumn,
    toggleColumn,
    resetToDefaults,
    coreColumns: QUOTE_LINES_CORE_COLUMNS,
    optionalColumns: QUOTE_LINES_OPTIONAL_COLUMNS
  };
}
