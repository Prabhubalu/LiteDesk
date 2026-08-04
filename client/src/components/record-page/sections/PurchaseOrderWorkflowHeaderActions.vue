<template>
  <div class="flex flex-wrap items-center justify-end gap-1.5">
    <button
      v-for="action in workflowActions"
      :key="action.key"
      type="button"
      class="inline-flex items-center rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
      :class="action.className"
      :disabled="busy"
      @click="action.handler"
    >
      {{ action.label }}
    </button>

    <button
      v-if="canEmail"
      type="button"
      class="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
      :disabled="busy"
      @click="showSendEmail = true"
    >
      {{ t('records.poSendEmail') }}
    </button>

    <Menu v-if="menuItems.length" as="div" class="relative">
      <MenuButton
        class="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-800 disabled:opacity-50 dark:border-gray-600 dark:text-gray-100"
        :disabled="busy"
      >
        {{ t('records.poMoreActions') }}
      </MenuButton>
      <transition
        enter-active-class="transition ease-out duration-100"
        enter-from-class="transform opacity-0 scale-95"
        enter-to-class="transform opacity-100 scale-100"
        leave-active-class="transition ease-in duration-75"
        leave-from-class="transform opacity-100 scale-100"
        leave-to-class="transform opacity-0 scale-95"
      >
        <MenuItems
          class="absolute right-0 top-full z-30 mt-1 w-56 rounded-lg bg-white py-1 shadow-lg ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10"
        >
          <MenuItem v-for="item in menuItems" :key="item.key" v-slot="{ active }">
            <button
              type="button"
              :class="[
                'block w-full px-4 py-2 text-left text-sm',
                active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200',
                item.danger ? 'text-red-700 dark:text-red-400' : ''
              ]"
              :disabled="busy"
              @click="item.handler"
            >
              {{ item.label }}
            </button>
          </MenuItem>
        </MenuItems>
      </transition>
    </Menu>

    <Teleport to="body">
      <div
        v-if="showReceiptModal"
        class="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
        @click.self="showReceiptModal = false"
      >
        <form
          class="w-full max-w-md space-y-3 rounded-xl bg-white p-5 shadow-xl dark:bg-gray-800"
          @submit.prevent="createReceiptNote"
        >
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">
            {{ t('records.poCreateReceiptNote') }}
          </h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{ t('records.poCreateReceiptNoteHint', { number: record?.poNumber || '' }) }}
          </p>
          <label class="block text-sm text-gray-800 dark:text-gray-200">
            <span>{{ t('records.poReceiptLocation') }}</span>
            <select
              v-model="receiptLocationId"
              required
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option disabled value="">{{ t('records.poReceiptLocationSelect') }}</option>
              <option
                v-for="loc in locations"
                :key="locKey(loc)"
                :value="locKey(loc)"
              >
                {{ loc.name || loc.inventoryLocationId || loc._id }}
              </option>
            </select>
          </label>
          <p v-if="receiptError" class="text-sm text-red-600 dark:text-red-400">{{ receiptError }}</p>
          <div class="flex justify-end gap-2 pt-1">
            <button
              type="button"
              class="rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-200"
              @click="showReceiptModal = false"
            >
              {{ t('actions.cancel') }}
            </button>
            <button
              type="submit"
              class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              :disabled="busy || !receiptLocationId"
            >
              {{ t('records.poCreateReceiptNote') }}
            </button>
          </div>
        </form>
      </div>
    </Teleport>

    <PurchaseOrderSendEmailDrawer
      :is-open="showSendEmail"
      :record="record"
      @close="showSendEmail = false"
      @sent="onEmailSent"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import { useAuthStore } from '@/stores/auth';
import { confirmAction } from '@/composables/useConfirmAction';
import { PO_STATUSES } from '@/constants/purchaseOrderLifecycle';
import PurchaseOrderSendEmailDrawer from '@/components/record-page/sections/PurchaseOrderSendEmailDrawer.vue';
const props = defineProps({
  record: { type: Object, default: null },
  context: { type: Object, default: () => ({}) }
});

const { t } = useI18n();
const router = useRouter();
const notifications = useNotifications();
const auth = useAuthStore();
const busy = ref(false);
const showReceiptModal = ref(false);
const showSendEmail = ref(false);
const locations = ref([]);
const receiptLocationId = ref('');
const receiptError = ref('');

const status = computed(() => String(props.record?.status || '').toLowerCase().trim());

const canEmail = computed(() => {
  if (!canAdjust() || !props.record?._id) return false;
  return status.value && status.value !== PO_STATUSES.CANCELLED;
});

function canAdjust() {
  if (auth.isOwner) return true;
  return auth.can?.('inventory', 'adjust') === true;
}

function locKey(loc) {
  return String(loc?.inventoryLocationId || loc?._id || loc?.id || '');
}

function refresh(payload = { type: 'soft-refresh' }) {
  props.context?.onSectionUpdated?.({ sectionKey: 'lines', payload });
}

function applyStatus(data) {
  const patch = data && typeof data === 'object' ? data : null;
  if (patch?.status) {
    refresh({ type: 'soft-refresh', purchaseOrder: { status: patch.status, ...patch } });
    return;
  }
  refresh({ type: 'soft-refresh' });
}

async function runAction(path, successKey) {
  if (!props.record?._id || busy.value || !canAdjust()) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/inventory/purchase-orders/${props.record._id}${path}`, {});
    if (res?.success) {
      notifications.success(t(successKey));
      applyStatus(res.data);
      return;
    }
    notifications.error(res?.message || t('records.poActionFailed'));
  } catch (e) {
    notifications.error(e?.message || t('records.poActionFailed'));
  } finally {
    busy.value = false;
  }
}

function onEmailSent() {
  showSendEmail.value = false;
  notifications.success(t('records.poSendEmailSuccess'));
}

async function openReceiptModal() {
  receiptError.value = '';
  showReceiptModal.value = true;
  if (!locations.value.length) {
    try {
      const res = await apiClient.get('/inventory/locations');
      const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      locations.value = rows;
    } catch {
      locations.value = [];
    }
  }
  const defaultWh =
    props.record?.deliveryWarehouseId?._id ||
    props.record?.deliveryWarehouseId ||
    '';
  if (defaultWh) {
    receiptLocationId.value = String(defaultWh);
  } else if (locations.value[0]) {
    receiptLocationId.value = locKey(locations.value[0]);
  }
}

async function createReceiptNote() {
  if (!props.record?._id || !receiptLocationId.value || busy.value) return;
  busy.value = true;
  receiptError.value = '';
  try {
    const res = await apiClient.post('/inventory/receipt-notes', {
      purchaseOrderId: props.record._id,
      receiptLocationId: receiptLocationId.value
    });
    if (res?.success === false) {
      receiptError.value = res?.message || t('records.poReceiptCreateFailed');
      return;
    }
    const rn = res?.data?.receiptNote || res?.data || res;
    const number = rn?.receiptNoteNumber || '';
    notifications.success(
      number
        ? t('records.poReceiptCreateSuccessWithNumber', { number })
        : t('records.poReceiptCreateSuccess')
    );
    showReceiptModal.value = false;
    applyStatus({ status: status.value });
    if (rn?._id) {
      router.push(`/inventory/receipt-notes/${rn._id}`);
    }
  } catch (e) {
    receiptError.value = e?.message || t('records.poReceiptCreateFailed');
  } finally {
    busy.value = false;
  }
}

async function duplicatePo() {
  if (!props.record?._id || busy.value || !canAdjust()) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/inventory/purchase-orders/${props.record._id}/duplicate`, {});
    if (res?.success && res?.data?._id) {
      notifications.success(t('records.poDuplicateSuccess', { number: res.data.poNumber || '' }));
      router.push(`/inventory/purchase-orders/${res.data._id}`);
      return;
    }
    notifications.error(res?.message || t('records.poActionFailed'));
  } catch (e) {
    notifications.error(e?.message || t('records.poActionFailed'));
  } finally {
    busy.value = false;
  }
}

async function cancelPo() {
  if (!(await confirmAction(t('records.poCancelConfirm')))) return;
  await runAction('/cancel', 'records.poCancelSuccess');
}

const workflowActions = computed(() => {
  if (!canAdjust()) return [];
  const s = status.value;
  const actions = [];

  if (s === PO_STATUSES.DRAFT) {
    actions.push({
      key: 'submit',
      label: t('records.poSubmitApproval'),
      className: 'border border-gray-300 text-gray-800 dark:border-gray-600 dark:text-gray-100',
      handler: () => runAction('/submit', 'records.poSubmitSuccess')
    });
    actions.push({
      key: 'approve',
      label: t('records.poApprove'),
      className: 'bg-emerald-600 text-white hover:bg-emerald-700',
      handler: () => runAction('/approve', 'records.poApproveSuccess')
    });
  }
  if (s === PO_STATUSES.PENDING_APPROVAL) {
    actions.push({
      key: 'approve',
      label: t('records.poApprove'),
      className: 'bg-emerald-600 text-white hover:bg-emerald-700',
      handler: () => runAction('/approve', 'records.poApproveSuccess')
    });
  }
  if (s === PO_STATUSES.APPROVED) {
    actions.push({
      key: 'order',
      label: t('records.poMarkOrdered'),
      className: 'bg-indigo-600 text-white hover:bg-indigo-700',
      handler: () => runAction('/order', 'records.poMarkOrderedSuccess')
    });
  }
  if (
    s === PO_STATUSES.APPROVED ||
    s === PO_STATUSES.ORDERED ||
    s === PO_STATUSES.PARTIALLY_RECEIVED
  ) {
    actions.push({
      key: 'receipt',
      label: t('records.poCreateReceiptNote'),
      className: 'bg-indigo-600 text-white hover:bg-indigo-700',
      handler: () => openReceiptModal()
    });
  }

  return actions;
});

const menuItems = computed(() => {
  const items = [];
  if (canAdjust()) {
    items.push({
      key: 'duplicate',
      label: t('actions.duplicate'),
      handler: () => duplicatePo()
    });
  }
  if (
    canAdjust() &&
    ![PO_STATUSES.CANCELLED, PO_STATUSES.FULLY_RECEIVED, PO_STATUSES.CLOSED].includes(status.value)
  ) {
    items.push({
      key: 'cancel',
      label: t('records.poCancel'),
      danger: true,
      handler: () => cancelPo()
    });
  }
  return items;
});
</script>
