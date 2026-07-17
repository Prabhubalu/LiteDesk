<template>
  <div
    v-if="visible"
    class="border-b border-emerald-100 bg-emerald-50/70 px-4 py-2 sm:px-5 dark:border-emerald-900/40 dark:bg-emerald-950/30"
  >
    <div class="mb-1 flex items-center justify-between gap-2">
      <span class="text-xs font-semibold text-emerald-900 dark:text-emerald-100">
        {{ t('records.aiExtractTitle') }}
      </span>
      <button
        type="button"
        class="text-xs font-medium text-emerald-700 hover:text-emerald-900 dark:text-emerald-300"
        @click="clear"
      >
        {{ t('actions.close') }}
      </button>
    </div>

    <textarea
      v-model="sourceText"
      rows="3"
      class="w-full rounded border border-emerald-200 bg-white px-2 py-1.5 text-xs dark:border-emerald-800 dark:bg-gray-900 dark:text-gray-100"
      :placeholder="t('records.aiExtractPlaceholder')"
    />

    <div class="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="rounded border border-emerald-300 bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-900 disabled:opacity-50 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-100"
        :disabled="loading || !sourceText.trim()"
        @click="runExtract"
      >
        {{ loading ? t('records.aiExtractRunning') : t('records.aiExtract') }}
      </button>
      <button
        v-if="patches.length"
        type="button"
        class="rounded border border-emerald-600 bg-emerald-700 px-2 py-1 text-[11px] font-medium text-white disabled:opacity-50"
        :disabled="applying || !selectedPatches.length"
        @click="applySelected"
      >
        {{ applying ? t('states.saving') : t('records.aiExtractApply') }}
      </button>
    </div>

    <p v-if="error" class="mt-2 text-xs text-red-600 dark:text-red-400">{{ error }}</p>
    <ul v-if="patches.length" class="mt-2 space-y-1">
      <li
        v-for="(p, idx) in patches"
        :key="`${p.fieldKey}-${idx}`"
        class="flex items-start gap-2 text-[11px] text-emerald-950 dark:text-emerald-50"
      >
        <input v-model="selected[idx]" type="checkbox" class="mt-0.5 h-3 w-3 rounded border-emerald-400" />
        <span>
          <strong>{{ p.fieldKey }}</strong>: {{ p.value }}
          <span class="text-emerald-700/70 dark:text-emerald-200/70">
            ({{ Math.round((p.confidence || 0) * 100) }}%)
          </span>
          <span v-if="p.rationale" class="block text-emerald-800/70 dark:text-emerald-200/70">{{ p.rationale }}</span>
        </span>
      </li>
    </ul>
    <p v-if="patches.length" class="mt-2 text-[11px] text-emerald-800/80 dark:text-emerald-200/80">
      {{ t('records.aiExtractConfirmHint') }}
    </p>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { trackAiAbilityUsed } from '@/utils/aiFeedback';

const props = defineProps({
  moduleKey: { type: String, default: 'people' },
  recordId: { type: String, default: '' },
  /** When true, panel stays open for paste even before a run */
  open: { type: Boolean, default: false },
  /** Confirm-to-apply: parent persists selected patches */
  applyPatches: { type: Function, default: null },
});

const { t } = useI18n();
const openLocal = ref(false);
const loading = ref(false);
const applying = ref(false);
const sourceText = ref('');
const error = ref('');
const patches = ref([]);
const selected = reactive({});

const visible = computed(
  () => Boolean(props.open || openLocal.value || loading.value || patches.value.length || error.value)
);

const selectedPatches = computed(() =>
  patches.value.filter((_, idx) => selected[idx])
);

watch(
  () => props.open,
  (v) => {
    if (v) openLocal.value = true;
  }
);

function clear() {
  openLocal.value = false;
  loading.value = false;
  applying.value = false;
  sourceText.value = '';
  error.value = '';
  patches.value = [];
  Object.keys(selected).forEach((k) => delete selected[k]);
}

function openPanel() {
  openLocal.value = true;
}

async function runExtract() {
  const text = sourceText.value.trim();
  if (!text || loading.value) return;
  loading.value = true;
  error.value = '';
  patches.value = [];
  Object.keys(selected).forEach((k) => delete selected[k]);
  try {
    const data = await apiClient.post('/ai/extract-fields', {
      moduleKey: props.moduleKey,
      recordId: props.recordId || null,
      text,
    });
    patches.value = Array.isArray(data?.patches) ? data.patches : [];
    patches.value.forEach((_, idx) => {
      selected[idx] = true;
    });
    trackAiAbilityUsed({
      abilityKey: 'extract_fields',
      provider: data?.provider,
      model: data?.model,
      keyMode: data?.keyMode,
    });
    if (!patches.value.length) error.value = t('records.aiExtractEmpty');
  } catch (err) {
    error.value = err?.message || t('records.aiExtractFailed');
  } finally {
    loading.value = false;
  }
}

async function applySelected() {
  if (!selectedPatches.value.length || applying.value) return;
  if (typeof props.applyPatches !== 'function') {
    error.value = t('records.aiExtractApplyFailed');
    return;
  }
  applying.value = true;
  error.value = '';
  try {
    await props.applyPatches(selectedPatches.value);
    clear();
  } catch (err) {
    error.value = err?.message || t('records.aiExtractApplyFailed');
  } finally {
    applying.value = false;
  }
}

defineExpose({ openPanel, runExtract, clear, loading });
</script>
