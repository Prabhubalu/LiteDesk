<template>
  <button
    type="button"
    class="group flex h-full min-h-[7.5rem] flex-col rounded-2xl border border-neutral-200/70 bg-white p-4 text-left transition-all hover:border-primary-200 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-primary-800"
    @click="$emit('open', app)"
  >
    <span class="mb-3 flex items-center gap-2.5">
      <span
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-400"
      >
        <component :is="iconComponent" class="h-5 w-5" />
      </span>
      <span class="truncate text-sm font-semibold text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
        {{ app.name }}
      </span>
    </span>

    <p
      v-if="statusText"
      class="mt-auto line-clamp-2 text-xs leading-relaxed"
      :class="statusClass"
    >
      <span
        v-if="statusSeverity"
        class="mr-1.5 inline-block h-1.5 w-1.5 translate-y-[-1px] rounded-full align-middle"
        :class="dotClass"
      />
      {{ statusText }}
    </p>
    <p
      v-else
      class="mt-auto text-xs text-neutral-400 dark:text-neutral-500"
    >
      {{ t('platform.platformHomeAppTileOpen') }}
    </p>
  </button>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  BriefcaseIcon,
  GlobeAltIcon,
  LifebuoyIcon,
  RectangleStackIcon,
  ShieldCheckIcon,
  Squares2X2Icon
} from '@heroicons/vue/24/outline';

const props = defineProps({
  app: {
    type: Object,
    required: true
  }
});

defineEmits(['open']);

const { t } = useI18n();

const ICON_BY_APP = {
  AUDIT: ShieldCheckIcon,
  SALES: BriefcaseIcon,
  HELPDESK: LifebuoyIcon,
  PROJECTS: RectangleStackIcon,
  PORTAL: GlobeAltIcon
};

const iconComponent = computed(() =>
  ICON_BY_APP[String(props.app.appKey || '').toUpperCase()] || Squares2X2Icon
);

const topSignal = computed(() => {
  const signals = props.app.pulse?.signals || [];
  const urgent = signals.find(
    (signal) => signal.severity !== 'info' && signal.text !== 'No urgent items'
  );
  return urgent || signals[0] || null;
});

const statusText = computed(() => {
  const text = topSignal.value?.text;
  if (!text || text === 'No urgent items') return '';
  return text;
});

const statusSeverity = computed(() => topSignal.value?.severity || null);

const statusClass = computed(() => {
  switch (statusSeverity.value) {
    case 'danger':
      return 'text-danger-700 dark:text-danger-300';
    case 'warning':
      return 'text-warning-700 dark:text-warning-300';
    default:
      return 'text-neutral-500 dark:text-neutral-400';
  }
});

const dotClass = computed(() => {
  switch (statusSeverity.value) {
    case 'danger':
      return 'bg-danger-500';
    case 'warning':
      return 'bg-warning-500';
    default:
      return 'bg-neutral-400';
  }
});
</script>
