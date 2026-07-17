<template>
  <div
    v-if="visible"
    class="border-b border-violet-100 bg-violet-50/70 px-4 py-2 sm:px-5 dark:border-violet-900/40 dark:bg-violet-950/30"
  >
    <div class="mb-1 flex items-center justify-between gap-2">
      <span class="text-xs font-semibold text-violet-900 dark:text-violet-100">
        {{ title }}
      </span>
      <button
        type="button"
        class="text-xs font-medium text-violet-700 hover:text-violet-900 dark:text-violet-300"
        @click="clear"
      >
        {{ t('actions.close') }}
      </button>
    </div>
    <p v-if="loading" class="text-xs text-violet-800 dark:text-violet-200">{{ t('states.loading') }}</p>
    <p v-else-if="error" class="text-xs text-red-600 dark:text-red-400">{{ error }}</p>
    <template v-else>
      <p v-if="summary" class="text-xs text-violet-950 dark:text-violet-50">{{ summary }}</p>
      <ul v-if="proposals.length" class="mt-2 space-y-1.5">
        <li
          v-for="(p, idx) in proposals"
          :key="`${p.action}-${idx}`"
          class="text-[11px] text-violet-900 dark:text-violet-100"
        >
          <strong>{{ p.label || p.action }}</strong>
          <span class="text-violet-700/80 dark:text-violet-200/80"> — {{ p.rationale }}</span>
          <span v-if="p.confidence != null" class="text-violet-600/70">
            ({{ Math.round((p.confidence || 0) * 100) }}%)
          </span>
        </li>
      </ul>
      <p class="mt-2 text-[11px] text-violet-800/80 dark:text-violet-200/80">
        {{ t('cases.recordAiProposeOnlyHint') }}
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
  caseId: { type: String, default: '' },
  mode: {
    type: String,
    default: 'policy',
    validator: (v) => ['policy', 'resolution'].includes(v),
  },
});

const { t } = useI18n();
const loading = ref(false);
const error = ref('');
const summary = ref('');
const proposals = ref([]);

const visible = computed(() => Boolean(loading.value || summary.value || proposals.value.length || error.value));
const title = computed(() =>
  props.mode === 'resolution'
    ? t('cases.recordAiResolutionTitle')
    : t('cases.recordAiPolicyTitle')
);

function clear() {
  loading.value = false;
  error.value = '';
  summary.value = '';
  proposals.value = [];
}

async function run() {
  const id = String(props.caseId || '').trim();
  if (!id || loading.value) return;
  loading.value = true;
  error.value = '';
  summary.value = '';
  proposals.value = [];
  try {
    const path =
      props.mode === 'resolution'
        ? `/ai/cases/${id}/resolution-propose`
        : `/ai/cases/${id}/policy-suggest`;
    const data = await apiClient.post(path, {});
    summary.value = String(data?.summary || '').trim();
    proposals.value = Array.isArray(data?.proposals) ? data.proposals : [];
    trackAiAbilityUsed({
      abilityKey: props.mode === 'resolution' ? 'case_resolution' : 'policy_suggest',
      provider: data?.provider,
      model: data?.model,
      keyMode: data?.keyMode,
    });
    if (!summary.value && !proposals.value.length) {
      error.value = t('cases.recordAiProposeEmpty');
    }
  } catch (err) {
    error.value = err?.message || t('cases.recordAiProposeFailed');
  } finally {
    loading.value = false;
  }
}

defineExpose({ run, clear, loading });
</script>
