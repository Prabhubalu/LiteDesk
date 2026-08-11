<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.pricingEngineDesc') }}</p>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-lg px-3 py-2 text-sm font-medium"
          :class="panel === 'rules' ? 'bg-indigo-600 text-white' : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'"
          @click="panel = 'rules'"
        >
          {{ t('settings.pricingTabRules') }}
        </button>
        <button
          type="button"
          class="rounded-lg px-3 py-2 text-sm font-medium"
          :class="panel === 'promotions' ? 'bg-indigo-600 text-white' : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'"
          @click="panel = 'promotions'"
        >
          {{ t('settings.pricingTabPromotions') }}
        </button>
        <button
          type="button"
          class="rounded-lg px-3 py-2 text-sm font-medium"
          :class="panel === 'preview' ? 'bg-indigo-600 text-white' : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'"
          @click="panel = 'preview'"
        >
          {{ t('settings.pricingTabPreview') }}
        </button>
      </div>
    </div>

    <div
      v-if="flash"
      class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-200"
    >
      {{ flash }}
    </div>
    <div
      v-if="error"
      class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-300"
    >
      {{ error }}
    </div>

    <!-- Rules -->
    <div v-if="panel === 'rules'" class="space-y-4">
      <div class="flex justify-end">
        <button type="button" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700" @click="openRuleForm()">
          {{ t('settings.pricingAddRule') }}
        </button>
      </div>
      <div v-if="loadingRules" class="py-10 text-center text-sm text-gray-500">{{ t('states.loading') }}</div>
      <ul
        v-else-if="rules.length"
        class="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800/40"
      >
        <li v-for="rule in rules" :key="rule._id" class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div class="min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white">{{ rule.name }}</p>
            <p class="text-xs text-gray-500">
              {{ rule.ruleType }} · P{{ rule.priority }} · {{ formatAdj(rule.adjustment) }}
              <span class="ml-1">· {{ rule.status }}</span>
            </p>
          </div>
          <div class="flex gap-2">
            <button type="button" class="text-xs text-indigo-600" @click="openRuleForm(rule)">{{ t('actions.edit') }}</button>
            <button type="button" class="text-xs text-red-600" @click="removeRule(rule._id)">{{ t('actions.delete') }}</button>
          </div>
        </li>
      </ul>
      <p v-else class="rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-600">
        {{ t('settings.pricingRulesEmpty') }}
      </p>
    </div>

    <!-- Promotions -->
    <div v-if="panel === 'promotions'" class="space-y-4">
      <div class="flex justify-end">
        <button type="button" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700" @click="openPromoForm()">
          {{ t('settings.pricingAddPromo') }}
        </button>
      </div>
      <div v-if="loadingPromos" class="py-10 text-center text-sm text-gray-500">{{ t('states.loading') }}</div>
      <ul
        v-else-if="promotions.length"
        class="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800/40"
      >
        <li v-for="promo in promotions" :key="promo._id" class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div class="min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white">{{ promo.name }}</p>
            <p class="text-xs text-gray-500">
              {{ promo.promoType }} · P{{ promo.priority }} · {{ formatPromoAction(promo) }}
              <span class="ml-1">· {{ promo.status }}</span>
            </p>
          </div>
          <div class="flex gap-2">
            <button type="button" class="text-xs text-indigo-600" @click="openPromoForm(promo)">{{ t('actions.edit') }}</button>
            <button type="button" class="text-xs text-red-600" @click="removePromo(promo._id)">{{ t('actions.delete') }}</button>
          </div>
        </li>
      </ul>
      <p v-else class="rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-600">
        {{ t('settings.pricingPromosEmpty') }}
      </p>
    </div>

    <!-- Preview -->
    <div v-if="panel === 'preview'" class="space-y-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/40">
      <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.pricingPreviewHint') }}</p>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-300">
          {{ t('settings.pricingPreviewVariantId') }}
          <input v-model="preview.variantId" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600" />
        </label>
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-300">
          {{ t('settings.pricingPreviewQty') }}
          <input v-model.number="preview.quantity" type="number" min="1" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600" />
        </label>
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-300">
          {{ t('settings.pricingCustomerType') }}
          <select v-model="preview.customerType" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600">
            <option value="">—</option>
            <option v-for="ct in customerTypes" :key="ct" :value="ct">{{ ct }}</option>
          </select>
        </label>
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-300">
          {{ t('settings.pricingRegion') }}
          <input v-model="preview.regionCode" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600" placeholder="IN" />
        </label>
      </div>
      <button
        type="button"
        class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        :disabled="previewLoading"
        @click="runPreview"
      >
        {{ t('settings.pricingRunPreview') }}
      </button>
      <div v-if="previewResult" class="space-y-2 rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-600">
        <p class="font-medium text-gray-900 dark:text-white">
          {{ t('settings.pricingPreviewList') }}: {{ previewResult.listPrice }}
          → {{ t('settings.pricingPreviewUnit') }}: {{ previewResult.unitPrice }}
          <span class="text-gray-500">({{ previewResult.currency }})</span>
        </p>
        <ol v-if="previewResult.pricingBreakdown?.applied?.length" class="list-decimal space-y-1 pl-5 text-xs text-gray-600 dark:text-gray-300">
          <li v-for="(step, idx) in previewResult.pricingBreakdown.applied" :key="idx">
            {{ step.kind }} · {{ step.name || step.ruleType || step.promoType }} · {{ step.unitPriceBefore }} → {{ step.unitPriceAfter }}
          </li>
        </ol>
        <p v-else class="text-xs text-gray-500">{{ t('settings.pricingPreviewNoAdjustments') }}</p>
      </div>
    </div>

    <!-- Rule modal -->
    <div v-if="showRuleForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 space-y-3 dark:bg-gray-800">
        <h4 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ editingRuleId ? t('settings.pricingEditRule') : t('settings.pricingAddRule') }}
        </h4>
        <input v-model="ruleForm.name" class="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600" :placeholder="t('settings.pricingNamePlaceholder')" />
        <select v-model="ruleForm.ruleType" class="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600">
          <option v-for="rt in ruleTypes" :key="rt" :value="rt">{{ rt }}</option>
        </select>
        <div class="grid grid-cols-2 gap-2">
          <select v-model="ruleForm.adjustment.type" class="rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600">
            <option value="percent">percent</option>
            <option value="amount">amount</option>
            <option value="fixed_price">fixed_price</option>
          </select>
          <input v-model.number="ruleForm.adjustment.value" type="number" class="rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600" />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <input v-model.number="ruleForm.conditions.minQty" type="number" min="0" class="rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600" :placeholder="t('settings.pricingMinQty')" />
          <input v-model.number="ruleForm.priority" type="number" class="rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600" :placeholder="t('settings.pricingPriority')" />
        </div>
        <select v-model="ruleForm.conditions.customerTypes" multiple class="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600 h-24">
          <option v-for="ct in customerTypes" :key="ct" :value="ct">{{ ct }}</option>
        </select>
        <input v-model="ruleForm.conditions.customerIdsRaw" class="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600" :placeholder="t('settings.pricingCustomerIdsHint')" />
        <input v-model="ruleForm.conditions.regionCodesRaw" class="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600" :placeholder="t('settings.pricingRegionsHint')" />
        <div class="grid grid-cols-2 gap-2">
          <input v-model="ruleForm.effectiveFrom" type="date" class="rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600" />
          <input v-model="ruleForm.effectiveUntil" type="date" class="rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600" />
        </div>
        <select v-model="ruleForm.status" class="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600">
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="px-3 py-2 text-sm" @click="showRuleForm = false">{{ t('actions.cancel') }}</button>
          <button type="button" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white" @click="saveRule">{{ t('actions.save') }}</button>
        </div>
      </div>
    </div>

    <!-- Promo modal -->
    <div v-if="showPromoForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 space-y-3 dark:bg-gray-800">
        <h4 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ editingPromoId ? t('settings.pricingEditPromo') : t('settings.pricingAddPromo') }}
        </h4>
        <input v-model="promoForm.name" class="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600" :placeholder="t('settings.pricingNamePlaceholder')" />
        <select v-model="promoForm.promoType" class="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600">
          <option v-for="pt in promoTypes" :key="pt" :value="pt">{{ pt }}</option>
        </select>
        <div v-if="promoForm.promoType === 'BUY_X_GET_Y'" class="grid grid-cols-2 gap-2">
          <input v-model.number="promoForm.action.buyQty" type="number" min="1" class="rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600" placeholder="Buy" />
          <input v-model.number="promoForm.action.getQty" type="number" min="1" class="rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600" placeholder="Get" />
        </div>
        <div v-else class="grid grid-cols-2 gap-2">
          <select v-model="promoForm.action.type" class="rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600">
            <option value="percent">percent</option>
            <option value="amount">amount</option>
          </select>
          <input v-model.number="promoForm.action.value" type="number" class="rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600" />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <input v-model.number="promoForm.conditions.minQty" type="number" class="rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600" :placeholder="t('settings.pricingMinQty')" />
          <input v-model.number="promoForm.conditions.minOrderSubtotal" type="number" class="rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600" :placeholder="t('settings.pricingMinOrder')" />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <input v-model="promoForm.effectiveFrom" type="date" class="rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600" />
          <input v-model="promoForm.effectiveUntil" type="date" class="rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600" />
        </div>
        <select v-model="promoForm.status" class="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600">
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="px-3 py-2 text-sm" @click="showPromoForm = false">{{ t('actions.cancel') }}</button>
          <button type="button" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white" @click="savePromo">{{ t('actions.save') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { unwrapCatalogApiData, unwrapCatalogApiList } from '@/utils/catalogApi';

const { t } = useI18n();

const panel = ref('rules');
const flash = ref('');
const error = ref('');
const rules = ref([]);
const promotions = ref([]);
const loadingRules = ref(false);
const loadingPromos = ref(false);
const customerTypes = ref(['RETAIL', 'DEALER', 'DISTRIBUTOR', 'CORPORATE']);
const ruleTypes = ref(['QUANTITY', 'CUSTOMER', 'REGION', 'DATE', 'CONTRACT', 'CHANNEL']);
const promoTypes = ref([
  'PRODUCT_DISCOUNT',
  'ORDER_DISCOUNT',
  'BUY_X_GET_Y',
  'VOLUME_DISCOUNT',
  'CUSTOMER_DISCOUNT',
  'SHIPPING_DISCOUNT',
  'FESTIVAL',
]);

const showRuleForm = ref(false);
const editingRuleId = ref(null);
const ruleForm = reactive({
  name: '',
  ruleType: 'QUANTITY',
  priority: 100,
  status: 'ACTIVE',
  effectiveFrom: '',
  effectiveUntil: '',
  adjustment: { type: 'percent', value: 5 },
  conditions: {
    minQty: null,
    customerTypes: [],
    customerIdsRaw: '',
    regionCodesRaw: '',
  },
});

const showPromoForm = ref(false);
const editingPromoId = ref(null);
const promoForm = reactive({
  name: '',
  promoType: 'PRODUCT_DISCOUNT',
  status: 'ACTIVE',
  priority: 100,
  effectiveFrom: '',
  effectiveUntil: '',
  action: { type: 'percent', value: 10, buyQty: 2, getQty: 1 },
  conditions: { minQty: null, minOrderSubtotal: null },
});

const preview = reactive({
  variantId: '',
  quantity: 1,
  customerType: '',
  regionCode: '',
});
const previewLoading = ref(false);
const previewResult = ref(null);

function formatAdj(adj) {
  if (!adj) return '—';
  if (adj.type === 'percent') return `${adj.value}%`;
  if (adj.type === 'fixed_price') return `= ${adj.value}`;
  return `- ${adj.value}`;
}

function formatPromoAction(promo) {
  if (promo.promoType === 'BUY_X_GET_Y') {
    return `Buy ${promo.action?.buyQty} Get ${promo.action?.getQty}`;
  }
  return formatAdj(promo.action);
}

function dateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function parseIds(raw) {
  return String(raw || '')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function loadMeta() {
  try {
    const res = await apiClient.get('/pricing/meta');
    const data = unwrapCatalogApiData(res) || {};
    if (data?.customerTypes) customerTypes.value = data.customerTypes;
    if (data?.ruleTypes) ruleTypes.value = data.ruleTypes;
    if (data?.promoTypes) promoTypes.value = data.promoTypes;
  } catch {
    /* meta optional */
  }
}

async function loadRules() {
  loadingRules.value = true;
  try {
    const res = await apiClient.get('/pricing/rules', { params: { includeInactive: true } });
    rules.value = unwrapCatalogApiList(res);
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('settings.pricingLoadFailed');
    rules.value = [];
  } finally {
    loadingRules.value = false;
  }
}

async function loadPromos() {
  loadingPromos.value = true;
  try {
    const res = await apiClient.get('/pricing/promotions', { params: { includeInactive: true } });
    promotions.value = unwrapCatalogApiList(res);
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('settings.pricingLoadFailed');
    promotions.value = [];
  } finally {
    loadingPromos.value = false;
  }
}

function openRuleForm(rule = null) {
  editingRuleId.value = rule?._id || null;
  ruleForm.name = rule?.name || '';
  ruleForm.ruleType = rule?.ruleType || 'QUANTITY';
  ruleForm.priority = rule?.priority ?? 100;
  ruleForm.status = rule?.status || 'ACTIVE';
  ruleForm.effectiveFrom = dateInput(rule?.effectiveFrom);
  ruleForm.effectiveUntil = dateInput(rule?.effectiveUntil);
  ruleForm.adjustment = {
    type: rule?.adjustment?.type || 'percent',
    value: rule?.adjustment?.value ?? 5,
  };
  ruleForm.conditions.minQty = rule?.conditions?.minQty ?? null;
  ruleForm.conditions.customerTypes = [...(rule?.conditions?.customerTypes || [])];
  ruleForm.conditions.customerIdsRaw = (rule?.conditions?.customerIds || []).join(', ');
  ruleForm.conditions.regionCodesRaw = (rule?.conditions?.regionCodes || []).join(', ');
  showRuleForm.value = true;
}

async function saveRule() {
  error.value = '';
  const payload = {
    name: ruleForm.name,
    ruleType: ruleForm.ruleType,
    priority: ruleForm.priority,
    status: ruleForm.status,
    effectiveFrom: ruleForm.effectiveFrom || null,
    effectiveUntil: ruleForm.effectiveUntil || null,
    adjustment: { ...ruleForm.adjustment },
    conditions: {
      minQty: ruleForm.conditions.minQty,
      customerTypes: ruleForm.conditions.customerTypes,
      customerIds: parseIds(ruleForm.conditions.customerIdsRaw),
      regionCodes: parseIds(ruleForm.conditions.regionCodesRaw),
    },
  };
  try {
    if (editingRuleId.value) {
      await apiClient.put(`/pricing/rules/${editingRuleId.value}`, payload);
    } else {
      await apiClient.post('/pricing/rules', payload);
    }
    showRuleForm.value = false;
    flash.value = t('settings.pricingSaved');
    await loadRules();
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('settings.pricingSaveFailed');
  }
}

async function removeRule(id) {
  try {
    await apiClient.delete(`/pricing/rules/${id}`);
    flash.value = t('settings.pricingDeleted');
    await loadRules();
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('settings.pricingDeleteFailed');
  }
}

function openPromoForm(promo = null) {
  editingPromoId.value = promo?._id || null;
  promoForm.name = promo?.name || '';
  promoForm.promoType = promo?.promoType || 'PRODUCT_DISCOUNT';
  promoForm.status = promo?.status || 'ACTIVE';
  promoForm.priority = promo?.priority ?? 100;
  promoForm.effectiveFrom = dateInput(promo?.effectiveFrom);
  promoForm.effectiveUntil = dateInput(promo?.effectiveUntil);
  promoForm.action = {
    type: promo?.action?.type || 'percent',
    value: promo?.action?.value ?? 10,
    buyQty: promo?.action?.buyQty ?? 2,
    getQty: promo?.action?.getQty ?? 1,
  };
  promoForm.conditions.minQty = promo?.conditions?.minQty ?? null;
  promoForm.conditions.minOrderSubtotal = promo?.conditions?.minOrderSubtotal ?? null;
  showPromoForm.value = true;
}

async function savePromo() {
  error.value = '';
  const payload = {
    name: promoForm.name,
    promoType: promoForm.promoType,
    status: promoForm.status,
    priority: promoForm.priority,
    effectiveFrom: promoForm.effectiveFrom || null,
    effectiveUntil: promoForm.effectiveUntil || null,
    action: { ...promoForm.action },
    conditions: {
      minQty: promoForm.conditions.minQty,
      minOrderSubtotal: promoForm.conditions.minOrderSubtotal,
    },
  };
  try {
    if (editingPromoId.value) {
      await apiClient.put(`/pricing/promotions/${editingPromoId.value}`, payload);
    } else {
      await apiClient.post('/pricing/promotions', payload);
    }
    showPromoForm.value = false;
    flash.value = t('settings.pricingSaved');
    await loadPromos();
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('settings.pricingSaveFailed');
  }
}

async function removePromo(id) {
  try {
    await apiClient.delete(`/pricing/promotions/${id}`);
    flash.value = t('settings.pricingDeleted');
    await loadPromos();
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('settings.pricingDeleteFailed');
  }
}

async function runPreview() {
  error.value = '';
  previewResult.value = null;
  if (!preview.variantId) {
    error.value = t('settings.pricingPreviewVariantRequired');
    return;
  }
  previewLoading.value = true;
  try {
    const res = await apiClient.post('/pricing/resolve', {
      variantId: preview.variantId,
      quantity: preview.quantity || 1,
      context: {
        customerType: preview.customerType || undefined,
        regionCode: preview.regionCode || undefined,
      },
    });
    previewResult.value = unwrapCatalogApiData(res);
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('settings.pricingPreviewFailed');
  } finally {
    previewLoading.value = false;
  }
}

onMounted(async () => {
  await loadMeta();
  await Promise.all([loadRules(), loadPromos()]);
});
</script>
