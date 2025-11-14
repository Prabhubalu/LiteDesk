<template>
  <div class="relative h-64">
    <canvas ref="chartCanvas"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onBeforeUnmount } from 'vue';
import { Chart, registerables } from 'chart.js';
import apiClient from '@/utils/apiClient';

Chart.register(...registerables);

const props = defineProps({
  formId: {
    type: String,
    required: true
  }
});

const chartCanvas = ref(null);
let myChart = null;
const chartData = ref({
  labels: [],
  compliance: []
});

const fetchData = async () => {
  try {
    // Fetch trends data using the reportGenerationService endpoint
    // We'll need to create an endpoint or use the comparison endpoint
    const response = await apiClient(`/forms/${props.formId}/responses`, {
      method: 'GET',
      params: { limit: 10, sort: 'submittedAt' }
    });
    
    if (response.success && response.data && response.data.responses) {
      const responses = response.data.responses.slice(0, 10).reverse(); // Get last 10, reverse for chronological order
      chartData.value = {
        labels: responses.map(r => {
          const date = new Date(r.submittedAt);
          return `${date.getMonth() + 1}/${date.getDate()}`;
        }),
        compliance: responses.map(r => r.kpis?.compliancePercentage || 0)
      };
      renderChart();
    }
  } catch (error) {
    console.error('Error fetching compliance trend data:', error);
  }
};

const renderChart = () => {
  if (myChart) {
    myChart.destroy();
  }

  if (!chartCanvas.value || !chartData.value.labels || chartData.value.labels.length === 0) {
    return;
  }

  myChart = new Chart(chartCanvas.value, {
    type: 'line',
    data: {
      labels: chartData.value.labels,
      datasets: [
        {
          label: 'Compliance %',
          data: chartData.value.compliance,
          borderColor: '#4F46E5', // brand-600
          backgroundColor: 'rgba(79, 70, 229, 0.1)',
          tension: 0.3,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#6B7280' // gray-500
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              return `Compliance: ${context.parsed.y}%`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            color: '#6B7280',
            callback: function(value) {
              return value + '%';
            }
          },
          grid: {
            color: '#E5E7EB' // gray-200
          }
        },
        x: {
          ticks: {
            color: '#6B7280'
          },
          grid: {
            color: '#E5E7EB'
          }
        }
      }
    }
  });
};

onMounted(() => {
  fetchData();
});

watch(() => props.formId, () => {
  fetchData();
});

onBeforeUnmount(() => {
  if (myChart) {
    myChart.destroy();
  }
});
</script>

