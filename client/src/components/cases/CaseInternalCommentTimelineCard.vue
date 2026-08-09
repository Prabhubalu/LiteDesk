<template>
  <div
    class="w-full overflow-hidden rounded-md border border-amber-300/80 bg-[#FFF9C4] shadow-[2px_2px_0_rgba(217,119,6,0.18)] dark:border-amber-700/70 dark:bg-amber-950/40 dark:shadow-none"
  >
    <div class="flex items-start gap-3 px-4 py-3">
      <Avatar :user="author" size="sm" class="mt-0.5 shrink-0" />
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span class="text-sm font-semibold text-amber-950 dark:text-amber-50">
            {{ authorLabel }}
          </span>
          <span
            v-if="createdAt"
            class="text-xs text-amber-800/70 dark:text-amber-200/70"
            :title="fullTimestamp"
          >
            {{ timelineStamp }}
          </span>
          <span
            class="inline-flex items-center rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-400/15 dark:text-amber-100"
          >
            {{ t('cases.recordInternalComment') }}
          </span>
        </div>
        <div class="mt-2 text-sm leading-relaxed text-amber-950 dark:text-amber-50">
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
