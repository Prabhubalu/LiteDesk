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
  data: []
});

const fetchData = async () => {
  try {
    const response = await apiClient(`/forms/${props.formId}/responses`, {
      method: 'GET',
      params: { limit: 100 }
    });
    
    if (response.success && response.data && response.data.responses) {
      const responses = response.data.responses;
      
      // Count ratings (assuming rating scale 1-5)
      const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      responses.forEach(r => {
        const rating = Math.round(r.kpis?.rating || 0);
        if (rating >= 1 && rating <= 5) {
          ratingCounts[rating]++;
        }
      });
      
      chartData.value = {
        labels: ['1 Star', '2 Stars', '3 Stars', '4 Stars', '5 Stars'],
        data: [ratingCounts[1], ratingCounts[2], ratingCounts[3], ratingCounts[4], ratingCounts[5]]
      };
      renderChart();
    }
  } catch (error) {
    console.error('Error fetching rating distribution data:', error);
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
    type: 'bar',
    data: {
      labels: chartData.value.labels,
      datasets: [
        {
          label: 'Number of Responses',
          data: chartData.value.data,
          backgroundColor: [
            'rgba(239, 68, 68, 0.8)',   // red-500
            'rgba(245, 158, 11, 0.8)',  // amber-500
            'rgba(234, 179, 8, 0.8)',   // yellow-500
            'rgba(34, 197, 94, 0.8)',   // green-500
            'rgba(16, 185, 129, 0.8)'   // emerald-500
          ],
          borderColor: [
            'rgb(239, 68, 68)',
            'rgb(245, 158, 11)',
            'rgb(234, 179, 8)',
            'rgb(34, 197, 94)',
            'rgb(16, 185, 129)'
          ],
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
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
            display: false
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

