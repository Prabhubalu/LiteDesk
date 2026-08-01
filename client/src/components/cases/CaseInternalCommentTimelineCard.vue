<template>
  <div
    class="overflow-hidden rounded-lg border border-amber-200/90 bg-amber-50/70 shadow-sm dark:border-amber-800/60 dark:bg-amber-950/25"
  >
    <div class="flex items-start gap-3 px-4 py-3">
      <Avatar :user="author" size="sm" class="mt-0.5 shrink-0" />
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span class="text-sm font-semibold text-gray-900 dark:text-white">
            {{ authorLabel }}
          </span>
          <span
            v-if="createdAt"
            class="text-xs text-gray-500 dark:text-gray-400"
            :title="fullTimestamp"
          >
            {{ timelineStamp }}
          </span>
          <span
            class="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-900/50 dark:text-amber-100"
          >
            {{ t('cases.recordInternalComment') }}
          </span>
        </div>
        <div class="mt-2 text-sm leading-relaxed text-gray-800 dark:text-gray-100">
          <CommentContent :content="activity?.message || ''" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import Avatar from '@/components/common/Avatar.vue';
import CommentContent from '@/components/record-page/CommentContent.vue';
import { enrichPersonForAvatar } from '@/utils/caseTimeline';
import { formatCaseEmailTimelineStamp } from '@/utils/caseEmailConversation';
import { formatUserDateTime } from '@/utils/localeFormat';

const props = defineProps({
  activity: { type: Object, required: true },
  createdAt: { type: String, default: '' }
});

const { t } = useI18n();

const author = computed(() => {
  const name = String(props.activity?.actorName || '').trim();
  if (!name) return enrichPersonForAvatar({});
  return enrichPersonForAvatar({ name });
});

const authorLabel = computed(() => {
  const name = String(props.activity?.actorName || '').trim();
  return name || t('cases.recordSupport');
});

const timelineStamp = computed(() =>
  formatCaseEmailTimelineStamp(props.createdAt || props.activity?.createdAt, t)
);

const fullTimestamp = computed(() => {
  const raw = props.createdAt || props.activity?.createdAt;
  if (!raw) return '';
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? '' : formatUserDateTime(d);
});
</script>
