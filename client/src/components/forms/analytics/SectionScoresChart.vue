<template>
  <div class="relative h-64">
    <canvas ref="chartCanvas"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onBeforeUnmount, computed } from 'vue';
import { Chart, registerables } from 'chart.js';
import apiClient from '@/utils/apiClient';

Chart.register(...registerables);

const props = defineProps({
  formId: {
    type: String,
    required: true
  },
  form: {
    type: Object,
    default: null
  }
});

const chartCanvas = ref(null);
let myChart = null;
const chartData = ref({
  labels: [],
  scores: []
});

const sectionNames = computed(() => {
  if (!props.form || !props.form.sections) return {};
  const names = {};
  props.form.sections.forEach(section => {
    names[section.sectionId] = section.name;
    if (section.subsections) {
      section.subsections.forEach(subsection => {
        names[subsection.subsectionId] = subsection.name;
      });
    }
  });
  return names;
});

const fetchData = async () => {
  try {
    const response = await apiClient(`/forms/${props.formId}/responses`, {
      method: 'GET',
      params: { limit: 50 }
    });
    
    if (response.success && response.data && response.data.responses) {
      const responses = response.data.responses;
      
      // Calculate average scores per section
      const sectionTotals = {};
      const sectionCounts = {};
      
      responses.forEach(r => {
        if (r.sectionScores && typeof r.sectionScores === 'object') {
          Object.entries(r.sectionScores).forEach(([sectionId, score]) => {
            if (typeof score === 'number') {
              sectionTotals[sectionId] = (sectionTotals[sectionId] || 0) + score;
              sectionCounts[sectionId] = (sectionCounts[sectionId] || 0) + 1;
            }
          });
        }
      });
      
      // Calculate averages
      const averages = {};
      Object.keys(sectionTotals).forEach(sectionId => {
        averages[sectionId] = Math.round(sectionTotals[sectionId] / sectionCounts[sectionId]);
      });
      
      // Sort by score (descending) and take top 10
      const sorted = Object.entries(averages)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      
      chartData.value = {
        labels: sorted.map(([id]) => sectionNames.value[id] || id),
        scores: sorted.map(([, score]) => score)
      };
      renderChart();
    }
  } catch (error) {
    console.error('Error fetching section scores data:', error);
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
          label: 'Average Score %',
          data: chartData.value.scores,
          backgroundColor: 'rgba(79, 70, 229, 0.8)', // brand-600
          borderColor: 'rgb(79, 70, 229)',
          borderWidth: 1
        }
      ]
    },
    options: {
      indexAxis: 'y', // Horizontal bar chart
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `Score: ${context.parsed.x}%`;
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          max: 100,
          ticks: {
            color: '#6B7280',
            callback: function(value) {
              return value + '%';
            }
          },
          grid: {
            color: '#E5E7EB'
          }
        },
        y: {
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
  if (props.form) {
    fetchData();
  }
});

watch(() => [props.formId, props.form], () => {
  if (props.form) {
    fetchData();
  }
}, { deep: true });

onBeforeUnmount(() => {
  if (myChart) {
    myChart.destroy();
  }
});
</script>

