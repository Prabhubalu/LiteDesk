<template>
  <div
    v-if="visible"
    class="border-b border-rose-100 bg-rose-50/70 px-4 py-2 sm:px-5 dark:border-rose-900/40 dark:bg-rose-950/30"
  >
    <div class="mb-1 flex items-center justify-between gap-2">
      <span class="text-xs font-semibold text-rose-900 dark:text-rose-100">
        {{ t('records.aiDuplicatesTitle') }}
      </span>
      <button
        type="button"
        class="text-xs font-medium text-rose-700 hover:text-rose-900 dark:text-rose-300"
        @click="clear"
      >
        {{ t('actions.close') }}
      </button>
    </div>
    <p v-if="loading" class="text-xs text-rose-800 dark:text-rose-200">{{ t('records.aiDuplicatesRunning') }}</p>
    <p v-else-if="error" class="text-xs text-red-600 dark:text-red-400">{{ error }}</p>
    <template v-else>
      <pre class="whitespace-pre-wrap font-sans text-xs leading-relaxed text-rose-950 dark:text-rose-50">{{ text }}</pre>
      <ul v-if="candidates.length" class="mt-2 space-y-1 text-[11px] text-rose-900 dark:text-rose-100">
        <li v-for="c in candidates" :key="c.peopleId || c.organizationRefId">
          • {{ labelFor(c) }}
          <span class="text-rose-700/70 dark:text-rose-200/70">({{ c.matchReason }})</span>
        </li>
      </ul>
      <p class="mt-2 text-[11px] text-rose-800/80 dark:text-rose-200/80">{{ t('records.aiDuplicatesConfirmHint') }}</p>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { trackAiAbilityUsed } from '@/utils/aiFeedback';

const props = defineProps({
  entity: {
    type: String,
    default: 'people',
    validator: (v) => ['people', 'organizations'].includes(v),
  },
  recordId: { type: String, default: '' },
});

const { t } = useI18n();
const loading = ref(false);
const text = ref('');
const error = ref('');
const candidates = ref([]);

const visible = computed(() => Boolean(loading.value || text.value || error.value));

function clear() {
  loading.value = false;
  text.value = '';
  error.value = '';
  candidates.value = [];
}

function labelFor(c) {
  if (props.entity === 'organizations') {
    return c.name || c.organizationRefId || '';
  }
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
  return name || c.email || c.peopleId || '';
}

async function runSuggest() {
  const id = String(props.recordId || '').trim();
  if (!id || loading.value) return;
  loading.value = true;
  text.value = '';
  error.value = '';
  candidates.value = [];
  try {
    const path =
      props.entity === 'organizations'
        ? `/ai/organizations/${id}/duplicates`
        : `/ai/people/${id}/duplicates`;
    const data = await apiClient.post(path, {});
    text.value = String(data?.text || '').trim();
    candidates.value = Array.isArray(data?.candidates) ? data.candidates : [];
    trackAiAbilityUsed({
      abilityKey: 'duplicate_suggest',
      provider: data?.provider,
      model: data?.model,
      keyMode: data?.keyMode,
    });
    if (!text.value && !candidates.value.length) {
      error.value = t('records.aiDuplicatesEmpty');
    }
  } catch (err) {
    error.value = err?.message || t('records.aiDuplicatesFailed');
  } finally {
    loading.value = false;
  }
}

defineExpose({ runSuggest, clear, loading });
</script>
