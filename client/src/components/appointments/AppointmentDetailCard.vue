<template>
  <div
    v-if="appointment?.isAppointment"
    class="rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50/80 to-white p-5 shadow-sm dark:border-indigo-500/30 dark:from-indigo-950/40 dark:to-gray-900"
  >
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">{{ t('appointments.detailBadge') }}</p>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ t('appointments.bookedVia', { source: sourceLabel }) }}
        </p>
      </div>
      <BadgeCell v-if="appointment.appointmentType" :value="typeLabel" variant="info" />
    </div>

    <div class="mt-4 grid gap-3 sm:grid-cols-2">
      <div v-if="appointment.bookedByName" class="rounded-xl bg-white/80 p-3 dark:bg-gray-800/60">
        <p class="text-xs text-gray-500">{{ t('appointments.bookedBy') }}</p>
        <p class="font-medium text-gray-900 dark:text-white">{{ appointment.bookedByName }}</p>
        <p v-if="appointment.bookedByEmail" class="text-sm text-gray-500">{{ appointment.bookedByEmail }}</p>
      </div>
      <div v-if="appointment.customerTimezone" class="rounded-xl bg-white/80 p-3 dark:bg-gray-800/60">
        <p class="text-xs text-gray-500">{{ t('appointments.guestTimezone') }}</p>
        <p class="text-sm font-medium text-gray-900 dark:text-white">{{ appointment.customerTimezone }}</p>
      </div>
      <div v-if="appointment.publicPageSlug" class="rounded-xl bg-white/80 p-3 dark:bg-gray-800/60">
        <p class="text-xs text-gray-500">{{ t('appointments.bookingPage') }}</p>
        <a :href="publicBookUrl" target="_blank" rel="noopener" class="text-sm font-medium text-indigo-600 hover:underline">
          /book/{{ appointment.publicPageSlug }}
        </a>
      </div>
      <div v-if="appointment.meetingLink" class="rounded-xl bg-white/80 p-3 dark:bg-gray-800/60">
        <p class="text-xs text-gray-500">{{ t('appointments.meetingLink') }}</p>
        <a :href="appointment.meetingLink" target="_blank" rel="noopener" class="text-sm font-medium text-indigo-600 hover:underline break-all">
          {{ t('appointments.joinMeeting') }}
        </a>
      </div>
    </div>

    <div
      v-if="formResponseEntries.length"
      class="mt-4 rounded-xl border border-gray-200/80 bg-white/80 p-3 dark:border-gray-700 dark:bg-gray-800/60"
    >
      <p class="text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('appointments.bookingAnswers') }}</p>
      <dl class="mt-2 space-y-2">
        <div v-for="row in formResponseEntries" :key="row.key" class="text-sm">
          <dt class="text-gray-500">{{ row.label }}</dt>
          <dd class="font-medium text-gray-900 dark:text-white">{{ row.value }}</dd>
        </div>
      </dl>
    </div>

    <div
      v-if="appointment.noShow"
      class="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
    >
      {{ t('appointments.markedNoShow') }}
      <span v-if="appointment.noShowMarkedAt" class="text-amber-700 dark:text-amber-300">
        · {{ formatMarkedAt(appointment.noShowMarkedAt) }}
      </span>
    </div>

    <div class="mt-4 flex flex-wrap gap-2">
      <a
        v-if="appointment.meetingLink"
        :href="appointment.meetingLink"
        target="_blank"
        rel="noopener"
        class="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        {{ t('appointments.join') }}
      </a>
      <button
        v-if="canReschedule"
        type="button"
        class="rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:bg-gray-900 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
        @click="showRescheduleModal = true"
      >
        {{ t('appointments.reschedule') }}
      </button>
      <button
        v-if="canCopyGuestLink"
        type="button"
        class="rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:bg-gray-900 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
        :disabled="guestLinkLoading"
        @click="copyGuestManageLink"
      >
        {{ guestLinkCopied ? t('appointments.linkCopied') : guestLinkLoading ? t('states.loading') : t('appointments.copyGuestLink') }}
      </button>
      <button
        v-if="canComplete"
        type="button"
        class="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        @click="$emit('complete')"
      >
        {{ t('appointments.markCompleted') }}
      </button>
      <button
        v-if="canMarkNoShow"
        type="button"
        class="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
        @click="$emit('no-show')"
      >
        {{ t('appointments.markNoShow') }}
      </button>
      <button
        v-if="canCancel"
        type="button"
        class="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300"
        @click="$emit('cancel')"
      >
        {{ t('appointments.cancelAppointment') }}
      </button>
    </div>
    <p v-if="guestLinkError" class="mt-2 text-sm text-red-600 dark:text-red-400">{{ guestLinkError }}</p>

    <AppointmentRescheduleModal
      v-if="eventId"
      v-model:open="showRescheduleModal"
      :event-id="eventId"
      :guest-label="appointment?.bookedByName || appointment?.bookedByEmail || ''"
      @rescheduled="$emit('rescheduled')"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import AppointmentRescheduleModal from '@/components/appointments/AppointmentRescheduleModal.vue';
import apiClient from '@/utils/apiClient';
import { formatUserDateTime } from '@/utils/localeFormat';

const props = defineProps({
  appointment: { type: Object, default: null },
  status: { type: String, default: '' },
  canCancel: { type: Boolean, default: true },
  eventId: { type: String, default: '' }
});

defineEmits(['cancel', 'complete', 'no-show', 'rescheduled']);

const { t } = useI18n();

const SOURCE_KEYS = {
  public_page: 'sourcePublicPage',
  manual: 'sourceManual',
  integration: 'sourceIntegration',
  campaign: 'sourceCampaign'
};
const TYPE_KEYS = {
  demo: 'typeDemo',
  consultation: 'typeConsultation',
  support: 'typeSupport',
  other: 'typeOther'
};

const sourceLabel = computed(() => {
  const source = props.appointment?.bookingSource;
  const key = SOURCE_KEYS[source];
  if (key) return t(`appointments.${key}`);
  return source || t('appointments.sourceUnknown');
});

const typeLabel = computed(() => {
  const type = props.appointment?.appointmentType;
  const key = TYPE_KEYS[type];
  if (key) return t(`appointments.${key}`);
  return type || t('appointments.sourceUnknown');
});

const showRescheduleModal = ref(false);
const guestLinkLoading = ref(false);
const guestLinkCopied = ref(false);
const guestLinkError = ref('');

const isPlanned = computed(() => props.status === 'Planned');
const canComplete = computed(
  () => isPlanned.value && !props.appointment?.noShow
);
const canMarkNoShow = computed(
  () => isPlanned.value && !props.appointment?.noShow
);
const canCancel = computed(
  () => props.canCancel && isPlanned.value && !props.appointment?.noShow
);
const canReschedule = computed(
  () => isPlanned.value && !props.appointment?.noShow && !!props.eventId
);
const canCopyGuestLink = computed(
  () => isPlanned.value && !props.appointment?.noShow && !!props.eventId
);

const formResponseEntries = computed(() => {
  const responses = props.appointment?.formResponses;
  if (!responses || typeof responses !== 'object') return [];
  return Object.entries(responses)
    .filter(([, v]) => v != null && String(v).trim() !== '')
    .map(([key, value]) => ({
      key,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      value: String(value)
    }));
});

function formatMarkedAt(iso) {
  try {
    return formatUserDateTime(iso);
  } catch {
    return '';
  }
}

const publicBookUrl = computed(() => {
  if (!props.appointment?.publicPageSlug) return '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/book/${props.appointment.publicPageSlug}`;
});

async function copyGuestManageLink() {
  if (!props.eventId) return;
  guestLinkError.value = '';
  guestLinkCopied.value = false;
  guestLinkLoading.value = true;
  try {
    const res = await apiClient.get(`/appointments/events/${props.eventId}/guest-link`);
    if (!res.success || !res.data?.manageUrl) {
      guestLinkError.value = res.message || t('appointments.guestLinkLoadFailed');
      return;
    }
    await navigator.clipboard.writeText(res.data.manageUrl);
    guestLinkCopied.value = true;
    setTimeout(() => {
      guestLinkCopied.value = false;
    }, 2500);
  } catch (e) {
    guestLinkError.value = e?.message || t('appointments.guestLinkCopyFailed');
  } finally {
    guestLinkLoading.value = false;
  }
}
</script>
