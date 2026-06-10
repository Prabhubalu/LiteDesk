<template>
  <div
    v-if="modelValue && mailbox"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="titleId"
    @click.self="close"
  >
    <div class="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
      <div class="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <h3 :id="titleId" class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ mailbox.label }}
        </h3>
        <button
          type="button"
          class="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          :aria-label="t('settings.roleDrawerCloseSr')"
          @click="close"
        >
          ×
        </button>
      </div>

      <div class="space-y-4 px-4 py-4 text-sm text-gray-700 dark:text-gray-300">
        <div>
          <span class="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">{{ t('inbox.mailboxDetailsKind') }}</span>
          <p class="mt-0.5 font-medium text-gray-900 dark:text-white">
            {{ mailbox.kind === 'group' ? t('inbox.mailboxDetailsShared') : t('inbox.mailboxDetailsPersonal') }}
          </p>
        </div>

        <div v-if="mailbox.emailAddress">
          <span class="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">{{ t('inbox.mailboxDetailsEmail') }}</span>
          <p class="mt-0.5 break-all font-mono text-[13px]">{{ mailbox.emailAddress }}</p>
        </div>

        <div>
          <span class="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">{{ t('inbox.mailboxDetailsStatus') }}</span>
          <p class="mt-0.5">{{ syncStatusLabel }}</p>
        </div>

        <div
          v-if="!gmailIntegrationEnabled && mailbox.inboundParser?.routingAddress"
          class="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-xs text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:text-emerald-100"
        >
          <p class="font-semibold">{{ t('inbox.mailboxDetailsForwardingAddress') }}</p>
          <p class="mt-1 break-all font-mono text-[11px] select-all">{{ mailbox.inboundParser.routingAddress }}</p>
          <p v-if="mailbox.inboundParser.forwardingHint" class="mt-1 leading-snug opacity-90">
            {{ mailbox.inboundParser.forwardingHint }}
          </p>
        </div>

        <div
          v-if="gmailIntegrationEnabled && mailbox.gmailInboxSync?.accountEmail"
          class="text-xs text-gray-500 dark:text-gray-400"
        >
          {{ t('inbox.inboxSurfaceConnectedAs') }}
          <span class="font-mono text-gray-800 dark:text-gray-200">{{ mailbox.gmailInboxSync.accountEmail }}</span>
        </div>
      </div>

      <div class="flex flex-wrap justify-end gap-2 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
        <button
          v-if="showConnectAction"
          type="button"
          class="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700"
          @click="emit('connect', mailbox)"
        >
          {{ t('inbox.inboxSurfaceConnect') }}
        </button>
        <button
          v-if="mailbox.kind === 'group' && canCreateGroup"
          type="button"
          class="rounded-lg border border-violet-200 px-3 py-2 text-xs font-medium text-violet-800 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-200 dark:hover:bg-violet-950/40"
          @click="emit('manage-members', mailbox)"
        >
          {{ t('settings.groupsLabelMembers') }}
        </button>
        <button
          v-if="mailbox.kind === 'personal' && canDeletePersonal"
          type="button"
          class="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-800 hover:bg-red-50 dark:border-red-900/50 dark:text-red-200 dark:hover:bg-red-950/40"
          :disabled="actionLoading"
          @click="emit('delete', mailbox)"
        >
          {{ t('inbox.mailboxDetailsRemovePersonal') }}
        </button>
        <button
          v-if="mailbox.kind === 'group' && canCreateGroup"
          type="button"
          class="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-800 hover:bg-red-50 dark:border-red-900/50 dark:text-red-200 dark:hover:bg-red-950/40"
          :disabled="actionLoading"
          @click="emit('delete', mailbox)"
        >
          {{ t('inbox.mailboxDetailsRemoveGroup') }}
        </button>
        <button
          type="button"
          class="rounded-lg px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          @click="close"
        >
          {{ t('performance.cancelWizard') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

interface MailboxInboundParser {
  routingAddress?: string;
  forwardingHint?: string;
}

interface MailboxGmailInboxSync {
  connected?: boolean;
  accountEmail?: string;
}

export interface MailboxDetailsTarget {
  id: string;
  kind: 'personal' | 'group';
  label: string;
  emailAddress?: string;
  gmailInboxSync?: MailboxGmailInboxSync;
  gmailSmtpOutbound?: { connected?: boolean };
  inboundParser?: MailboxInboundParser;
}

const props = defineProps<{
  modelValue: boolean;
  mailbox: MailboxDetailsTarget | null;
  syncStatusLabel?: string;
  gmailIntegrationEnabled?: boolean;
  canDeletePersonal?: boolean;
  canCreateGroup?: boolean;
  actionLoading?: boolean;
  showConnectAction?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  connect: [mailbox: MailboxDetailsTarget];
  'manage-members': [mailbox: MailboxDetailsTarget];
  delete: [mailbox: MailboxDetailsTarget];
}>();

const { t } = useI18n();

const titleId = 'mailbox-details-title';

const syncStatusLabel = computed(() => props.syncStatusLabel || '—');

function close() {
  emit('update:modelValue', false);
}
</script>
