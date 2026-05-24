<template>
  <div
    class="group relative transition-colors cursor-pointer focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 focus-within:outline-none rounded focus-within:bg-gray-50 dark:focus-within:bg-gray-700/30"
    :class="[
      compact ? 'py-3 px-1' : 'py-5 px-1',
      showDivider ? 'border-b border-gray-100 dark:border-gray-800' : '',
      'hover:bg-gray-50 dark:hover:bg-gray-700/30'
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
          checkbox-class="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 cursor-pointer"
          @change.stop="$emit('complete', item)"
          @click.stop
        />
      </div>

      <div class="flex-1 min-w-0">
        <h3
          :class="[
            'font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors',
            compact ? 'text-base mb-1' : 'text-lg mb-1.5'
          ]"
        >
          {{ item.title }}
        </h3>

        <p
          :class="[
            'text-sm',
            compact ? 'mb-2' : 'mb-3',
            item.isOverdue
              ? 'text-red-600 dark:text-red-400'
              : 'text-gray-500 dark:text-gray-400'
          ]"
        >
          {{ item.attentionLabel }}
        </p>

        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 min-w-0">
            <span>{{ item.sourceApp }}</span>
            <span>·</span>
            <span class="truncate">{{ item.organizationLabel }}</span>
            <span v-if="item.relatedLabel" class="text-gray-400 dark:text-gray-500 truncate">
              · {{ item.relatedLabel }}
            </span>
          </div>

          <div v-if="item.dueAt" class="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500">
            {{ formatAttentionDueTime(item.dueAt, item.isOverdue) }}
          </div>
        </div>
      </div>

      <div v-if="item.kind === 'event'" class="flex-shrink-0">
        <BadgeCell
          :value="getEventAttentionBadgeLabel(eventAttentionType)"
          :variant="getEventAttentionBadgeVariant(eventAttentionType)"
        />
      </div>

      <div class="flex-shrink-0 pt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRightIcon class="w-5 h-5 text-gray-400 dark:text-gray-500" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import { ChevronRightIcon } from '@heroicons/vue/24/outline';
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
</script>
