<template>
  <div v-if="stats" class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
    <div
      v-for="card in cards"
      :key="card.key"
      class="rounded-xl border border-gray-200/80 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-800/80"
    >
      <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ card.label }}</p>
      <p class="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{{ card.value }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';

const { t } = useI18n();

const props = defineProps({
  active: { type: Boolean, default: false }
});

const stats = ref(null);

const cards = computed(() => {
  if (!stats.value) return [];
  return [
    { key: 'total', label: t('appointments.statsTotal'), value: stats.value.totalAppointments ?? 0 },
    { key: 'completed', label: t('appointments.statsCompleted'), value: stats.value.completedAppointments ?? 0 },
    { key: 'cancelled', label: t('appointments.statsCancelled'), value: stats.value.cancelledAppointments ?? 0 },
    { key: 'noShow', label: t('appointments.statsNoShowRate'), value: `${stats.value.noShowRate ?? 0}%` }
  ];
});

async function load() {
  if (!props.active) return;
  try {
    const res = await apiClient.get('/appointments/stats');
    if (res.success) stats.value = res.data;
  } catch {
    stats.value = null;
  }
}

watch(() => props.active, (v) => { if (v) load(); });
onMounted(() => { if (props.active) load(); });

defineExpose({ refresh: load });
</script>
