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
      {{ t('records.dnSendEmail') }}
    </button>

    <Menu v-if="menuItems.length" as="div" class="relative">
      <MenuButton
        class="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-800 disabled:opacity-50 dark:border-gray-600 dark:text-gray-100"
        :disabled="busy"
      >
        {{ t('records.dnMoreActions') }}
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

    <DeliveryNoteSendEmailDrawer
      :is-open="showSendEmail"
      :record="record"
      @close="showSendEmail = false"
      @sent="onEmailSent"
    />
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import { useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';
import {
  canApproveDeliveryNote,
  canCancelDeliveryNote,
  canMarkDeliveryNoteDelivered,
  canMarkDeliveryNoteDispatched,
  canMarkDeliveryNotePacked,
  canMarkDeliveryNotePicked,
  DN_STATUSES
} from '@/constants/deliveryNoteLifecycle';
import DeliveryNoteSendEmailDrawer from '@/components/record-page/sections/DeliveryNoteSendEmailDrawer.vue';

const props = defineProps({
  record: { type: Object, default: null },
  section: { type: Object, default: null }
});

const { t } = useI18n();
const router = useRouter();
const busy = ref(false);
const showSendEmail = ref(false);
const emitSectionUpdated = inject('emitSectionUpdated', null);
const recordPageNotify = inject('recordPageNotify', null);

function notify(type, message) {
  if (typeof recordPageNotify === 'function') {
    recordPageNotify({ type, message });
    return;
  }
  if (type === 'error') console.error(message);
}

function recordId() {
  return props.record?._id || props.record?.id || null;
}

const status = computed(() => String(props.record?.status || '').toLowerCase());

const canEmail = computed(() => {
  if (!recordId()) return false;
  return status.value && status.value !== DN_STATUSES.CANCELLED;
});

const secondaryBtn =
  'bg-white border border-gray-300 text-gray-800 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100';

async function runAction(path, { successKey, onSuccess } = {}) {
  const id = recordId();
  if (!id || busy.value) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/inventory/delivery-notes/${id}/${path}`);
    const data = res?.data ?? res;
    if (typeof emitSectionUpdated === 'function') {
      emitSectionUpdated({ payload: data });
    }
    if (successKey) notify('success', t(successKey));
    if (typeof onSuccess === 'function') onSuccess(data);
  } catch (err) {
    notify('error', err?.message || t('records.dnActionFailed'));
  } finally {
    busy.value = false;
  }
}

function onEmailSent() {
  showSendEmail.value = false;
  notify('success', t('records.dnSendEmailSuccess'));
}

const workflowActions = computed(() => {
  const list = [];
  if (canApproveDeliveryNote(status.value) && status.value !== DN_STATUSES.APPROVED) {
    list.push({
      key: 'approve',
      label: t('records.dnApprove'),
      className: secondaryBtn,
      handler: () => runAction('approve', { successKey: 'records.dnApproved' })
    });
  }
  if (canMarkDeliveryNotePicked(status.value) && status.value !== DN_STATUSES.PICKED) {
    list.push({
      key: 'pick',
      label: t('records.dnMarkPicked'),
      className: secondaryBtn,
      handler: () => runAction('pick', { successKey: 'records.dnPicked' })
    });
  }
  if (canMarkDeliveryNotePacked(status.value) && status.value !== DN_STATUSES.PACKED) {
    list.push({
      key: 'pack',
      label: t('records.dnMarkPacked'),
      className: secondaryBtn,
      handler: () => runAction('pack', { successKey: 'records.dnPacked' })
    });
  }
  if (canMarkDeliveryNoteDispatched(status.value) && status.value !== DN_STATUSES.DISPATCHED) {
    list.push({
      key: 'dispatch',
      label: t('records.dnMarkDispatched'),
      className: secondaryBtn,
      handler: () => runAction('dispatch', { successKey: 'records.dnDispatched' })
    });
  }
  if (canMarkDeliveryNoteDelivered(status.value) && status.value !== DN_STATUSES.DELIVERED) {
    list.push({
      key: 'deliver',
      label: t('records.dnMarkDelivered'),
      className: secondaryBtn,
      handler: () => runAction('deliver', { successKey: 'records.dnDelivered' })
    });
  }
  return list;
});

const menuItems = computed(() => {
  const items = [
    {
      key: 'duplicate',
      label: t('records.dnDuplicate'),
      handler: () =>
        runAction('duplicate', {
          successKey: 'records.dnDuplicated',
          onSuccess: (data) => {
            const nid = data?._id || data?.id;
            if (nid) router.push(`/inventory/delivery-notes/${nid}`);
          }
        })
    }
  ];
  if (canCancelDeliveryNote(status.value) && !props.record?.inventoryPostedAt) {
    items.push({
      key: 'cancel',
      label: t('records.dnCancel'),
      danger: true,
      handler: () => runAction('cancel', { successKey: 'records.dnCancelled' })
    });
  }
  return items;
});
</script>
