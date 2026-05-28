<template>
  <div class="space-y-6">
    <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
      <div class="flex items-start gap-3">
        <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <h3 class="text-sm font-semibold text-blue-800 dark:text-blue-300">{{ t('settings.helpdeskExecBannerTitle') }}</h3>
          <p class="text-sm text-blue-700 dark:text-blue-400 mt-1">
            {{ t('settings.helpdeskExecBannerBody') }}
          </p>
        </div>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>

    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <p class="text-sm text-red-700 dark:text-red-300">{{ error }}</p>
    </div>

    <form v-else class="space-y-6" @submit.prevent="saveSettings">
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">{{ t('settings.helpdeskExecEnabledCaseTypes') }}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label v-for="type in caseTypes" :key="type" class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              v-model="form.caseTypes.enabled"
              :value="type"
              type="checkbox"
              class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>{{ caseTypeLabel(type) }}</span>
          </label>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">{{ t('settings.helpdeskExecPrioritySlaTargets') }}</h3>
        <div class="space-y-3">
          <div
            v-for="priority in priorities"
            :key="priority"
            class="grid grid-cols-1 md:grid-cols-3 gap-3 items-center"
          >
            <div class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ priorityLabel(priority) }}</div>
            <div>
              <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.helpdeskExecFirstResponse') }}</label>
              <input
                v-model.number="form.slaPriorityTargets[priority].firstResponseMinutes"
                min="1"
                type="number"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.helpdeskExecResolution') }}</label>
              <input
                v-model.number="form.slaPriorityTargets[priority].resolutionMinutes"
                min="1"
                type="number"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('settings.helpdeskExecBusinessHours') }}</h3>
          <button
            type="button"
            class="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
            :disabled="recalculatingSlas"
            @click="runSlaRecalculate"
          >
            {{ recalculatingSlas ? t('settings.helpdeskExecRecalculating') : t('settings.helpdeskExecRecalculateSlas') }}
          </button>
        </div>
        <p v-if="recalculateMessage" class="mb-3 text-sm text-emerald-700 dark:text-emerald-300">{{ recalculateMessage }}</p>
        <HelpdeskSlaScheduleSection v-model:business-hours="form.businessHours" />
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">{{ t('settings.helpdeskExecNotifications') }}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label v-for="(label, key) in notificationLabels" :key="key" class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input v-model="form.notifications[key]" type="checkbox" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            <span>{{ label }}</span>
          </label>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('settings.helpdeskExecAdvancedRules') }}</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ t('settings.helpdeskExecAdvancedRulesDesc') }}
        </p>
        <p class="text-xs text-gray-600 dark:text-gray-400">
          {{ t('settings.helpdeskExecAssignmentIntro') }}
          <button
            type="button"
            class="text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
            @click="goAssignmentRulesHub"
          >
            {{ t('settings.helpdeskExecAssignmentLink') }}
          </button>{{ t('settings.helpdeskExecAssignmentOutro') }}
        </p>
        <div class="grid grid-cols-1 gap-4">
          <div>
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.helpdeskExecSlaPolicies') }}</label>
            <textarea v-model="jsonEditors.slaPolicies" rows="6" class="w-full px-3 py-2 font-mono text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"></textarea>
          </div>
          <div>
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.helpdeskExecEscalationRules') }}</label>
            <textarea v-model="jsonEditors.escalationRules" rows="6" class="w-full px-3 py-2 font-mono text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"></textarea>
          </div>
          <div>
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.helpdeskExecChannelRules') }}</label>
            <p class="text-xs text-amber-800 dark:text-amber-200 mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900 dark:bg-amber-950/30">
              {{ t('settings.helpdeskExecChannelRulesMailroomNote') }}
            </p>
            <textarea v-model="jsonEditors.channelRules" rows="6" class="w-full px-3 py-2 font-mono text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"></textarea>
          </div>
          <div>
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.helpdeskExecDefaultSlaPolicyKey') }}</label>
            <input
              v-model.trim="form.defaultSlaPolicyKey"
              type="text"
              :placeholder="t('settings.helpdeskExecDefaultSlaPolicyPh')"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ t('settings.helpdeskExecCannedResponsesTitle') }}
          </h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {{ t('settings.helpdeskExecCannedResponsesHint') }}
          </p>
        </div>
        <div
          v-for="(item, idx) in form.cannedResponses"
          :key="item.id || `canned-${idx}`"
          class="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3"
        >
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div class="grid flex-1 grid-cols-1 md:grid-cols-2 gap-3 min-w-0">
              <div>
                <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.helpdeskExecCannedName') }}</label>
                <input
                  v-model.trim="item.name"
                  type="text"
                  class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.helpdeskExecCannedChannel') }}</label>
                <select
                  v-model="item.channel"
                  class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="email">{{ t('settings.helpdeskExecCannedChannelEmail') }}</option>
                  <option value="internal">{{ t('settings.helpdeskExecCannedChannelInternal') }}</option>
                  <option value="all">{{ t('settings.helpdeskExecCannedChannelAll') }}</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              class="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
              @click="removeCannedResponse(idx)"
            >
              {{ t('actions.remove') }}
            </button>
          </div>
          <div>
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.helpdeskExecCannedSubject') }}</label>
            <input
              v-model="item.subject"
              type="text"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono"
            />
          </div>
          <div>
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.helpdeskExecCannedBody') }}</label>
            <textarea
              v-model="item.body"
              rows="4"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono"
            />
          </div>
        </div>
        <button
          type="button"
          class="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
          @click="addCannedResponse"
        >
          {{ t('settings.helpdeskExecCannedAdd') }}
        </button>
      </div>

      <div v-if="saveError" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p class="text-sm text-red-700 dark:text-red-300">{{ saveError }}</p>
      </div>
      <div v-if="saveSuccess" class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <p class="text-sm text-green-700 dark:text-green-300">{{ t('settings.helpdeskExecSaveSuccess') }}</p>
      </div>

      <div class="flex justify-end gap-3">
        <button
          type="button"
          :disabled="saving"
          class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          @click="resetForm"
        >
          {{ t('settings.helpdeskExecReset') }}
        </button>
        <button
          type="submit"
          :disabled="saving || !hasChanges"
          class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
        >
          {{ saving ? t('settings.helpdeskExecSaving') : t('settings.helpdeskExecSaveChanges') }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import HelpdeskSlaScheduleSection from '@/components/settings/HelpdeskSlaScheduleSection.vue';

const { t } = useI18n();
const router = useRouter();

/** API enum values (English) — form payloads use these keys unchanged. */
const caseTypes = ['Support Ticket', 'Complaint', 'Service Request', 'Warranty Claim', 'Internal Case'];
const priorities = ['Low', 'Medium', 'High', 'Critical'];

const CASE_TYPE_LABEL_KEYS = {
  'Support Ticket': 'settings.helpdeskExecCaseTypeSupportTicket',
  Complaint: 'settings.helpdeskExecCaseTypeComplaint',
  'Service Request': 'settings.helpdeskExecCaseTypeServiceRequest',
  'Warranty Claim': 'settings.helpdeskExecCaseTypeWarrantyClaim',
  'Internal Case': 'settings.helpdeskExecCaseTypeInternalCase'
};

const PRIORITY_LABEL_KEYS = {
  Low: 'settings.helpdeskExecPriorityLow',
  Medium: 'settings.helpdeskExecPriorityMedium',
  High: 'settings.helpdeskExecPriorityHigh',
  Critical: 'settings.helpdeskExecPriorityCritical'
};

function caseTypeLabel(type) {
  const key = CASE_TYPE_LABEL_KEYS[type];
  return key ? t(key) : type;
}

function priorityLabel(priority) {
  const key = PRIORITY_LABEL_KEYS[priority];
  return key ? t(key) : priority;
}

function goAssignmentRulesHub() {
  router.push({
    path: '/settings',
    query: { tab: 'automation', automationView: 'assignment-rules', assignmentApp: 'HELPDESK', assignmentModule: 'cases' }
  });
}

const loading = ref(true);
const saving = ref(false);
const error = ref('');
const saveError = ref('');
const saveSuccess = ref(false);
const originalSnapshot = ref('');

const recalculatingSlas = ref(false);
const recalculateMessage = ref('');

const notificationLabels = computed(() => ({
  notifyOnCreated: t('settings.helpdeskExecNotifyOnCreated'),
  notifyOnAssigned: t('settings.helpdeskExecNotifyOnAssigned'),
  notifyOnSlaWarning: t('settings.helpdeskExecNotifyOnSlaWarning'),
  notifyOnSlaBreach: t('settings.helpdeskExecNotifyOnSlaBreach')
}));

const form = ref({
  caseTypes: { enabled: [...caseTypes] },
  slaPriorityTargets: {},
  businessHours: {
    enabled: false,
    scheduleSource: 'legacy',
    businessHourSetId: null,
    timezone: 'UTC',
    workingDays: [1, 2, 3, 4, 5],
    startTime: '09:00',
    endTime: '18:00'
  },
  notifications: {
    notifyOnCreated: true,
    notifyOnAssigned: true,
    notifyOnSlaWarning: true,
    notifyOnSlaBreach: true
  },
  defaultSlaPolicyKey: '',
  cannedResponses: []
});

const jsonEditors = ref({
  slaPolicies: '[]',
  escalationRules: '[]',
  channelRules: '{}'
});

const hasChanges = computed(() => {
  const current = JSON.stringify({
    form: form.value,
    jsonEditors: jsonEditors.value
  });
  return current !== originalSnapshot.value;
});

function updateSnapshot() {
  originalSnapshot.value = JSON.stringify({
    form: form.value,
    jsonEditors: jsonEditors.value
  });
}

function applySettingsToForm(settings) {
  form.value.caseTypes = settings.caseTypes || { enabled: [...caseTypes] };
  form.value.slaPriorityTargets = settings.slaPriorityTargets || {};
  const bh = settings.businessHours || {};
  form.value.businessHours = {
    ...form.value.businessHours,
    ...bh,
    scheduleSource: bh.scheduleSource || (bh.enabled ? 'legacy' : 'legacy'),
    businessHourSetId: bh.businessHourSetId ? String(bh.businessHourSetId) : null
  };
  form.value.notifications = settings.notifications || form.value.notifications;
  form.value.defaultSlaPolicyKey = settings.defaultSlaPolicyKey || '';
  form.value.cannedResponses = Array.isArray(settings.cannedResponses)
    ? settings.cannedResponses.map((item) => ({ ...item }))
    : [];
  jsonEditors.value = {
    slaPolicies: JSON.stringify(settings.slaPolicies || [], null, 2),
    escalationRules: JSON.stringify(settings.escalationRules || [], null, 2),
    channelRules: JSON.stringify(settings.channelRules || {}, null, 2)
  };
}

function ensurePriorityTargets() {
  for (const priority of priorities) {
    if (!form.value.slaPriorityTargets[priority]) {
      form.value.slaPriorityTargets[priority] = { firstResponseMinutes: 240, resolutionMinutes: 2880 };
    }
  }
}

async function fetchSettings() {
  loading.value = true;
  error.value = '';
  try {
    const response = await apiClient('/settings/applications/helpdesk/execution-settings', { method: 'GET' });
    if (!response?.success || !response?.settings) {
      throw new Error(t('settings.helpdeskExecInvalidLoadResponse'));
    }
    applySettingsToForm(response.settings);
    ensurePriorityTargets();
    updateSnapshot();
  } catch (err) {
    console.error('Failed to load helpdesk execution settings:', err);
    error.value = err?.message || t('settings.helpdeskExecLoadFailed');
  } finally {
    loading.value = false;
  }
}

function parseJsonEditor(value, label) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(t('settings.helpdeskExecInvalidJson', { label }));
  }
}

function buildPayload() {
  return {
    settings: {
      caseTypes: form.value.caseTypes,
      slaPriorityTargets: form.value.slaPriorityTargets,
      businessHours: form.value.businessHours,
      notifications: form.value.notifications,
      defaultSlaPolicyKey: form.value.defaultSlaPolicyKey || null,
      slaPolicies: parseJsonEditor(jsonEditors.value.slaPolicies, t('settings.helpdeskExecSlaPolicies')),
      escalationRules: parseJsonEditor(jsonEditors.value.escalationRules, t('settings.helpdeskExecEscalationRules')),
      channelRules: parseJsonEditor(jsonEditors.value.channelRules, t('settings.helpdeskExecChannelRules')),
      cannedResponses: (form.value.cannedResponses || []).map((item, idx) => ({
        id: String(item.id || `macro-${idx + 1}`).trim(),
        name: String(item.name || '').trim(),
        channel: String(item.channel || 'email').trim(),
        subject: String(item.subject || '').trim(),
        body: String(item.body || '').trim()
      }))
    }
  };
}

function addCannedResponse() {
  if (!Array.isArray(form.value.cannedResponses)) form.value.cannedResponses = [];
  form.value.cannedResponses.push({
    id: `macro-${Date.now()}`,
    name: '',
    channel: 'email',
    subject: 'Re: {{case.title}}',
    body: '<p>Hi {{contact.firstName}},</p><p></p><p>Best regards,<br/>{{agent.name}}</p>'
  });
}

function removeCannedResponse(index) {
  form.value.cannedResponses.splice(index, 1);
}

async function runSlaRecalculate() {
  recalculateMessage.value = '';
  recalculatingSlas.value = true;
  try {
    const response = await apiClient('/settings/applications/helpdesk/recalculate-slas', {
      method: 'POST',
      body: JSON.stringify({ limit: 500 })
    });
    if (!response?.success) {
      throw new Error(response?.message || t('settings.helpdeskExecRecalcFailed'));
    }
    const { updated, scanned } = response.data || {};
    recalculateMessage.value = t('settings.helpdeskExecRecalcResult', {
      updated: updated ?? 0,
      scanned: scanned ?? 0
    });
  } catch (err) {
    saveError.value = err?.message || t('settings.helpdeskExecRecalcSlasFailed');
  } finally {
    recalculatingSlas.value = false;
  }
}

async function saveSettings() {
  saveError.value = '';
  saveSuccess.value = false;

  const incompleteMacro = (form.value.cannedResponses || []).find(
    (item) => !String(item.name || '').trim() || !String(item.body || '').trim()
  );
  if (incompleteMacro) {
    saveError.value = t('settings.helpdeskExecCannedIncomplete');
    return;
  }

  saving.value = true;
  try {
    const prev = originalSnapshot.value ? JSON.parse(originalSnapshot.value) : null;
    const oldBusinessHours = prev?.form?.businessHours;
    const payload = buildPayload();
    const response = await apiClient('/settings/applications/helpdesk/execution-settings', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    if (!response?.success || !response?.settings) {
      throw new Error(t('settings.helpdeskExecUnexpectedSaveResponse'));
    }
    const businessHoursChanged = JSON.stringify(oldBusinessHours) !== JSON.stringify(payload.settings.businessHours);
    applySettingsToForm(response.settings);
    ensurePriorityTargets();
    updateSnapshot();
    saveSuccess.value = true;
    if (businessHoursChanged && payload.settings.businessHours?.enabled) {
      recalculateMessage.value = t('settings.helpdeskExecScheduleSavedRecalcHint');
    }
  } catch (err) {
    console.error('Failed to save helpdesk execution settings:', err);
    saveError.value = err?.message || t('settings.helpdeskExecSaveFailed');
  } finally {
    saving.value = false;
  }
}

function resetForm() {
  fetchSettings();
}

onMounted(() => {
  fetchSettings();
});
</script>
