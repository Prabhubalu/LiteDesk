<template>
  <section
    :class="[
      flexFill ? 'flex min-h-0 flex-1 flex-col' : ['overflow-hidden', PLATFORM_HOME_CARD_CLASS]
    ]"
  >
    <div
      :class="[
        'flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5',
        flexFill ? 'border-b border-neutral-200/80 dark:border-neutral-700/80' : PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS
      ]"
    >
      <div class="min-w-0">
        <h2 class="text-sm font-semibold text-neutral-900 dark:text-white">
          {{ t('cases.portalCasesConversation') }}
        </h2>
        <p v-if="activities.length" class="text-xs text-neutral-500 dark:text-neutral-400">
          {{ t('cases.portalCasesMessageCount', { count: activities.length }) }}
        </p>
      </div>
    </div>

    <div
      ref="scrollEl"
      class="overscroll-y-contain arivu-scrollbar"
      :class="[
        flexFill
          ? 'min-h-0 flex-1 overflow-y-auto bg-neutral-50/80 px-3 py-4 dark:bg-neutral-950/40 sm:px-4'
          : 'max-h-[min(52vh,28rem)] overflow-y-auto p-4 sm:max-h-[min(58vh,32rem)]'
      ]"
    >
      <div
        v-if="!activities.length"
        class="flex flex-col items-center justify-center py-14 text-center"
      >
        <div
          class="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
        >
          <ChatBubbleLeftRightIcon class="h-6 w-6" />
        </div>
        <p class="text-sm font-medium text-neutral-800 dark:text-neutral-200">
          {{ t('cases.portalCasesNoMessages') }}
        </p>
        <p class="mt-1 max-w-xs text-xs text-neutral-500 dark:text-neutral-400">
          {{ t('cases.portalCasesNoMessagesHint') }}
        </p>
      </div>

      <div v-else class="space-y-5">
        <div v-for="group in groupedActivities" :key="group.dayKey">
          <div class="mb-4 flex items-center gap-3">
            <div class="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
            <span class="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-neutral-500 shadow-sm ring-1 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:ring-neutral-700">
              {{ formatDayLabel(group.date) }}
            </span>
            <div class="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
          </div>

          <div class="space-y-3">
            <div
              v-for="(act, idx) in group.items"
              :key="act._id || `${group.dayKey}-${idx}`"
              class="flex gap-2.5"
              :class="isFromCustomer(act) ? '' : 'flex-row-reverse'"
            >
              <div
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                :class="isFromCustomer(act)
                  ? 'bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-100'
                  : 'bg-[var(--portal-brand-primary,#3a1f8a)] text-white'"
                :aria-hidden="true"
              >
                {{ activityInitials(act) }}
              </div>

              <div
                class="min-w-0 max-w-[82%] sm:max-w-[70%]"
                :class="isFromCustomer(act) ? '' : 'text-right'"
              >
                <p
                  class="mb-1 text-[11px] font-medium text-neutral-500 dark:text-neutral-400"
                  :class="isFromCustomer(act) ? '' : 'text-right'"
                >
                  {{ senderLabel(act) }}
                </p>
                <div
                  class="rounded-2xl px-3.5 py-2.5 text-sm shadow-sm"
                  :class="isFromCustomer(act)
                    ? 'rounded-tl-md border border-neutral-200 bg-white text-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100'
                    : 'rounded-tr-md bg-[var(--portal-brand-primary,#3a1f8a)] text-white'"
                >
                  <p class="whitespace-pre-wrap break-words text-left">{{ act.message || '—' }}</p>
                </div>
                <p
                  class="mt-1 text-[10px] text-neutral-400 dark:text-neutral-500"
                  :class="isFromCustomer(act) ? '' : 'text-right'"
                >
                  {{ formatTime(act.createdAt) }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChatBubbleLeftRightIcon } from '@heroicons/vue/24/outline';
import { useAuthStore } from '@/stores/authRegistry';
import {
  formatPortalDayLabel,
  formatPortalMessageTime,
  groupPortalActivitiesByDay,
  isPortalActivityFromCustomer,
  portalActivityInitials
} from '@/utils/portalCaseUtils';
import {
  PLATFORM_HOME_CARD_CLASS,
  PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS
} from '@/utils/platformHomeLayout';

const props = defineProps({
  activities: { type: Array, default: () => [] },
  flexFill: { type: Boolean, default: false }
});

const { t } = useI18n();
const authStore = useAuthStore();
const scrollEl = ref(null);

const groupedActivities = computed(() => groupPortalActivitiesByDay(props.activities));

function formatDayLabel(date) {
  return formatPortalDayLabel(date, t);
}

function formatTime(value) {
  return formatPortalMessageTime(value);
}

function isFromCustomer(act) {
  return isPortalActivityFromCustomer(act, authStore.user?.email);
}

function activityInitials(act) {
  return portalActivityInitials(act, authStore.user);
}

function senderLabel(act) {
  if (isFromCustomer(act)) {
    return authStore.user?.firstName
      ? [authStore.user.firstName, authStore.user.lastName].filter(Boolean).join(' ')
      : t('cases.portalCasesYou');
  }
  return act.actorName || t('cases.portalCasesSupport');
}

async function scrollToBottom() {
  await nextTick();
  const el = scrollEl.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

watch(
  () => props.activities.length,
  () => {
    void scrollToBottom();
  },
  { immediate: true }
);

defineExpose({ scrollToBottom });
</script>
