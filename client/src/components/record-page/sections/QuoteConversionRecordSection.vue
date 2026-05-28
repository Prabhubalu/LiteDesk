<template>
  <section v-if="record?._id" class="space-y-3">
    <div class="flex items-center justify-between">
      <div class="text-sm font-normal text-gray-900 dark:text-white">Conversion</div>
      <button
        v-if="canConvert"
        type="button"
        class="inline-flex items-center rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-sm"
        :disabled="busy"
        @click="convert"
      >
        Convert
      </button>
    </div>

    <div v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">Loading…</div>
    <div
      v-else-if="error"
      class="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-800 dark:text-red-200"
    >
      {{ error }}
    </div>

    <div v-else class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
      <div v-if="!conversion" class="text-sm text-gray-600 dark:text-gray-300">
        Not converted yet.
      </div>
      <div v-else class="space-y-2 text-sm">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div class="flex items-center justify-between gap-3">
            <div class="text-gray-500 dark:text-gray-400">Status</div>
            <div class="font-medium text-gray-900 dark:text-gray-100">{{ conversion.status || '—' }}</div>
          </div>
          <div class="flex items-center justify-between gap-3">
            <div class="text-gray-500 dark:text-gray-400">Converted at</div>
            <div class="font-medium text-gray-900 dark:text-gray-100">{{ fmtDate(conversion.convertedAt) }}</div>
          </div>
          <div class="flex items-center justify-between gap-3">
            <div class="text-gray-500 dark:text-gray-400">Type</div>
            <div class="font-medium text-gray-900 dark:text-gray-100">{{ conversion.conversionType || '—' }}</div>
          </div>
          <div class="flex items-center justify-between gap-3">
            <div class="text-gray-500 dark:text-gray-400">Target module</div>
            <div class="font-medium text-gray-900 dark:text-gray-100">{{ conversion.targetModuleKey || '—' }}</div>
          </div>
          <div class="flex items-center justify-between gap-3">
            <div class="text-gray-500 dark:text-gray-400">Target record</div>
            <div class="font-medium text-gray-900 dark:text-gray-100 font-mono text-xs">
              {{ conversion.targetRecordId || '—' }}
            </div>
          </div>
          <div class="flex items-center justify-between gap-3">
            <div class="text-gray-500 dark:text-gray-400">Link id</div>
            <div class="font-medium text-gray-900 dark:text-gray-100 font-mono text-xs">
              {{ conversion._id }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';

const props = defineProps({
  record: { type: Object, default: null },
  adapter: { type: Object, default: () => ({}) },
  context: { type: Object, default: () => ({}) }
});

const emit = defineEmits(['updated']);

const notifications = useNotifications();
const busy = ref(false);
const loading = ref(false);
const error = ref('');
const conversion = ref(null);

const canConvert = computed(() => {
  const s = String(props.record?.status || '');
  if (s !== 'Accepted' && s !== 'Partially Accepted') return false;
  return props.record?.converted !== true;
});

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

async function load() {
  if (!props.record?._id) return;
  loading.value = true;
  error.value = '';
  try {
    const res = await apiClient.get(`/quotes/${props.record._id}/conversion`);
    if (!res?.success) {
      error.value = res?.message || 'Failed to load conversion';
      conversion.value = null;
      return;
    }
    conversion.value = res?.data?.conversion || null;
  } catch (e) {
    error.value = e?.message || 'Failed to load conversion';
    conversion.value = null;
  } finally {
    loading.value = false;
  }
}

async function convert() {
  if (!props.record?._id) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/quotes/${props.record._id}/convert`, {});
    if (res?.success) {
      notifications.success('Converted');
      emit('updated');
      await load();
      return;
    }
    notifications.error(res?.message || 'Failed to convert');
  } catch (e) {
    notifications.error(e?.message || 'Failed to convert');
  } finally {
    busy.value = false;
  }
}

onMounted(load);
watch(() => String(props.record?._id || ''), () => load());
</script>

