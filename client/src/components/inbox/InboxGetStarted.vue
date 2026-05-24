<template>
  <div class="inbox-get-started mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
    <div
      class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] lg:items-center lg:gap-12"
    >
      <div class="min-w-0">
        <h1 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{{ t('inbox.inboxGetStartedGetStartedWithLitedesk') }}</h1>
        <p class="mt-2 max-w-lg text-sm text-gray-600 dark:text-gray-400">
          <template v-if="inboundParserMode">
            {{ t('inbox.inboxGetStartedInboundParserSubtitle') }}
          </template>
          <template v-else>
            {{ t('inbox.inboxGetStartedConnectYourWorkInboxToSend') }}
          </template>
        </p>

        <ul class="mt-8 space-y-3" role="list">
          <li
            v-for="step in steps"
            :key="step.id"
            class="flex items-center gap-4 rounded-2xl border border-gray-200/90 bg-white px-4 py-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-900/90"
          >
            <span
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-700 ring-1 ring-gray-100 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700"
              aria-hidden="true"
            >
              <component :is="step.icon" class="h-5 w-5" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-gray-900 dark:text-white">
                {{ step.title }}
              </p>
              <p class="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                {{ step.subtitle }}
              </p>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
              :class="step.primary
                ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50'
                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800'"
              :disabled="step.disabled || (step.id === 'mailbox' && connectLoading)"
              @click="onStepAction(step.id)"
            >
              <span v-if="step.id === 'mailbox' && connectLoading">{{ t('inbox.inboxGetStartedConnecting') }}</span>
              <span v-else>{{ step.actionLabel }}</span>
            </button>
          </li>
        </ul>

        <p
          v-if="!inboundParserMode && !gmailOAuthReady"
          class="mt-6 max-w-lg rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
        >{{ t('inbox.inboxGetStartedGmailIsntEnabledOnThisServer') }}<code class="rounded bg-amber-100/80 px-1 font-mono text-[10px] dark:bg-amber-950/80">GOOGLE_GMAIL_*</code>{{ t('inbox.inboxGetStartedOrOpenSetupFromTheConnect') }}</p>
      </div>

      <div
        class="relative mx-auto flex aspect-square w-full max-w-[380px] items-center justify-center"
        aria-hidden="true"
      >
        <div class="absolute inset-[8%] rounded-full border border-emerald-200/60 dark:border-emerald-900/40" />
        <div class="inbox-orbit-ring absolute inset-[18%] rounded-full border border-emerald-100/80 dark:border-emerald-950/60" />
        <div
          class="inbox-orbit-ring-reverse absolute inset-[28%] rounded-full border border-dashed border-emerald-200/50 dark:border-emerald-900/30"
        />

        <div
          class="relative z-10 flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-lg ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-700"
        >
          <img src="/assets/logo.svg" alt="" class="h-12 w-12 object-contain" />
        </div>

        <div
          v-for="(node, i) in orbitNodes"
          :key="node.id"
          class="absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl bg-white shadow-md ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-700"
          :style="orbitPosition(i, orbitNodes.length)"
          :title="node.label"
        >
          <span
            class="flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-bold text-white"
            :class="node.bgClass"
            :style="node.style"
          >{{ node.letter }}</span>
        </div>

        <div
          v-for="(tip, i) in featureTips"
          :key="i"
          class="absolute max-w-[9.5rem] rounded-lg border border-gray-200/90 bg-white/95 px-2.5 py-1.5 text-[10px] leading-snug text-gray-600 shadow-sm backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/95 dark:text-gray-300"
          :style="tipPosition(i)"
        >
          <span v-html="tip" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ChatBubbleLeftRightIcon,
  EnvelopeIcon,
  ShareIcon,
  UserGroupIcon
} from '@heroicons/vue/24/outline';

defineProps({
  gmailOAuthReady: { type: Boolean, default: true },
  inboundParserMode: { type: Boolean, default: false },
  connectLoading: { type: Boolean, default: false }
});

const { t } = useI18n();

const emit = defineEmits(['connect-mailbox', 'setup-group', 'coming-soon']);

const steps = computed(() => [
  {
    id: 'mailbox',
    title: t('inbox.inboxGetStartedStepMailboxTitle'),
    subtitle: t('inbox.inboxGetStartedStepMailboxSubtitle'),
    actionLabel: t('inbox.inboxGetStartedStepConnect'),
    primary: true,
    disabled: false,
    icon: EnvelopeIcon
  },
  {
    id: 'group',
    title: t('inbox.inboxGetStartedStepGroupTitle'),
    subtitle: t('inbox.inboxGetStartedStepGroupSubtitle'),
    actionLabel: t('inbox.inboxGetStartedStepSetup'),
    primary: false,
    disabled: false,
    icon: UserGroupIcon
  },
  {
    id: 'social',
    title: t('inbox.inboxGetStartedStepSocialTitle'),
    subtitle: t('inbox.inboxGetStartedStepSocialSubtitle'),
    actionLabel: t('inbox.inboxGetStartedStepConnect'),
    primary: false,
    disabled: true,
    icon: ShareIcon
  },
  {
    id: 'chat',
    title: t('inbox.inboxGetStartedStepChatTitle'),
    subtitle: t('inbox.inboxGetStartedStepChatSubtitle'),
    actionLabel: t('inbox.inboxGetStartedStepConnect'),
    primary: false,
    disabled: true,
    icon: ChatBubbleLeftRightIcon
  }
]);

const orbitNodes = [
  { id: 'gmail', label: 'Gmail', letter: 'G', style: 'background: conic-gradient(from -45deg, #ea4335, #fbbc05, #34a853, #4285f4, #ea4335)' },
  { id: 'outlook', label: 'Outlook', letter: 'O', bgClass: 'bg-[#0078d4]' },
  { id: 'm365', label: 'Microsoft 365', letter: 'M', bgClass: 'bg-[#d83b01]' },
  { id: 'yahoo', label: 'Yahoo', letter: 'Y', bgClass: 'bg-[#6001d2]' },
  { id: 'wa', label: 'WhatsApp', letter: 'W', bgClass: 'bg-[#25d366]' },
  { id: 'ig', label: 'Instagram', letter: 'I', bgClass: 'bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af]' },
  { id: 'fb', label: 'Facebook', letter: 'f', bgClass: 'bg-[#1877f2]' },
  { id: 'x', label: 'X', letter: 'X', bgClass: 'bg-gray-900 dark:bg-gray-100 dark:!text-gray-900' }
];

const featureTips = computed(() => [
  t('inbox.inboxGetStartedTipAssign'),
  t('inbox.inboxGetStartedTipMentions'),
  t('inbox.inboxGetStartedTipCanned'),
  t('inbox.inboxGetStartedTipEmails'),
]);

function orbitPosition(index, total) {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  const radius = 46;
  const x = 50 + radius * Math.cos(angle);
  const y = 50 + radius * Math.sin(angle);
  return { left: `${x}%`, top: `${y}%` };
}

function tipPosition(index) {
  const spots = [
    { left: '4%', top: '18%' },
    { right: '0%', top: '32%' },
    { left: '2%', bottom: '28%' },
    { right: '4%', bottom: '22%' },
    { left: '28%', bottom: '6%' }
  ];
  return spots[index % spots.length];
}

function onStepAction(stepId) {
  if (stepId === 'mailbox') {
    emit('connect-mailbox');
    return;
  }
  if (stepId === 'group') {
    emit('setup-group');
    return;
  }
  emit('coming-soon', stepId);
}
</script>

<style scoped>
.inbox-orbit-ring {
  animation: inbox-orbit-spin 48s linear infinite;
}

.inbox-orbit-ring-reverse {
  animation: inbox-orbit-spin-reverse 64s linear infinite;
}

@keyframes inbox-orbit-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes inbox-orbit-spin-reverse {
  to {
    transform: rotate(-360deg);
  }
}
</style>
