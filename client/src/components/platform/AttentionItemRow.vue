<template>
  <div
    v-if="compact"
    class="group relative flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-neutral-50 focus-within:bg-neutral-50 dark:hover:bg-neutral-800/60 dark:focus-within:bg-neutral-800/60"
    :class="showDivider ? 'border-b border-neutral-100 dark:border-white/[0.06]' : ''"
    role="button"
    tabindex="0"
    @click="$emit('select', item)"
    @keydown.enter="$emit('select', item)"
    @keydown.space.prevent="$emit('select', item)"
  >
    <div
      v-if="item.kind === 'task' && item.allowComplete"
      class="flex h-8 w-8 shrink-0 items-center justify-center"
      @click.stop
    >
      <HeadlessCheckbox
        :checked="false"
        :aria-label="`Complete task: ${item.title}`"
        checkbox-class="h-4 w-4 cursor-pointer rounded border-neutral-300 text-primary-600 focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 dark:border-neutral-600 dark:focus:ring-offset-neutral-900"
        @change.stop="$emit('complete', item)"
        @click.stop
      />
    </div>
    <span
      v-else
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
    >
      <ClockIcon v-if="item.kind === 'event'" class="h-4 w-4" />
      <CheckCircleIcon v-else class="h-4 w-4" />
    </span>

    <div class="min-w-0 flex-1">
      <div class="flex min-w-0 items-center gap-2">
        <span class="truncate text-sm font-medium text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
          {{ item.title }}
        </span>
        <span
          v-if="item.attentionLabel"
          class="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none"
          :class="attentionPillClass"
        >
          {{ item.attentionLabel }}
        </span>
      </div>
      <p class="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
        <span>{{ item.sourceApp }}</span>
        <span v-if="item.organizationLabel"> · {{ item.organizationLabel }}</span>
        <span v-if="item.relatedLabel"> · {{ item.relatedLabel }}</span>
      </p>
    </div>

    <span
      v-if="item.dueAt"
      class="shrink-0 text-[11px] text-neutral-400 dark:text-neutral-500"
    >
      {{ formatAttentionDueTime(item.dueAt, item.isOverdue, t) }}
    </span>

    <ChevronRightIcon class="h-4 w-4 shrink-0 text-neutral-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-neutral-600" />
  </div>

  <div
    v-else
    class="group relative cursor-pointer rounded transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2 focus-within:ring-offset-white dark:focus-within:ring-offset-neutral-950"
    :class="[
      'py-5 px-1',
      showDivider ? 'border-b border-neutral-100 dark:border-neutral-700/80' : '',
      'hover:bg-neutral-50 focus-within:bg-neutral-50 dark:hover:bg-neutral-800/60 dark:focus-within:bg-neutral-800/60'
    ]"
    role="button"
    tabindex="0"
    @click="$emit('select', item)"
    @keydown.enter="$emit('select', item)"
    @keydown.space.prevent="$emit('select', item)"
  >
    <div class="flex items-start gap-4">
      <div
        v-if="item.kind === 'task' && item.allowComplete"
        class="flex-shrink-0 pt-0.5"
        @click.stop
      >
        <HeadlessCheckbox
          :checked="false"
          :aria-label="`Complete task: ${item.title}`"
          checkbox-class="w-5 h-5 text-primary-600 border-neutral-300 rounded focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 cursor-pointer dark:border-neutral-600 dark:focus:ring-offset-neutral-950"
          @change.stop="$emit('complete', item)"
          @click.stop
        />
      </div>

      <div class="flex-1 min-w-0">
        <h3 class="mb-1.5 text-lg font-semibold text-neutral-900 transition-colors group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
          {{ item.title }}
        </h3>

        <p
          :class="[
            'mb-3 text-sm',
            item.isOverdue
              ? 'text-danger-600 dark:text-danger-400'
              : 'text-neutral-500 dark:text-neutral-400'
          ]"
        >
          {{ item.attentionLabel }}
        </p>

        <div class="flex items-center justify-between gap-4">
          <div class="flex min-w-0 items-center gap-2 text-xs text-neutral-400 dark:text-neutral-500">
            <span>{{ item.sourceApp }}</span>
            <span>·</span>
            <span class="truncate">{{ item.organizationLabel }}</span>
            <span v-if="item.relatedLabel" class="truncate text-neutral-400 dark:text-neutral-500">
              · {{ item.relatedLabel }}
            </span>
          </div>

          <div v-if="item.dueAt" class="flex-shrink-0 text-xs text-neutral-400 dark:text-neutral-500">
            {{ formatAttentionDueTime(item.dueAt, item.isOverdue, t) }}
          </div>
        </div>
      </div>

      <div v-if="item.kind === 'event'" class="flex-shrink-0">
        <BadgeCell
          :value="getEventAttentionBadgeLabel(eventAttentionType, t)"
          :variant="getEventAttentionBadgeVariant(eventAttentionType)"
        />
      </div>

      <div class="flex-shrink-0 pt-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <ChevronRightIcon class="h-5 w-5 text-neutral-400 dark:text-neutral-500" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import { CheckCircleIcon, ChevronRightIcon, ClockIcon } from '@heroicons/vue/24/outline';
import {
  formatAttentionDueTime,
  getEventAttentionType,
  getEventAttentionBadgeLabel,
  getEventAttentionBadgeVariant
} from '@/utils/attentionFormatters';

const props = defineProps({
  item: {
    type: Object,
    required: true
  },
  showDivider: {
    type: Boolean,
    default: true
  },
  compact: {
    type: Boolean,
    default: false
  }
});

const { t } = useI18n();

defineEmits(['select', 'complete']);

const eventAttentionType = computed(() => getEventAttentionType(props.item));

const attentionPillClass = computed(() => {
  if (props.item.isOverdue) {
    return 'bg-danger-50 text-danger-700 dark:bg-danger-900/40 dark:text-danger-200';
  }
  if (props.item.kind === 'event') {
    return 'bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200';
  }
  return 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300';
});
</script>
