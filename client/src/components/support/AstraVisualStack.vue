<template>
    <div
    v-if="soleVisual"
    class="mt-1"
  >
    <AstraUiBlock
      v-if="soleVisual"
      :visual="soleVisual"
    />
  </div>
  <TabGroup
    v-else-if="visuals.length > 1"
    as="div"
    class="mt-3"
  >
    <TabList class="flex flex-wrap gap-1 rounded-xl border border-neutral-200/80 bg-neutral-50/80 p-1 dark:border-neutral-700 dark:bg-neutral-900/60">
      <Tab
        v-for="(viz, idx) in visuals"
        :key="`${viz.id || viz.component}-${idx}-tab`"
        v-slot="{ selected }"
        as="template"
      >
        <button
          type="button"
          class="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold tracking-wide transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          :class="selected
            ? 'bg-white text-primary-800 shadow-sm dark:bg-neutral-800 dark:text-primary-200'
            : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100'"
        >
          {{ tabLabel(viz) }}
        </button>
      </Tab>
    </TabList>
    <TabPanels class="mt-1">
      <TabPanel
        v-for="(viz, idx) in visuals"
        :key="`${viz.id || viz.component}-${idx}-panel`"
        class="focus:outline-none"
      >
        <AstraUiBlock :visual="viz" />
      </TabPanel>
    </TabPanels>
  </TabGroup>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/vue';
import { useI18n } from 'vue-i18n';
import AstraUiBlock from '@/components/support/AstraUiBlock.vue';
import type { InAppAiVisual } from '@/composables/useInProductAiAsk';

const props = defineProps<{
  visuals: InAppAiVisual[];
}>();

const { t } = useI18n();

const visuals = computed(() => (
  Array.isArray(props.visuals) ? props.visuals.filter(Boolean) : []
));

const soleVisual = computed(() => (
  visuals.value.length === 1 ? visuals.value[0] : undefined
));

function tabLabel(viz: InAppAiVisual) {
  const title = String(viz.title || '').trim();
  if (title) return title.length > 28 ? `${title.slice(0, 26)}…` : title;
  const c = viz.component;
  if (c === 'kpi_strip') return t('liveChat.astraVisualTabMetrics');
  if (c === 'chart') return t('liveChat.astraVisualTabChart');
  if (c === 'progress_list') return t('liveChat.astraVisualTabShare');
  if (c === 'data_table') return t('liveChat.astraVisualTabTable');
  if (c === 'callout') return t('liveChat.astraVisualTabInsight');
  return t('liveChat.astraVisualTabView');
}
</script>
