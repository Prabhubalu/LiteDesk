<template>
  <div class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ t('settings.personalSmtpSendersTitle') }}
        </h3>
        <p class="mt-1 text-xs text-gray-600 dark:text-gray-400">
          {{ t('settings.personalSmtpSendersSubtitle') }}
        </p>
      </div>
      <button
        type="button"
        class="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        :disabled="busy || loadingLocal"
        @click="addSmtpSender"
      >
        {{ t('settings.personalSmtpSendersAdd') }}
      </button>
    </div>

    <div v-if="loadingLocal" class="mt-4 text-xs text-gray-500 dark:text-gray-400">
      {{ t('states.loading') }}
    </div>

    <p v-else-if="loadError" class="mt-4 text-xs text-red-600 dark:text-red-400">
      {{ loadError }}
    </p>

    <ul v-else-if="rows.length" class="mt-4 divide-y divide-gray-100 dark:divide-gray-700">
      <li
        v-for="row in rows"
        :key="row.id"
        class="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
      >
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <p class="truncate text-sm font-medium text-gray-900 dark:text-white">
              {{ row.fromName ? `${row.fromName} <${row.email}>` : row.email || t('settings.personalSmtpSendersNoEmail') }}
            </p>
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
              :class="row.connected
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                : 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100'"
            >
              {{ row.connected
                ? t('settings.personalSmtpSendersConnected')
                : t('settings.personalSmtpSendersDisconnected') }}
            </span>
            <span
              v-if="row.kind === 'personal'"
              class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300"
            >
              {{ t('settings.personalSmtpSendersInboxBadge') }}
            </span>
          </div>
          <p class="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400">
            {{ row.summary }}
          </p>
        </div>
        <div class="flex shrink-0 flex-wrap items-center gap-1.5">
          <button
            type="button"
            class="rounded-md px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
            :disabled="busy"
            @click="reconnect(row)"
          >
            {{ row.connected
              ? t('settings.personalSmtpSendersReconnect')
              : t('settings.personalSmtpSendersConnect') }}
          </button>
          <button
            v-if="row.connected"
            type="button"
            class="rounded-md px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-amber-950/40"
            :disabled="busy"
            @click="disable(row)"
          >
            {{ t('settings.personalSmtpSendersDisable') }}
          </button>
          <button
            v-if="row.kind === 'smtp_sender'"
            type="button"
            class="rounded-md px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
            :disabled="busy"
            @click="removeSender(row)"
          >
            {{ t('settings.personalSmtpSendersRemove') }}
          </button>
        </div>
      </li>
    </ul>

    <p v-else class="mt-4 text-xs text-gray-500 dark:text-gray-400">
      {{ t('settings.personalSmtpSendersEmpty') }}
    </p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import { confirmAction } from '@/composables/useConfirmAction';
import { useMailboxConnection } from '@/composables/useMailboxConnection';
import { useSmtpSetupWizard } from '@/composables/useSmtpSetupWizard';

const { t } = useI18n();
const notifications = useNotifications();
const { refreshMailboxes } = useMailboxConnection();
const { openSmtpSetupWizard } = useSmtpSetupWizard();

const busy = ref(false);
const loadingLocal = ref(true);
const loadError = ref('');
const localMailboxes = ref([]);
/** mailboxId -> compose identity when viaSmtp / mailbox_smtp */
const smtpReadyByMailboxId = ref({});

const rows = computed(() => {
  const list = Array.isArray(localMailboxes.value) ? localMailboxes.value : [];
  const readyMap = smtpReadyByMailboxId.value || {};
  const out = [];
  const seen = new Set();

  for (const mb of list) {
    if (mb.kind !== 'smtp_sender' && mb.kind !== 'personal') continue;
    const id = String(mb.id);
    seen.add(id);
    const identity = readyMap[id];
    const connected = isSmtpConnected(mb) || Boolean(identity?.viaSmtp);
    out.push(toRow(mb, connected, identity));
  }

  // Compose may know about SMTP-ready mailboxes not yet in our filtered list
  for (const [mailboxId, identity] of Object.entries(readyMap)) {
    if (!mailboxId || seen.has(mailboxId) || !identity?.viaSmtp) continue;
    out.push({
      id: mailboxId,
      kind: identity.kind === 'smtp_sender' ? 'smtp_sender' : 'personal',
      email: String(identity.emailAddress || '').toLowerCase(),
      fromName: String(identity.fromName || identity.label || '').trim(),
      connected: true,
      provider: 'gmail',
      summary: providerLabel('gmail')
    });
  }

  // Connected first, then by email
  out.sort((a, b) => {
    if (a.connected !== b.connected) return a.connected ? -1 : 1;
    return String(a.email || '').localeCompare(String(b.email || ''));
  });
  return out;
});

function isSmtpConnected(mb) {
  const smtp = mb?.smtpOutbound || {};
  const gmailSmtp = mb?.gmailSmtpOutbound || {};
  if (smtp.connected === true || gmailSmtp.connected === true) return true;
  if (smtp.hasCredentials === true && String(mb?.emailAddress || mb?.gmailInboxSync?.accountEmail || '').includes('@')) {
    return true;
  }
  const channel = String(mb?.outboundChannel || '').toLowerCase();
  if ((channel === 'smtp' || channel === 'gmail_smtp') && smtp.verifiedAt) {
    return true;
  }
  return false;
}

function toRow(mb, connected, identity = null) {
  const smtp = mb.smtpOutbound || {};
  const email = String(
    mb.emailAddress
    || mb.gmailInboxSync?.accountEmail
    || identity?.emailAddress
    || ''
  ).trim().toLowerCase();
  const rawName = String(
    smtp.fromName
    || identity?.fromName
    || mb.label
    || ''
  ).trim();
  const fromName = rawName && rawName.toLowerCase() !== email ? rawName : '';
  const provider = String(smtp.provider || '').trim()
    || (String(mb.outboundChannel || '') === 'gmail_smtp' ? 'gmail' : '')
    || (connected ? 'gmail' : '');
  const host = String(smtp.host || '').trim();
  const port = smtp.port != null ? String(smtp.port) : '';
  const hostBit = host ? (port ? `${host}:${port}` : host) : '';
  const summaryParts = [];
  if (provider) summaryParts.push(providerLabel(provider));
  if (hostBit) summaryParts.push(hostBit);
  if (!connected) {
    summaryParts.push(t('settings.personalSmtpSendersNotConfiguredHint'));
  }
  return {
    id: String(mb.id),
    kind: mb.kind,
    email: email || '',
    fromName,
    connected,
    provider,
    summary: summaryParts.filter(Boolean).join(' · ')
  };
}

function providerLabel(provider) {
  const p = String(provider || '').toLowerCase();
  if (p === 'gmail') return 'Gmail SMTP';
  if (p === 'outlook') return 'Outlook SMTP';
  if (p === 'yahoo') return 'Yahoo SMTP';
  if (p === 'zoho') return 'Zoho SMTP';
  if (p === 'icloud') return 'iCloud SMTP';
  if (!p) return '';
  return t('settings.personalSmtpSendersCustomSmtp');
}

async function loadSenders() {
  loadingLocal.value = true;
  loadError.value = '';
  try {
    const [mbRes, previewRes] = await Promise.all([
      apiClient.get('/mailboxes'),
      apiClient.get('/communications/email/compose-preview?standalone=true').catch(() => null)
    ]);
    localMailboxes.value = Array.isArray(mbRes?.data?.mailboxes) ? mbRes.data.mailboxes : [];

    const ready = {};
    const identities = Array.isArray(previewRes?.data?.identities) ? previewRes.data.identities : [];
    for (const idty of identities) {
      if (!idty?.mailboxId) continue;
      const viaSmtp = idty.viaSmtp === true || idty.deliveryMode === 'mailbox_smtp';
      if (!viaSmtp) continue;
      ready[String(idty.mailboxId)] = idty;
    }
    smtpReadyByMailboxId.value = ready;

    void refreshMailboxes();
  } catch (err) {
    loadError.value = err?.message || t('settings.personalSmtpSendersLoadFailed');
    localMailboxes.value = [];
    smtpReadyByMailboxId.value = {};
  } finally {
    loadingLocal.value = false;
  }
}

async function addSmtpSender() {
  if (busy.value) return;
  busy.value = true;
  try {
    const res = await apiClient.post('/mailboxes', {
      kind: 'smtp_sender',
      label: t('settings.personalSmtpSendersDefaultLabel')
    });
    const mb = res?.data?.mailbox;
    if (!mb?.id) {
      notifications.error(t('settings.personalSmtpSendersCreateFailed'));
      return;
    }
    openSmtpSetupWizard({
      mailboxId: mb.id,
      email: mb.emailAddress || '',
      reason: 'settings',
      onConnected: () => {
        void loadSenders();
      }
    });
    await loadSenders();
  } catch (err) {
    notifications.error(err?.message || t('settings.personalSmtpSendersCreateFailed'));
  } finally {
    busy.value = false;
  }
}

function reconnect(row) {
  openSmtpSetupWizard({
    mailboxId: row.id,
    email: row.email || '',
    reason: 'settings',
    onConnected: () => {
      void loadSenders();
    }
  });
}

async function disable(row) {
  const ok = await confirmAction({
    title: t('settings.personalSmtpSendersDisableConfirmTitle'),
    message: t('settings.personalSmtpSendersDisableConfirmBody', { email: row.email || row.id }),
    confirmLabel: t('settings.personalSmtpSendersDisable'),
    tone: 'warning'
  });
  if (!ok) return;
  busy.value = true;
  try {
    await apiClient.post(`/mailboxes/${row.id}/outbound/smtp/disconnect`);
    notifications.success(t('settings.personalSmtpSendersDisabled'));
    await loadSenders();
  } catch (err) {
    notifications.error(err?.message || t('settings.personalSmtpSendersDisableFailed'));
  } finally {
    busy.value = false;
  }
}

async function removeSender(row) {
  const ok = await confirmAction({
    title: t('settings.personalSmtpSendersRemoveConfirmTitle'),
    message: t('settings.personalSmtpSendersRemoveConfirmBody', { email: row.email || row.id }),
    confirmLabel: t('settings.personalSmtpSendersRemove'),
    tone: 'danger'
  });
  if (!ok) return;
  busy.value = true;
  try {
    await apiClient.delete(`/mailboxes/${row.id}`);
    notifications.success(t('settings.personalSmtpSendersRemoved'));
    await loadSenders();
  } catch (err) {
    notifications.error(err?.message || t('settings.personalSmtpSendersRemoveFailed'));
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  void loadSenders();
});
</script>
