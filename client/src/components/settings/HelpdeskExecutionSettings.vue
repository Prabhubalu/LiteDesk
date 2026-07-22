<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div v-if="loading" class="flex justify-center py-16">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
    </div>

    <div v-else-if="error" class="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
      <p class="text-sm text-red-700 dark:text-red-300">{{ error }}</p>
    </div>

    <form v-else class="flex min-h-0 flex-1 flex-col overflow-hidden" @submit.prevent="saveSettings">
      <div
        class="sticky top-0 z-10 -mx-1 flex shrink-0 flex-col gap-2 border-b border-gray-200 bg-white/95 px-1 pb-3 pt-1 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex min-w-0 items-start gap-3">
            <button
              type="button"
              class="mt-0.5 text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              :title="t('settings.assignRulesBackTitle')"
              @click="goBackToAutomation"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div class="min-w-0">
              <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ t('settings.slaPageTitle') }}</h2>
              <p class="mt-0.5 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.slaPageSubtitle') }}</p>
            </div>
          </div>

          <Menu as="div" class="relative shrink-0">
            <MenuButton
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {{ t('settings.helpdeskExecRelatedTitle') }}
              <ChevronDownIcon class="h-4 w-4 opacity-60" />
            </MenuButton>
            <transition
              enter-active-class="transition duration-100 ease-out"
              enter-from-class="transform scale-95 opacity-0"
              enter-to-class="transform scale-100 opacity-100"
              leave-active-class="transition duration-75 ease-in"
              leave-from-class="transform scale-100 opacity-100"
              leave-to-class="transform scale-95 opacity-0"
            >
              <MenuItems
                class="absolute right-0 z-20 mt-1 w-56 origin-top-right rounded-xl border border-gray-200 bg-white py-1 shadow-lg focus:outline-none dark:border-gray-700 dark:bg-gray-900"
              >
                <MenuItem v-slot="{ active }">
                  <button
                    type="button"
                    :class="['block w-full px-3 py-2 text-left text-sm', active ? 'bg-gray-100 dark:bg-gray-800' : 'text-gray-700 dark:text-gray-300']"
                    @click="goAssignmentRulesHub"
                  >
                    {{ t('settings.helpdeskExecLinkAssignment') }}
                  </button>
                </MenuItem>
                <MenuItem v-slot="{ active }">
                  <RouterLink
                    :to="{ path: '/settings', query: { tab: 'business-hours' } }"
                    :class="['block px-3 py-2 text-sm', active ? 'bg-gray-100 dark:bg-gray-800' : 'text-gray-700 dark:text-gray-300']"
                  >
                    {{ t('settings.helpdeskExecLinkBusinessHours') }}
                  </RouterLink>
                </MenuItem>
                <MenuItem v-slot="{ active }">
                  <RouterLink
                    :to="{ path: '/settings', query: { tab: 'automation', automationView: 'mailroom' } }"
                    :class="['block px-3 py-2 text-sm', active ? 'bg-gray-100 dark:bg-gray-800' : 'text-gray-700 dark:text-gray-300']"
                  >
                    {{ t('settings.helpdeskExecLinkMailroom') }}
                  </RouterLink>
                </MenuItem>
              </MenuItems>
            </transition>
          </Menu>
        </div>

        <nav class="flex gap-6 border-t border-gray-100 px-1 dark:border-gray-800">
          <button
            v-for="item in navItems"
            :key="item.id"
            type="button"
            class="-mb-px border-b-2 px-1 py-2.5 text-sm font-medium transition-colors"
            :class="activeTab === item.id
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'"
            @click="activeTab = item.id"
          >
            {{ item.label }}
          </button>
        </nav>
      </div>

      <div
        class="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain"
        :class="[
          SETTINGS_HEADER_CONTENT_GAP_CLASS,
          hasChanges ? SETTINGS_SAVE_BAR_CONTENT_CLASS : ''
        ]"
      >
          <div v-show="activeTab === TAB.sla">
            <div class="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
              {{ t('settings.slaHelpdeskCasesOnlyHint') }}
            </div>
            <SlaPolicyHub embedded :fixed-module-key="'cases'" />
          </div>

          <div v-show="activeTab === TAB.alerts" class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.helpdeskExecNotifications') }}</h3>
            <p class="mt-1 mb-4 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.helpdeskExecCaseNotificationsHint') }}</p>
            <div class="divide-y divide-gray-100 dark:divide-gray-800">
              <label
                v-for="(meta, key) in notificationItems"
                :key="key"
                class="flex cursor-pointer items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <span>
                  <span class="block text-sm font-medium text-gray-900 dark:text-white">{{ meta.title }}</span>
                  <span class="block text-xs text-gray-500 dark:text-gray-400">{{ meta.description }}</span>
                </span>
                <span class="relative inline-flex h-6 w-11 shrink-0">
                  <input v-model="form.notifications[key]" type="checkbox" class="peer sr-only" />
                  <span class="h-6 w-11 rounded-full bg-gray-200 transition peer-checked:bg-indigo-600 dark:bg-gray-700" />
                  <span class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                </span>
              </label>
            </div>
          </div>

          <div v-show="activeTab === TAB.replies">
            <HelpdeskCannedResponsesSection
              ref="cannedSectionRef"
              v-model:responses="form.cannedResponses"
            />
          </div>
      </div>

      <div v-if="saveError" class="mt-4 shrink-0 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
        <p class="text-sm text-red-700 dark:text-red-300">{{ saveError }}</p>
      </div>
      <div v-if="saveSuccess" class="mt-4 shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
        <p class="text-sm text-emerald-700 dark:text-emerald-300">{{ t('settings.helpdeskExecSaveSuccess') }}</p>
      </div>

      <SettingsSaveBar
        :visible="hasChanges"
        :saving="saving"
        :reset-label="t('settings.helpdeskExecReset')"
        :save-label="t('settings.helpdeskExecSaveChanges')"
        :saving-label="t('settings.helpdeskExecSaving')"
        @reset="resetForm"
        @save="saveSettings"
      />
    </form>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import { ChevronDownIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { CASE_TYPES } from '@/constants/caseLifecycle';
import { resolveExecutionMetadata } from '@/constants/helpdeskSlaPolicy';
import SlaPolicyHub from '@/components/settings/sla/SlaPolicyHub.vue';
import HelpdeskCannedResponsesSection from '@/components/settings/helpdesk/HelpdeskCannedResponsesSection.vue';
import SettingsSaveBar from '@/components/settings/SettingsSaveBar.vue';
import {
  SETTINGS_HEADER_CONTENT_GAP_CLASS,
  SETTINGS_SAVE_BAR_CONTENT_CLASS
} from '@/components/settings/settingsSaveBar';

const { t } = useI18n();
const router = useRouter();

const TAB = {
  sla: 'sla',
  alerts: 'alerts',
  replies: 'replies'
};

const executionMetadata = ref(resolveExecutionMetadata(null));
const priorities = computed(() => executionMetadata.value.priorities);
const caseTypes = computed(() => executionMetadata.value.caseTypes);
const channels = computed(() => executionMetadata.value.channels);
const slaPolicyOptions = computed(() => executionMetadata.value.slaPolicy);

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

const navItems = computed(() => [
  { id: TAB.sla, label: t('settings.slaPageTitle') },
  { id: TAB.alerts, label: t('settings.slaNavCaseNotifications') },
  { id: TAB.replies, label: t('settings.helpdeskExecNavReplies') }
]);

const notificationItems = computed(() => ({
  notifyOnCreated: {
    title: t('settings.helpdeskExecNotifyOnCreated'),
    description: t('settings.helpdeskExecNotifyOnCreatedDesc')
  },
  notifyOnAssigned: {
    title: t('settings.helpdeskExecNotifyOnAssigned'),
    description: t('settings.helpdeskExecNotifyOnAssignedDesc')
  }
}));

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

function goBackToAutomation() {
  router.push({ path: '/settings', query: { tab: 'automation' } });
}

function hoursToMinutes(hours) {
  return Math.max(1, Math.round(Number(hours || 0) * 60));
}

function minutesToHours(minutes) {
  return Math.max(1, Math.round(Number(minutes || 0) / 60));
}

const activeTab = ref(TAB.sla);
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const saveError = ref('');
const saveSuccess = ref(false);
const originalSnapshot = ref('');
const recalculatingSlas = ref(false);
const recalculateMessage = ref('');
const cannedSectionRef = ref(null);

const form = ref({
  caseTypes: { enabled: [...CASE_TYPES] },
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
  slaPolicies: [],
  cannedResponses: []
});

const preservedRules = ref({ escalationRules: [], channelRules: {} });

function buildSerializableState() {
  const slaPriorityTargets = { ...form.value.slaPriorityTargets };
  return JSON.stringify({ form: { ...form.value, slaPriorityTargets }, preservedRules: preservedRules.value });
}

const hasChanges = computed(() => buildSerializableState() !== originalSnapshot.value);

function updateSnapshot() {
  originalSnapshot.value = buildSerializableState();
}

function applySettingsToForm(settings) {
  form.value.caseTypes = settings.caseTypes || { enabled: [...caseTypes.value] };
  form.value.slaPriorityTargets = settings.slaPriorityTargets || {};
  const bh = settings.businessHours || {};
  form.value.businessHours = { ...form.value.businessHours, ...bh, businessHourSetId: bh.businessHourSetId ? String(bh.businessHourSetId) : null };
  form.value.notifications = settings.notifications || form.value.notifications;
  form.value.defaultSlaPolicyKey = settings.defaultSlaPolicyKey || '';
  form.value.slaPolicies = Array.isArray(settings.slaPolicies)
    ? settings.slaPolicies.map((item) => ({
      key: String(item.key || '').trim(),
      name: String(item.name || '').trim(),
      description: String(item.description || '').trim(),
      enabled: item.enabled !== false,
      caseTypes: Array.isArray(item.caseTypes) ? [...item.caseTypes] : [],
      channels: Array.isArray(item.channels) ? [...item.channels] : [],
      priorities: Array.isArray(item.priorities) ? [...item.priorities] : [],
      priorityTargets: item.priorityTargets && typeof item.priorityTargets === 'object'
        ? JSON.parse(JSON.stringify(item.priorityTargets))
        : {},
      alerts: Array.isArray(item.alerts) ? JSON.parse(JSON.stringify(item.alerts)) : [],
      escalationSteps: Array.isArray(item.escalationSteps) ? JSON.parse(JSON.stringify(item.escalationSteps)) : [],
      escalationCooldownMinutes: item.escalationCooldownMinutes ?? 15,
      priorityHourOverrides: item.priorityHourOverrides && typeof item.priorityHourOverrides === 'object'
        ? { ...item.priorityHourOverrides }
        : {},
      useCalendarTime: Boolean(item.useCalendarTime)
    }))
    : [];
  form.value.cannedResponses = Array.isArray(settings.cannedResponses) ? settings.cannedResponses.map((item) => ({ ...item })) : [];
  preservedRules.value = {
    escalationRules: Array.isArray(settings.escalationRules) ? JSON.parse(JSON.stringify(settings.escalationRules)) : [],
    channelRules: settings.channelRules && typeof settings.channelRules === 'object'
      ? JSON.parse(JSON.stringify(settings.channelRules))
      : {}
  };
}

function ensurePriorityTargets() {
  const source = form.value.slaPriorityTargets;
  const templatePriority = priorities.value.find((p) => source[p]);
  const template = templatePriority ? source[templatePriority] : null;
  for (const priority of priorities.value) {
    if (!source[priority] && template) {
      source[priority] = { ...template };
    }
  }
}

async function fetchSettings() {
  loading.value = true;
  error.value = '';
  try {
    const response = await apiClient('/settings/applications/helpdesk/execution-settings', { method: 'GET' });
    if (!response?.success || !response?.settings) throw new Error(t('settings.helpdeskExecInvalidLoadResponse'));
    executionMetadata.value = resolveExecutionMetadata(response.metadata);
    applySettingsToForm(response.settings);
    ensurePriorityTargets();
    updateSnapshot();
  } catch (err) {
    error.value = err?.message || t('settings.helpdeskExecLoadFailed');
  } finally {
    loading.value = false;
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
      slaPolicies: form.value.slaPolicies,
      escalationRules: preservedRules.value.escalationRules,
      channelRules: preservedRules.value.channelRules,
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

async function runSlaRecalculate() {
  recalculatingSlas.value = true;
  recalculateMessage.value = '';
  try {
    const response = await apiClient('/settings/applications/helpdesk/recalculate-slas', { method: 'POST', body: JSON.stringify({ limit: 500 }) });
    if (!response?.success) throw new Error(response?.message || t('settings.helpdeskExecRecalcFailed'));
    const { updated, scanned } = response.data || {};
    recalculateMessage.value = t('settings.helpdeskExecRecalcResult', { updated: updated ?? 0, scanned: scanned ?? 0 });
  } catch (err) {
    saveError.value = err?.message || t('settings.helpdeskExecRecalcSlasFailed');
  } finally {
    recalculatingSlas.value = false;
  }
}

async function saveSettings() {
  saveError.value = '';
  saveSuccess.value = false;

  const cannedValidationError = cannedSectionRef.value?.validate?.();
  if (cannedValidationError) {
    saveError.value = cannedValidationError;
    activeTab.value = TAB.replies;
    return;
  }
  if (!form.value.caseTypes.enabled.length) {
    saveError.value = t('settings.helpdeskExecCaseTypesRequired');
    return;
  }

  saving.value = true;
  try {
    const { pickDirtyFields } = await import('@/utils/pickDirtyFields');
    const fullSettings = buildPayload().settings;
    const baselineState = originalSnapshot.value ? JSON.parse(originalSnapshot.value) : null;
    const baselineSettings = baselineState
      ? {
          caseTypes: baselineState.form?.caseTypes,
          slaPriorityTargets: baselineState.form?.slaPriorityTargets,
          businessHours: baselineState.form?.businessHours,
          notifications: baselineState.form?.notifications,
          defaultSlaPolicyKey: baselineState.form?.defaultSlaPolicyKey || null,
          slaPolicies: baselineState.form?.slaPolicies,
          escalationRules: baselineState.preservedRules?.escalationRules,
          channelRules: baselineState.preservedRules?.channelRules,
          cannedResponses: baselineState.form?.cannedResponses
        }
      : {};
    const dirtySettings = pickDirtyFields(fullSettings, baselineSettings);
    if (Object.keys(dirtySettings).length === 0) {
      saving.value = false;
      return;
    }

    const response = await apiClient('/settings/applications/helpdesk/execution-settings', {
      method: 'PUT',
      body: JSON.stringify({ settings: dirtySettings })
    });
    if (!response?.success || !response?.settings) throw new Error(t('settings.helpdeskExecUnexpectedSaveResponse'));
    applySettingsToForm(response.settings);
    ensurePriorityTargets();
    updateSnapshot();
    saveSuccess.value = true;
  } catch (err) {
    saveError.value = err?.message || t('settings.helpdeskExecSaveFailed');
  } finally {
    saving.value = false;
  }
}

function resetForm() {
  fetchSettings();
}

onMounted(fetchSettings);
</script>
