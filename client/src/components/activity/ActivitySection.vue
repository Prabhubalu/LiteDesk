<template>
  <div class="flex flex-col h-full min-h-0 overflow-hidden">
    <div class="sticky top-0 z-[1] flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-900">
      <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ resolvedTitle }}</h2>
      <div class="flex items-center gap-2">
        <button
          v-if="!activitySearchOpen"
          type="button"
          class="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          :aria-label="t('actions.search')"
          :title="t('actions.search')"
          @click="openSearch"
        >
          <MagnifyingGlassIcon class="w-5 h-5" />
        </button>
        <button
          v-else
          type="button"
          class="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          :aria-label="t('records.activityCloseSearchAria')"
          :title="t('actions.close')"
          @click="closeSearch"
        >
          <XMarkIcon class="w-5 h-5" />
        </button>
        <button
          v-if="showNotifications"
          type="button"
          class="relative p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          :aria-label="t('records.activityNotificationsAria')"
          :title="t('records.activityNotificationsAria')"
        >
          <BellIcon class="w-5 h-5" />
          <span
            v-if="notificationCount > 0"
            class="absolute top-0 right-0 flex items-center justify-center w-4 h-4 text-xs font-medium text-white bg-red-500 rounded-full"
          >
            {{ notificationCount > 9 ? '9+' : notificationCount }}
          </span>
        </button>
        <Menu as="div" class="relative">
          <MenuButton
            type="button"
            class="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            :aria-label="t('records.activityFilterAria')"
            :title="t('records.activityFilterAria')"
          >
            <FunnelIcon class="w-5 h-5" />
          </MenuButton>
          <transition
            enter-active-class="transition duration-100 ease-out"
            enter-from-class="transform scale-95 opacity-0"
            enter-to-class="transform scale-100 opacity-100"
            leave-active-class="transition duration-75 ease-in"
            leave-from-class="transform scale-100 opacity-100"
            leave-to-class="transform scale-95 opacity-0"
          >
            <MenuItems class="absolute right-0 mt-1 w-56 origin-top-right rounded-lg bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black/5 focus:outline-none z-20 py-1">
              <div class="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('records.activityFilterHeading') }}</span>
                  <button
                    v-if="activityFilterComments && activityFilterUpdates && activityFilterEmail && activityFilterDoneThreads && activityFilterAssignedToMe && activityFilterTagged && activityFilterUntagged"
                    type="button"
                    class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    @click="setBothFilters(false)"
                  >
                    {{ t('records.activityUnselectAll') }}
                  </button>
                  <button
                    v-else
                    type="button"
                    class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    @click="setBothFilters(true)"
                  >
                    {{ t('records.activitySelectAll') }}
                  </button>
                </div>
              </div>
              <MenuItem v-slot="{ active }">
                <button
                  type="button"
                  :class="[active ? 'bg-gray-50 dark:bg-gray-700/50' : '', 'flex w-full items-center gap-3 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300']"
                  @click="toggleCommentsFilter"
                >
                  <span>{{ t('records.activityFilterComments') }}</span>
                  <CheckIcon v-if="activityFilterComments" class="w-5 h-5 text-indigo-600 dark:text-indigo-400 ml-auto flex-shrink-0" />
                </button>
              </MenuItem>
              <MenuItem v-slot="{ active }">
                <button
                  type="button"
                  :class="[active ? 'bg-gray-50 dark:bg-gray-700/50' : '', 'flex w-full items-center gap-3 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300']"
                  @click="toggleEmailFilter"
                >
                  <span>{{ t('records.activityFilterEmail') }}</span>
                  <CheckIcon v-if="activityFilterEmail" class="w-5 h-5 text-indigo-600 dark:text-indigo-400 ml-auto flex-shrink-0" />
                </button>
              </MenuItem>
              <MenuItem v-slot="{ active }">
                <button
                  type="button"
                  :class="[active ? 'bg-gray-50 dark:bg-gray-700/50' : '', 'flex w-full items-center gap-3 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300']"
                  @click="toggleUpdatesFilter"
                >
                  <span>{{ t('records.activityFilterUpdates') }}</span>
                  <CheckIcon v-if="activityFilterUpdates" class="w-5 h-5 text-indigo-600 dark:text-indigo-400 ml-auto flex-shrink-0" />
                </button>
              </MenuItem>
              <MenuItem v-slot="{ active }">
                <button
                  type="button"
                  :class="[active ? 'bg-gray-50 dark:bg-gray-700/50' : '', 'flex w-full items-center gap-3 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300']"
                  @click="toggleDoneThreadsFilter"
                >
                  <span>{{ t('records.activityFilterDoneThreads') }}</span>
                  <CheckIcon v-if="activityFilterDoneThreads" class="w-5 h-5 text-indigo-600 dark:text-indigo-400 ml-auto flex-shrink-0" />
                </button>
              </MenuItem>
              <MenuItem v-slot="{ active }">
                <button
                  type="button"
                  :class="[active ? 'bg-gray-50 dark:bg-gray-700/50' : '', 'flex w-full items-center gap-3 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300']"
                  @click="toggleAssignedToMeFilter"
                >
                  <span>{{ t('records.activityFilterAssignedToMe') }}</span>
                  <CheckIcon v-if="activityFilterAssignedToMe" class="w-5 h-5 text-indigo-600 dark:text-indigo-400 ml-auto flex-shrink-0" />
                </button>
              </MenuItem>
              <MenuItem v-slot="{ active }">
                <button
                  type="button"
                  :class="[active ? 'bg-gray-50 dark:bg-gray-700/50' : '', 'flex w-full items-center gap-3 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300']"
                  @click="toggleTaggedFilter"
                >
                  <span>{{ t('records.activityFilterTaggedThreads') }}</span>
                  <CheckIcon v-if="activityFilterTagged" class="w-5 h-5 text-indigo-600 dark:text-indigo-400 ml-auto flex-shrink-0" />
                </button>
              </MenuItem>
              <MenuItem v-slot="{ active }">
                <button
                  type="button"
                  :class="[active ? 'bg-gray-50 dark:bg-gray-700/50' : '', 'flex w-full items-center gap-3 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300']"
                  @click="toggleUntaggedFilter"
                >
                  <span>{{ t('records.activityFilterUntaggedThreads') }}</span>
                  <CheckIcon v-if="activityFilterUntagged" class="w-5 h-5 text-indigo-600 dark:text-indigo-400 ml-auto flex-shrink-0" />
                </button>
              </MenuItem>
            </MenuItems>
          </transition>
        </Menu>
      </div>
    </div>

    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div v-if="activitySearchOpen" class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div class="flex items-center gap-2 border-2 border-indigo-500 dark:border-indigo-400 rounded-lg px-3 py-2 bg-white dark:bg-gray-800">
          <MagnifyingGlassIcon class="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
          <input
            ref="activitySearchInputRef"
            :value="activitySearchQuery"
            @input="updateSearchQuery($event.target.value)"
            @keydown.esc="closeSearch"
            @keydown.enter.prevent
            :placeholder="t('records.activitySearchPh')"
            class="flex-1 text-sm outline-none bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
          />
          <button
            v-if="activitySearchQuery"
            type="button"
            @click="clearSearch"
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
            :aria-label="t('records.activityClearSearchAria')"
            :title="t('records.activityClearSearchTitle')"
          >
            <XMarkIcon class="w-5 h-5" />
          </button>
        </div>
      </div>
    </transition>

    <div
      v-if="isThreadViewActive && activeThreadRootComment"
      class="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900"
    >
      <button
        type="button"
        class="inline-flex items-center gap-1.5 text-[13px] font-medium text-gray-600 transition-colors hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100"
        @click="$emit('close-thread')"
      >
        <ArrowLeftIcon class="h-4 w-4" />
        <span>{{ t('actions.back') }}</span>
      </button>
      <div class="ml-auto flex items-center gap-1.5 min-w-0 text-sm font-semibold text-gray-900 dark:text-white">
        <span class="font-medium text-gray-700 dark:text-gray-300">{{ t('records.activityThreadBy') }}</span>
        <Avatar
          v-if="activeThreadRootComment.author && typeof activeThreadRootComment.author === 'object'"
          :user="activeThreadRootComment.author"
          size="sm"
        />
        <div v-else class="h-6 w-6 rounded-full bg-gray-500 flex items-center justify-center text-white text-[10px] font-semibold">
          {{ ui.getInitials(activeThreadRootComment.author) }}
        </div>
        <span class="truncate">{{ ui.getAuthorName(activeThreadRootComment.author) }}</span>
      </div>
    </div>

    <div
      class="flex-1 min-h-0 flex flex-col transition-opacity duration-200 ease-out"
      :style="(activityPaneReady || (!activityFilterComments && !activityFilterUpdates && !activityFilterEmail && !activityFilterDoneThreads && !activityFilterAssignedToMe && !activityFilterTagged && !activityFilterUntagged)) ? undefined : { opacity: 0, visibility: 'hidden', pointerEvents: 'none' }"
    >
      <div
        v-if="!isThreadViewActive && !activityFilterComments && !activityFilterUpdates && !activityFilterEmail && !activityFilterDoneThreads && !activityFilterAssignedToMe && !activityFilterTagged && !activityFilterUntagged"
        class="flex-1 min-h-0 flex flex-col items-center justify-center p-8 text-center"
      >
        <div class="relative w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
          <FunnelIcon class="w-8 h-8 text-gray-400 dark:text-gray-500" />
          <span class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span class="block w-[140%] h-0.5 bg-gray-400 dark:bg-gray-500 origin-center rotate-45" aria-hidden="true" />
          </span>
        </div>
        <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-1">{{ t('records.activityNothingFound') }}</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">{{ t('records.activitySelectOneFilter') }}</p>
        <button
          type="button"
          class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
          @click="setBothFilters(true)"
        >
          {{ t('records.activityResetFilters') }}
        </button>
      </div>

      <RecordActivityTimeline
        v-else
        ref="timelineRef"
        :events="filteredEvents"
        :scroll-to-bottom-on-layout="true"
        :allow-comments="true"
        :allow-attachments="true"
        :allow-interactions="true"
        :expand-to-fill="true"
        :show-item-borders="false"
        item-padding-class="py-1.5"
        class="[&_ul]:py-1"
        @comment="$emit('comment', $event)"
      >
        <template #commentInput="{ submit }">
          <CommentInput
            ref="commentInputRef"
            :model-value="newCommentText"
            @update:model-value="$emit('update:newCommentText', $event)"
            :show-submit="true"
            variant="activity"
            :placeholder="commentComposerPlaceholder"
            @submit="submit"
          />
        </template>

        <template #event="{ event, index }">
          <div v-if="isThreadViewActive && index === 1 && threadReplyCount > 0">
            <ThreadReplies :count="threadReplyCount" />
            <ActivityEventRenderer
              :event="event"
              :index="index"
              :ui="ui"
              :search-query="activitySearchQuery"
              :is-thread-view-active="isThreadViewActive"
            />
          </div>
          <ActivityEventRenderer
            v-else
            :event="event"
            :index="index"
            :ui="ui"
            :search-query="activitySearchQuery"
            :is-thread-view-active="isThreadViewActive"
          />
        </template>
      </RecordActivityTimeline>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  BellIcon,
  FunnelIcon,
  CheckIcon,
  ArrowLeftIcon
} from '@heroicons/vue/24/outline';
import Avatar from '@/components/common/Avatar.vue';
import { RecordActivityTimeline } from '@/components/record-page';
import CommentInput from '@/components/record-page/CommentInput.vue';
import ActivityEventRenderer from './ActivityEventRenderer.vue';
import ThreadReplies from './controls/ThreadReplies.vue';

const { t } = useI18n();

const props = defineProps({
  title: { type: String, default: undefined },
  events: { type: Array, default: () => [] },
  ui: { type: Object, required: true },
  isThreadViewActive: { type: Boolean, default: false },
  activeThreadRootComment: { type: Object, default: null },
  threadReplyCount: { type: Number, default: 0 },
  activityPaneReady: { type: Boolean, default: true },
  activitySearchOpen: { type: Boolean, default: false },
  activitySearchQuery: { type: String, default: '' },
  activityFilterComments: { type: Boolean, default: true },
  activityFilterUpdates: { type: Boolean, default: true },
  activityFilterEmail: { type: Boolean, default: true },
  activityFilterDoneThreads: { type: Boolean, default: false },
  activityFilterAssignedToMe: { type: Boolean, default: false },
  activityFilterTagged: { type: Boolean, default: false },
  activityFilterUntagged: { type: Boolean, default: false },
  newCommentText: { type: String, default: '' },
  notificationCount: { type: Number, default: 0 },
  showNotifications: { type: Boolean, default: false },
  onTimelineRef: { type: Function, default: null }
});

const emit = defineEmits([
  'comment',
  'close-thread',
  'update:activitySearchOpen',
  'update:activitySearchQuery',
  'update:activityFilterComments',
  'update:activityFilterUpdates',
  'update:activityFilterEmail',
  'update:activityFilterDoneThreads',
  'update:activityFilterAssignedToMe',
  'update:activityFilterTagged',
  'update:activityFilterUntagged',
  'update:newCommentText'
]);

const resolvedTitle = computed(() => props.title ?? t('records.genericTabActivity'));
const commentComposerPlaceholder = computed(() =>
  props.isThreadViewActive ? t('records.activityReplyPh') : t('records.activityCommentPh')
);

const activitySearchInputRef = ref(null);
const timelineRef = ref(null);
const commentInputRef = ref(null);

/** Filter events by type based on Comments / Updates / Email toggles. */
const filteredEvents = computed(() => {
  const list = props.events || [];
  const showComments = props.activityFilterComments;
  const showUpdates = props.activityFilterUpdates;
  const showEmail = props.activityFilterEmail;
  const showDoneThreads = props.activityFilterDoneThreads;
  return list.filter((e) => {
    const type = String(e?.type || '').trim();
    if (type === 'comment') return showComments;
    if (type === 'system') return showUpdates;
    if (type === 'email_thread') {
      if (!showEmail) return false;
      if (showDoneThreads) return true;
      if (e?.thread?.done === true) return false;
      const thread = e?.thread || {};
      const currentUserId = props.ui?.currentUser?._id || props.ui?.currentUser?.id || null;
      if (props.activityFilterAssignedToMe) {
        if (!currentUserId || String(thread.assignedToUserId || '') !== String(currentUserId)) return false;
      }
      const hasTags = Array.isArray(thread.tags) && thread.tags.length > 0;
      if (props.activityFilterTagged && !hasTags) return false;
      if (props.activityFilterUntagged && hasTags) return false;
      return true;
    }
    return false;
  });
});

watch(timelineRef, (value) => {
  if (props.onTimelineRef) props.onTimelineRef(value);
}, { immediate: true });

const openSearch = () => {
  emit('update:activitySearchOpen', true);
  nextTick(() => activitySearchInputRef.value?.focus?.());
};

const closeSearch = () => {
  emit('update:activitySearchQuery', '');
  emit('update:activitySearchOpen', false);
};

const updateSearchQuery = (value) => {
  emit('update:activitySearchQuery', value);
};

const clearSearch = () => {
  emit('update:activitySearchQuery', '');
  nextTick(() => activitySearchInputRef.value?.focus?.());
};

const toggleCommentsFilter = () => {
  emit('update:activityFilterComments', !props.activityFilterComments);
};

const toggleUpdatesFilter = () => {
  emit('update:activityFilterUpdates', !props.activityFilterUpdates);
};

const toggleEmailFilter = () => {
  emit('update:activityFilterEmail', !props.activityFilterEmail);
};

const toggleDoneThreadsFilter = () => {
  emit('update:activityFilterDoneThreads', !props.activityFilterDoneThreads);
};

const toggleAssignedToMeFilter = () => {
  emit('update:activityFilterAssignedToMe', !props.activityFilterAssignedToMe);
};

const toggleTaggedFilter = () => {
  emit('update:activityFilterTagged', !props.activityFilterTagged);
};

const toggleUntaggedFilter = () => {
  emit('update:activityFilterUntagged', !props.activityFilterUntagged);
};

const setBothFilters = (value) => {
  emit('update:activityFilterComments', value);
  emit('update:activityFilterUpdates', value);
  emit('update:activityFilterEmail', value);
  emit('update:activityFilterDoneThreads', value);
  emit('update:activityFilterAssignedToMe', value);
  emit('update:activityFilterTagged', value);
  emit('update:activityFilterUntagged', value);
};

const focusCommentInput = () => {
  nextTick(() => {
    commentInputRef.value?.focus?.();
  });
};

defineExpose({
  focusCommentInput,
  scrollToBottom: (options) => timelineRef.value?.scrollToBottom?.(options)
});
</script>
