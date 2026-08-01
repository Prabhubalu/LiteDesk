<template>
  <section class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">PDF preview</h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          <span v-if="preview?.exists">Version {{ preview.versionNumber }} · {{ formatDate(preview.generatedAt) }}</span>
          <span v-else>Generate a watermarked approval preview.</span>
        </p>
      </div>
      <div class="flex gap-2">
        <button
          v-if="preview?.filePath"
          type="button"
          class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          @click="openPdf"
        >
          Open
        </button>
        <button
          type="button"
          class="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
          :disabled="busy"
          @click="generatePreview"
        >
          {{ busy ? 'Generating...' : 'Generate preview' }}
        </button>
      </div>
    </div>

    <div v-if="preview?.filePath" class="mt-4 h-[420px] overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
      <iframe :src="preview.filePath" class="h-full w-full bg-white" title="Quote PDF preview"></iframe>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import { formatUserDateTime } from '@/utils/localeFormat';

const props = defineProps({
  quoteId: { type: String, default: '' },
  preview: { type: Object, default: null }
});

const emit = defineEmits(['generated']);
const notifications = useNotifications();
const busy = ref(false);

function openPdf() {
  if (props.preview?.filePath) window.open(props.preview.filePath, '_blank');
}

async function generatePreview() {
  if (!props.quoteId) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/quotes/${props.quoteId}/documents/preview`, {});
    if (!res?.success) {
      notifications.error(res?.message || 'Failed to generate preview');
      return;
    }
    notifications.success('Preview generated');
    emit('generated', res.data);
  } catch (err) {
    notifications.error(err?.message || 'Failed to generate preview');
  } finally {
    busy.value = false;
  }
}

function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return formatUserDateTime(d);
}
</script>
