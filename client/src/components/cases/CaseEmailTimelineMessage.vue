<template>
  <article
    class="min-w-0 overflow-hidden rounded-lg transition-colors duration-200"
    :class="expanded ? 'bg-white dark:bg-gray-900/40' : 'hover:bg-gray-50/80 dark:hover:bg-gray-800/40'"
  >
    <div class="flex items-start gap-3 p-1">
      <Avatar :user="avatarUser" size="md" class="shrink-0 pointer-events-none [&_img]:rounded-full [&>div]:rounded-full" />

      <div class="min-w-0 flex-1">
        <div
          class="flex cursor-pointer items-start justify-between gap-2 rounded-md"
          role="button"
          tabindex="0"
          :aria-expanded="expanded"
          @click="$emit('toggle')"
          @keydown.enter.prevent="$emit('toggle')"
          @keydown.space.prevent="$emit('toggle')"
        >
          <div class="min-w-0 flex-1">
            <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ displayName }}</span>
              <span
                class="inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold leading-tight"
                :class="roleBadgeClass"
              >
                {{ roleLabel }}
              </span>
              <span
                v-if="deliveryBadge"
                class="inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold leading-tight"
                :class="deliveryBadge.className"
                :title="deliveryBadge.title"
              >
                {{ deliveryBadge.label }}
              </span>
              <span v-if="expanded" class="text-sm text-gray-500 dark:text-gray-400">
                {{ t('cases.recordActivitySentEmail') }}
              </span>
              <span v-else-if="bodySnippet" class="min-w-0 truncate text-sm text-gray-500 dark:text-gray-400">
                {{ bodySnippet }}
              </span>
            </div>
          </div>

          <div class="flex shrink-0 items-center gap-1" @click.stop>
            <span
              v-if="!expanded && normalizedAttachments.length"
              class="pointer-events-none text-gray-400 dark:text-gray-500"
              :title="t('cases.recordActivityAttachments', { count: normalizedAttachments.length })"
            >
              <PaperClipIcon class="h-4 w-4" />
            </span>
            <time class="pointer-events-none text-xs text-gray-500 dark:text-gray-400" :datetime="isoTime">
              {{ relativeTime }}
            </time>
            <Menu as="div" class="relative">
              <MenuButton
                type="button"
                class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                :aria-label="t('records.genericMoreActions')"
              >
                <EllipsisHorizontalIcon class="h-5 w-5" />
              </MenuButton>
              <MenuItems
                class="absolute right-0 z-20 mt-1 w-40 origin-top-right rounded-lg bg-white py-1 shadow-lg ring-1 ring-black/5 focus:outline-none dark:bg-gray-800 dark:ring-white/10"
              >
                <MenuItem v-slot="{ active }">
                  <button
                    type="button"
                    class="block w-full px-3 py-2 text-left text-sm"
                    :class="active ? 'bg-gray-50 text-gray-900 dark:bg-gray-700 dark:text-white' : 'text-gray-700 dark:text-gray-200'"
                    @click="$emit('reply', message)"
                  >
                    {{ t('records.activityReply') }}
                  </button>
                </MenuItem>
                <MenuItem v-slot="{ active }">
                  <button
                    type="button"
                    class="block w-full px-3 py-2 text-left text-sm"
                    :class="active ? 'bg-gray-50 text-gray-900 dark:bg-gray-700 dark:text-white' : 'text-gray-700 dark:text-gray-200'"
                    @click="$emit('reply-all', message)"
                  >
                    {{ t('cases.recordEmailComposerTabReplyAll') }}
                  </button>
                </MenuItem>
                <MenuItem v-slot="{ active }">
                  <button
                    type="button"
                    class="block w-full px-3 py-2 text-left text-sm"
                    :class="active ? 'bg-gray-50 text-gray-900 dark:bg-gray-700 dark:text-white' : 'text-gray-700 dark:text-gray-200'"
                    @click="$emit('forward', message)"
                  >
                    {{ t('cases.recordEmailComposerTabForward') }}
                  </button>
                </MenuItem>
              </MenuItems>
            </Menu>
            <ChevronDownIcon
              class="pointer-events-none h-4 w-4 text-gray-400 transition-transform duration-300 ease-in-out"
              :class="{ 'rotate-180': expanded }"
            />
          </div>
        </div>

        <div
          class="grid transition-[grid-template-rows] duration-300 ease-in-out"
          :class="expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
        >
          <div class="min-h-0 overflow-hidden">
            <div
              class="mt-2 transition-opacity duration-300"
              :class="expanded ? 'opacity-100' : 'opacity-0'"
              @click.stop
            >
              <!-- Recipients -->
              <div class="mt-1">
                <button
                  type="button"
                  class="inline-flex max-w-full items-center gap-1 text-left text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                  :aria-expanded="headersExpanded"
                  @click="headersExpanded = !headersExpanded"
                >
                  <span class="truncate">
                    <span class="text-gray-500 dark:text-gray-500">{{ t('cases.recordEmailComposerHeadersSummaryTo') }}:</span>
                    {{ primaryToLine }}
                  </span>
                  <ChevronDownIcon
                    class="h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200"
                    :class="{ 'rotate-180': headersExpanded }"
                  />
                </button>

                <div
                  class="grid transition-[grid-template-rows] duration-200 ease-in-out"
                  :class="headersExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
                >
                  <div class="min-h-0 overflow-hidden">
                    <div
                      class="mt-2 space-y-1 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-300"
                    >
                      <p v-if="fromLine">
                        <span class="font-medium text-gray-500">{{ t('cases.recordEmailComposerFrom') }}:</span>
                        {{ fromLine }}
                      </p>
                      <p v-if="toLine">
                        <span class="font-medium text-gray-500">{{ t('cases.recordEmailComposerHeadersSummaryTo') }}:</span>
                        {{ toLine }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Body (HTML emails sanitized like inbox; plain text gets <br> lines) -->
              <div
                class="email-body mt-3 text-sm leading-relaxed text-gray-800 dark:text-gray-100"
                v-html="renderedBody"
              />

              <CaseEmailMessageAttachments
                v-if="normalizedAttachments.length"
                :attachments="normalizedAttachments"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import { ChevronDownIcon, EllipsisHorizontalIcon, PaperClipIcon } from '@heroicons/vue/24/outline';
import Avatar from '@/components/common/Avatar.vue';
import CaseEmailMessageAttachments from '@/components/cases/CaseEmailMessageAttachments.vue';
import { getCaseEmailMessageAvatarUser } from '@/utils/caseEmailConversation';
import { formatCaseContactDisplayName } from '@/utils/caseTimeline';
import { extractEmailFromActorName } from '@/utils/caseEmailReply';
import { normalizeCaseEmailAttachment } from '@/utils/caseEmailAttachments';
import { emailBodyToPlainText, renderEmailMessageBody } from '@/utils/emailMessageBody';
import { formatRelativeTime } from '@/utils/relativeTime';

const props = defineProps({
  message: { type: Object, required: true },
  caseRecord: { type: Object, default: null },
  createdAt: { type: [String, Date], default: null },
  expanded: { type: Boolean, default: true }
});

defineEmits(['reply', 'reply-all', 'forward', 'toggle']);

const { t } = useI18n();
const headersExpanded = ref(false);

watch(
  () => props.expanded,
  (on) => {
    if (!on) headersExpanded.value = false;
  }
);

const isInbound = computed(() => String(props.message?.direction || '').toLowerCase() === 'inbound');

const avatarUser = computed(() => getCaseEmailMessageAvatarUser(props.message, props.caseRecord));

const displayName = computed(() => {
  if (isInbound.value) {
    return formatCaseContactDisplayName(
      avatarUser.value,
      t('cases.recordActivityRoleCustomer')
    );
  }
  const u = avatarUser.value;
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return name || u.email || t('cases.recordActivityRoleAgent');
});

const roleLabel = computed(() =>
  isInbound.value ? t('cases.recordActivityRoleCustomer') : t('cases.recordActivityRoleAgent')
);

const roleBadgeClass = computed(() =>
  isInbound.value
    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
    : 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200'
);

const deliveryBadge = computed(() => {
  if (isInbound.value) return null;
  const status = String(props.message?.deliveryStatus || '').toLowerCase();
  if (!status || status === 'queued' || status === 'processing' || status === 'sent') return null;

  if (status === 'delivered') {
    return {
      label: t('cases.recordEmailDeliveryDelivered'),
      title: '',
      className: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
    };
  }
  if (status === 'bounced') {
    const diagnostic = String(props.message?.bounceDiagnostic || props.message?.deliveryError || '').trim();
    return {
      label: t('cases.recordEmailDeliveryBounced'),
      title: diagnostic || t('cases.recordEmailDeliveryBouncedHint'),
      className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
    };
  }
  if (status === 'failed') {
    const err = String(props.message?.deliveryError || '').trim();
    return {
      label: t('cases.recordEmailDeliveryFailed'),
      title: err || t('cases.recordEmailDeliveryFailedHint'),
      className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
    };
  }
  return null;
});

const relativeTime = computed(() => formatRelativeTime(props.createdAt, t));
const isoTime = computed(() => {
  const d = new Date(props.createdAt || '');
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
});

const fromLine = computed(() => {
  const addr = props.message?.fromAddress || '';
  if (!addr) return isInbound.value ? displayName.value : '';
  if (addr.includes('@') && !addr.includes(displayName.value)) {
    return `${displayName.value} <${extractEmailFromActorName(addr) || addr}>`;
  }
  return addr;
});

const toLine = computed(() => {
  const list = props.message?.toAddresses || [];
  if (!list.length && isInbound.value) {
    const owner = props.caseRecord?.assignedTo;
    if (owner?.email) return owner.email;
  }
  return list.join(', ');
});

const primaryToLine = computed(() => {
  const line = toLine.value;
  if (!line) return '—';
  const first = line.split(',')[0]?.trim();
  return first || line;
});

const renderedBody = computed(() =>
  renderEmailMessageBody(props.message?.body, { emptyLabel: '—' })
);

const bodySnippet = computed(() => {
  const text = emailBodyToPlainText(props.message?.body);
  if (!text) return '';
  const max = 120;
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
});

const normalizedAttachments = computed(() =>
  (props.message?.attachments || []).map((a, idx) => normalizeCaseEmailAttachment(a, idx))
);
</script>

<style scoped>
.email-body :deep(a) {
  color: rgb(96 73 231);
  text-decoration: underline;
  cursor: pointer;
  pointer-events: auto;
}
.email-body :deep(p) {
  margin: 0 0 0.75rem;
}
.email-body :deep(p:last-child) {
  margin-bottom: 0;
}
.email-body :deep(blockquote) {
  margin: 0.75rem 0;
  padding-left: 0.75rem;
  border-left: 3px solid rgb(229 231 235);
  color: rgb(107 114 128);
}
.email-body :deep(pre),
.email-body :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.9em;
  background: rgb(243 244 246);
  border-radius: 4px;
  padding: 0.1rem 0.3rem;
}
.email-body :deep(pre) {
  padding: 0.75rem;
  overflow-x: auto;
}
.email-body :deep(img) {
  max-width: 100%;
  height: auto;
}
.email-body :deep(table) {
  border-collapse: collapse;
  max-width: 100%;
}
.email-body :deep(td),
.email-body :deep(th) {
  border: 1px solid rgb(229 231 235);
  padding: 0.25rem 0.5rem;
}
.dark .email-body :deep(a) {
  color: rgb(167 139 250);
}
.dark .email-body :deep(blockquote) {
  border-left-color: rgb(75 85 99);
  color: rgb(156 163 175);
}
.dark .email-body :deep(pre),
.dark .email-body :deep(code) {
  background: rgb(31 41 55);
}
.dark .email-body :deep(td),
.dark .email-body :deep(th) {
  border-color: rgb(75 85 99);
}
</style>
