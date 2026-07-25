<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.itemGroupsDesc') }}</p>
      <button type="button" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white" @click="openCreate">
        {{ t('settings.itemGroupAdd') }}
      </button>
    </div>
    <div v-if="loading" class="flex justify-center py-8">
      <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
    </div>
    <div v-else-if="!groups.length" class="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
      {{ t('settings.itemGroupsEmpty') }}
    </div>
    <div v-else class="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
      <table class="min-w-full text-sm">
        <thead class="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-800/80">
          <tr>
            <th class="px-3 py-2">{{ t('settings.itemGroupName') }}</th>
            <th class="px-3 py-2">{{ t('settings.itemGroupStatus') }}</th>
            <th class="px-3 py-2 text-right">{{ t('actions.edit') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <tr v-for="g in groups" :key="g._id">
            <td class="px-3 py-2 text-gray-900 dark:text-white">{{ g.name }}</td>
            <td class="px-3 py-2">{{ g.status }}</td>
            <td class="space-x-2 px-3 py-2 text-right">
              <button type="button" class="text-indigo-600 hover:underline" @click="preview(g)">{{ t('settings.itemGroupPreview') }}</button>
              <button type="button" class="text-indigo-600 hover:underline" @click="generate(g)">{{ t('settings.itemGroupGenerate') }}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="message" class="text-sm text-emerald-600">{{ message }}</p>
    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

    <div class="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
      <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.itemGroupPricingTitle') }}</h4>
      <p class="mt-1 text-xs text-gray-500">{{ t('settings.itemGroupPricingDesc') }}</p>
      <form class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3" @submit.prevent="calcPrice">
        <label class="text-sm">
          <span class="text-gray-600">{{ t('settings.itemGroupBasePrice') }}</span>
          <input v-model.number="pricing.basePrice" type="number" min="0" step="any" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
        </label>
        <label class="text-sm">
          <span class="text-gray-600">{{ t('settings.itemGroupDiscountPercent') }}</span>
          <input v-model.number="pricing.discountPercent" type="number" min="0" max="100" step="any" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
        </label>
        <div class="flex items-end">
          <button type="submit" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white">{{ t('settings.itemGroupCalcPrice') }}</button>
        </div>
      </form>
      <p v-if="pricingResult != null" class="mt-2 text-sm text-gray-800 dark:text-gray-200">
        {{ t('settings.itemGroupPriceResult', { price: pricingResult }) }}
      </p>
    </div>

    <Teleport to="body">
      <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="showForm = false">
        <form class="w-full max-w-md space-y-3 rounded-xl bg-white p-5 shadow-xl dark:bg-gray-800" @submit.prevent="save">
          <h3 class="font-semibold text-gray-900 dark:text-white">{{ t('settings.itemGroupAdd') }}</h3>
          <input v-model="form.name" required :placeholder="t('settings.itemGroupName')" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
          <textarea v-model="form.attrText" rows="4" :placeholder="t('settings.itemGroupAttrsPlaceholder')" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
          <p class="text-xs text-gray-500">{{ t('settings.itemGroupAttrsHint') }}</p>
          <div class="flex justify-end gap-2">
            <button type="button" class="px-3 py-2 text-sm" @click="showForm = false">{{ t('actions.cancel') }}</button>
            <button type="submit" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">{{ t('actions.save') }}</button>
          </div>
        </form>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Teleport } from 'vue';
import apiClient from '@/utils/apiClient';

const { t } = useI18n();
const groups = ref([]);
const loading = ref(false);
const error = ref('');
const message = ref('');
const showForm = ref(false);
const form = reactive({ name: '', attrText: 'Color:Black,White\nStorage:128,256' });
const pricing = reactive({ basePrice: 100, discountPercent: 0 });
const pricingResult = ref(null);

function parseAttrs(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, idx) => {
      const [name, valuesRaw] = line.split(':');
      return {
        name: String(name || '').trim(),
        values: String(valuesRaw || '').split(',').map((v) => v.trim()).filter(Boolean),
        isVariantAttribute: true,
        required: true,
        displayOrder: idx
      };
    })
    .filter((a) => a.name && a.values.length);
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await apiClient.get('/item-groups');
    groups.value = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('states.genericFailure');
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  form.name = '';
  form.attrText = 'Color:Black,White\nStorage:128,256';
  showForm.value = true;
}

async function save() {
  try {
    await apiClient.post('/item-groups', {
      name: form.name,
      attributes: parseAttrs(form.attrText)
    });
    showForm.value = false;
    await load();
  } catch (err) {
    error.value = err?.response?.data?.message || t('states.error');
  }
}

async function preview(g) {
  try {
    const res = await apiClient.post(`/item-groups/${g._id}/preview`);
    message.value = t('settings.itemGroupPreviewResult', { count: res?.data?.count || 0 });
  } catch (err) {
    error.value = err?.message || t('states.genericFailure');
  }
}

async function generate(g) {
  try {
    const res = await apiClient.post(`/item-groups/${g._id}/generate`);
    message.value = t('settings.itemGroupGenerateResult', { count: res?.data?.createdCount || 0 });
  } catch (err) {
    error.value = err?.message || t('states.genericFailure');
  }
}

async function calcPrice() {
  try {
    const res = await apiClient.post('/item-groups/pricing/calculate', {
      basePrice: pricing.basePrice,
      quantity: 1,
      promotions: pricing.discountPercent
        ? [{ type: 'percent', value: pricing.discountPercent }]
        : []
    });
    pricingResult.value = res?.data?.unitPrice ?? null;
  } catch (err) {
    error.value = err?.message || t('states.genericFailure');
  }
}

onMounted(load);
</script>
