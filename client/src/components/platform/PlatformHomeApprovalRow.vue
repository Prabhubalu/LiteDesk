<template>
  <div
    class="group flex w-full items-center gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
  >
    <button
      type="button"
      class="flex min-w-0 flex-1 items-center gap-3 text-left"
      @click="$emit('select', item)"
    >
      <span
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300"
      >
        <ClipboardDocumentCheckIcon class="h-4 w-4" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block truncate text-sm font-medium text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
          {{ item.title }}
        </span>
        <span
          v-if="item.subtitle || relativeTime"
          class="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400"
        >
          <span v-if="item.subtitle" class="truncate">{{ item.subtitle }}</span>
          <span v-if="item.subtitle && relativeTime" aria-hidden="true">·</span>
          <span v-if="relativeTime" class="shrink-0">{{ relativeTime }}</span>
        </span>
      </span>
    </button>

    <div class="flex shrink-0 items-center gap-1" @click.stop>
      <button
        type="button"
        class="inline-flex items-center rounded-lg bg-success-600 px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-success-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-success-700 dark:hover:bg-success-600"
        :disabled="Boolean(processingId)"
        @click="$emit('approve', item)"
      >
        {{ isApproving ? t('platform.platformHomeApprovalProcessing') : t('forms.hubActionApprove') }}
      </button>
      <button
        type="button"
        class="inline-flex items-center rounded-lg border border-neutral-200/80 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-neutral-900/50 dark:text-neutral-200 dark:hover:bg-neutral-800"
        :disabled="Boolean(processingId)"
        @click="$emit('reject', item)"
      >
        {{ isRejecting ? t('platform.platformHomeApprovalProcessing') : t('forms.hubActionReject') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ClipboardDocumentCheckIcon } from '@heroicons/vue/24/outline';
import { formatRelativeTime } from '@/utils/relativeTime';

const props = defineProps({
  item: {
    type: Object,
    required: true
  },
  processingId: {
    type: String,
    default: null
  },
  processingAction: {
    type: String,
    default: null
  }
});

defineEmits(['select', 'approve', 'reject']);

const { t } = useI18n();

const relativeTime = computed(() =>
  props.item.updatedAt ? formatRelativeTime(props.item.updatedAt, t) : ''
);

const isApproving = computed(() =>
  props.processingId === props.item.id && props.processingAction === 'approve'
);

const isRejecting = computed(() =>
  props.processingId === props.item.id && props.processingAction === 'reject'
);
</script>
