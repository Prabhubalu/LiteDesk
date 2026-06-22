<template>
  <div
    class="flex flex-1 flex-col items-center justify-center text-center"
    :class="compact ? 'px-5 py-10' : 'px-8 py-16'"
  >
    <div
      v-if="!compact"
      class="relative mx-auto"
    >
      <div
        class="absolute -inset-4 rounded-full bg-gradient-to-br from-indigo-100/80 via-violet-50/60 to-purple-100/40 blur-2xl dark:from-indigo-950/40 dark:via-violet-950/30 dark:to-purple-950/20"
        aria-hidden="true"
      />
      <img
        src="/assets/illustrations/empty_state.svg"
        :alt="illustrationAlt"
        class="relative mx-auto h-36 w-auto sm:h-44"
      />
    </div>

    <div
      v-else
      class="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 shadow-sm dark:from-indigo-950/60 dark:to-violet-950/40"
    >
      <component
        :is="icon"
        class="h-7 w-7 text-indigo-600 dark:text-indigo-400"
        aria-hidden="true"
      />
    </div>

    <h3
      class="mt-5 text-base font-semibold text-gray-900 dark:text-white"
      :class="compact ? 'max-w-[240px]' : 'max-w-md'"
    >
      {{ title }}
    </h3>
    <p
      class="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400"
      :class="compact ? 'max-w-[260px]' : 'max-w-md'"
    >
      {{ description }}
    </p>

    <button
      v-if="actionLabel"
      type="button"
      class="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
      @click="$emit('action')"
    >
      {{ actionLabel }}
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ChatBubbleLeftRightIcon,
  InboxIcon,
  QueueListIcon,
} from '@heroicons/vue/24/outline';

const props = defineProps({
  variant: {
    type: String,
    default: 'detail',
    validator: (value) => ['list-mine', 'list-all', 'detail'].includes(value),
  },
  compact: { type: Boolean, default: false },
  showBrowseAllAction: { type: Boolean, default: false },
});

defineEmits(['action']);

const { t } = useI18n();

const illustrationAlt = computed(() => t('liveChat.emptyStateIllustrationAlt'));

const icon = computed(() => {
  if (props.variant === 'list-mine') return InboxIcon;
  if (props.variant === 'list-all') return QueueListIcon;
  return ChatBubbleLeftRightIcon;
});

const title = computed(() => {
  if (props.variant === 'list-mine') return t('liveChat.emptyStateListMineTitle');
  if (props.variant === 'list-all') return t('liveChat.emptyStateListAllTitle');
  return t('liveChat.emptyStateDetailTitle');
});

const description = computed(() => {
  if (props.variant === 'list-mine') return t('liveChat.emptyStateListMineDescription');
  if (props.variant === 'list-all') return t('liveChat.emptyStateListAllDescription');
  return t('liveChat.emptyStateDetailDescription');
});

const actionLabel = computed(() => {
  if (props.variant === 'list-mine' && props.showBrowseAllAction) {
    return t('liveChat.emptyStateListMineAction');
  }
  return '';
});
</script>
