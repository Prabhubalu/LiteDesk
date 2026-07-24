<template>
  <section :class="['overflow-hidden', PLATFORM_HOME_CARD_CLASS]">
    <div
      :class="[
        'flex items-center justify-between gap-2 px-4 py-2.5 sm:px-5',
        PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS,
      ]"
    >
      <h3 class="truncate text-sm font-semibold text-neutral-900 dark:text-white">
        {{ title || t('astra.listTitle') }}
      </h3>
      <span
        v-if="total != null"
        class="shrink-0 rounded-full border border-neutral-200/70 px-2 py-0.5 text-[10px] font-medium text-neutral-500 dark:border-white/10 dark:text-neutral-400"
      >
        {{ total }}
      </span>
    </div>

    <div
      :class="[
        'flex max-h-80 flex-col divide-y divide-neutral-100 dark:divide-white/[0.06]',
        PLATFORM_HOME_LIST_SCROLL_CLASS,
      ]"
    >
      <div
        v-for="item in items"
        :key="item.id"
        class="group"
      >
        <button
          type="button"
          class="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/60 sm:px-4"
          @click="onOpen(item)"
        >
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            :class="iconWrapClass"
          >
            <component :is="iconComponent" class="h-4 w-4" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
              {{ item.title }}
            </span>
            <span
              v-if="item.subtitle"
              class="mt-0.5 block truncate text-xs text-neutral-500 dark:text-neutral-400"
            >
              {{ item.subtitle }}
            </span>
          </span>
          <span
            v-if="item.amount != null"
            class="shrink-0 text-xs font-medium tabular-nums text-neutral-600 dark:text-neutral-300"
          >
            {{ formatAmount(item.amount) }}
          </span>
          <ChevronRightIcon class="h-4 w-4 shrink-0 text-neutral-300 group-hover:text-primary-500 dark:text-neutral-600" />
        </button>
        <div
          v-if="item.actions?.length"
          class="flex flex-wrap gap-1.5 px-3.5 pb-2.5 sm:px-4"
        >
          <button
            v-for="action in item.actions"
            :key="action.id || action.label"
            type="button"
            class="rounded-full border border-neutral-200/80 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-600 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-primary-500/40 dark:hover:bg-primary-950/40 dark:hover:text-primary-200"
            @click.stop="onAction(action)"
          >
            {{ action.label }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import {
  BriefcaseIcon,
  ChevronRightIcon,
  TicketIcon,
  UserIcon,
} from '@heroicons/vue/24/outline';
import {
  PLATFORM_HOME_CARD_CLASS,
  PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS,
  PLATFORM_HOME_LIST_SCROLL_CLASS,
} from '@/utils/platformHomeLayout';
import type { AstraRecordListItem, AstraRecordAction } from '@/astra/blocks/types';

const props = defineProps<{
  title?: string;
  entity?: string;
  total?: number;
  items: AstraRecordListItem[];
}>();

const emit = defineEmits<{
  action: [prompt: string];
}>();

const { t } = useI18n();
const router = useRouter();

const iconComponent = computed(() => {
  if (props.entity === 'cases') return TicketIcon;
  if (props.entity === 'people') return UserIcon;
  return BriefcaseIcon;
});

const iconWrapClass = computed(() => {
  if (props.entity === 'cases') {
    return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  }
  if (props.entity === 'people') {
    return 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300';
  }
  return 'bg-primary-50 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300';
});

function formatAmount(amount: number | string) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return String(amount);
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

function onOpen(item: AstraRecordListItem) {
  if (item.href) {
    void router.push(item.href);
  }
}

function onAction(action: AstraRecordAction) {
  const prompt = String(action.prompt || action.label || '').trim();
  if (prompt) emit('action', prompt);
}
</script>
