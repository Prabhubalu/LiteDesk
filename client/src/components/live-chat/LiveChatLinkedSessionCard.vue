<template>
  <div
    v-if="summary"
    class="shrink-0 rounded-xl border border-gray-200 bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-900 sm:px-6"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {{ t('liveChat.linkedSessionCardTitle') }}
        </p>
        <p class="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
          {{ summary.sessionKey || summary.sessionId }}
        </p>
        <dl class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
          <div v-if="summary.outcome">
            <dt class="inline">{{ t('liveChat.linkedSessionOutcome') }}:</dt>
            <dd class="inline ml-1 font-medium">{{ formatOutcome(summary.outcome) }}</dd>
          </div>
          <div v-if="durationLabel">
            <dt class="inline">{{ t('liveChat.linkedSessionDuration') }}:</dt>
            <dd class="inline ml-1 font-medium">{{ durationLabel }}</dd>
          </div>
          <div v-if="summary.missing">
            <dd class="text-amber-700 dark:text-amber-300">{{ t('liveChat.linkedSessionMissing') }}</dd>
          </div>
        </dl>
      </div>
      <button
        v-if="!summary.missing && summary.sessionId"
        type="button"
        class="inline-flex shrink-0 items-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
        @click="openSession(summary.sessionId)"
      >
        {{ t('liveChat.linkedSessionOpenTranscript') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useLiveChatTabNavigation } from '@/composables/useLiveChatTabNavigation';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  fetchPath: { type: String, required: true },
  sessionRef: { type: Object, default: null },
});

const { t } = useI18n();
const { openSession } = useLiveChatTabNavigation();
const summary = ref(null);

const durationLabel = computed(() => {
  const seconds = summary.value?.durationSeconds;
  if (seconds == null || Number.isNaN(seconds)) return '';
  if (seconds < 60) return t('liveChat.linkedSessionDurationSeconds', { count: seconds });
  const mins = Math.floor(seconds / 60);
  return t('liveChat.linkedSessionDurationMinutes', { count: mins });
});

function formatOutcome(key) {
  const normalized = String(key || '').trim();
  if (!normalized) return '';
  const label = t(`liveChat.outcomes.${normalized}`, normalized);
  return label === `liveChat.outcomes.${normalized}` ? normalized : label;
}

function applySessionRef(ref) {
  const sessionId = String(ref?.sessionId || '').trim();
  if (!sessionId) return;
  summary.value = {
    sessionId,
    sessionKey: ref.sessionKey || null,
    outcome: ref.outcome || null,
    missing: false,
  };
}

async function loadSummary() {
  const path = String(props.fetchPath || '').trim();
  if (!path) {
    summary.value = null;
    return;
  }

  if (props.sessionRef?.sessionId) {
    applySessionRef(props.sessionRef);
  }

  try {
    const res = await apiClient.getOptional(path, {
      cache: 'no-store',
      params: { appKey: 'PLATFORM' },
    });
    if (res?.success && res.data) {
      summary.value = res.data;
      return;
    }
  } catch (err) {
    console.warn('[LiveChatLinkedSessionCard] load failed:', err?.message || err);
  }

  if (!props.sessionRef?.sessionId) {
    summary.value = null;
  }
}

onMounted(loadSummary);
watch(() => [props.fetchPath, props.sessionRef?.sessionId], loadSummary);
</script>
