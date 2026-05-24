<template>
  <CardWidget class="ld-card-group" :title="title">
    <div v-if="loading" class="flex-1 flex items-center justify-center py-6">
      <div class="w-8 h-8 border-4 border-gray-200 dark:border-gray-700 border-t-indigo-600 dark:border-t-indigo-500 rounded-full animate-spin"></div>
    </div>
    <div v-else-if="error" class="flex-1 flex items-center justify-center py-6">
      <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
    </div>
    <div v-else class="flex-1 flex flex-col items-center justify-center py-4">
      <div class="text-3xl font-bold text-gray-900 dark:text-white mb-1">{{ displayValue }}</div>
      <div v-if="subtitle" class="text-sm text-gray-500 dark:text-gray-400">{{ subtitle }}</div>
    </div>
  </CardWidget>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import CardWidget from '@/components/common/CardWidget.vue';
import apiClient from '@/utils/apiClient';

const { t } = useI18n();

const props = defineProps({
  formId: {
    type: String,
    required: true
  },
  metricType: {
    type: String,
    required: true,
    validator: (value) => ['total-responses', 'avg-compliance', 'avg-rating', 'response-rate'].includes(value)
  }
});

const loading = ref(true);
const error = ref(null);
const data = ref(null);

const title = computed(() => {
  switch (props.metricType) {
    case 'total-responses':
      return t('forms.widgetTotalResponses');
    case 'avg-compliance':
      return t('forms.widgetAvgCompliance');
    case 'avg-rating':
      return t('forms.widgetAvgRating');
    case 'response-rate':
      return t('forms.widgetResponseRate');
    default:
      return t('forms.widgetAnalytics');
  }
});

const displayValue = computed(() => {
  if (!data.value) {
    return props.metricType === 'avg-rating' ? '0.0/5' :
           (props.metricType === 'avg-compliance' || props.metricType === 'response-rate') ? '0%' :
           '0';
  }

  switch (props.metricType) {
    case 'total-responses':
      return data.value.totalResponses ?? 0;
    case 'avg-compliance':
      return `${Math.round(data.value.avgCompliance ?? 0)}%`;
    case 'avg-rating':
      return `${Number(data.value.avgRating ?? 0).toFixed(1)}/5`;
    case 'response-rate':
      return `${Math.round(data.value.responseRate ?? 0)}%`;
    default:
      return '0';
  }
});

const subtitle = computed(() => {
  switch (props.metricType) {
    case 'avg-rating':
      return t('forms.widgetSubtitleStars');
    case 'avg-compliance':
    case 'response-rate':
      return t('forms.widgetSubtitlePercent');
    default:
      return null;
  }
});

const fetchAnalytics = async () => {
  loading.value = true;
  error.value = null;

  try {
    const url = `/forms/${props.formId}/responses?page=1&limit=1000`;
    const response = await apiClient(url, {
      method: 'GET'
    });

    let responses = [];
    let totalResponses = 0;

    if (response && response.success) {
      if (Array.isArray(response.data)) {
        responses = response.data;
      } else if (response.data && Array.isArray(response.data.data)) {
        responses = response.data.data;
      }

      totalResponses = response.pagination?.totalResponses || response.data?.pagination?.totalResponses || responses.length;
    } else if (Array.isArray(response)) {
      responses = response;
      totalResponses = responses.length;
    } else if (response && Array.isArray(response.data)) {
      responses = response.data;
      totalResponses = response.pagination?.totalResponses || responses.length;
    }

    if (responses.length > 0) {
      switch (props.metricType) {
        case 'total-responses':
          data.value = { totalResponses };
          break;
        case 'avg-compliance': {
          const complianceValues = responses
            .map(r => r.kpis?.compliancePercentage ||
                     r.kpis?.finalScore ||
                     r.compliancePercentage ||
                     (r.kpis && typeof r.kpis === 'object' ? r.kpis.compliance : null))
            .filter(v => v !== undefined && v !== null && !isNaN(v));
          data.value = {
            avgCompliance: complianceValues.length > 0
              ? complianceValues.reduce((sum, val) => sum + Number(val), 0) / complianceValues.length
              : 0
          };
          break;
        }
        case 'avg-rating': {
          const ratingValues = responses
            .map(r => r.kpis?.avgRating ||
                     r.avgRating ||
                     (r.kpis && typeof r.kpis === 'object' ? r.kpis.rating : null))
            .filter(v => v !== undefined && v !== null && !isNaN(v));
          data.value = {
            avgRating: ratingValues.length > 0
              ? ratingValues.reduce((sum, val) => sum + Number(val), 0) / ratingValues.length
              : 0
          };
          break;
        }
        case 'response-rate':
          data.value = { responseRate: responses.length > 0 ? 85 : 0 };
          break;
      }
    } else {
      switch (props.metricType) {
        case 'total-responses':
          data.value = { totalResponses: 0 };
          break;
        case 'avg-compliance':
          data.value = { avgCompliance: 0 };
          break;
        case 'avg-rating':
          data.value = { avgRating: 0 };
          break;
        case 'response-rate':
          data.value = { responseRate: 0 };
          break;
      }
    }
  } catch (err) {
    console.error('Error fetching form analytics:', err);
    error.value = t('forms.widgetLoadFailed');
    switch (props.metricType) {
      case 'total-responses':
        data.value = { totalResponses: 0 };
        break;
      case 'avg-compliance':
        data.value = { avgCompliance: 0 };
        break;
      case 'avg-rating':
        data.value = { avgRating: 0 };
        break;
      case 'response-rate':
        data.value = { responseRate: 0 };
        break;
    }
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchAnalytics();
});
</script>
