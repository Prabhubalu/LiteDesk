<template>
  <div class="mx-auto max-w-5xl">
    <div class="mb-8">
      <router-link
        to="/control"
        class="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
      >
        ← {{ t('process.controlPlaneHeading') }}
      </router-link>
      <h1 class="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
        {{ t('process.controlPlaneAiTitle') }}
      </h1>
      <p class="mt-2 text-gray-600 dark:text-gray-400">
        {{ t('process.controlPlaneAiSubtitle') }}
      </p>
    </div>

    <div
      v-if="loadError"
      class="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
    >
      {{ loadError }}
    </div>

    <div v-else-if="loading" class="flex justify-center py-16">
      <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
    </div>

    <form
      v-else
      class="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      @submit.prevent="save"
    >
      <section class="space-y-4">
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">
          {{ t('process.controlPlaneAiDefaultsHeading') }}
        </h2>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ t('process.controlPlaneAiDefaultsHint') }}
        </p>

        <label class="block text-sm">
          <span class="text-gray-700 dark:text-gray-300">{{ t('process.controlPlaneAiDefaultProvider') }}</span>
          <HeadlessSelect
            v-model="form.defaultLlmProvider"
            class="mt-1"
            wrapper-class="mt-1"
            :options="providerOptions"
            :placeholder="t('process.controlPlaneAiSelectProvider')"
            teleport
          />
        </label>

        <label class="block text-sm">
          <span class="text-gray-700 dark:text-gray-300">{{ t('process.controlPlaneAiDefaultModel') }}</span>
          <HeadlessSelect
            v-model="form.defaultLlmModel"
            class="mt-1"
            wrapper-class="mt-1"
            :options="modelOptions"
            :placeholder="t('process.controlPlaneAiSelectModel')"
            allow-empty
            :empty-label="t('process.controlPlaneAiModelAuto')"
            empty-value=""
            teleport
            searchable
          />
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {{ t('process.controlPlaneAiModelHint') }}
          </p>
        </label>
      </section>

      <section class="space-y-4 border-t border-gray-200 pt-6 dark:border-gray-700">
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">
          {{ t('process.controlPlaneAiKeysHeading') }}
        </h2>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ t('process.controlPlaneAiKeysHint') }}
        </p>

        <div
          v-for="row in providerKeyRows"
          :key="row.provider"
          class="rounded-lg border border-gray-100 p-4 dark:border-gray-700/80"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ row.provider }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                <span v-if="row.hasKey && row.last4">
                  {{ t('process.controlPlaneAiKeySaved', { last4: row.last4 }) }}
                </span>
                <span v-else-if="row.hasKey">{{ t('process.controlPlaneAiKeyPresent') }}</span>
                <span v-else>{{ t('process.controlPlaneAiKeyMissing') }}</span>
                · {{ t('process.controlPlaneAiKeySource', { source: row.source }) }}
              </p>
            </div>
            <button
              v-if="row.hasKey"
              type="button"
              class="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
              @click="clearKey(row.provider)"
            >
              {{ t('process.controlPlaneAiClearKey') }}
            </button>
          </div>
          <input
            v-model="form.apiKeys[row.provider]"
            type="password"
            autocomplete="new-password"
            class="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            :placeholder="t('process.controlPlaneAiKeyPlaceholder')"
          />
        </div>
      </section>

      <section class="space-y-4 border-t border-gray-200 pt-6 dark:border-gray-700">
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">
          {{ t('process.controlPlaneAiPricingHeading') }}
        </h2>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ t('process.controlPlaneAiPricingHint') }}
        </p>

        <div class="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700/80">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
                <th class="px-3 py-2">{{ t('process.controlPlaneAiPricingPackKey') }}</th>
                <th class="px-3 py-2">{{ t('process.controlPlaneAiPricingPackName') }}</th>
                <th class="px-3 py-2">{{ t('process.controlPlaneAiPricingTokens') }}</th>
                <th class="px-3 py-2">{{ t('process.controlPlaneAiPricingPriceCents') }}</th>
                <th class="px-3 py-2">{{ t('process.controlPlaneAiPricingPricePreview') }}</th>
                <th class="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(pack, idx) in form.tokenPacks"
                :key="`${pack.packKey}-${idx}`"
                class="border-b border-gray-100 dark:border-gray-800"
              >
                <td class="px-3 py-2">
                  <input
                    v-model="pack.packKey"
                    type="text"
                    class="w-full min-w-[7rem] rounded-lg border border-gray-300 px-2 py-1 font-mono text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </td>
                <td class="px-3 py-2">
                  <input
                    v-model="pack.name"
                    type="text"
                    class="w-full min-w-[9rem] rounded-lg border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </td>
                <td class="px-3 py-2">
                  <input
                    v-model.number="pack.tokens"
                    type="number"
                    min="1"
                    class="w-32 rounded-lg border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </td>
                <td class="px-3 py-2">
                  <input
                    v-model.number="pack.priceCents"
                    type="number"
                    min="0"
                    class="w-24 rounded-lg border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </td>
                <td class="px-3 py-2 text-gray-700 dark:text-gray-300">
                  {{ formatMoney(pack.priceCents, pack.currency) }}
                </td>
                <td class="px-3 py-2 text-right">
                  <button
                    type="button"
                    class="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                    @click="removePack(idx)"
                  >
                    {{ t('process.controlPlaneAiPricingRemove') }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <button
          type="button"
          class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          @click="addPack"
        >
          {{ t('process.controlPlaneAiPricingAddPack') }}
        </button>
      </section>

      <div class="flex flex-wrap items-center gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
        <button
          type="submit"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          :disabled="saving"
        >
          {{ saving ? t('process.controlPlaneAiSaving') : t('process.controlPlaneAiSave') }}
        </button>
        <p v-if="saveMessage" class="text-sm text-emerald-700 dark:text-emerald-400">{{ saveMessage }}</p>
      </div>
    </form>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotifications } from '@/composables/useNotifications';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const notifications = useNotifications();

const loading = ref(true);
const loadError = ref('');
const saving = ref(false);
const saveMessage = ref('');
const clears = reactive({});
const providerKeyRows = ref([]);
const modelsByProvider = ref({});

const form = reactive({
  defaultLlmProvider: 'anthropic',
  defaultLlmModel: '',
  apiKeys: {},
  tokenPacks: [],
});

const providerOptions = computed(() =>
  providerKeyRows.value.map((row) => ({
    value: row.provider,
    label: row.provider,
  }))
);

const modelOptions = computed(() => {
  const models = modelsByProvider.value?.[form.defaultLlmProvider] || [];
  return models.map((model) => ({ value: model, label: model }));
});

watch(
  () => form.defaultLlmProvider,
  () => {
    const models = modelsByProvider.value?.[form.defaultLlmProvider] || [];
    if (form.defaultLlmModel && !models.includes(form.defaultLlmModel)) {
      form.defaultLlmModel = '';
    }
  }
);

function formatMoney(cents, currency = 'USD') {
  const amount = Number(cents || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: String(currency || 'USD').toUpperCase(),
    }).format(amount);
  } catch {
    return `$${(amount || 0).toFixed(2)}`;
  }
}

function mapPacks(packs) {
  if (!Array.isArray(packs) || packs.length === 0) {
    return [
      { packKey: 'ai_tokens_1m', name: '1,000,000 tokens', tokens: 1_000_000, priceCents: 1000, currency: 'USD' },
      { packKey: 'ai_tokens_5m', name: '5,000,000 tokens', tokens: 5_000_000, priceCents: 4500, currency: 'USD' },
      { packKey: 'ai_tokens_25m', name: '25,000,000 tokens', tokens: 25_000_000, priceCents: 20000, currency: 'USD' },
    ];
  }
  return packs.map((pack) => ({
    packKey: pack.packKey || '',
    name: pack.name || '',
    tokens: Number(pack.tokens) || 0,
    priceCents: Number(pack.priceCents) || 0,
    currency: pack.currency || 'USD',
  }));
}

function addPack() {
  form.tokenPacks.push({
    packKey: `ai_tokens_${Date.now()}`,
    name: '',
    tokens: 1_000_000,
    priceCents: 1000,
    currency: 'USD',
  });
}

function removePack(idx) {
  form.tokenPacks.splice(idx, 1);
}

function clearKey(provider) {
  form.apiKeys[provider] = '';
  clears[provider] = true;
}

function applyConfig(data) {
  form.defaultLlmProvider = data.defaultLlmProvider || 'anthropic';
  form.defaultLlmModel = data.defaultLlmModel || '';
  providerKeyRows.value = Array.isArray(data.providers) ? data.providers : [];
  modelsByProvider.value = data.supported?.llmModelsByProvider || {};
  form.apiKeys = {};
  for (const row of providerKeyRows.value) {
    form.apiKeys[row.provider] = '';
    clears[row.provider] = false;
  }
  form.tokenPacks = mapPacks(data.tokenPacks);
}

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    if (!authStore.user?.isPlatformAdmin) {
      notifications.error(t('process.controlPlanePlatformOnlyBody'));
      router.push('/control');
      return;
    }
    const res = await apiClient('/platform/ai-settings', { method: 'GET' });
    if (!res?.success) {
      loadError.value = res?.message || t('process.controlPlaneAiLoadFailed');
      return;
    }
    applyConfig(res.data || {});
  } catch (err) {
    loadError.value = err?.message || t('process.controlPlaneAiLoadFailed');
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  saveMessage.value = '';
  try {
    const apiKeys = {};
    for (const row of providerKeyRows.value) {
      const typed = String(form.apiKeys[row.provider] || '').trim();
      if (typed) {
        apiKeys[row.provider] = typed;
      } else if (clears[row.provider]) {
        apiKeys[row.provider] = null;
      }
    }

    const tokenPacks = form.tokenPacks
      .filter((pack) => String(pack.packKey || '').trim() && Number(pack.tokens) > 0)
      .map((pack) => ({
        packKey: String(pack.packKey).trim(),
        name: String(pack.name || '').trim() || String(pack.packKey).trim(),
        tokens: Math.max(1, Math.floor(Number(pack.tokens) || 0)),
        priceCents: Math.max(0, Math.floor(Number(pack.priceCents) || 0)),
        currency: String(pack.currency || 'USD').toUpperCase(),
      }));

    const res = await apiClient('/platform/ai-settings', {
      method: 'PUT',
      body: JSON.stringify({
        defaultLlmProvider: form.defaultLlmProvider,
        defaultLlmModel: form.defaultLlmModel || null,
        apiKeys,
        tokenPacks,
      }),
    });
    if (!res?.success) {
      notifications.error(res?.message || t('process.controlPlaneAiSaveFailed'));
      return;
    }
    applyConfig(res.data || {});
    saveMessage.value = t('process.controlPlaneAiSaveSuccess');
    notifications.success(t('process.controlPlaneAiSaveSuccess'));
  } catch (err) {
    notifications.error(err?.message || t('process.controlPlaneAiSaveFailed'));
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>
