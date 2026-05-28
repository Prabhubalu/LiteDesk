<template>
  <article
    class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
  >
    <header
      class="flex items-start gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800"
      :class="isInbound ? '' : 'bg-indigo-50/50 dark:bg-indigo-950/20'"
    >
      <div
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold"
        :class="
          isInbound
            ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
            : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
        "
      >
        {{ initials }}
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ senderLabel }}</p>
          <span class="text-xs text-gray-500 dark:text-gray-400">{{ formatTime(message.receivedAt || message.sentAt) }}</span>
        </div>
        <p v-if="message.subject" class="mt-0.5 truncate text-xs font-medium text-gray-600 dark:text-gray-300">
          {{ message.subject }}
        </p>
        <p v-if="addressLine" class="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400">
          {{ addressLine }}
        </p>
      </div>
      <EnvelopeIcon class="h-4 w-4 shrink-0 text-gray-400" />
    </header>
    <div
      class="px-4 py-3 text-sm leading-relaxed text-gray-800 dark:text-gray-100"
      :class="bodyIsHtml ? 'prose prose-sm dark:prose-invert max-w-none break-words' : 'whitespace-pre-wrap break-words'"
    >
      <div v-if="bodyIsHtml" v-html="sanitizedBody" />
      <template v-else>{{ plainBody }}</template>
    </div>
    <div v-if="attachments.length" class="border-t border-gray-100 px-4 py-2 dark:border-gray-800">
      <CaseMailroomAttachments :attachments="attachments" />
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { EnvelopeIcon } from '@heroicons/vue/24/outline';
import CaseMailroomAttachments from '@/components/cases/CaseMailroomAttachments.vue';
import { formatRelativeTime } from '@/utils/relativeTime';
import { sanitizeRichDescriptionHtml } from '@/utils/richDescriptionHtml';
import { getCaseActivityDisplayName } from '@/utils/caseTimeline';
import { caseActivityToEmailMessage } from '@/utils/caseEmailConversation';

const props = defineProps({
  activity: { type: Object, required: true },
  caseRecord: { type: Object, default: null }
});

const { t } = useI18n();

const message = computed(() => caseActivityToEmailMessage(props.activity, props.caseRecord));
const isInbound = computed(() => message.value.direction === 'inbound');

const senderLabel = computed(() =>
  getCaseActivityDisplayName(props.activity, props.caseRecord)
);

const initials = computed(() => {
  const label = senderLabel.value || '?';
  const parts = label.replace(/<[^>]+>/g, '').trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return label.slice(0, 2).toUpperCase();
});

const addressLine = computed(() => {
  if (isInbound.value && message.value.fromAddress) {
    return `From: ${message.value.fromAddress}`;
  }
  const to = (message.value.toAddresses || []).join(', ');
  if (!isInbound.value && to) return `To: ${to}`;
  return '';
});

const plainBody = computed(() => String(message.value.body || '').trim() || '—');
const bodyIsHtml = computed(() => /<[a-z][\s\S]*>/i.test(plainBody.value));
const sanitizedBody = computed(() => sanitizeRichDescriptionHtml(plainBody.value));

const attachments = computed(() => {
  const list = message.value.attachments;
  return Array.isArray(list) ? list : [];
});

function formatTime(date) {
  return formatRelativeTime(date, t) || '';
}
</script>
