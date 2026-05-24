<template>
  <div class="trends-chart-container">
    <canvas ref="chartCanvas"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const { t, locale } = useI18n();

const props = defineProps({
  data: {
    type: Object,
    default: () => ({
      labels: [],
      compliance: [],
      scores: []
    })
  }
});

const chartCanvas = ref(null);
let chartInstance = null;

const createChart = () => {
  if (!chartCanvas.value || !props.data.labels || props.data.labels.length === 0) {
    return;
  }

  if (chartInstance) {
    chartInstance.destroy();
  }

  const ctx = chartCanvas.value.getContext('2d');

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: props.data.labels,
      datasets: [
        {
          label: t('forms.trendsChartCompliance'),
          data: props.data.compliance,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: t('forms.trendsChartScore'),
          data: props.data.scores,
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          tension: 0.4,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 15
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: function(value) {
              return value + '%';
            }
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      }
    }
  });
};

watch(() => props.data, () => {
  createChart();
}, { deep: true });

watch(locale, () => {
  createChart();
});

onMounted(() => {
  createChart();
});
</script>

<style scoped>
.trends-chart-container {
  position: relative;
  height: 300px;
  width: 100%;
}
</style>
