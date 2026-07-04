<template>
  <button
    type="button"
    class="group w-full rounded-xl border p-4 text-left transition-all duration-200"
    :class="
      disabled
        ? 'cursor-not-allowed border-zinc-200/60 opacity-60 dark:border-zinc-800'
        : selected
          ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500/30 dark:border-indigo-400 dark:bg-indigo-500/10'
          : 'border-zinc-200/80 hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:hover:border-zinc-700'
    "
    :disabled="disabled"
    @click="!disabled && $emit('select')"
  >
    <div class="flex items-center gap-3">
      <div
        class="flex shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 transition group-hover:bg-indigo-50 group-hover:text-indigo-600 dark:bg-zinc-800 dark:text-zinc-300 dark:group-hover:bg-indigo-500/10 dark:group-hover:text-indigo-400"
        :class="compact ? 'h-9 w-9' : 'h-10 w-10'"
      >
        <component :is="iconComponent" :class="compact ? 'h-4 w-4' : 'h-5 w-5'" aria-hidden="true" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="font-medium text-zinc-900 dark:text-zinc-100">{{ module.label || module.moduleKey }}</p>
        <p v-if="!reportable" class="mt-0.5 text-xs text-zinc-400">
          {{ t('analytics.builderModuleComingSoon') }}
        </p>
        <p v-else-if="!compact && description" class="mt-0.5 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
          {{ description }}
        </p>
      </div>
      <div
        v-if="selected"
        class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white"
      >
        <CheckIcon class="h-3 w-3" />
      </div>
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  BanknotesIcon,
  BuildingOfficeIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  CheckIcon,
  ClipboardDocumentListIcon,
  CubeIcon,
  DocumentTextIcon,
  TicketIcon,
  UsersIcon,
} from '@heroicons/vue/24/outline';
import { getModuleIconComponent } from '@/utils/moduleIcons';
import type { AnalyticsCatalogModule } from '@/composables/useAnalyticsReports';

const props = defineProps<{
  module: AnalyticsCatalogModule;
  selected: boolean;
  compact?: boolean;
}>();

defineEmits<{ (e: 'select'): void }>();

const { t } = useI18n();

const reportable = computed(() => props.module.reportable !== false);
const disabled = computed(() => !reportable.value);

const iconMap: Record<string, typeof BanknotesIcon> = {
  deals: BanknotesIcon,
  people: UsersIcon,
  organizations: BuildingOfficeIcon,
  cases: TicketIcon,
  quotes: DocumentTextIcon,
  tasks: CheckCircleIcon,
  events: CalendarDaysIcon,
  items: CubeIcon,
  forms: ClipboardDocumentListIcon,
};

const iconComponent = computed(
  () => iconMap[props.module.moduleKey] || getModuleIconComponent(props.module.moduleKey),
);

const description = computed(() => {
  const key = `analytics.builderModuleDesc_${props.module.moduleKey}`;
  const translated = t(key);
  return translated !== key ? translated : t('analytics.builderModuleDescDefault');
});
</script>
