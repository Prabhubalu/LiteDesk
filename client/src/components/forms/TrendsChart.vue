<template>
  <div class="trends-chart-container">
    <canvas ref="chartCanvas"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

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

  // Destroy existing chart if any
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
          label: 'Compliance %',
          data: props.data.compliance,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Score %',
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

