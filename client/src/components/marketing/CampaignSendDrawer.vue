<template>
  <WorkspaceScopedDrawerShell
    :is-open="isOpen"
    panel-offset-class="pl-10"
    draft-module-key="campaigns"
    :draft-record-id="campaignId || ''"
    @backdrop="emit('close')"
    @escape="emit('close')"
  >
              <div class="rounded-tl-xl overflow-hidden pointer-events-auto flex h-full w-screen max-w-lg flex-col bg-white shadow-xl dark:bg-gray-900">
                <div class="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                  <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                    {{ t('marketing.campaignsSendDrawerTitle') }}
                  </h2>
                  <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {{ drawerDescription }}
                  </p>
                </div>

                <div class="flex-1 overflow-y-auto px-6 py-4">
                  <div class="mb-4 flex gap-2">
                    <button
                      type="button"
                      class="rounded-full px-3 py-1 text-sm font-medium transition-colors"
                      :class="deliveryTiming === 'now'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'"
                      @click="deliveryTiming = 'now'"
                    >
                      {{ t('marketing.campaignsSendTimingNow') }}
                    </button>
                    <button
                      type="button"
                      class="rounded-full px-3 py-1 text-sm font-medium transition-colors"
                      :class="deliveryTiming === 'schedule'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'"
                      @click="deliveryTiming = 'schedule'"
                    >
                      {{ t('marketing.campaignsSendTimingSchedule') }}
                    </button>
                  </div>

                  <div
                    v-if="deliveryTiming === 'schedule'"
                    class="mb-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
                  >
                    <div>
                      <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {{ t('marketing.campaignsSendScheduleAtLabel') }}
                      </label>
                      <input
                        v-model="scheduledAtLocal"
                        type="datetime-local"
                        :min="minScheduleValue"
                        class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                      />
                    </div>
                    <div>
                      <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {{ t('marketing.campaignsSendTimezoneLabel') }}
                      </label>
                      <select
                        v-model="timezone"
                        class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                      >
                        <option v-for="tz in timezoneOptions" :key="tz" :value="tz">{{ tz }}</option>
                      </select>
                    </div>
                    <label class="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input v-model="quietHoursEnabled" type="checkbox" class="mt-0.5 rounded border-gray-300" />
                      <span>
                        <span class="font-medium">{{ t('marketing.campaignsSendQuietHoursLabel') }}</span>
                        <span class="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                          {{ t('marketing.campaignsSendQuietHoursHelp') }}
                        </span>
                      </span>
                    </label>
                  </div>

                  <section v-if="precheckLoading || precheck" class="mb-4">
                    <h3 class="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                      {{ t('marketing.campaignsPrecheckTitle') }}
                    </h3>
                    <div
                      v-if="precheck?.credits?.maxSendableRecipients != null"
                      class="mb-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm dark:border-indigo-900/40 dark:bg-indigo-950/20"
                    >
                      <p class="font-medium text-indigo-900 dark:text-indigo-100">
                        {{
                          t('marketing.campaignsSendCapacitySummary', {
                            count: Number(precheck.credits.maxSendableRecipients).toLocaleString()
                          })
                        }}
                      </p>
                      <p
                        v-if="effectiveRecipientCount > precheck.credits.maxSendableRecipients"
                        class="mt-1 text-red-700 dark:text-red-300"
                      >
                        {{
                          t('marketing.campaignsSendCapacityExceeded', {
                            selected: effectiveRecipientCount.toLocaleString(),
                            max: Number(precheck.credits.maxSendableRecipients).toLocaleString()
                          })
                        }}
                      </p>
                    </div>
                    <div
                      v-if="precheck?.credits?.recipientCount > 0"
                      class="mb-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800/50"
                    >
                      <p class="text-gray-700 dark:text-gray-200">
                        {{ t('marketing.campaignsCreditSummaryRecipients', { count: precheck.credits.recipientCount.toLocaleString() }) }}
                      </p>
                      <p class="text-gray-700 dark:text-gray-200">
                        {{ t('marketing.campaignsCreditSummaryNeeded', { count: precheck.credits.creditsNeeded.toLocaleString() }) }}
                      </p>
                      <p class="text-gray-700 dark:text-gray-200">
                        {{ t('marketing.campaignsCreditSummaryRemaining', { count: precheck.credits.creditsRemaining.toLocaleString() }) }}
                      </p>
                    </div>
                    <p
                      v-if="showInfraLoadBanner"
                      class="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100"
                    >
                      {{ t('marketing.campaignsInfraLoadBanner') }}
                    </p>
                    <div
                      v-if="throughputSummaryLines.length"
                      class="mb-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800/50"
                    >
                      <p
                        v-for="line in throughputSummaryLines"
                        :key="line.key"
                        class="text-gray-700 dark:text-gray-200"
                      >
                        {{ line.text }}
                      </p>
                    </div>
                    <div v-if="precheckLoading" class="text-sm text-gray-500">
                      {{ t('states.loading') }}
                    </div>
                    <ul v-else class="space-y-2">
                      <li
                        v-for="check in precheck?.checks || []"
                        :key="check.key"
                        class="flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
                        :class="precheckClass(check.status)"
                      >
                        <span class="mt-0.5 h-2 w-2 shrink-0 rounded-full" :class="precheckDotClass(check.status)" />
                        <span>{{ check.message }}</span>
                      </li>
                    </ul>
                  </section>

                  <div v-if="hasAudience" class="mb-4 flex gap-2">
                    <button
                      type="button"
                      class="rounded-full px-3 py-1 text-sm font-medium transition-colors"
                      :class="sendMode === 'audience'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'"
                      @click="sendMode = 'audience'"
                    >
                      {{ t('marketing.campaignsSendModeAudience') }}
                    </button>
                    <button
                      type="button"
                      class="rounded-full px-3 py-1 text-sm font-medium transition-colors"
                      :class="sendMode === 'manual'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'"
                      @click="sendMode = 'manual'"
                    >
                      {{ t('marketing.campaignsSendModeManual') }}
                    </button>
                  </div>

                  <div
                    v-if="sendMode === 'audience' && hasAudience"
                    class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
                  >
                    <p class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ audienceName }}
                    </p>
                    <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {{ t('marketing.campaignsSendAudienceCount', { count: audienceMemberCount }) }}
                    </p>
                  </div>

                  <template v-else>
                    <input
                      v-model="searchQuery"
                      type="search"
                      :placeholder="t('marketing.campaignsSendSearchPlaceholder')"
                      class="mb-4 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                      @input="debounceContactSearch"
                    />

                    <p class="mb-3 text-sm text-gray-600 dark:text-gray-400">
                      {{ t('marketing.campaignsSendSelectedCount', { count: selectedIds.size }) }}
                    </p>

                    <div v-if="loading" class="py-8 text-center text-sm text-gray-500">
                      {{ t('states.loading') }}
                    </div>

                    <ul v-else class="divide-y divide-gray-200 dark:divide-gray-700">
                      <li
                        v-for="person in contacts"
                        :key="person._id"
                        class="flex items-start gap-3 py-3"
                      >
                        <input
                          :checked="selectedIds.has(String(person._id))"
                          type="checkbox"
                          class="mt-1 rounded border-gray-300"
                          :disabled="!contactEmail(person)"
                          @change="toggleContact(person._id, $event.target.checked)"
                        />
                        <div class="min-w-0 flex-1">
                          <p class="truncate text-sm font-medium text-gray-900 dark:text-white">
                            {{ contactLabel(person) }}
                          </p>
                          <p class="truncate text-xs text-gray-500 dark:text-gray-400">
                            {{ contactEmail(person) || t('marketing.campaignsSendNoEmail') }}
                          </p>
                        </div>
                      </li>
                    </ul>
                  </template>
                </div>

                <div class="space-y-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
                  <button
                    type="button"
                    class="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200"
                    @click="showTestModal = true"
                  >
                    {{ t('marketing.campaignsTestSendAction') }}
                  </button>
                  <div class="flex gap-3">
                    <button
                      type="button"
                      class="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                      :disabled="actionDisabled"
                      @click="confirmAction"
                    >
                      {{ sending ? t('states.saving') : primaryActionLabel }}
                    </button>
                    <button
                      type="button"
                      class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200"
                      @click="emit('close')"
                    >
                      {{ t('actions.cancel') }}
                    </button>
                  </div>
                </div>
              </div>

  </WorkspaceScopedDrawerShell>

  <CampaignTestSendModal
    :is-open="showTestModal"
    :sending="testing"
    @close="showTestModal = false"
    @submit="handleTestSubmit"
  />
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import CampaignTestSendModal from '@/components/marketing/CampaignTestSendModal.vue';
import WorkspaceScopedDrawerShell from '@/components/common/WorkspaceScopedDrawerShell.vue';

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  sending: { type: Boolean, default: false },
  testing: { type: Boolean, default: false },
  campaignId: { type: String, default: '' },
  audienceId: { type: String, default: '' },
  audienceName: { type: String, default: '' },
  audienceMemberCount: { type: Number, default: 0 },
  precheck: { type: Object, default: null },
  precheckLoading: { type: Boolean, default: false },
  initialDeliveryTiming: { type: String, default: 'now' }
});

const emit = defineEmits(['close', 'send', 'schedule', 'test-send', 'precheck-request']);

const { t } = useI18n();
const notifications = useNotifications();

const searchQuery = ref('');
const loading = ref(false);
const contacts = ref([]);
const selectedIds = ref(new Set());
const sendMode = ref('manual');
const deliveryTiming = ref('now');
const scheduledAtLocal = ref('');
const timezone = ref(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
const quietHoursEnabled = ref(false);
const showTestModal = ref(false);
let searchTimer = null;

const timezoneOptions = computed(() => {
  const current = timezone.value || 'UTC';
  if (typeof Intl.supportedValuesOf === 'function') {
    const values = Intl.supportedValuesOf('timeZone');
    return values.includes(current) ? values : [current, ...values];
  }
  return [current, 'UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London'];
});

const hasAudience = computed(() => Boolean(props.audienceId) && props.audienceMemberCount > 0);

const drawerDescription = computed(() =>
  hasAudience.value
    ? t('marketing.campaignsSendDrawerDescriptionAudience')
    : t('marketing.campaignsSendDrawerDescription')
);

const minScheduleValue = computed(() => toDatetimeLocalValue(new Date()));

const primaryActionLabel = computed(() =>
  deliveryTiming.value === 'schedule'
    ? t('marketing.campaignsSendScheduleConfirm')
    : t('marketing.campaignsSendConfirm')
);

const recipientsSelected = computed(() => {
  if (sendMode.value === 'audience' && hasAudience.value) return true;
  return selectedIds.value.size > 0;
});

const effectiveRecipientCount = computed(() => {
  if (sendMode.value === 'audience' && hasAudience.value) {
    return Math.max(0, Number(props.audienceMemberCount) || 0);
  }
  return selectedIds.value.size;
});

const actionDisabled = computed(() => {
  if (props.sending) return true;
  if (!recipientsSelected.value) return true;
  if (deliveryTiming.value === 'schedule' && !scheduledAtLocal.value) return true;
  if (props.precheck && props.precheck.ready === false) return true;
  return false;
});

const showInfraLoadBanner = computed(() => {
  const multiplier = Number(props.precheck?.throughput?.infraMultiplier);
  return Number.isFinite(multiplier) && multiplier > 0 && multiplier < 1;
});

const throughputSummaryLines = computed(() => {
  const throughput = props.precheck?.throughput;
  if (!throughput) return [];

  /** @type {{ key: string, text: string }[]} */
  const lines = [];

  if (throughput.senderReputation != null) {
    lines.push({
      key: 'reputation',
      text: t('marketing.campaignsThroughputReputation', {
        score: Number(throughput.senderReputation).toLocaleString()
      })
    });
  }

  if (throughput.maxHourlyRate != null && throughput.maxHourlyRate > 0) {
    lines.push({
      key: 'maxHourly',
      text: t('marketing.campaignsThroughputMaxHourly', {
        rate: Number(throughput.maxHourlyRate).toLocaleString()
      })
    });
  }

  if (throughput.effectiveHourlyRate != null && throughput.effectiveHourlyRate > 0) {
    lines.push({
      key: 'effectiveHourly',
      text: t('marketing.campaignsThroughputEffectiveHourly', {
        rate: Number(throughput.effectiveHourlyRate).toLocaleString()
      })
    });
  }

  if (throughput.effectiveBurstRate != null && throughput.effectiveBurstRate > 0) {
    lines.push({
      key: 'effectiveBurst',
      text: t('marketing.campaignsThroughputEffectiveBurst', {
        rate: Number(throughput.effectiveBurstRate).toLocaleString()
      })
    });
  }

  const duration = formatEstimateDuration(props.precheck?.estimate?.estimatedSeconds);
  if (duration) {
    lines.push({
      key: 'estimate',
      text: t('marketing.campaignsEstimateCompletion', { duration })
    });
  }

  return lines;
});

function formatEstimateDuration(totalSeconds) {
  const seconds = Number(totalSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0 && minutes > 0) {
    return t('marketing.campaignsEstimateDurationHoursMinutes', { hours, minutes });
  }
  if (hours > 0) {
    return t('marketing.campaignsEstimateDurationHours', { hours });
  }
  return t('marketing.campaignsEstimateDurationMinutes', { minutes: Math.max(1, minutes) });
}

function toDatetimeLocalValue(date) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (value) => String(value).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultScheduleValue() {
  const next = new Date(Date.now() + 60 * 60 * 1000);
  next.setSeconds(0, 0);
  return toDatetimeLocalValue(next);
}

function precheckClass(status) {
  if (status === 'error') {
    return 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200';
  }
  if (status === 'warning') {
    return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100';
  }
  if (status === 'info') {
    return 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-100';
  }
  return 'border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200';
}

function precheckDotClass(status) {
  if (status === 'error') return 'bg-red-500';
  if (status === 'warning') return 'bg-amber-500';
  if (status === 'info') return 'bg-blue-500';
  return 'bg-emerald-500';
}

function contactEmail(contact) {
  const email = (contact.email || contact.work_email || contact.workEmail || '').trim();
  return email && email.includes('@') ? email : '';
}

function contactLabel(contact) {
  const first = contact.firstName || contact.first_name || '';
  const last = contact.lastName || contact.last_name || '';
  const name = [first, last].filter(Boolean).join(' ');
  return name || contact.email || contact._id;
}

function normalizePeopleResponse(response) {
  if (Array.isArray(response)) return response;
  if (response?.success && Array.isArray(response.data)) return response.data;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

async function fetchContacts() {
  loading.value = true;
  try {
    const params = { limit: 50, sortBy: 'firstName', sortOrder: 'asc' };
    const q = searchQuery.value.trim();
    if (q) params.search = q;
    const res = await apiClient.get('/people', { params });
    contacts.value = normalizePeopleResponse(res);
  } catch {
    contacts.value = [];
  } finally {
    loading.value = false;
  }
}

function debounceContactSearch() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(fetchContacts, 300);
}

function toggleContact(id, checked) {
  const key = String(id);
  const next = new Set(selectedIds.value);
  if (checked) next.add(key);
  else next.delete(key);
  selectedIds.value = next;
}

function buildRecipientsPayload() {
  if (sendMode.value === 'audience' && hasAudience.value) {
    return { mode: 'audience', audienceId: props.audienceId };
  }

  const selected = contacts.value.filter((c) => selectedIds.value.has(String(c._id)));
  const recipients = selected
    .map((person) => {
      const email = contactEmail(person);
      if (!email) return null;
      const first = person.firstName || person.first_name || '';
      const last = person.lastName || person.last_name || '';
      const name = [first, last].filter(Boolean).join(' ') || undefined;
      return {
        email,
        name,
        recipientId: String(person._id)
      };
    })
    .filter(Boolean);

  if (recipients.length === 0) {
    notifications.error(t('marketing.campaignsSendNoRecipients'));
    return null;
  }

  return { mode: 'manual', recipients };
}

function confirmAction() {
  const payload = buildRecipientsPayload();
  if (!payload) return;

  if (deliveryTiming.value === 'schedule') {
    const scheduledDate = new Date(scheduledAtLocal.value);
    if (Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
      notifications.error(t('marketing.campaignsSendScheduleInvalid'));
      return;
    }

    emit('schedule', {
      ...payload,
      scheduledAt: scheduledDate.toISOString(),
      timezone: timezone.value,
      quietHours: {
        enabled: quietHoursEnabled.value,
        start: '22:00',
        end: '08:00'
      }
    });
    return;
  }

  emit('send', payload);
}

function handleTestSubmit(payload) {
  emit('test-send', payload);
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      selectedIds.value = new Set();
      searchQuery.value = '';
      sendMode.value = hasAudience.value ? 'audience' : 'manual';
      deliveryTiming.value = props.initialDeliveryTiming === 'schedule' ? 'schedule' : 'now';
      scheduledAtLocal.value = defaultScheduleValue();
      timezone.value = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      quietHoursEnabled.value = false;
      showTestModal.value = false;
      if (sendMode.value === 'manual') fetchContacts();
      if (hasAudience.value) {
        emit('precheck-request', props.audienceMemberCount);
      }
    }
  }
);

watch(effectiveRecipientCount, (count) => {
  if (!props.isOpen) return;
  emit('precheck-request', count);
});

watch(
  () => props.audienceMemberCount,
  (count) => {
    if (!props.isOpen || sendMode.value !== 'audience') return;
    emit('precheck-request', count);
  }
);
</script>
