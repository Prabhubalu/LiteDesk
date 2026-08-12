<template>
  <section class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
    <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('platform.catalogVariantTitle') }}</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{{ t('platform.catalogVariantDesc') }}</p>
      </div>
      <span
        v-if="variants.length > 1"
        class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200"
      >
        {{ t('platform.catalogVariantCount', { count: variants.length }) }}
      </span>
    </div>

    <div v-if="variants.length > 1" class="mb-5 inline-flex flex-wrap rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
      <button
        v-for="(variant, idx) in variants"
        :key="variant._id"
        type="button"
        class="px-3 py-1.5 text-sm transition-colors"
        :class="[
          selectedVariantId === variant._id
            ? 'bg-indigo-600 text-white'
            : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800',
          idx > 0 ? 'border-l border-gray-200 dark:border-gray-600' : ''
        ]"
        @click="selectVariant(variant._id)"
      >
        {{ variant.variant_code || variant._id }}
        <span v-if="variant.is_default" class="ml-1 text-xs opacity-80">({{ t('platform.catalogVariantDefault') }})</span>
      </button>
    </div>

    <div v-if="!variants.length" class="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/30 px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
      {{ t('platform.catalogVariantEmpty') }}
    </div>
    <div v-else-if="!activeVariant" class="text-sm text-gray-500 dark:text-gray-400">
      {{ t('platform.catalogVariantLoading') }}
    </div>

    <form v-else class="space-y-6" @submit.prevent="saveVariant">
      <!-- Identity -->
      <div>
        <h4 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
          {{ t('platform.catalogVariantGroupIdentity') }}
        </h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ t('platform.catalogVariantCode') }}</label>
            <input
              v-model="form.variant_code"
              type="text"
              :disabled="!canEdit || !activeVariant.is_default"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 disabled:bg-gray-50 dark:disabled:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 disabled:opacity-60"
            >
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ fieldLabel('unit_of_measure') }}</label>
            <HeadlessSelect
              v-model="form.unit_of_measure"
              :options="uomOptions"
              :disabled="!canEdit"
              allow-empty
              empty-value=""
              empty-label="—"
              teleport
            />
          </div>
        </div>
      </div>

      <!-- Pricing -->
      <div class="pt-5 border-t border-gray-100 dark:border-gray-700/80">
        <h4 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
          {{ t('platform.catalogVariantGroupPricing') }}
        </h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ fieldLabel('selling_price') }}</label>
            <input
              v-model.number="form.selling_price"
              type="number"
              min="0"
              step="0.01"
              :disabled="!canEdit"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 disabled:bg-gray-50 dark:disabled:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 disabled:opacity-60"
            >
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ fieldLabel('cost_price') }}</label>
            <input
              v-model.number="form.cost_price"
              type="number"
              min="0"
              step="0.01"
              :disabled="!canEdit"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 disabled:bg-gray-50 dark:disabled:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 disabled:opacity-60"
            >
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ fieldLabel('currency') }}</label>
            <HeadlessSelect
              v-model="form.currency"
              :options="currencySelectOptions"
              :disabled="!canEdit"
              teleport
              :searchable="true"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ fieldLabel('commission_rate') }}</label>
            <input
              v-model.number="form.commission_rate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              :disabled="!canEdit"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 disabled:bg-gray-50 dark:disabled:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 disabled:opacity-60"
            >
          </div>
        </div>
      </div>

      <!-- Tax -->
      <div class="pt-5 border-t border-gray-100 dark:border-gray-700/80">
        <h4 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
          {{ t('platform.catalogVariantGroupTax') }}
        </h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ fieldLabel('tax_type') }}</label>
            <HeadlessSelect
              v-model="form.tax_type"
              :options="taxTypeOptions"
              :disabled="!canEdit"
              teleport
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ fieldLabel('tax_percentage') }}</label>
            <input
              v-model.number="form.tax_percentage"
              type="number"
              min="0"
              max="100"
              step="0.01"
              :disabled="!canEdit"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 disabled:bg-gray-50 dark:disabled:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 disabled:opacity-60"
            >
          </div>
        </div>
      </div>

      <!-- Identifiers -->
      <div class="pt-5 border-t border-gray-100 dark:border-gray-700/80">
        <h4 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
          {{ t('platform.catalogVariantGroupIds') }}
        </h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ t('platform.catalogBarcode') }}</label>
            <input
              v-model="form.barcode"
              type="text"
              :disabled="!canEdit"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 disabled:bg-gray-50 dark:disabled:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 disabled:opacity-60"
              :placeholder="t('platform.catalogBarcodePlaceholder')"
            >
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ t('platform.catalogBarcodeType') }}</label>
            <HeadlessSelect
              v-model="form.barcode_type"
              :options="barcodeTypeOptions"
              :disabled="!canEdit"
              teleport
            />
          </div>
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ t('platform.catalogQrPayload') }}</label>
            <input
              v-model="form.qr_payload"
              type="text"
              :disabled="!canEdit"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 disabled:bg-gray-50 dark:disabled:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 disabled:opacity-60"
              :placeholder="t('platform.catalogQrPayloadPlaceholder')"
            >
          </div>
        </div>
      </div>

      <ItemVariantPriceEntries
        v-if="activeVariant"
        :variant-id="activeVariant._id"
        :can-edit="canEdit"
      />

      <ItemBundleBuilder
        v-if="activeVariant && itemType === 'Bundle'"
        :variant-id="activeVariant._id"
        :can-edit="canEdit"
      />

      <p v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>

      <div v-if="canEdit" class="flex justify-end pt-1 border-t border-gray-100 dark:border-gray-700/80">
        <button
          type="submit"
          :disabled="saving"
          class="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors"
        >
          {{ saving ? t('states.saving') : t('actions.save') }}
        </button>
      </div>
    </form>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { CATALOG_BARCODE_TYPES, CATALOG_BARCODE_TYPE_LABEL_KEYS } from '@/constants/catalogBarcode';
import { getFieldDisplayLabel } from '@/utils/fieldDisplay';
import { getEnabledCurrencyOptions, resolveOrgCurrencyCode } from '@/utils/currencyOptions';
import { useAuthStore } from '@/stores/authRegistry';
import { getItemFieldMetadata } from '@/platform/fields/itemFieldModel';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import ItemVariantPriceEntries from '@/components/catalog/ItemVariantPriceEntries.vue';
import ItemBundleBuilder from '@/components/catalog/ItemBundleBuilder.vue';

const props = defineProps({
  variants: { type: Array, default: () => [] },
  itemType: { type: String, default: '' },
  canEdit: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  error: { type: String, default: '' }
});

const emit = defineEmits(['save']);

const { t } = useI18n();
const authStore = useAuthStore();
const orgCurrency = computed(() => resolveOrgCurrencyCode(authStore.organization));
const currencyOptions = computed(() => getEnabledCurrencyOptions(authStore.organization));
const currencySelectOptions = computed(() =>
  currencyOptions.value.map((opt) => ({
    value: opt.code,
    label: `${opt.symbol || opt.code} ${opt.code} — ${opt.name}`
  }))
);

const barcodeTypes = CATALOG_BARCODE_TYPES;

const barcodeTypeLabel = (type) => {
  const key = CATALOG_BARCODE_TYPE_LABEL_KEYS[type];
  return key ? t(key) : type;
};

const barcodeTypeOptions = computed(() =>
  barcodeTypes.map((type) => ({ value: type, label: barcodeTypeLabel(type) }))
);

const uomOptions = [
  { value: 'pcs', label: 'pcs' },
  { value: 'kg', label: 'kg' },
  { value: 'liters', label: 'liters' },
  { value: 'hours', label: 'hours' },
  { value: 'boxes', label: 'boxes' },
  { value: 'meters', label: 'meters' },
  { value: 'units', label: 'units' }
];

const taxTypeOptions = [
  { value: 'None', label: 'None' },
  { value: 'GST', label: 'GST' },
  { value: 'VAT', label: 'VAT' }
];

const fieldLabel = (key) => {
  const meta = getItemFieldMetadata(key);
  return getFieldDisplayLabel(meta ? { key, ...meta } : { key });
};

const defaultVariant = computed(() =>
  props.variants.find((v) => v.is_default) || props.variants[0] || null
);

const selectedVariantId = ref(null);

const activeVariant = computed(() => {
  if (!props.variants.length) return null;
  if (selectedVariantId.value) {
    return props.variants.find((v) => v._id === selectedVariantId.value) || defaultVariant.value;
  }
  return defaultVariant.value;
});

watch(defaultVariant, (variant) => {
  if (variant && !selectedVariantId.value) {
    selectedVariantId.value = variant._id;
  }
}, { immediate: true });

watch(() => props.variants, () => {
  if (defaultVariant.value && !props.variants.some((v) => v._id === selectedVariantId.value)) {
    selectedVariantId.value = defaultVariant.value._id;
  }
}, { deep: true });

const form = reactive({
  variant_code: '',
  unit_of_measure: '',
  selling_price: 0,
  cost_price: 0,
  currency: resolveOrgCurrencyCode(),
  tax_type: 'None',
  tax_percentage: 0,
  commission_rate: 0,
  barcode: '',
  barcode_type: 'OTHER',
  qr_payload: ''
});

watch(activeVariant, (variant) => {
  if (!variant) return;
  form.variant_code = variant.variant_code || '';
  form.unit_of_measure = variant.unit_of_measure || '';
  form.selling_price = variant.selling_price ?? 0;
  form.cost_price = variant.cost_price ?? 0;
  form.currency = variant.currency || orgCurrency.value;
  form.tax_type = variant.tax_type || 'None';
  form.tax_percentage = variant.tax_percentage ?? 0;
  form.commission_rate = variant.commission_rate ?? 0;
  form.barcode = variant.barcode || '';
  form.barcode_type = variant.barcode_type || 'OTHER';
  form.qr_payload = variant.qr_payload || '';
}, { immediate: true });

const selectVariant = (variantId) => {
  selectedVariantId.value = variantId;
};

const saveVariant = () => {
  if (!activeVariant.value) return;
  emit('save', {
    variantId: activeVariant.value._id,
    payload: {
      variant_code: form.variant_code,
      unit_of_measure: form.unit_of_measure,
      selling_price: form.selling_price,
      cost_price: form.cost_price,
      currency: form.currency,
      tax_type: form.tax_type,
      tax_percentage: form.tax_percentage,
      commission_rate: form.commission_rate,
      barcode: form.barcode,
      barcode_type: form.barcode_type,
      qr_payload: form.qr_payload
    }
  });
};
</script>
