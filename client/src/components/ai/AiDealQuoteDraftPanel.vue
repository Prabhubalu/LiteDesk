<template>
  <div
    v-if="visible"
    class="border-b border-amber-100 bg-amber-50/70 px-4 py-2 sm:px-5 dark:border-amber-900/40 dark:bg-amber-950/30"
  >
    <div class="mb-1 flex items-center justify-between gap-2">
      <span class="text-xs font-semibold text-amber-900 dark:text-amber-100">
        {{ title }}
      </span>
      <button
        type="button"
        class="text-xs font-medium text-amber-700 hover:text-amber-900 dark:text-amber-300"
        @click="clear"
      >
        {{ t('actions.close') }}
      </button>
    </div>
    <p v-if="loading" class="text-xs text-amber-800 dark:text-amber-200">{{ loadingLabel }}</p>
    <p v-else-if="error" class="text-xs text-red-600 dark:text-red-400">{{ error }}</p>
    <template v-else>
      <pre class="whitespace-pre-wrap font-sans text-xs leading-relaxed text-amber-950 dark:text-amber-50">{{ text }}</pre>
      <ul v-if="gaps.length" class="mt-2 space-y-1 text-[11px] text-amber-900 dark:text-amber-100">
        <li v-for="(gap, idx) in gaps" :key="`${gap.code}-${idx}`">
          • {{ gap.message }}
        </li>
      </ul>
      <p v-if="hint" class="mt-2 text-[11px] text-amber-800/80 dark:text-amber-200/80">{{ hint }}</p>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { trackAiAbilityUsed } from '@/utils/aiFeedback';

const props = defineProps({
  dealId: { type: String, default: '' },
});

const { t } = useI18n();
const loading = ref(false);
const text = ref('');
const error = ref('');
const gaps = ref([]);
const canApply = ref(false);
const lastMeta = ref({ provider: '', model: '', keyMode: '' });

const visible = computed(() => Boolean(loading.value || text.value || error.value));
const title = computed(() => t('records.aiQuoteDraftTitle'));
const loadingLabel = computed(() => t('records.aiQuoteDrafting'));
const hint = computed(() =>
  canApply.value ? t('records.aiQuoteDraftApplyHint') : t('records.aiQuoteDraftGapHint')
);

function clear() {
  loading.value = false;
  text.value = '';
  error.value = '';
  gaps.value = [];
  canApply.value = false;
}

async function runQuoteDraft() {
  const id = String(props.dealId || '').trim();
  if (!id || loading.value) return;
  loading.value = true;
  text.value = '';
  error.value = '';
  gaps.value = [];
  try {
    const data = await apiClient.post(`/ai/deals/${id}/quote-draft`, {});
    text.value = String(data?.text || '').trim();
    gaps.value = Array.isArray(data?.coverageGaps) ? data.coverageGaps : [];
    canApply.value = Boolean(data?.canApplyCatalogLines);
    lastMeta.value = {
      provider: data?.provider || '',
      model: data?.model || '',
      keyMode: data?.keyMode || '',
    };
    trackAiAbilityUsed({
      abilityKey: 'deal_quote_draft',
      provider: data?.provider,
      model: data?.model,
      keyMode: data?.keyMode,
    });
    if (!text.value) error.value = t('records.aiQuoteDraftEmpty');
  } catch (err) {
    error.value = err?.message || t('records.aiQuoteDraftFailed');
  } finally {
    loading.value = false;
  }
}

defineExpose({ runQuoteDraft, clear });
</script>
