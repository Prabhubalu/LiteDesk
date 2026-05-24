<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-[95] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="connect-mailbox-title"
      @click.self="close"
    >
      <div
        class="relative flex max-h-[min(92vh,680px)] w-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        :class="modalPanelClass"
        @click.stop
      >
        <!-- Header -->
        <div class="border-b border-gray-100 px-5 py-4 dark:border-gray-800 sm:px-6">
          <div class="flex items-start gap-3">
            <button
              v-if="view !== 'providers'"
              type="button"
              class="mt-0.5 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              :aria-label="t('performance.back')"
              @click="goBack"
            >
              <ArrowLeftIcon class="h-5 w-5" />
            </button>
            <div class="min-w-0 flex-1">
              <h2 id="connect-mailbox-title" class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ headerTitle }}
              </h2>
              <p class="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                {{ headerSubtitle }}
              </p>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              :aria-label="t('settings.roleDrawerCloseSr')"
              @click="close"
            >
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>

          <!-- Step indicator -->
          <div v-if="view !== 'providers'" class="mt-4 flex items-center gap-2">
            <span
              v-for="(label, idx) in stepLabels"
              :key="label"
              class="flex items-center gap-2 text-[11px] font-medium"
            >
              <span
                class="flex h-6 w-6 items-center justify-center rounded-full"
                :class="stepIndex >= idx
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'"
              >{{ idx + 1 }}</span>
              <span
                :class="stepIndex >= idx ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'"
              >{{ label }}</span>
              <span
                v-if="idx < stepLabels.length - 1"
                class="mx-1 h-px w-6 bg-gray-200 dark:bg-gray-700"
                aria-hidden="true"
              />
            </span>
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <!-- Provider picker -->
          <template v-if="view === 'providers'">
            <ul
              v-if="reason !== 'inbox'"
              class="mb-5 space-y-2 rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-300"
            >
              <li class="flex gap-2">
                <CheckCircleIcon class="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{{ t('inbox.connectMailboxModalSendAndReceiveEmailInsideThe') }}</span>
              </li>
              <li class="flex gap-2">
                <CheckCircleIcon class="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{{ t('inbox.connectMailboxModalSyncThreadsToYourWorkspaceInbox') }}</span>
              </li>
              <li class="flex gap-2">
                <CheckCircleIcon class="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{{ t('inbox.connectMailboxModalKeepConversationsLinkedToPeopleDeals') }}</span>
              </li>
            </ul>

            <p
              :class="reason === 'inbox'
                ? 'text-sm font-semibold text-gray-900 dark:text-white'
                : 'text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-500'"
            >
              {{ reason === 'inbox' ? 'Select your email provider:' : 'Choose your email provider' }}
            </p>
            <div
              class="mt-4"
              :class="reason === 'inbox' ? 'grid grid-cols-2 gap-4 sm:grid-cols-4' : 'mt-3 grid grid-cols-2 gap-3'"
            >
              <InboxProviderCard
                v-for="p in inboxProviders"
                :key="p.id"
                :provider="providerForCard(p)"
                :variant="reason === 'inbox' ? 'picker' : 'default'"
                :selected="selectedProviderId === p.id"
                :disabled="p.id === 'google' && !gmailOAuthReady"
                :unavailable-reason="p.id === 'google' && !gmailOAuthReady ? 'Gmail not configured on server' : ''"
                @select="onProviderSelect"
              />
            </div>
            <p
              v-if="reason === 'inbox' && !gmailOAuthReady"
              class="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
            >{{ t('inbox.connectMailboxModalGmailIsntEnabledOnThisServer2') }}<code class="rounded bg-amber-100 px-1 font-mono text-[10px] dark:bg-amber-950/80">GOOGLE_GMAIL_*</code>
              in the API environment, or use Settings → Integrations.
            </p>
            <p
              v-else-if="reason !== 'inbox'"
              class="mt-4 text-center text-[11px] text-gray-400 dark:text-gray-500"
            >
              Outlook, Yahoo, and IMAP use the same mailbox model — we’ll enable them as integrations ship.
            </p>
          </template>

          <!-- Create mailbox -->
          <template v-else-if="view === 'create-mailbox'">
            <div v-if="mailboxKind === 'group'" class="space-y-3">
              <p class="text-sm text-gray-700 dark:text-gray-300">{{ t('inbox.connectMailboxModalCreateA') }}<span class="font-medium">{{ t('inbox.connectMailboxModalSharedTeamMailbox') }}</span>, then connect Google Workspace / Gmail.
              </p>
              <label class="block text-sm font-medium text-gray-800 dark:text-gray-200">{{ t('inbox.connectMailboxModalDisplayName') }}<input
                  v-model="groupLabel"
                  type="text"
                  class="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                  :placeholder="t('appointments.typeSupport')"
                >
              </label>
              <label class="block text-sm font-medium text-gray-800 dark:text-gray-200">{{ t('inbox.connectMailboxModalSharedEmailAddress') }}<input
                  v-model="groupEmail"
                  type="email"
                  class="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                  :placeholder="t('inbox.connectMailboxModalSupportCompanyCom')"
                >
              </label>
              <button
                type="button"
                class="w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                :disabled="setupLoading || !flags.canCreateGroup || !groupLabel.trim()"
                @click="createGroupMailbox"
              >
                {{ setupLoading ? 'Creating…' : 'Create shared mailbox' }}
              </button>
            </div>
            <template v-else>
            <div class="rounded-xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm text-blue-950 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">
              <p class="font-medium">{{ t('inbox.connectMailboxModalOneQuickStepFirst') }}</p>
              <p class="mt-1 text-xs leading-relaxed text-blue-900/90 dark:text-blue-200/90">{{ t('inbox.connectMailboxModalLitedeskCreatesAPrivate') }}<span class="font-medium">{{ t('inbox.connectMailboxModalPersonalMailbox') }}</span> for your account, then links it to
                {{ selectedProvider?.name || 'your provider' }}.
              </p>
            </div>
            <button
              type="button"
              class="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              :disabled="setupLoading || !flags.canCreatePersonal"
              @click="createPersonalMailbox"
            >
              {{ setupLoading ? 'Creating mailbox…' : 'Create my mailbox' }}
            </button>
            <p v-if="!flags.canCreatePersonal" class="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">{{ t('inbox.connectMailboxModalYourRoleCannotCreateAPersonal') }}</p>
            </template>
          </template>

          <!-- Gmail SMTP (App Password) -->
          <template v-else-if="view === 'connect-provider' && selectedProviderId === 'google-smtp'">
            <p
              v-if="!flags.gmailSmtpOrgConfigured"
              class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
            >{{ t('inbox.connectMailboxModalYourOrganizationHasNotEnabledGmail') }}<span class="font-medium">{{ t('settings.integrationsProviderOptionGmailSmtp') }}</span> under Settings → Integrations → Email and save.
            </p>
            <template v-else>
              <label class="block text-sm font-medium text-gray-800 dark:text-gray-200">{{ t('inbox.connectMailboxModalGmailAddress') }}<input
                  v-model="emailHint"
                  type="email"
                  autocomplete="email"
                  class="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                  :placeholder="t('inbox.connectMailboxModalYouCompanyCom')"
                >
              </label>
              <label class="block mt-4 text-sm font-medium text-gray-800 dark:text-gray-200">{{ t('settings.integrationsGmailSmtpHintAppPassword') }}<input
                  v-model="appPassword"
                  type="password"
                  autocomplete="off"
                  class="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                  placeholder="16-character app password"
                >
              </label>
              <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Create one at Google Account → Security → 2-Step Verification → App passwords.
                This is used only to send mail as you; inbox sync uses Gmail API (OAuth) if you connect Gmail separately.
              </p>
            </template>
          </template>

          <!-- Gmail / Google connect -->
          <template v-else-if="view === 'connect-provider' && selectedProviderId === 'google'">
            <div class="mb-4 flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-800/50">
              <span
                v-if="selectedProvider"
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg font-bold text-white"
                :class="selectedProvider.iconBgClass"
                :style="selectedProvider.iconStyle || undefined"
              >{{ selectedProvider.iconLetter }}</span>
              <div v-if="selectedProvider" class="min-w-0">
                <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ selectedProvider.name }}</p>
                <p class="text-[11px] text-gray-500 dark:text-gray-400">{{ selectedProvider.integrationLabel }}</p>
              </div>
            </div>

            <p
              v-if="!gmailOAuthReady"
              class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
            >{{ t('inbox.connectMailboxModalGmailIsntEnabledOnThisServer') }}<code class="rounded bg-amber-100 px-1 font-mono text-[10px] dark:bg-amber-950/80">GOOGLE_GMAIL_*</code>{{ t('inbox.connectMailboxModalOrCredentialsUnder') }}<span class="font-medium">Settings → Integrations</span>.
            </p>

            <template v-else>
              <label class="block text-sm font-medium text-gray-800 dark:text-gray-200">{{ t('inbox.connectMailboxModalWorkEmailAddress') }}<input
                  v-model="emailHint"
                  type="email"
                  autocomplete="email"
                  class="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                  :placeholder="selectedProvider?.emailPlaceholder || 'you@company.com'"
                >
              </label>
              <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                {{ selectedProvider?.connectHint }}
              </p>

              <div
                class="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-xs leading-relaxed text-gray-700 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300"
              >
                <p class="font-medium text-gray-900 dark:text-white">{{ t('inbox.connectMailboxModalWhatHappensNext') }}</p>
                <ol class="mt-2 list-decimal space-y-1.5 pl-4">
                  <li>{{ t('inbox.connectMailboxModalGoogleOpensInAPopupSo') }}</li>
                  <li>{{ t('inbox.connectMailboxModalLitedeskImportsMailUsingARead') }}</li>
                  <li>{{ t('inbox.connectMailboxModalYouCanSendFromTheCrm') }}</li>
                </ol>
                <p class="mt-2 text-gray-600 dark:text-gray-400">{{ t('inbox.connectMailboxModalIfGoogleShowsAnUnverifiedApp') }}<span class="font-medium">{{ t('settings.settingsRelDrawerAdvanced') }}</span>{{ t('inbox.connectMailboxModalToContinueWhenYouTrustThis') }}</p>
              </div>
            </template>
          </template>
        </div>

        <!-- Footer -->
        <div class="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-800 sm:px-6">
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            @click="close"
          >{{ t('inbox.connectMailboxModalNotNow') }}</button>
          <div class="flex flex-wrap gap-2">
            <button
              v-if="view === 'providers' && personalMailbox && hasConnectedInbox"
              type="button"
              class="rounded-lg px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
              @click="close"
            >{{ t('inbox.connectMailboxModalDone') }}</button>
            <button
              v-else-if="view === 'connect-provider' && selectedProviderId === 'google-smtp' && flags.gmailSmtpOrgConfigured"
              type="button"
              class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              :disabled="smtpConnectLoading || !emailLooksValid || !appPassword.trim()"
              @click="connectGmailSmtp"
            >
              {{ smtpConnectLoading ? 'Verifying…' : 'Connect Gmail SMTP' }}
            </button>
            <button
              v-else-if="view === 'connect-provider' && selectedProviderId === 'google' && gmailOAuthReady"
              type="button"
              class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              :disabled="gmailSyncLoading || !emailLooksValid"
              @click="connectGoogle"
            >
              {{ gmailSyncLoading ? 'Opening Google…' : 'Continue with Google' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, computed, watch } from 'vue';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotifications } from '@/composables/useNotifications';
import { useMailboxConnection } from '@/composables/useMailboxConnection';
import { useGmailInboxConnect } from '@/composables/useGmailInboxConnect';
import apiClient from '@/utils/apiClient';
import { INBOX_PROVIDERS, getInboxProvider } from '@/constants/inboxProviders';
import InboxProviderCard from '@/components/inbox/InboxProviderCard.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  reason: { type: String, default: 'send' },
  /** `personal` | `group` — shared mailbox uses admin OAuth (R1). */
  mailboxKind: { type: String, default: 'personal' },
  /** When set (group), connect Gmail to this mailbox instead of creating one. */
  targetMailbox: { type: Object, default: null }
});

const { t } = useI18n();

const emit = defineEmits(['update:modelValue', 'connected']);

const authStore = useAuthStore();
const notifications = useNotifications();
const {
  flags,
  personalMailbox,
  groupMailboxes,
  hasConnectedInbox,
  gmailOAuthReady,
  refreshMailboxes,
  ensurePersonalMailbox,
  ensureGroupMailbox
} = useMailboxConnection();

/** Mailbox id used for OAuth after create-group step */
const connectTargetMailbox = ref(null);
const { gmailSyncLoading, startGmailOAuth } = useGmailInboxConnect();

/** @type {import('vue').Ref<'providers' | 'create-mailbox' | 'connect-provider'>} */
const view = ref('providers');
const selectedProviderId = ref('google');
const setupLoading = ref(false);
const emailHint = ref('');
const groupLabel = ref('Support');
const groupEmail = ref('');
const appPassword = ref('');
const smtpConnectLoading = ref(false);

const inboxProviders = INBOX_PROVIDERS;

const selectedProvider = computed(() => getInboxProvider(selectedProviderId.value));

const emailLooksValid = computed(() => {
  const s = String(emailHint.value || '').trim();
  return s.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
});

const modalPanelClass = computed(() =>
  view.value === 'providers' && props.reason === 'inbox' ? 'max-w-3xl' : 'max-w-xl'
);

const headerTitle = computed(() => {
  if (props.mailboxKind === 'group') {
    if (view.value === 'providers') return 'Connect shared mailbox';
    if (view.value === 'create-mailbox') return 'Create shared inbox';
    return 'Connect Gmail for team';
  }
  if (view.value === 'providers' && props.reason === 'inbox') {
    return 'Connect your Inbox to LiteDesk';
  }
  if (view.value === 'providers') return 'Connect your inbox';
  if (view.value === 'create-mailbox') return 'Set up your mailbox';
  if (selectedProvider.value) return `Connect ${selectedProvider.value.name}`;
  return 'Connect inbox';
});

const headerSubtitle = computed(() => {
  if (view.value === 'providers') {
    if (props.reason === 'inbox') {
      return 'Manage your work email in a private inbox that stays in sync with your email provider.';
    }
    return 'Link your work email to send and receive messages from people, deals, and your inbox.';
  }
  if (view.value === 'create-mailbox') {
    return 'Your mailbox keeps CRM email separate from other users in your organization.';
  }
  if (selectedProvider.value?.id === 'google') {
    return 'Authorize Google to sync Gmail via OAuth (read-only import + CRM send).';
  }
  if (selectedProvider.value?.id === 'google-smtp') {
    return 'Send email through your organization’s Gmail SMTP relay using an App Password.';
  }
  return selectedProvider.value?.integrationLabel || '';
});

const stepLabels = computed(() => {
  if (view.value === 'create-mailbox') return ['Provider', 'Mailbox'];
  return ['Provider', 'Mailbox', 'Connect'];
});

const stepIndex = computed(() => {
  if (view.value === 'providers') return 0;
  if (view.value === 'create-mailbox') return 1;
  return 2;
});

function providerForCard(p) {
  if (p.id === 'google' && !gmailOAuthReady.value) {
    return { ...p, status: 'disabled' };
  }
  if (p.id === 'google-smtp' && !flags.value.gmailSmtpOrgConfigured) {
    return { ...p, status: 'disabled' };
  }
  return p;
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      view.value = props.targetMailbox?.id ? 'connect-provider' : 'providers';
      selectedProviderId.value = 'google';
      connectTargetMailbox.value = props.targetMailbox || null;
      emailHint.value = props.targetMailbox?.emailAddress
        ? String(props.targetMailbox.emailAddress).trim()
        : authStore.user?.email && String(authStore.user.email).includes('@')
          ? String(authStore.user.email).trim()
          : '';
      void refreshMailboxes();
    }
  }
);

function close() {
  view.value = 'providers';
  appPassword.value = '';
  emit('update:modelValue', false);
}

function goBack() {
  if (view.value === 'connect-provider') {
    view.value = personalMailbox.value ? 'providers' : 'create-mailbox';
    return;
  }
  if (view.value === 'create-mailbox') {
    view.value = 'providers';
  }
}

function onProviderSelect(providerId) {
  const p = getInboxProvider(providerId);
  if (!p || p.status !== 'available') {
    if (p?.status === 'coming_soon') {
      notifications.info(t('inbox.inboxProviderSoonUseGmail', { name: p.name }));
    }
    return;
  }
  if (providerId === 'google' && !gmailOAuthReady.value) {
    notifications.warning('Gmail is not configured on this server yet.');
    return;
  }
  if (providerId === 'google-smtp' && !flags.value.gmailSmtpOrgConfigured) {
    notifications.warning('Gmail SMTP is not enabled for this organization. Ask an admin to configure it in Settings.');
    return;
  }
  selectedProviderId.value = providerId;
  if (props.mailboxKind === 'group') {
    if (props.targetMailbox?.id || connectTargetMailbox.value?.id) {
      view.value = 'connect-provider';
      return;
    }
    view.value = 'create-mailbox';
    return;
  }
  if (!personalMailbox.value) {
    view.value = 'create-mailbox';
    return;
  }
  view.value = 'connect-provider';
}

async function createPersonalMailbox() {
  setupLoading.value = true;
  try {
    const mb = await ensurePersonalMailbox();
    if (mb?.id) {
      notifications.success('Mailbox ready');
      view.value = 'connect-provider';
    } else {
      notifications.error('Could not create personal mailbox');
    }
  } finally {
    setupLoading.value = false;
  }
}

async function createGroupMailbox() {
  setupLoading.value = true;
  try {
    const mb = await ensureGroupMailbox({
      label: groupLabel.value,
      emailAddress: groupEmail.value
    });
    if (mb?.id) {
      connectTargetMailbox.value = mb;
      emailHint.value = String(groupEmail.value || mb.emailAddress || '').trim();
      notifications.success('Shared mailbox created');
      view.value = 'connect-provider';
    } else {
      notifications.error('Could not create shared mailbox');
    }
  } finally {
    setupLoading.value = false;
  }
}

function resolveConnectMailboxId() {
  if (props.targetMailbox?.id) return String(props.targetMailbox.id);
  if (connectTargetMailbox.value?.id) return String(connectTargetMailbox.value.id);
  if (props.mailboxKind === 'group') {
    const g = groupMailboxes.value.find((m) => m.id && !m.gmailInboxSync?.connected);
    return g?.id ? String(g.id) : '';
  }
  return personalMailbox.value?.id ? String(personalMailbox.value.id) : '';
}

async function connectGoogle() {
  const mbId = resolveConnectMailboxId();
  if (!mbId || !emailLooksValid.value) return;
  await startGmailOAuth(mbId, emailHint.value, {
    onConnected: async () => {
      await refreshMailboxes();
      emit('connected');
      close();
    }
  });
}

async function connectGmailSmtp() {
  const mbId = resolveConnectMailboxId();
  if (!mbId || !emailLooksValid.value || !appPassword.value.trim()) return;
  smtpConnectLoading.value = true;
  try {
    const res = await apiClient.post(`/mailboxes/${encodeURIComponent(mbId)}/outbound/gmail-smtp/connect`, {
      emailAddress: emailHint.value.trim(),
      appPassword: appPassword.value.replace(/\s/g, '')
    });
    if (res?.success) {
      notifications.success('Gmail SMTP connected for sending');
      appPassword.value = '';
      await refreshMailboxes();
      emit('connected');
      close();
    } else {
      notifications.error(res?.message || 'Could not connect Gmail SMTP');
    }
  } catch (err) {
    notifications.error(err?.response?.data?.message || err?.message || 'Could not connect Gmail SMTP');
  } finally {
    smtpConnectLoading.value = false;
  }
}
</script>
