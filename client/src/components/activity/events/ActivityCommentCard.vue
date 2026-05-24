<template>
  <div class="w-full">
    <div
      :class="[
        'group/comment overflow-hidden rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900',
        ui.commentMentionsCurrentUser(event) ? 'border-l-2 border-l-indigo-500 dark:border-l-indigo-400' : ''
      ]"
    >
      <div class="flex items-start justify-between gap-2 px-4 pt-3 pb-2">
        <div class="flex items-center gap-3 min-w-0">
          <Avatar
            v-if="event.author && typeof event.author === 'object'"
            :user="event.author"
            size="sm"
          />
          <div v-else class="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center text-white text-xs font-medium">
            {{ ui.getInitials(event.author) }}
          </div>
          <div class="min-w-0 flex items-baseline gap-2 flex-wrap">
            <span class="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {{ ui.getAuthorName(event.author) }}
            </span>
            <span
              v-if="event.createdAt"
              class="text-xs text-gray-500 dark:text-gray-400 cursor-help"
              :title="ui.formatFullTimestamp(event.createdAt)"
              @pointerup="ui.handleTimestampPointerUp($event, event.createdAt)"
            >
              {{ ui.formatRelativeActivityTime(event.createdAt) }}
            </span>
            <span v-if="event.editedAt" class="text-xs text-gray-400 dark:text-gray-500">{{ t('records.activityCommentEdited') }}</span>
          </div>
        </div>
        <div class="ml-2 flex items-center gap-1 opacity-0 group-hover/comment:opacity-100 focus-within:opacity-100 transition-opacity">
          <HoverTooltip
            v-if="ui.canEditComment(event)"
            :content="t('actions.edit')"
            anchor-selector="button"
            class="inline-flex"
          >
            <button
              type="button"
              class="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              :aria-label="t('records.activityEditCommentAria')"
              @click="ui.startEditComment(event)"
            >
              <PencilSquareIcon class="h-4 w-4" />
            </button>
          </HoverTooltip>
          <HoverTooltip
            v-if="!isThreadViewActive"
            :content="t('records.activityReply')"
            anchor-selector="button"
            class="inline-flex"
          >
            <button
              type="button"
              class="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              :aria-label="t('records.activityReplyToCommentAria')"
              @click="ui.openCommentThread(event)"
            >
              <ArrowUturnLeftIcon class="h-4 w-4" />
            </button>
          </HoverTooltip>
        </div>
      </div>

      <div v-if="ui.editingCommentId === event.id" class="px-4 pb-3.5 text-sm leading-[1.55] text-gray-700 dark:text-gray-300 space-y-2">
        <CommentInput
          v-model="editingText"
          v-model:existing-attachments="editingAttachments"
          :show-submit="true"
          :submit-on-enter="true"
          variant="activity"
          :placeholder="t('records.activityEditCommentPh')"
          class="mb-2"
          @files-change="ui.handleEditCommentFilesChange"
          @submit="ui.saveEditComment"
        >
          <template #footerActions="{ canSubmit, submit }">
            <button
              type="button"
              class="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
              @click="ui.cancelEditComment"
            >
              {{ t('actions.cancel') }}
            </button>
            <button
              type="button"
              :disabled="!canSubmit || !ui.isEditingCommentDirty"
              class="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              @click="submit"
            >
              {{ t('actions.save') }}
            </button>
          </template>
        </CommentInput>
      </div>

      <div v-else class="px-4 pb-3.5 text-sm leading-[1.55] text-gray-700 dark:text-gray-300 [&_p]:m-0 [&_p]:leading-[1.55]">
        <div
          v-if="searchQuery.trim()"
          v-html="ui.highlightSearchText(event.content || event.text)"
          class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap"
        ></div>
        <CommentContent v-else :content="event.content || event.text" />

        <AttachmentList :attachments="resolvedAttachments" :ui="ui" />
      </div>

      <ReactionBar
        v-if="ui.editingCommentId !== event.id"
        :event="event"
        :ui="ui"
        :is-thread-view-active="isThreadViewActive"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { PencilSquareIcon, ArrowUturnLeftIcon } from '@heroicons/vue/24/outline';
import Avatar from '@/components/common/Avatar.vue';
import HoverTooltip from '@/components/common/HoverTooltip.vue';
import CommentInput from '@/components/record-page/CommentInput.vue';
import CommentContent from '@/components/record-page/CommentContent.vue';
import ReactionBar from '../controls/ReactionBar.vue';
import AttachmentList from '../controls/AttachmentList.vue';

const { t } = useI18n();

const props = defineProps({
  event: { type: Object, required: true },
  ui: { type: Object, required: true },
  searchQuery: { type: String, default: '' },
  isThreadViewActive: { type: Boolean, default: false }
});

const editingText = computed({
  get: () => props.ui.editingCommentText,
  set: (value) => props.ui.setEditingCommentText(value)
});

const editingAttachments = computed({
  get: () => props.ui.editingCommentAttachments,
  set: (value) => props.ui.setEditingCommentAttachments(value)
});

const resolvedAttachments = computed(() => {
  const candidate = props.event?.attachments ?? props.event?.payload?.attachments ?? props.event?.files;
  if (Array.isArray(candidate)) return candidate;
  if (candidate && typeof candidate === 'object') return [candidate];
  return [];
});
</script>
