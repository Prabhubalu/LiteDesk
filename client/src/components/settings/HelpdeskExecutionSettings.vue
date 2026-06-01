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
        class="sticky top-0 z-10 -mx-1 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white/95 px-1 pb-3 pt-1 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95"
      >
        <nav class="flex min-w-0 flex-1 flex-wrap gap-1">
          <button
            v-for="item in navItems"
            :key="item.id"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            :class="activeSection === item.id
              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'"
            @click="scrollToSection(item.id)"
          >
            <component :is="item.icon" class="h-4 w-4 shrink-0 opacity-70" />
            {{ item.label }}
          </button>
        </nav>

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

      <div
        ref="contentRef"
        class="min-h-0 min-w-0 flex-1 space-y-6 overflow-y-auto overscroll-contain"
        :class="[
          SETTINGS_HEADER_CONTENT_GAP_CLASS,
          hasChanges ? SETTINGS_SAVE_BAR_CONTENT_CLASS : ''
        ]"
      >
          <section :id="SECTION.sla" class="scroll-mt-6">
            <HelpdeskSlaHub
              ref="policiesSectionRef"
              v-model:standard-targets="slaDisplay"
              v-model:business-hours="form.businessHours"
              v-model:enabled-case-types="form.caseTypes.enabled"
              v-model:policies="form.slaPolicies"
              v-model:default-policy-key="form.defaultSlaPolicyKey"
              :priorities="priorities"
              :case-types="caseTypes"
              :channels="channels"
              :case-type-label="caseTypeLabel"
              :priority-label="priorityLabel"
              :notifications="form.notifications"
              :recalculating-slas="recalculatingSlas"
              :recalculate-message="recalculateMessage"
              @recalculate="runSlaRecalculate"
            />
          </section>

          <section :id="SECTION.alerts" class="scroll-mt-6 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
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
          </section>

          <section :id="SECTION.replies" class="scroll-mt-6">
            <HelpdeskCannedResponsesSection
              ref="cannedSectionRef"
              v-model:responses="form.cannedResponses"
            />
          </section>

          <details :id="SECTION.developer" class="scroll-mt-6 rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <summary class="cursor-pointer list-none px-6 py-4 text-sm font-medium text-gray-700 dark:text-gray-300">
              {{ t('settings.helpdeskExecDeveloperTitle') }}
            </summary>
            <div class="space-y-4 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
              <p class="text-sm text-gray-500">{{ t('settings.helpdeskExecAdvancedRulesDesc') }}</p>
              <div>
                <label class="mb-1 block text-xs text-gray-500">{{ t('settings.helpdeskExecEscalationRules') }}</label>
                <textarea v-model="jsonEditors.escalationRules" rows="4" class="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs dark:border-gray-700 dark:bg-gray-900" />
              </div>
              <div>
                <label class="mb-1 block text-xs text-gray-500">{{ t('settings.helpdeskExecChannelRules') }}</label>
                <textarea v-model="jsonEditors.channelRules" rows="4" class="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs dark:border-gray-700 dark:bg-gray-900" />
              </div>
            </div>
          </details>
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
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import {
  BellAlertIcon,
  ChatBubbleLeftRightIcon,
  ChevronDownIcon,
  ClockIcon,
  CodeBracketIcon
} from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import HelpdeskSlaHub from '@/components/settings/helpdesk/HelpdeskSlaHub.vue';
import HelpdeskCannedResponsesSection from '@/components/settings/helpdesk/HelpdeskCannedResponsesSection.vue';
import SettingsSaveBar from '@/components/settings/SettingsSaveBar.vue';
import {
  SETTINGS_HEADER_CONTENT_GAP_CLASS,
  SETTINGS_SAVE_BAR_CONTENT_CLASS
} from '@/components/settings/settingsSaveBar';

const { t } = useI18n();
const router = useRouter();

const SECTION = {
  sla: 'helpdesk-sla',
  alerts: 'helpdesk-alerts',
  replies: 'helpdesk-replies',
  developer: 'helpdesk-developer'
};

const caseTypes = ['Support Ticket', 'Complaint', 'Service Request', 'Warranty Claim', 'Internal Case'];
const priorities = ['Low', 'Medium', 'High', 'Critical'];
const channels = ['Email', 'Live Chat', 'Phone', 'Customer Portal', 'Partner Portal', 'Internal'];

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
  { id: SECTION.sla, label: t('settings.helpdeskExecNavSla'), icon: ClockIcon },
  { id: SECTION.alerts, label: t('settings.helpdeskExecNavAlerts'), icon: BellAlertIcon },
  { id: SECTION.replies, label: t('settings.helpdeskExecNavReplies'), icon: ChatBubbleLeftRightIcon },
  { id: SECTION.developer, label: t('settings.helpdeskExecNavDeveloper'), icon: CodeBracketIcon }
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

function hoursToMinutes(hours) {
  return Math.max(1, Math.round(Number(hours || 0) * 60));
}

function minutesToHours(minutes) {
  return Math.max(1, Math.round(Number(minutes || 0) / 60));
}

const activeSection = ref(SECTION.sla);
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const saveError = ref('');
const saveSuccess = ref(false);
const originalSnapshot = ref('');
const recalculatingSlas = ref(false);
const recalculateMessage = ref('');
const policiesSectionRef = ref(null);
const cannedSectionRef = ref(null);
const contentRef = ref(null);
let sectionObserver = null;

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
  slaPolicies: [],
  cannedResponses: []
});

const slaDisplay = reactive({});
const jsonEditors = ref({ escalationRules: '[]', channelRules: '{}' });

function scrollToSection(id) {
  activeSection.value = id;
  const target = document.getElementById(id);
  const container = contentRef.value;
  if (target && container) {
    const top = target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    container.scrollTo({ top: Math.max(0, top - 8), behavior: 'smooth' });
    return;
  }
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function buildSerializableState() {
  const slaPriorityTargets = {};
  for (const priority of priorities) {
    const row = slaDisplay[priority] || { responseHours: 4, resolutionHours: 48 };
    slaPriorityTargets[priority] = {
      firstResponseMinutes: hoursToMinutes(row.responseHours),
      resolutionMinutes: hoursToMinutes(row.resolutionHours)
    };
  }
  return JSON.stringify({ form: { ...form.value, slaPriorityTargets }, jsonEditors: jsonEditors.value });
}

const hasChanges = computed(() => buildSerializableState() !== originalSnapshot.value);

function syncSlaDisplayFromTargets() {
  for (const priority of priorities) {
    const target = form.value.slaPriorityTargets[priority] || { firstResponseMinutes: 240, resolutionMinutes: 2880 };
    slaDisplay[priority] = {
      responseHours: minutesToHours(target.firstResponseMinutes),
      resolutionHours: minutesToHours(target.resolutionMinutes)
    };
  }
}

function syncSlaTargetsFromDisplay() {
  for (const priority of priorities) {
    const row = slaDisplay[priority] || { responseHours: 4, resolutionHours: 48 };
    form.value.slaPriorityTargets[priority] = {
      firstResponseMinutes: hoursToMinutes(row.responseHours),
      resolutionMinutes: hoursToMinutes(row.resolutionHours)
    };
  }
}

function updateSnapshot() {
  originalSnapshot.value = buildSerializableState();
}

function applySettingsToForm(settings) {
  form.value.caseTypes = settings.caseTypes || { enabled: [...caseTypes] };
  form.value.slaPriorityTargets = settings.slaPriorityTargets || {};
  const bh = settings.businessHours || {};
  form.value.businessHours = { ...form.value.businessHours, ...bh, businessHourSetId: bh.businessHourSetId ? String(bh.businessHourSetId) : null };
  form.value.notifications = settings.notifications || form.value.notifications;
  form.value.defaultSlaPolicyKey = settings.defaultSlaPolicyKey || '';
  form.value.slaPolicies = Array.isArray(settings.slaPolicies)
    ? settings.slaPolicies.map((item) => ({
      key: String(item.key || '').trim(),
      name: String(item.name || '').trim(),
      enabled: item.enabled !== false,
      caseTypes: Array.isArray(item.caseTypes) ? [...item.caseTypes] : [],
      channels: Array.isArray(item.channels) ? [...item.channels] : [],
      priorities: Array.isArray(item.priorities) ? [...item.priorities] : [],
      priorityTargets: item.priorityTargets && typeof item.priorityTargets === 'object'
        ? JSON.parse(JSON.stringify(item.priorityTargets))
        : {}
    }))
    : [];
  form.value.cannedResponses = Array.isArray(settings.cannedResponses) ? settings.cannedResponses.map((item) => ({ ...item })) : [];
  jsonEditors.value = {
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
  syncSlaDisplayFromTargets();
}

async function fetchSettings() {
  loading.value = true;
  error.value = '';
  try {
    const response = await apiClient('/settings/applications/helpdesk/execution-settings', { method: 'GET' });
    if (!response?.success || !response?.settings) throw new Error(t('settings.helpdeskExecInvalidLoadResponse'));
    applySettingsToForm(response.settings);
    ensurePriorityTargets();
    updateSnapshot();
  } catch (err) {
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
  syncSlaTargetsFromDisplay();
  return {
    settings: {
      caseTypes: form.value.caseTypes,
      slaPriorityTargets: form.value.slaPriorityTargets,
      businessHours: form.value.businessHours,
      notifications: form.value.notifications,
      defaultSlaPolicyKey: form.value.defaultSlaPolicyKey || null,
      slaPolicies: form.value.slaPolicies,
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
    scrollToSection(SECTION.replies);
    return;
  }
  if (!form.value.caseTypes.enabled.length) {
    saveError.value = t('settings.helpdeskExecCaseTypesRequired');
    scrollToSection(SECTION.sla);
    return;
  }
  const policyValidationError = policiesSectionRef.value?.validate?.();
  if (policyValidationError) {
    saveError.value = policyValidationError;
    scrollToSection(SECTION.sla);
    return;
  }

  saving.value = true;
  try {
    const payload = buildPayload();
    const response = await apiClient('/settings/applications/helpdesk/execution-settings', { method: 'PUT', body: JSON.stringify(payload) });
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

function setupSectionObserver() {
  sectionObserver?.disconnect();
  sectionObserver = null;
  if (!contentRef.value) return;

  const sectionIds = Object.values(SECTION);
  sectionObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      const nextId = visible[0]?.target?.id;
      if (nextId && sectionIds.includes(nextId)) {
        activeSection.value = nextId;
      }
    },
    {
      root: contentRef.value,
      rootMargin: '-12% 0px -55% 0px',
      threshold: [0.1, 0.35, 0.6]
    }
  );

  sectionIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) sectionObserver.observe(el);
  });
}

watch(loading, (isLoading) => {
  if (!isLoading) nextTick(setupSectionObserver);
});

onMounted(fetchSettings);

onUnmounted(() => {
  sectionObserver?.disconnect();
});
</script>

<style scoped>
details summary::-webkit-details-marker {
  display: none;
}
</style>
