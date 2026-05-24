<template>
  <section
    v-if="showDevTools"
    class="rounded-2xl border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 p-6 space-y-4"
  >
    <div>
      <h3 class="text-sm font-semibold text-amber-900 dark:text-amber-200">
        {{ t('common.localeDevTitle') }}
      </h3>
      <p class="mt-1 text-xs text-amber-800/80 dark:text-amber-300/80">
        {{ t('common.pseudoLocaleHint') }}
      </p>
    </div>

    <div class="space-y-2">
      <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">Pseudo locale</label>
      <select
        v-model="selectedPseudo"
        class="w-full max-w-md px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
        @change="applyPseudo"
      >
        <option value="">Off (use org language)</option>
        <option value="en-XA">en-XA — accent + length expansion</option>
        <option value="ar-XB">ar-XB — RTL + pseudo accents</option>
      </select>
    </div>

    <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
      <input v-model="telemetryOn" type="checkbox" class="rounded" @change="toggleTelemetry" />
      Enable i18n telemetry logging
    </label>

    <div v-if="recentEvents.length" class="text-xs font-mono text-gray-600 dark:text-gray-400 max-h-32 overflow-auto">
      <div v-for="(evt, i) in recentEvents" :key="i">{{ evt.type }}: {{ formatEvent(evt) }}</div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useLocale } from '@/composables/useLocale';
import {
  getRecentI18nTelemetry,
  onI18nTelemetry,
  setI18nTelemetryEnabled,
  isI18nTelemetryEnabled,
} from '@/i18n/telemetry';
import { I18N_DEV_PSEUDO_STORAGE_KEY } from '@/i18n/constants';

const { t } = useI18n();
const { setLanguage, clearPseudoLanguage } = useLocale();

const showDevTools = computed(
  () => import.meta.env.DEV || import.meta.env.VITE_ENABLE_I18N_DEV === 'true'
);

const selectedPseudo = ref('');
const telemetryOn = ref(false);
const recentEvents = ref([]);

let unsubscribe = null;

onMounted(() => {
  try {
    selectedPseudo.value = localStorage.getItem(I18N_DEV_PSEUDO_STORAGE_KEY) || '';
  } catch {
    selectedPseudo.value = '';
  }
  telemetryOn.value = isI18nTelemetryEnabled();
  recentEvents.value = [...getRecentI18nTelemetry()];
  unsubscribe = onI18nTelemetry((evt) => {
    recentEvents.value = [...getRecentI18nTelemetry()].slice(-20);
  });
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
});

async function applyPseudo() {
  if (!selectedPseudo.value) {
    await clearPseudoLanguage();
    try {
      localStorage.removeItem(I18N_DEV_PSEUDO_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return;
  }
  await setLanguage(selectedPseudo.value, true);
}

function toggleTelemetry() {
  setI18nTelemetryEnabled(telemetryOn.value);
}

function formatEvent(evt) {
  if (evt.type === 'missing_key') return `${evt.key} (${evt.locale})`;
  if (evt.type === 'locale_load_failed') return `${evt.locale}: ${evt.error}`;
  return JSON.stringify(evt);
}
</script>
