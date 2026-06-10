import { ref, computed } from 'vue';
import apiClient from '@/utils/apiClient';
import { isMailboxConnectedForProvider } from '@/constants/inboxProviders';
import { isInboxShellUnblocked, isMailboxInboundReady } from '@/utils/mailboxInboundStatus';

const mailboxes = ref([]);
const flags = ref({
  canCreatePersonal: false,
  canDeletePersonal: false,
  canCreateGroup: false,
  gmailIntegrationEnabled: false,
  gmailOAuthAppConfigured: false,
  gmailSmtpOrgConfigured: false,
  inboundParserEnabled: false,
  inboundParserConfigured: false,
  inboundParserProvisionReady: false
});
const loading = ref(false);
const loaded = ref(false);

let inflight = null;

const personalMailbox = computed(
  () => mailboxes.value.find((m) => m.kind === 'personal') || null
);

const groupMailboxes = computed(() => mailboxes.value.filter((m) => m.kind === 'group'));

const hasConnectedGroupMailbox = computed(() =>
  groupMailboxes.value.some((m) => isMailboxConnectedForProvider(m, 'google'))
);

/** True when personal mailbox is inbound-ready (Gmail or parser forwarding). */
const hasConnectedPersonalInbox = computed(() => {
  const personal = mailboxes.value.find((m) => m.kind === 'personal');
  return isMailboxInboundReady(personal, flags.value);
});

/** True when inbox shell should be shown (shared access or connected personal). */
const hasUsableInboxAccess = computed(() =>
  isInboxShellUnblocked(mailboxes.value, flags.value)
);

/** @deprecated Prefer hasUsableInboxAccess / hasConnectedPersonalInbox */
const hasConnectedInbox = computed(() => {
  if (!flags.value.gmailIntegrationEnabled) {
    return hasConnectedPersonalInbox.value
      || mailboxes.value.some((m) => m.kind === 'group');
  }
  return mailboxes.value.some(
    (m) => isMailboxConnectedForProvider(m, 'google') || isMailboxConnectedForProvider(m, 'google-smtp')
  );
});

const connectedPersonalMailbox = computed(
  () =>
    mailboxes.value.find(
      (m) => m.kind === 'personal' && isMailboxConnectedForProvider(m, 'google')
    ) || null
);

const gmailOAuthReady = computed(() => flags.value.gmailOAuthAppConfigured === true);

async function refreshMailboxes() {
  if (inflight) return inflight;
  loading.value = true;
  inflight = (async () => {
    try {
      const res = await apiClient('/mailboxes', { method: 'GET' });
      if (res?.success && res?.data) {
        mailboxes.value = Array.isArray(res.data.mailboxes) ? res.data.mailboxes : [];
        flags.value = {
          canCreatePersonal: Boolean(res.data.flags?.canCreatePersonal),
          canDeletePersonal: Boolean(res.data.flags?.canDeletePersonal),
          canCreateGroup: Boolean(res.data.flags?.canCreateGroup),
          gmailIntegrationEnabled: Boolean(res.data.flags?.gmailIntegrationEnabled),
          gmailOAuthAppConfigured: Boolean(res.data.flags?.gmailOAuthAppConfigured),
          gmailSmtpOrgConfigured: Boolean(res.data.flags?.gmailSmtpOrgConfigured),
          inboundParserEnabled: Boolean(res.data.flags?.inboundParserEnabled),
          inboundParserConfigured: Boolean(res.data.flags?.inboundParserConfigured),
          inboundParserProvisionReady: Boolean(res.data.flags?.inboundParserProvisionReady)
        };
      } else {
        mailboxes.value = [];
      }
      loaded.value = true;
    } catch (err) {
      console.warn('[useMailboxConnection] refresh failed:', err);
    } finally {
      loading.value = false;
      inflight = null;
    }
  })();
  return inflight;
}

async function ensurePersonalMailbox(input = {}) {
  if (personalMailbox.value?.id) return personalMailbox.value;
  if (!flags.value.canCreatePersonal) return null;
  const label = String(input.label || 'My work inbox').trim() || 'My work inbox';
  const body = { kind: 'personal', label };
  const email =
    typeof input === 'string'
      ? input.trim()
      : String(input.emailAddress || '').trim();
  if (email) body.emailAddress = email;
  const res = await apiClient('/mailboxes', {
    method: 'POST',
    body: JSON.stringify(body)
  });
  if (res?.success && res?.data?.mailbox) {
    await refreshMailboxes();
    return res.data.mailbox;
  }
  return null;
}

/**
 * @param {{ label: string, emailAddress?: string, memberUserIds?: string[] }} input
 */
async function deletePersonalMailbox(mailboxId, options = {}) {
  if (!mailboxId) return false;
  const deleteEmails = options.deleteEmails === true;
  const res = await apiClient(`/mailboxes/${encodeURIComponent(mailboxId)}`, {
    method: 'DELETE',
    params: deleteEmails ? { deleteEmails: 'true' } : undefined
  });
  if (res?.success) {
    await refreshMailboxes();
    return res;
  }
  return null;
}

async function provisionMailboxParser(mailboxId) {
  if (!mailboxId) {
    return { ok: false, message: 'Missing mailbox id' };
  }
  const res = await apiClient(
    `/mailboxes/${encodeURIComponent(mailboxId)}/inbound-parser/provision`,
    { method: 'POST' }
  );
  const provision = res?.data?.parserProvision;
  const mailbox = res?.data?.mailbox || null;
  if (res?.success && mailbox) {
    await refreshMailboxes();
    return { ok: true, mailbox };
  }
  if (mailbox) {
    await refreshMailboxes();
  }
  const storedError = mailbox?.inboundParser?.provisioningError;
  const message =
    res?.message
    || provision?.message
    || provision?.error
    || storedError
    || 'Could not generate a forwarding address. Ask your platform admin to configure the inbound parser.';
  return { ok: false, message, mailbox, provision };
}

async function ensureGroupMailbox(input = {}) {
  const label = String(input.label || 'Shared inbox').trim();
  if (!label) return null;
  if (!flags.value.canCreateGroup) return null;
  const body = {
    kind: 'group',
    label,
    emailAddress: input.emailAddress ? String(input.emailAddress).trim() : '',
    memberUserIds: Array.isArray(input.memberUserIds) ? input.memberUserIds : []
  };
  const res = await apiClient('/mailboxes', { method: 'POST', body: JSON.stringify(body) });
  if (res?.success && res?.data?.mailbox) {
    await refreshMailboxes();
    return res.data.mailbox;
  }
  return null;
}

/**
 * Shared mailbox connection state for inbox + compose gating.
 */
export function useMailboxConnection() {
  return {
    mailboxes,
    flags,
    loading,
    loaded,
    personalMailbox,
    groupMailboxes,
    hasConnectedInbox,
    hasConnectedPersonalInbox,
    hasUsableInboxAccess,
    hasConnectedGroupMailbox,
    connectedPersonalMailbox,
    gmailOAuthReady,
    refreshMailboxes,
    ensurePersonalMailbox,
    ensureGroupMailbox,
    deletePersonalMailbox,
    provisionMailboxParser,
    isMailboxInboundReady: (mb) => isMailboxInboundReady(mb, flags.value)
  };
}
