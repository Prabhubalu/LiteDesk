<template>
  <div class="flex items-center gap-2 border-t border-gray-200 px-4 py-2 dark:border-gray-700">
    <div class="flex flex-wrap items-center gap-1.5">
      <template v-if="ui.hasCommentReactions(event)">
        <button
          v-for="reaction in ui.getCommentReactions(event)"
          :key="`${event.id || event.createdAt}-${reaction.emoji}`"
          type="button"
          :class="[
            'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[1rem] leading-none transition-colors',
            ui.isCommentReactionSelected(event, reaction.emoji)
              ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-200'
              : 'border-blue-500 text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-300 dark:hover:bg-blue-900/20'
          ]"
          :aria-label="`${reaction.emoji} ${reaction.count} reactions`"
          @click="ui.handleHideCommentReactionTooltip?.(); ui.toggleCommentReaction(event, reaction.emoji)"
          @mouseenter="ui.handleShowCommentReactionTooltip($event, reaction)"
          @mouseleave="ui.handleHideCommentReactionTooltip"
        >
          <span aria-hidden="true">{{ reaction.emoji }}</span>
          <span class="text-xs font-normal leading-none">{{ reaction.count }}</span>
        </button>
        <button
          v-if="!ui.isCommentReactionSelected(event, '👍')"
          type="button"
          class="inline-flex h-[1.875rem] w-[1.875rem] items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          :aria-label="t('records.reactionBarLikeComment2')"
          @click="ui.toggleCommentReaction(event, '👍')"
        >
          <HandThumbUpIcon class="w-4 h-4" />
        </button>
        <button
          type="button"
          class="inline-flex h-[1.875rem] w-[1.875rem] items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          :aria-label="t('records.reactionBarReactToComment2')"
          :ref="(el) => ui.setCommentReactionButtonRef(event, el)"
          @click="ui.toggleCommentReactionPicker(event)"
        >
          <FaceSmileIcon class="w-4 h-4" />
        </button>
      </template>
      <template v-else>
        <button
          type="button"
          class="inline-flex h-[1.875rem] w-[1.875rem] items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          :aria-label="t('records.reactionBarLikeComment')"
          @click="ui.toggleCommentReaction(event, '👍')"
        >
          <HandThumbUpIcon class="w-4 h-4" />
        </button>
        <button
          type="button"
          class="inline-flex h-[1.875rem] w-[1.875rem] items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          :aria-label="t('records.reactionBarReactToComment')"
          :ref="(el) => ui.setCommentReactionButtonRef(event, el)"
          @click="ui.toggleCommentReactionPicker(event)"
        >
          <FaceSmileIcon class="w-4 h-4" />
        </button>
      </template>
    </div>
    <button
      v-if="!isThreadViewActive"
      type="button"
      class="ml-auto inline-flex items-center gap-2 text-[13px] font-normal text-gray-400 transition-colors hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
      @click="ui.openCommentThread(event)"
    >
      <span>
        {{ ui.getCommentThreadReplyCount(event) > 0
          ? `${ui.getCommentThreadReplyCount(event)} ${ui.getCommentThreadReplyCount(event) === 1 ? 'reply' : 'replies'}`
          : 'Reply' }}
      </span>
      <template v-if="ui.getCommentThreadReplyCount(event) > 0 && ui.getCommentThreadLatestReplyAuthor(event)">
        <Avatar
          v-if="typeof ui.getCommentThreadLatestReplyAuthor(event) === 'object'"
          :user="ui.getCommentThreadLatestReplyAuthor(event)"
          size="sm"
        />
        <div v-else class="h-6 w-6 rounded-full bg-gray-500 flex items-center justify-center text-white text-[10px] font-semibold">
          {{ ui.getInitials(ui.getCommentThreadLatestReplyAuthor(event)) }}
        </div>
      </template>
    </button>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { HandThumbUpIcon, FaceSmileIcon } from '@heroicons/vue/24/outline';
import Avatar from '@/components/common/Avatar.vue';

defineProps({
  event: { type: Object, required: true },
  ui: { type: Object, required: true },
  isThreadViewActive: { type: Boolean, default: false }
});

const { t } = useI18n();
</script>
