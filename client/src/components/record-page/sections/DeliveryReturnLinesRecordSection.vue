<template>
  <div class="space-y-4 px-1 py-2">
    <div
      v-if="editable"
      class="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40"
    >
      <div class="min-w-[12rem] flex-1">
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-300">
          {{ t('records.drImportSources') }}
        </label>
        <select
          v-model="selectedDnId"
          class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">{{ t('records.drSelectDeliveryNote') }}</option>
          <option v-for="dn in eligibleNotes" :key="dn._id" :value="dn._id">
            {{ dn.deliveryNoteNumber }}
            <template v-if="dn.returnableQuantityTotal">
              — {{ dn.returnableQuantityTotal }}
            </template>
          </option>
        </select>
      </div>
      <button
        type="button"
        class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        :disabled="importBusy || !selectedDnId"
        @click="importFromSelected"
      >
        {{ t('records.drImportLines') }}
      </button>
      <button
        type="button"
        class="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 dark:border-gray-600 dark:text-gray-100"
        :disabled="importBusy"
        @click="loadEligible"
      >
        {{ t('records.drRefreshSources') }}
      </button>
      <p v-if="importError" class="w-full text-sm text-red-600">{{ importError }}</p>
    </div>

    <div v-if="!lines.length" class="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
      {{ t('records.drNoLines') }}
    </div>

    <div v-else class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900/50">
          <tr class="text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <th class="px-3 py-2">{{ t('records.drColProduct') }}</th>
            <th class="px-3 py-2">{{ t('records.drColDelivered') }}</th>
            <th class="px-3 py-2">{{ t('records.drColReturnable') }}</th>
            <th class="px-3 py-2">{{ t('records.drColReturnQty') }}</th>
            <th class="px-3 py-2">{{ t('records.drColUnitPrice') }}</th>
            <th class="px-3 py-2">{{ t('records.drColReason') }}</th>
            <th class="px-3 py-2">{{ t('records.drColLineTotal') }}</th>
            <th v-if="editable" class="px-3 py-2" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          <tr v-for="line in lines" :key="lineKey(line)" class="text-gray-900 dark:text-gray-100">
            <td class="px-3 py-2">
              <div class="font-medium">{{ line.itemNameSnapshot || line.skuSnapshot || '—' }}</div>
              <div v-if="line.skuSnapshot" class="text-xs text-gray-500">{{ line.skuSnapshot }}</div>
            </td>
            <td class="px-3 py-2 tabular-nums">{{ num(line.quantityDelivered) }}</td>
            <td class="px-3 py-2 tabular-nums">{{ num(line.quantityReturnable) }}</td>
            <td class="px-3 py-2">
              <input
                v-if="editable"
                type="number"
                min="0"
                step="any"
                class="w-24 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
                :value="line.quantityReturned"
                @change="(e) => patchLine(line, { quantityReturned: e.target.value })"
              />
              <span v-else class="tabular-nums">{{ num(line.quantityReturned) }}</span>
            </td>
            <td class="px-3 py-2 tabular-nums">{{ money(line.unitPrice) }}</td>
            <td class="px-3 py-2">
              <input
                v-if="editable"
                type="text"
                class="w-36 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
                :value="line.returnReason"
                @change="(e) => patchLine(line, { returnReason: e.target.value })"
              />
              <span v-else>{{ line.returnReason || '—' }}</span>
            </td>
            <td class="px-3 py-2 tabular-nums">{{ money(line.lineTotal) }}</td>
            <td v-if="editable" class="px-3 py-2 text-right">
              <button
                type="button"
                class="text-xs text-red-600 hover:underline"
                :disabled="saveBusy"
                @click="removeLine(line)"
              >
                {{ t('actions.remove') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="lines.length"
      class="flex justify-end gap-6 border-t border-gray-100 pt-3 text-sm dark:border-gray-800"
    >
      <div class="text-gray-500">{{ t('records.drSubtotal') }}</div>
      <div class="font-medium tabular-nums">{{ money(record?.subtotal) }}</div>
      <div class="text-gray-500">{{ t('records.drGrandTotal') }}</div>
      <div class="font-semibold tabular-nums">{{ money(record?.grandTotal) }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { isDeliveryReturnEditable } from '@/constants/deliveryReturnLifecycle';

const props = defineProps({
  record: { type: Object, default: null },
  section: { type: Object, default: null }
});

const { t } = useI18n();
const emitSectionUpdated = inject('emitSectionUpdated', null);
const recordPageNotify = inject('recordPageNotify', null);

const lines = computed(() => (Array.isArray(props.record?.lines) ? props.record.lines : []));
const editable = computed(() => isDeliveryReturnEditable(props.record?.status));
const saveBusy = ref(false);
const importBusy = ref(false);
const importError = ref('');
const eligibleNotes = ref([]);
const selectedDnId = ref('');

function notify(type, message) {
  if (typeof recordPageNotify === 'function') {
    recordPageNotify({ type, message });
  }
}

function lineKey(line) {
  return line?._id || line?.deliveryReturnLineId || line?.deliveryNoteLineId;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function money(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: props.record?.currency || 'USD'
    }).format(n);
  } catch {
    return String(n);
  }
}

function recordId() {
  return props.record?._id || props.record?.id || null;
}

function customerId() {
  const v = props.record?.customerId;
  if (!v) return null;
  if (typeof v === 'object') return v._id || v.id || null;
  return v;
}

async function loadEligible() {
  const cid = customerId();
  if (!cid) {
    eligibleNotes.value = [];
    return;
  }
  try {
    const res = await apiClient.get('/inventory/delivery-returns/eligible-sources', {
      params: { customerId: cid }
    });
    const data = res?.data ?? res;
    eligibleNotes.value = Array.isArray(data?.deliveryNotes) ? data.deliveryNotes : [];
  } catch {
    eligibleNotes.value = [];
  }
}

async function importFromSelected() {
  const id = recordId();
  if (!id || !selectedDnId.value) return;
  importBusy.value = true;
  importError.value = '';
  try {
    const res = await apiClient.post(`/inventory/delivery-returns/${id}/lines/from-sources`, {
      deliveryNoteIds: [selectedDnId.value],
      returnReason: props.record?.returnReason || t('records.drDefaultReason')
    });
    const data = res?.data ?? res;
    if (typeof emitSectionUpdated === 'function') emitSectionUpdated({ payload: data });
    selectedDnId.value = '';
    await loadEligible();
  } catch (err) {
    importError.value = err?.message || t('records.drImportFailed');
  } finally {
    importBusy.value = false;
  }
}

async function patchLine(line, body) {
  const id = recordId();
  const lineId = lineKey(line);
  if (!id || !lineId || saveBusy.value) return;
  saveBusy.value = true;
  try {
    const res = await apiClient.patch(`/inventory/delivery-returns/${id}/lines/${lineId}`, body);
    const data = res?.data ?? res;
    if (typeof emitSectionUpdated === 'function') emitSectionUpdated({ payload: data });
  } catch (err) {
    notify('error', err?.message || t('records.drLineSaveFailed'));
  } finally {
    saveBusy.value = false;
  }
}

async function removeLine(line) {
  const id = recordId();
  const lineId = lineKey(line);
  if (!id || !lineId || saveBusy.value) return;
  saveBusy.value = true;
  try {
    const res = await apiClient.delete(`/inventory/delivery-returns/${id}/lines/${lineId}`);
    const data = res?.data ?? res;
    if (typeof emitSectionUpdated === 'function') emitSectionUpdated({ payload: data });
  } catch (err) {
    notify('error', err?.message || t('records.drLineSaveFailed'));
  } finally {
    saveBusy.value = false;
  }
}

watch(
  () => customerId(),
  () => {
    if (editable.value) loadEligible();
  }
);

onMounted(() => {
  if (editable.value) loadEligible();
});
</script>
