<template>
  <section
    v-if="record?._id"
    class="rounded-xl border px-4 py-3"
    :class="bannerClass"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium" :class="titleClass">
          {{ t('documents.reservationEditingStatus') }}
        </p>
        <p class="mt-0.5 text-sm" :class="subtitleClass">
          {{ statusTitle }}
        </p>
        <p v-if="reservedUserName && reservationState === 'reserved'" class="mt-1 text-xs" :class="subtitleClass">
          {{ t('documents.reservationStartedAt', { time: formatDateTime(record.reservedAt) }) }}
        </p>
        <p v-if="reservationState === 'reserved' && expiresLabel" class="mt-0.5 text-xs" :class="subtitleClass">
          {{ t('documents.reservationExpiresIn', { time: expiresLabel }) }}
        </p>
        <p v-if="reservationState === 'available'" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {{ t('documents.reservationNobodyEditing') }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-if="showReserve"
          type="button"
          class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          :disabled="busy"
          @click="handleReserve"
        >
          {{ t('documents.reservationReserveAction') }}
        </button>
        <button
          v-if="showRelease"
          type="button"
          class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          :disabled="busy"
          @click="handleRelease"
        >
          {{ t('documents.reservationReleaseAction') }}
        </button>
        <button
          v-if="showNotify"
          type="button"
          class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          :disabled="busy"
          @click="handleNotify"
        >
          {{ t('documents.reservationNotifyAction') }}
        </button>
        <button
          v-if="showTakeover"
          type="button"
          class="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100"
          :disabled="busy"
          @click="openTakeoverConfirm"
        >
          {{ t('documents.reservationTakeoverAction') }}
        </button>
      </div>
    </div>

    <Dialog :open="showTakeoverModal" class="relative z-50" @close="showTakeoverModal = false">
      <div class="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900">
          <DialogTitle class="text-base font-semibold text-gray-900 dark:text-white">
            {{ t('documents.reservationTakeoverTitle') }}
          </DialogTitle>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
            {{ t('documents.reservationTakeoverMessage', { name: reservedUserName || t('documents.presenceUnknownUser') }) }}
          </p>
          <div class="mt-4 flex justify-end gap-2">
            <button
              type="button"
              class="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200"
              @click="showTakeoverModal = false"
            >
              {{ t('documents.reservationTakeoverCancel') }}
            </button>
            <button
              type="button"
              class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              :disabled="busy"
              @click="handleTakeover"
            >
              {{ t('documents.reservationTakeoverConfirm') }}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  </section>
</template>

<script setup>
import { formatUserDateTime } from '@/utils/localeFormat';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/vue';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotifications } from '@/composables/useNotifications';
import {
  formatReservationRemaining,
  formatUserName,
  resolveReservationState,
  resolveReservedUserId
} from '@/utils/documentEditingCoordination';

const props = defineProps({
  record: { type: Object, default: null },
  context: { type: Object, default: () => ({}) }
});

const { t } = useI18n();
const authStore = useAuthStore();
const notifications = useNotifications();
const busy = ref(false);
const showTakeoverModal = ref(false);

const currentUserId = computed(() => String(authStore.user?._id || authStore.user?.id || ''));
const canManage = computed(() => props.context?.canManageReservation === true);

const reservationState = computed(() => resolveReservationState(props.record));
const reservedUserId = computed(() => resolveReservedUserId(props.record));
const isReservedByMe = computed(() =>
  reservationState.value === 'reserved' && reservedUserId.value === currentUserId.value
);
const isReservedByOther = computed(() =>
  reservationState.value === 'reserved' && Boolean(reservedUserId.value) && !isReservedByMe.value
);

const reservedUserName = computed(() => {
  const user = props.record?.reservedBy;
  if (typeof user === 'object') return formatUserName(user);
  return '';
});

const expiresLabel = computed(() => formatReservationRemaining(props.record?.reservationExpiresAt));

const showReserve = computed(() =>
  canManage.value && (reservationState.value === 'available' || reservationState.value === 'expired')
);
const showRelease = computed(() => canManage.value && isReservedByMe.value);
const showNotify = computed(() => canManage.value && isReservedByOther.value);
const showTakeover = computed(() =>
  canManage.value && (isReservedByOther.value || reservationState.value === 'expired')
);

const bannerClass = computed(() => {
  if (isReservedByOther.value) {
    return 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30';
  }
  if (isReservedByMe.value) {
    return 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/30';
  }
  return 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40';
});

const titleClass = computed(() => (
  isReservedByOther.value
    ? 'text-amber-900 dark:text-amber-100'
    : isReservedByMe.value
      ? 'text-indigo-900 dark:text-indigo-100'
      : 'text-gray-900 dark:text-white'
));

const subtitleClass = computed(() => (
  isReservedByOther.value
    ? 'text-amber-800 dark:text-amber-200'
    : isReservedByMe.value
      ? 'text-indigo-800 dark:text-indigo-200'
      : 'text-gray-700 dark:text-gray-300'
));

const statusTitle = computed(() => {
  if (reservationState.value === 'expired') return t('documents.reservationExpiredTitle');
  if (isReservedByMe.value) return t('documents.reservationActiveByYou');
  if (isReservedByOther.value) {
    return t('documents.reservationReservedBy', { name: reservedUserName.value || t('documents.presenceUnknownUser') });
  }
  return t('documents.reservationAvailableTitle');
});

function formatDateTime(value) {
  if (!value) return '—';
  return formatUserDateTime(value);
}

function openTakeoverConfirm() {
  showTakeoverModal.value = true;
}

async function handleReserve() {
  if (typeof props.context?.onReserve !== 'function') return;
  busy.value = true;
  try {
    await props.context.onReserve();
    notifications.success(t('documents.reservationReserveSuccess'));
  } catch (error) {
    notifications.error(error?.message || t('documents.reservationReserveFailed'));
  } finally {
    busy.value = false;
  }
}

async function handleRelease() {
  if (typeof props.context?.onReleaseReservation !== 'function') return;
  busy.value = true;
  try {
    await props.context.onReleaseReservation();
    notifications.success(t('documents.reservationReleaseSuccess'));
  } catch (error) {
    notifications.error(error?.message || t('documents.reservationReleaseFailed'));
  } finally {
    busy.value = false;
  }
}

async function handleNotify() {
  if (typeof props.context?.onNotifyReserver !== 'function') return;
  busy.value = true;
  try {
    await props.context.onNotifyReserver();
    notifications.success(t('documents.reservationNotifySuccess'));
  } catch (error) {
    notifications.error(error?.message || t('documents.reservationNotifyFailed'));
  } finally {
    busy.value = false;
  }
}

async function handleTakeover() {
  if (typeof props.context?.onTakeoverReservation !== 'function') return;
  busy.value = true;
  try {
    await props.context.onTakeoverReservation();
    showTakeoverModal.value = false;
    notifications.success(t('documents.reservationTakeoverSuccess'));
  } catch (error) {
    notifications.error(error?.message || t('documents.reservationTakeoverFailed'));
  } finally {
    busy.value = false;
  }
}
</script>
