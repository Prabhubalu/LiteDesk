<template>
  <div class="relative" :style="{ height: `${chartHeight}px` }">
    <canvas ref="chartCanvas"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onBeforeUnmount, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Chart, registerables } from 'chart.js';
import { getScoreRingColor } from '@/utils/formScoringUtils';

Chart.register(...registerables);

const { t } = useI18n();

const props = defineProps({
  sections: {
    type: Array,
    required: true,
  },
});

const chartCanvas = ref(null);
let chartInstance = null;

const chartHeight = computed(() => Math.max(160, props.sections.length * 48));

const barColors = computed(() =>
  props.sections.map((section) => {
    const pct = section.percentage ?? 0;
    const color = getScoreRingColor(pct);
    return {
      background: color + 'CC',
      border: color,
    };
  })
);

const renderChart = () => {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  if (!chartCanvas.value || props.sections.length === 0) return;

  const isDark = document.documentElement.classList.contains('dark');
  const tickColor = isDark ? '#9CA3AF' : '#6B7280';
  const gridColor = isDark ? '#374151' : '#E5E7EB';

  chartInstance = new Chart(chartCanvas.value, {
    type: 'bar',
    data: {
      labels: props.sections.map((s) => s.sectionName),
      datasets: [
        {
          label: t('forms.analyticsChartAvgScorePct'),
          data: props.sections.map((s) => s.percentage),
          backgroundColor: barColors.value.map((c) => c.background),
          borderColor: barColors.value.map((c) => c.border),
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              return t('forms.analyticsTooltipScore', { value: context.parsed.x });
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          max: 100,
          ticks: {
            color: tickColor,
            callback(value) {
              return `${value}%`;
            },
          },
          grid: { color: gridColor },
        },
        y: {
          ticks: { color: tickColor },
          grid: { display: false },
        },
      },
    },
  });
};

onMounted(renderChart);

watch(
  () => props.sections,
  () => renderChart(),
  { deep: true }
);

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.destroy();
  }
});
</script>
