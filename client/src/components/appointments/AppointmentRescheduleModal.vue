<template>
  <TransitionRoot :show="open" as="template">
    <Dialog class="relative z-[10000]" @close="close">
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-150"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-black/40" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-y-auto p-4 sm:p-6">
        <div class="flex min-h-full items-center justify-center">
          <TransitionChild
            as="template"
            enter="ease-out duration-200"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="ease-in duration-150"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <DialogPanel class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
              <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t('appointments.rescheduleTitle') }}
              </DialogTitle>
              <p v-if="guestLabel" class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ guestLabel }}
              </p>

              <p v-if="error" class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
                {{ error }}
              </p>

              <p class="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('appointments.pickNewDate') }}</p>
              <div class="mt-2 flex gap-2 overflow-x-auto pb-2">
                <button
                  v-for="d in dateOptions"
                  :key="d.key"
                  type="button"
                  class="flex min-w-[3.5rem] flex-col items-center rounded-xl border px-3 py-2 text-sm transition-colors"
                  :class="selectedDate === d.key
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                    : 'border-gray-200 dark:border-gray-700'"
                  @click="pickDate(d.key)"
                >
                  <span class="text-xs text-gray-500">{{ d.weekday }}</span>
                  <span class="font-semibold">{{ d.day }}</span>
                </button>
              </div>

              <div v-if="slotsLoading" class="py-8 text-center text-sm text-gray-500">{{ t('appointments.loadingTimes') }}</div>
              <div v-else-if="selectedDate && !slots.length" class="py-8 text-center text-sm text-gray-500">
                {{ t('appointments.noTimesThisDay') }}
              </div>
              <div v-else class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <button
                  v-for="slot in slots"
                  :key="slot.start"
                  type="button"
                  class="rounded-lg border py-2 text-sm font-medium transition-colors"
                  :class="selectedSlot?.start === slot.start
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-gray-200 hover:border-indigo-300 dark:border-gray-700'"
                  @click="selectedSlot = slot"
                >
                  {{ formatSlotTime(slot.start) }}
                </button>
              </div>

              <label class="mt-4 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input v-model="notifyGuest" type="checkbox" class="rounded border-gray-300 text-indigo-600" />
                {{ t('appointments.emailGuestUpdated') }}
              </label>

              <div class="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  class="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300"
                  :disabled="submitting"
                  @click="close"
                >
                  {{ t('actions.cancel') }}
                </button>
                <button
                  type="button"
                  class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  :disabled="!selectedSlot || submitting"
                  @click="submit"
                >
                  {{ submitting ? t('states.saving') : t('appointments.confirmNewTime') }}
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot
} from '@headlessui/vue';
import apiClient from '@/utils/apiClient';
import { formatSlotTime } from '@/utils/appointmentFormatters';
import { formatDate } from '@/utils/localeFormat';

const props = defineProps({
  open: { type: Boolean, default: false },
  eventId: { type: String, required: true },
  guestLabel: { type: String, default: '' }
});

const emit = defineEmits(['update:open', 'rescheduled']);

const { t } = useI18n();

const error = ref('');
const submitting = ref(false);
const notifyGuest = ref(true);
const selectedDate = ref(null);
const selectedSlot = ref(null);
const slots = ref([]);
const slotsLoading = ref(false);

const dateOptions = computed(() => {
  const out = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push({
      key: d.toISOString().slice(0, 10),
      weekday: formatDate(d, { weekday: 'short' }),
      day: d.getDate()
    });
  }
  return out;
});

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    error.value = '';
    selectedSlot.value = null;
    slots.value = [];
    const first = dateOptions.value[0]?.key;
    if (first) {
      selectedDate.value = first;
      fetchSlots();
    }
  }
);

function close() {
  emit('update:open', false);
}

async function fetchSlots() {
  if (!props.eventId || !selectedDate.value) return;
  slotsLoading.value = true;
  selectedSlot.value = null;
  try {
    const res = await apiClient.get(`/appointments/events/${props.eventId}/reschedule-slots`, {
      params: { date: selectedDate.value }
    });
    slots.value = res.success ? res.data?.slots || [] : [];
    if (!res.success) error.value = res.message || t('appointments.loadTimesFailed');
  } catch (e) {
    slots.value = [];
    error.value = e?.message || t('appointments.loadTimesFailed');
  } finally {
    slotsLoading.value = false;
  }
}

function pickDate(key) {
  selectedDate.value = key;
  fetchSlots();
}

async function submit() {
  if (!selectedSlot.value || !props.eventId) return;
  error.value = '';
  submitting.value = true;
  try {
    const res = await apiClient.post(`/appointments/events/${props.eventId}/reschedule`, {
      start: selectedSlot.value.start,
      notifyGuest: notifyGuest.value
    });
    if (!res.success) {
      error.value = res.message || t('appointments.rescheduleFailed');
      return;
    }
    emit('rescheduled', res.data);
    close();
  } catch (e) {
    error.value = e?.message || t('appointments.rescheduleFailed');
  } finally {
    submitting.value = false;
  }
}
</script>
