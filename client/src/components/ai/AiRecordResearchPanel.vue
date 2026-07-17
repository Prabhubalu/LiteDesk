<template>
  <div
    v-if="visible"
    class="border-b border-sky-100 bg-sky-50/70 px-4 py-2 sm:px-5 dark:border-sky-900/40 dark:bg-sky-950/30"
  >
    <div class="mb-1 flex items-center justify-between gap-2">
      <span class="text-xs font-semibold text-sky-900 dark:text-sky-100">
        {{ t('records.aiResearchTitle') }}
      </span>
      <button
        type="button"
        class="text-xs font-medium text-sky-700 hover:text-sky-900 dark:text-sky-300"
        @click="clear"
      >
        {{ t('actions.close') }}
      </button>
    </div>
    <p v-if="loading" class="text-xs text-sky-800 dark:text-sky-200">{{ t('records.aiResearching') }}</p>
    <p v-else-if="error" class="text-xs text-red-600 dark:text-red-400">{{ error }}</p>
    <template v-else>
      <pre class="whitespace-pre-wrap font-sans text-xs leading-relaxed text-sky-950 dark:text-sky-50">{{ text }}</pre>
      <ul v-if="citations.length" class="mt-2 space-y-1 text-[11px] text-sky-900/80 dark:text-sky-100/80">
        <li v-for="c in citations" :key="`${c.index}-${c.sourceId}`">
          [{{ c.index }}] {{ c.sourceType }} · {{ c.sourceId }}
          <span v-if="c.excerpt"> — {{ c.excerpt }}</span>
        </li>
      </ul>
      <p class="mt-2 text-[11px] text-sky-800/80 dark:text-sky-200/80">{{ t('records.aiResearchReadOnlyHint') }}</p>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { trackAiAbilityUsed } from '@/utils/aiFeedback';

const props = defineProps({
  appKey: { type: String, default: 'SALES' },
  moduleKey: { type: String, required: true },
  recordId: { type: String, default: '' },
});

const { t } = useI18n();
const loading = ref(false);
const text = ref('');
const error = ref('');
const citations = ref([]);

const visible = computed(() => Boolean(loading.value || text.value || error.value));

function clear() {
  loading.value = false;
  text.value = '';
  error.value = '';
  citations.value = [];
}

async function runResearch() {
  const id = String(props.recordId || '').trim();
  if (!id || loading.value) return;
  loading.value = true;
  text.value = '';
  error.value = '';
  citations.value = [];
  try {
    const data = await apiClient.post('/ai/research', {
      appKey: props.appKey,
      moduleKey: props.moduleKey,
      recordId: id,
    });
    text.value = String(data?.text || '').trim();
    citations.value = Array.isArray(data?.citations) ? data.citations : [];
    trackAiAbilityUsed({
      abilityKey: 'record_research',
      provider: data?.provider,
      model: data?.model,
      keyMode: data?.keyMode,
    });
    if (!text.value) error.value = t('records.aiResearchEmpty');
  } catch (err) {
    error.value = err?.message || t('records.aiResearchFailed');
  } finally {
    loading.value = false;
  }
}

function onPaletteResearch(event) {
  const detail = event?.detail || {};
  if (detail.moduleKey && detail.moduleKey !== props.moduleKey) return;
  if (detail.recordId && String(detail.recordId) !== String(props.recordId)) return;
  runResearch();
}

onMounted(() => {
  window.addEventListener('arivu:ai-research', onPaletteResearch);
});
onUnmounted(() => {
  window.removeEventListener('arivu:ai-research', onPaletteResearch);
});

defineExpose({ runResearch, clear, loading });
</script>
