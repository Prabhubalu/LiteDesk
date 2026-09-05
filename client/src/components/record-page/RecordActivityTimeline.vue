<template>
  <!-- Conversation style: [Older] ... [Newest] ───── [Composer] -->
  <section :class="['record-activity-timeline', 'flex', 'flex-col', { 'flex-1': expandToFill, 'min-h-0': expandToFill }]" aria-labelledby="record-activity-heading">
    <h2 id="record-activity-heading" class="sr-only">{{ t('records.activityHeadingSr') }}</h2>
    
    <!-- Activity feed – scrollable; inner wrapper anchors content at bottom when short -->
    <div
      ref="feedEl"
      :class="['record-activity-timeline__feed', 'overflow-y-auto', { 'flex-1': expandToFill, 'min-h-0': expandToFill, 'is-scrolling': isScrolling }]"
      @scroll="onScroll"
      @wheel="onWheel"
    >
      <div class="record-activity-timeline__feed-inner min-h-full flex flex-col justify-end">
      <ul class="space-y-0 list-none p-0 m-0 flex-shrink-0">
        <li
          v-for="(event, index) in events"
          :key="event.id ?? index"
          :class="[
            'record-activity-timeline__item px-4 last:border-b-0',
            itemPaddingClass,
            showItemBorders ? 'border-b border-gray-100 dark:border-gray-800' : 'border-b-0'
          ]"
        >
          <slot name="event" :event="event" :index="index">
            <!-- Default event rendering -->
            <div v-if="event.type === 'system'" class="text-sm text-gray-600 dark:text-gray-400">
              <span>{{ event.message || t('records.activitySystemWithAction', { action: event.action || t('records.activityUpdated') }) }}</span>
              <span v-if="event.createdAt" class="ml-2 text-xs text-gray-400 dark:text-gray-500">
                {{ formatDate(event.createdAt) }}
              </span>
            </div>
            
            <!-- Comment rendering -->
            <div v-else-if="event.type === 'comment'" class="flex gap-3">
              <div class="flex-shrink-0">
                <slot name="avatar" :event="event">
                  <div class="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-medium">
                    {{ getInitials(event.author) }}
                  </div>
                </slot>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-baseline gap-2 mb-1">
                  <span class="text-sm font-medium text-gray-900 dark:text-white">{{ getAuthorName(event.author) }}</span>
                  <span v-if="event.createdAt" class="text-xs text-gray-500 dark:text-gray-400">
                    {{ formatDate(event.createdAt) }}
                  </span>
                </div>
                <div class="text-sm text-gray-700 dark:text-gray-300 mb-2">
                  {{ event.content || event.text }}
                </div>
                
                <!-- Attachments -->
                <div v-if="event.attachments && event.attachments.length > 0" class="mt-2 space-y-1">
                  <a
                    v-for="(attachment, idx) in event.attachments"
                    :key="idx"
                    href="#"
                    class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                  >
                    <PaperClipIcon class="w-4 h-4" />
                    <span>{{ attachment.name || attachment.filename }}</span>
                    <span v-if="attachment.size" class="text-xs text-gray-400 dark:text-gray-500">
                      ({{ formatFileSize(attachment.size) }})
                    </span>
                  </a>
                </div>
                
                <!-- Interaction buttons -->
                <div v-if="allowInteractions" class="flex items-center gap-4 mt-3">
                  <button
                    type="button"
                    class="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none"
                  >
                    <HandThumbUpIcon class="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    class="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none"
                  >
                    <HandThumbDownIcon class="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none"
                  >
                    {{ t('records.activityReply') }}
                  </button>
                </div>
              </div>
            </div>
          </slot>
        </li>
      </ul>
      
      <div v-if="events.length === 0" class="flex-shrink-0 px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">
        <slot name="empty">{{ t('records.activityEmpty') }}</slot>
      </div>
      </div>
    </div>
    
    <!-- Composer – fixed at bottom (conversation style) -->
    <div v-if="allowComments" class="record-activity-timeline__input flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
      <slot name="commentInput" :submit="handleSubmitComment">
        <textarea
          v-model="commentText"
          :placeholder="t('records.activityCommentPh')"
          rows="3"
          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent resize-none"
        />
        <div class="flex items-center justify-between mt-2">
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
              :title="t('records.activityAddAttachment')"
            >
              <PaperClipIcon class="w-5 h-5" />
            </button>
            <button
              type="button"
              class="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
              :title="t('records.activityMention')"
            >
              <span class="text-sm font-medium">@</span>
            </button>
            <button
              type="button"
              class="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
              :title="t('records.activityEmoji')"
            >
              <span class="text-sm">😊</span>
            </button>
          </div>
          <button
            type="button"
            @click="handleSubmitComment"
            :disabled="!commentText.trim()"
            class="px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
          >
            {{ t('records.activityCommentBtn') }}
          </button>
        </div>
      </slot>
    </div>
  </section>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { PaperClipIcon, HandThumbUpIcon, HandThumbDownIcon } from '@heroicons/vue/24/outline';
import { formatUserDate } from '@/utils/localeFormat';

const { t } = useI18n();

const feedEl = ref(null);

function scrollToBottom(options = {}) {
  const el = feedEl.value;
  if (!el) return;
  const behavior = options.behavior || 'auto';
  // Keep scroll inside the feed only — scrollIntoView can shift ancestor layout/CSS.
  el.scrollTo({ top: el.scrollHeight, behavior });
}

defineExpose({ feedEl, scrollToBottom });

const isScrolling = ref(false);
let scrollHideTimer = null;
const SCROLL_HIDE_DELAY = 800;

function showScrollbar() {
  isScrolling.value = true;
  if (scrollHideTimer) clearTimeout(scrollHideTimer);
  scrollHideTimer = setTimeout(() => {
    isScrolling.value = false;
    scrollHideTimer = null;
  }, SCROLL_HIDE_DELAY);
}

function onScroll() {
  showScrollbar();
}

function onWheel() {
  showScrollbar();
}

let resizeObserver = null;
let lastHeight = 0;

onMounted(() => {
  const el = feedEl.value;
  if (!el) return;
  el.addEventListener('touchstart', showScrollbar, { passive: true });
  if (props.scrollToBottomOnLayout) {
    resizeObserver = new ResizeObserver(() => {
      if (!props.events?.length) return;
      const h = el.offsetHeight;
      const shouldScroll = h > 0 && (lastHeight === 0 || el.scrollTop < 50);
      if (h > 0) lastHeight = h;
      else lastHeight = 0;
      if (shouldScroll) scrollToBottom();
    });
    resizeObserver.observe(el);
  }
});

onUnmounted(() => {
  if (scrollHideTimer) clearTimeout(scrollHideTimer);
  resizeObserver?.disconnect();
  resizeObserver = null;
  lastHeight = 0;
  const el = feedEl.value;
  if (el) el.removeEventListener('touchstart', showScrollbar);
});

/**
 * RecordActivityTimeline – universal activity and history stream.
 * Chronological list with comment support, attachments, and interactions.
 * Includes comment input field at bottom.
 */
const props = defineProps({
  events: {
    type: Array,
    default: () => []
  },
  allowComments: { type: Boolean, default: true },
  allowAttachments: { type: Boolean, default: true },
  allowInteractions: { type: Boolean, default: true },
  expandToFill: { type: Boolean, default: true },
  showItemBorders: { type: Boolean, default: true },
  itemPaddingClass: { type: String, default: 'py-4' },
  /** When true, scrolls to bottom when feed is laid out (e.g. after keep-alive reactivation) */
  scrollToBottomOnLayout: { type: Boolean, default: false }
});

const emit = defineEmits(['comment', 'like', 'dislike', 'reply']);

const commentText = ref('');

const getEventKey = (event) => String(
  event?.id
  ?? event?._id
  ?? event?.payload?.commentId
  ?? `${event?.type || ''}:${event?.createdAt || ''}`
);

watch(() => props.events, async (events, previousEvents = []) => {
  const current = Array.isArray(events) ? events : [];
  const previous = Array.isArray(previousEvents) ? previousEvents : [];
  if (current.length <= previous.length) return;

  const newestEvent = current[current.length - 1];
  if (newestEvent?.type !== 'comment') return;

  const newestKey = getEventKey(newestEvent);
  if (previous.some((event) => getEventKey(event) === newestKey)) return;

  await nextTick();
  requestAnimationFrame(() => scrollToBottom({ behavior: 'smooth' }));
});

const handleSubmitComment = (payload) => {
  const content = typeof payload === 'string'
    ? payload.trim()
    : (payload?.content ?? commentText.value).trim();
  const files = typeof payload === 'object' && Array.isArray(payload?.files) ? payload.files : [];
  if (content || files.length > 0) {
    emit('comment', { content, files });
    commentText.value = '';
  }
};

const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return formatUserDate(d);
};

const formatFileSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const getInitials = (author) => {
  if (!author) return '?';
  if (typeof author === 'string') return author.substring(0, 2).toUpperCase();
  const firstName = author.firstName || author.first_name || '';
  const lastName = author.lastName || author.last_name || '';
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName[0].toUpperCase();
  if (author.email) return author.email[0].toUpperCase();
  return '?';
};

const getAuthorName = (author) => {
  if (!author) return 'Unknown';
  if (typeof author === 'string') return author;
  const firstName = author.firstName || author.first_name || '';
  const lastName = author.lastName || author.last_name || '';
  if (firstName && lastName) return `${firstName} ${lastName}`;
  if (firstName) return firstName;
  if (author.username) return author.username;
  if (author.email) return author.email;
  return 'Unknown';
};
</script>

<style scoped>
/* Conversation style: feed scrolls, newest at bottom; composer fixed below */
.record-activity-timeline__feed {
  scrollbar-color: transparent transparent;
  scrollbar-width: thin;
  overflow-anchor: auto;
}
.record-activity-timeline__feed.is-scrolling {
  scrollbar-color: rgba(0, 0, 0, 0.25) transparent;
}
.record-activity-timeline__feed.is-scrolling::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.25);
}
.record-activity-timeline__feed::-webkit-scrollbar {
  width: 6px;
}
.record-activity-timeline__feed::-webkit-scrollbar-track {
  background: transparent;
}
.record-activity-timeline__feed::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
}
/* Dark mode (when ancestor has .dark) */
.dark .record-activity-timeline__feed.is-scrolling {
  scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
}
.dark .record-activity-timeline__feed.is-scrolling::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.25);
}
</style>
