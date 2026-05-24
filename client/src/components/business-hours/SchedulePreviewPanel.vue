<template>
  <div class="rounded-xl border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-950/30 p-4 space-y-3">
    <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.settingsBhLivePreview') }}</h4>
    <p v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.settingsBhCalculating') }}</p>
    <template v-else-if="preview">
      <p class="text-sm text-gray-700 dark:text-gray-300">
        <span class="font-medium">{{ t('settings.settingsBhPreviewNow') }}</span>
        {{ preview.isOpen ? t('settings.settingsBhWithinBusinessHours') : preview.pauseReason }}
      </p>
      <p v-if="preview.targetAfterMinutes" class="text-sm text-gray-700 dark:text-gray-300">
        <span class="font-medium">{{ t('settings.settingsBhSlaFromNow') }}</span>
        {{ formatInstant(preview.targetAfterMinutes) }}
      </p>
      <p v-if="preview.nextOpenAt && !preview.isOpen" class="text-xs text-gray-600 dark:text-gray-400">
        {{ t('settings.settingsBhNextOpen', { time: formatInstant(preview.nextOpenAt) }) }}
      </p>
    </template>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBusinessHours } from '@/composables/useBusinessHours';

const props = defineProps({
  setId: { type: String, default: null },
  timezone: { type: String, default: 'UTC' }
});

const { t } = useI18n();
const { simulate } = useBusinessHours();
const loading = ref(false);
const preview = ref(null);

function formatInstant(iso) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: props.timezone
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}

async function runPreview() {
  if (!props.setId) {
    preview.value = null;
    return;
  }
  loading.value = true;
  try {
    preview.value = await simulate({
      setId: props.setId,
      minutesToAdd: 240
    });
  } catch {
    preview.value = null;
  } finally {
    loading.value = false;
  }
}

watch(() => props.setId, runPreview, { immediate: true });
</script>
