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
  rates: []
});

const fetchData = async () => {
  try {
    const response = await apiClient(`/forms/${props.formId}/responses`, {
      method: 'GET',
      params: { limit: 30, sort: 'submittedAt' }
    });
    
    if (response.success && response.data && response.data.responses) {
      const responses = response.data.responses.slice(0, 30).reverse();
      
      // Group by date and calculate response rate
      const dateGroups = {};
      responses.forEach(r => {
        const date = new Date(r.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        dateGroups[date] = (dateGroups[date] || 0) + 1;
      });
      
      chartData.value = {
        labels: Object.keys(dateGroups),
        rates: Object.values(dateGroups)
      };
      renderChart();
    }
  } catch (error) {
    console.error('Error fetching response rate data:', error);
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
          label: 'Responses per Day',
          data: chartData.value.rates,
          borderColor: '#10B981', // green-500
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.3,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 5
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
            color: '#6B7280'
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              return `${context.parsed.y} responses`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: '#6B7280',
            stepSize: 1
          },
          grid: {
            color: '#E5E7EB'
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

