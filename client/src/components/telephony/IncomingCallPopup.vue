<template>
  <div
    v-if="incomingEvent"
    class="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
    role="dialog"
    aria-modal="true"
  >
    <div class="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl dark:bg-gray-900">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
        {{ t('telephony.incomingTitle') }}
      </h2>
      <p class="mt-2 text-sm font-medium text-gray-800 dark:text-gray-100">
        {{ callerName }}
      </p>
      <p v-if="callerCompany" class="text-sm text-gray-500 dark:text-gray-400">
        {{ callerCompany }}
      </p>
      <p class="mt-1 font-mono text-sm text-gray-700 dark:text-gray-300">
        {{ incomingEvent.from || '—' }}
      </p>
      <p v-if="caseLabel" class="mt-1 text-xs text-indigo-600 dark:text-indigo-400">
        {{ caseLabel }}
      </p>

      <div class="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
          @click="onAccept"
        >
          {{ t('telephony.incomingAccept') }}
        </button>
        <button
          type="button"
          class="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          @click="declineIncoming"
        >
          {{ t('telephony.incomingDecline') }}
        </button>
        <button
          v-if="recordPath"
          type="button"
          class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600"
          @click="openRecord"
        >
          {{ t('telephony.incomingOpenRecord') }}
        </button>
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600"
          @click="createContact"
        >
          {{ t('telephony.incomingCreateContact') }}
        </button>
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600"
          @click="createLead"
        >
          {{ t('telephony.incomingCreateLead') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useTelephonySoftphone } from '@/composables/useTelephonySoftphone';

const { t } = useI18n();
const router = useRouter();
const { incomingEvent, acceptIncomingTwilio, declineIncoming } = useTelephonySoftphone();

const display = computed(() => incomingEvent.value?.display || {});

const callerName = computed(() => {
  const d = display.value;
  return (
    d?.name ||
    d?.fullName ||
    d?.personName ||
    incomingEvent.value?.from ||
    t('telephony.incomingUnknownCaller')
  );
});

const callerCompany = computed(() => display.value?.company || display.value?.organizationName || '');

const caseLabel = computed(() => {
  const caseId = display.value?.caseId || display.value?.linkedCaseId;
  return caseId ? t('telephony.incomingCaseLabel', { id: caseId }) : '';
});

const recordPath = computed(() => {
  const d = display.value;
  if (d?.personId || d?.linkedPersonId) return `/people/${d.personId || d.linkedPersonId}`;
  if (d?.organizationId || d?.linkedOrganizationId) {
    return `/organizations/${d.organizationId || d.linkedOrganizationId}`;
  }
  if (d?.caseId || d?.linkedCaseId) return `/helpdesk/cases/${d.caseId || d.linkedCaseId}`;
  return '';
});

function onAccept() {
  acceptIncomingTwilio();
}

function openRecord() {
  if (recordPath.value) router.push(recordPath.value);
}

function createContact() {
  const phone = incomingEvent.value?.from || '';
  router.push({ path: '/people/new', query: phone ? { phone } : {} });
}

function createLead() {
  const phone = incomingEvent.value?.from || '';
  router.push({ path: '/people/new', query: { ...(phone ? { phone } : {}), type: 'lead' } });
}
</script>
