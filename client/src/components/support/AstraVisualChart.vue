<template>
  <div class="mt-3 overflow-hidden rounded-xl border border-gray-200/80 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/40">
    <p
      v-if="visual.title"
      class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
    >
      {{ visual.title }}
    </p>
    <div
      ref="chartEl"
      class="w-full"
      style="height: 220px; min-height: 220px;"
      role="img"
      :aria-label="visual.title || 'Chart'"
    />
    <p
      v-if="!hasPoints"
      class="py-8 text-center text-xs text-gray-500 dark:text-gray-400"
    >
      No chart data
    </p>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from 'echarts/components';
import type { EChartsType } from 'echarts/core';
import type { InAppAiVisual } from '@/composables/useInProductAiAsk';

echarts.use([
  CanvasRenderer,
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
]);

const PALETTE = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#0891b2',
  '#4f46e5',
];

const props = defineProps<{
  visual: InAppAiVisual;
}>();

const chartEl = ref<HTMLDivElement | null>(null);
let chart: EChartsType | null = null;
let resizeObserver: ResizeObserver | null = null;

const hasPoints = computed(() => (
  Array.isArray(props.visual.points) && props.visual.points.length > 0
));

function buildOption() {
  const points = Array.isArray(props.visual.points) ? props.visual.points : [];
  const labels = points.map((p) => p.label);
  const values = points.map((p) => Number(p.value) || 0);
  const chartType = props.visual.chartType || 'pie';

  if (chartType === 'bar') {
    return {
      color: PALETTE,
      tooltip: { trigger: 'axis' },
      grid: { left: 44, right: 12, top: 20, bottom: 52, containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: labels,
        axisLabel: { rotate: labels.some((l) => l.length > 10) ? 28 : 0, fontSize: 10 },
      },
      yAxis: {
        type: 'value' as const,
        splitLine: { lineStyle: { type: 'dashed' as const } },
      },
      series: [{
        type: 'bar' as const,
        data: values,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
      }],
    };
  }

  if (chartType === 'line') {
    return {
      color: PALETTE,
      tooltip: { trigger: 'axis' },
      grid: { left: 44, right: 12, top: 20, bottom: 40, containLabel: true },
      xAxis: { type: 'category' as const, data: labels, axisLabel: { fontSize: 10 } },
      yAxis: {
        type: 'value' as const,
        splitLine: { lineStyle: { type: 'dashed' as const } },
      },
      series: [{
        type: 'line' as const,
        data: values,
        smooth: true,
        areaStyle: { opacity: 0.12 },
      }],
    };
  }

  return {
    color: PALETTE,
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: {
      type: 'scroll' as const,
      bottom: 0,
      textStyle: { fontSize: 10 },
    },
    series: [{
      type: 'pie' as const,
      radius: ['38%', '62%'],
      center: ['50%', '42%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
      label: { fontSize: 10, formatter: '{b}\n{d}%' },
      data: points.map((p, i) => ({
        name: p.label,
        value: Number(p.value) || 0,
        itemStyle: { color: PALETTE[i % PALETTE.length] },
      })),
    }],
  };
}

function renderChart() {
  if (!chartEl.value || !hasPoints.value) return;
  if (!chart) {
    chart = echarts.init(chartEl.value, undefined, { renderer: 'canvas' });
  }
  chart.setOption(buildOption(), true);
  chart.resize();
}

onMounted(async () => {
  await nextTick();
  renderChart();
  if (chartEl.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      chart?.resize();
    });
    resizeObserver.observe(chartEl.value);
  }
});

watch(
  () => props.visual,
  async () => {
    await nextTick();
    renderChart();
  },
  { deep: true },
);

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  chart?.dispose();
  chart = null;
});
</script>
