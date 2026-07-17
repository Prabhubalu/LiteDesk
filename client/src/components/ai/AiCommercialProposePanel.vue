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
    <p v-if="loading" class="text-xs text-amber-800 dark:text-amber-200">{{ t('states.loading') }}</p>
    <p v-else-if="error" class="text-xs text-red-600 dark:text-red-400">{{ error }}</p>
    <template v-else>
      <p v-if="summary" class="text-xs text-amber-950 dark:text-amber-50">{{ summary }}</p>
      <ul v-if="proposals.length" class="mt-2 space-y-1.5">
        <li
          v-for="(p, idx) in proposals"
          :key="`${p.action}-${idx}`"
          class="text-[11px] text-amber-900 dark:text-amber-100"
        >
          <strong>{{ p.label || p.action }}</strong>
          <span class="text-amber-700/80 dark:text-amber-200/80"> — {{ p.rationale }}</span>
          <span v-if="p.confidence != null" class="text-amber-600/70">
            ({{ Math.round((p.confidence || 0) * 100) }}%)
          </span>
        </li>
      </ul>
      <ul v-if="gaps.length" class="mt-2 space-y-1 text-[11px] text-amber-900/80 dark:text-amber-100/80">
        <li v-for="(gap, idx) in gaps" :key="`${gap.code}-${idx}`">• {{ gap.message }}</li>
      </ul>
      <p class="mt-2 text-[11px] text-amber-800/80 dark:text-amber-200/80">
        {{ hint }}
      </p>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { trackAiAbilityUsed } from '@/utils/aiFeedback';

const props = defineProps({
  mode: {
    type: String,
    default: 'commercial',
    validator: (v) => ['commercial', 'collection'].includes(v),
  },
  dealId: { type: String, default: '' },
});

const { t } = useI18n();
const loading = ref(false);
const error = ref('');
const summary = ref('');
const proposals = ref([]);
const gaps = ref([]);

const visible = computed(
  () => Boolean(loading.value || summary.value || proposals.value.length || error.value)
);
const title = computed(() =>
  props.mode === 'collection'
    ? t('records.aiCollectionAgentTitle')
    : t('records.aiCommercialAgentTitle')
);
const hint = computed(() =>
  props.mode === 'collection'
    ? t('records.aiCollectionAgentConfirmHint')
    : t('records.aiCommercialAgentConfirmHint')
);

function clear() {
  loading.value = false;
  error.value = '';
  summary.value = '';
  proposals.value = [];
  gaps.value = [];
}

async function run() {
  if (loading.value) return;
  if (props.mode === 'commercial' && !String(props.dealId || '').trim()) return;

  loading.value = true;
  error.value = '';
  summary.value = '';
  proposals.value = [];
  gaps.value = [];
  try {
    const path =
      props.mode === 'collection'
        ? '/ai/agents/collection'
        : `/ai/agents/commercial/${props.dealId}`;
    const data = await apiClient.post(path, props.mode === 'collection' ? { limit: 25 } : {});
    summary.value = String(data?.summary || '').trim();
    proposals.value = Array.isArray(data?.proposals) ? data.proposals : [];
    gaps.value = Array.isArray(data?.coverageGaps) ? data.coverageGaps : [];
    trackAiAbilityUsed({
      abilityKey: props.mode === 'collection' ? 'collection_agent' : 'commercial_agent',
      provider: data?.provider,
      model: data?.model,
      keyMode: data?.keyMode,
    });
    if (!summary.value && !proposals.value.length) {
      error.value =
        props.mode === 'collection'
          ? t('records.aiCollectionAgentEmpty')
          : t('records.aiCommercialAgentEmpty');
    }
  } catch (err) {
    error.value =
      err?.message
      || (props.mode === 'collection'
        ? t('records.aiCollectionAgentFailed')
        : t('records.aiCommercialAgentFailed'));
  } finally {
    loading.value = false;
  }
}

defineExpose({ run, clear, loading });
</script>
