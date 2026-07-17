<template>
  <div
    v-if="visible"
    class="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/40 dark:bg-amber-950/30"
  >
    <div class="mb-2 flex items-center justify-between gap-2">
      <span class="text-sm font-semibold text-amber-900 dark:text-amber-100">
        {{ t('audit.aiNarrativeTitle') }}
      </span>
      <button
        type="button"
        class="text-xs font-medium text-amber-700 hover:text-amber-900 dark:text-amber-300"
        @click="clear"
      >
        {{ t('actions.close') }}
      </button>
    </div>
    <p v-if="loading" class="text-xs text-amber-800 dark:text-amber-200">{{ t('audit.aiNarrativeRunning') }}</p>
    <p v-else-if="error" class="text-xs text-red-600 dark:text-red-400">{{ error }}</p>
    <template v-else>
      <p
        v-if="overallRisk"
        class="mb-2 text-[11px] font-medium uppercase tracking-wide text-amber-800 dark:text-amber-200"
      >
        {{ t('audit.aiNarrativeRisk', { risk: overallRisk }) }}
      </p>
      <pre
        v-if="narrative"
        class="whitespace-pre-wrap font-sans text-xs leading-relaxed text-amber-950 dark:text-amber-50"
      >{{ narrative }}</pre>
      <ul v-if="actions.length" class="mt-3 space-y-2">
        <li
          v-for="a in actions"
          :key="a.questionId"
          class="rounded-lg border border-amber-200 bg-white/70 p-2 text-[11px] text-amber-950 dark:border-amber-800 dark:bg-neutral-900/50 dark:text-amber-50"
        >
          <div class="font-semibold">{{ a.questionText || a.questionId }}</div>
          <p v-if="a.auditorFinding" class="mt-1">{{ a.auditorFinding }}</p>
          <p v-if="a.suggestedAction" class="mt-1 text-amber-800/80 dark:text-amber-200/80">
            {{ a.suggestedAction }}
          </p>
          <span class="mt-1 inline-block text-amber-700/70 dark:text-amber-300/70">
            {{ a.priority }} · {{ Math.round((a.confidence || 0) * 100) }}%
          </span>
        </li>
      </ul>
      <p class="mt-2 text-[11px] text-amber-800/80 dark:text-amber-200/80">
        {{ t('audit.aiNarrativeConfirmHint') }}
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
  responseId: { type: String, default: '' },
});

const { t } = useI18n();
const loading = ref(false);
const error = ref('');
const narrative = ref('');
const overallRisk = ref('');
const actions = ref([]);

const visible = computed(
  () => Boolean(loading.value || narrative.value || actions.value.length || error.value)
);

function clear() {
  loading.value = false;
  error.value = '';
  narrative.value = '';
  overallRisk.value = '';
  actions.value = [];
}

async function run() {
  const id = String(props.responseId || '').trim();
  if (!id || loading.value) return;
  loading.value = true;
  error.value = '';
  narrative.value = '';
  overallRisk.value = '';
  actions.value = [];
  try {
    const data = await apiClient.post(`/ai/audit/responses/${id}/narrative`, {});
    narrative.value = String(data?.narrative || '').trim();
    overallRisk.value = String(data?.overallRisk || '').trim();
    actions.value = Array.isArray(data?.remediationActions) ? data.remediationActions : [];
    trackAiAbilityUsed({
      abilityKey: 'audit_narrative',
      provider: data?.provider,
      model: data?.model,
      keyMode: data?.keyMode,
    });
    if (!narrative.value && !actions.value.length) {
      error.value = t('audit.aiNarrativeEmpty');
    }
  } catch (err) {
    error.value = err?.message || t('audit.aiNarrativeFailed');
  } finally {
    loading.value = false;
  }
}

defineExpose({ run, clear, loading });
</script>
