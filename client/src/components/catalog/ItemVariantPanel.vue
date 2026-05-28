<template>
  <section class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
    <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
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

    <div v-if="variants.length > 1" class="mb-4 flex flex-wrap gap-2">
      <button
        v-for="variant in variants"
        :key="variant._id"
        type="button"
        class="px-3 py-1.5 rounded-lg text-sm border transition-colors"
        :class="selectedVariantId === variant._id
          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200 dark:border-indigo-400'
          : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900'"
        @click="selectVariant(variant._id)"
      >
        {{ variant.variant_code || variant._id }}
        <span v-if="variant.is_default" class="ml-1 text-xs opacity-70">({{ t('platform.catalogVariantDefault') }})</span>
      </button>
    </div>

    <div v-if="!variants.length" class="text-sm text-gray-500 dark:text-gray-400">
      {{ t('platform.catalogVariantEmpty') }}
    </div>
    <div v-else-if="!activeVariant" class="text-sm text-gray-500 dark:text-gray-400">
      {{ t('platform.catalogVariantLoading') }}
    </div>

    <form v-else class="space-y-4" @submit.prevent="saveVariant">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('platform.catalogVariantCode') }}</label>
          <input
            v-model="form.variant_code"
            type="text"
            :disabled="!canEdit || !activeVariant.is_default"
            class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 disabled:bg-gray-50 dark:disabled:bg-gray-900 text-gray-900 dark:text-white text-sm"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ fieldLabel('unit_of_measure') }}</label>
          <select
            v-model="form.unit_of_measure"
            :disabled="!canEdit"
            class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
          >
            <option value="">—</option>
            <option value="pcs">pcs</option>
            <option value="kg">kg</option>
            <option value="liters">liters</option>
            <option value="hours">hours</option>
            <option value="boxes">boxes</option>
            <option value="meters">meters</option>
            <option value="units">units</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ fieldLabel('selling_price') }}</label>
          <input
            v-model.number="form.selling_price"
            type="number"
            min="0"
            step="0.01"
            :disabled="!canEdit"
            class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ fieldLabel('cost_price') }}</label>
          <input
            v-model.number="form.cost_price"
            type="number"
            min="0"
            step="0.01"
            :disabled="!canEdit"
            class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ fieldLabel('currency') }}</label>
          <input
            v-model="form.currency"
            type="text"
            :disabled="!canEdit"
            class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ fieldLabel('tax_type') }}</label>
          <select
            v-model="form.tax_type"
            :disabled="!canEdit"
            class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
          >
            <option value="None">None</option>
            <option value="GST">GST</option>
            <option value="VAT">VAT</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ fieldLabel('tax_percentage') }}</label>
          <input
            v-model.number="form.tax_percentage"
            type="number"
            min="0"
            max="100"
            step="0.01"
            :disabled="!canEdit"
            class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ fieldLabel('commission_rate') }}</label>
          <input
            v-model.number="form.commission_rate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            :disabled="!canEdit"
            class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('platform.catalogBarcode') }}</label>
          <input
            v-model="form.barcode"
            type="text"
            :disabled="!canEdit"
            class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
            :placeholder="t('platform.catalogBarcodePlaceholder')"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('platform.catalogBarcodeType') }}</label>
          <select
            v-model="form.barcode_type"
            :disabled="!canEdit"
            class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
          >
            <option v-for="type in barcodeTypes" :key="type" :value="type">{{ barcodeTypeLabel(type) }}</option>
          </select>
        </div>
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('platform.catalogQrPayload') }}</label>
          <input
            v-model="form.qr_payload"
            type="text"
            :disabled="!canEdit"
            class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
            :placeholder="t('platform.catalogQrPayloadPlaceholder')"
          />
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

      <div v-if="canEdit" class="flex justify-end">
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
import { getItemFieldMetadata } from '@/platform/fields/itemFieldModel';
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

const barcodeTypes = CATALOG_BARCODE_TYPES;

/** Labels from item field metadata (same source as list/detail field config). */
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
  currency: 'USD',
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
  form.currency = variant.currency || 'USD';
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

const barcodeTypeLabel = (type) => {
  const key = CATALOG_BARCODE_TYPE_LABEL_KEYS[type];
  return key ? t(key) : type;
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
