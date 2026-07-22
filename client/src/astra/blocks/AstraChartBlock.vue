<template>
  <section :class="['overflow-hidden', PLATFORM_HOME_CARD_CLASS]">
    <div
      :class="[
        'flex items-center justify-between gap-2 px-4 py-2.5 sm:px-5',
        PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS,
      ]"
    >
      <h3 class="truncate text-sm font-semibold text-neutral-900 dark:text-white">
        {{ title || t('astra.chartTitle') }}
      </h3>
      <span
        v-if="total"
        class="shrink-0 rounded-full border border-neutral-200/70 px-2 py-0.5 text-[10px] font-medium text-neutral-500 dark:border-white/10 dark:text-neutral-400"
      >
        {{ total }}
      </span>
    </div>
    <div class="h-44 px-2 py-2 sm:px-3">
      <VChart v-if="series.length" class="h-full w-full" :option="option" autoresize />
      <p v-else class="flex h-full items-center justify-center text-xs text-neutral-400">
        {{ t('astra.chartTitle') }}
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BarChart, PieChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import VChart from 'vue-echarts';
import {
  PLATFORM_HOME_CARD_CLASS,
  PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS,
} from '@/utils/platformHomeLayout';
import type { AstraChartPoint } from '@/astra/blocks/types';

use([CanvasRenderer, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent]);

const props = withDefaults(
  defineProps<{
    title?: string;
    chartType?: 'bar' | 'donut';
    series: AstraChartPoint[];
  }>(),
  { chartType: 'bar', series: () => [] },
);

const { t } = useI18n();

const total = computed(() =>
  props.series.reduce((sum, point) => sum + (Number(point.value) || 0), 0),
);

const option = computed(() => {
  const labels = props.series.map((p) => p.name);
  const values = props.series.map((p) => Number(p.value) || 0);
  const colors = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

  if (props.chartType === 'donut') {
    return {
      color: colors,
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'pie',
          radius: ['48%', '72%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 6, borderColor: 'transparent', borderWidth: 2 },
          label: { show: false },
          data: props.series.map((p) => ({ name: p.name, value: p.value })),
        },
      ],
    };
  }

  return {
    color: colors,
    grid: { left: 8, right: 8, top: 16, bottom: 28, containLabel: true },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { color: '#737373', fontSize: 10, hideOverlap: true },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: 'rgba(163,163,163,0.35)' } },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: 'rgba(163,163,163,0.18)' } },
      axisLabel: { color: '#a3a3a3', fontSize: 10 },
    },
    series: [
      {
        type: 'bar',
        data: values,
        barMaxWidth: 28,
        itemStyle: { borderRadius: [6, 6, 0, 0] },
      },
    ],
  };
});
</script>
