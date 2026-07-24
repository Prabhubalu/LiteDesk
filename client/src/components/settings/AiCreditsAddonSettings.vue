<template>
  <SettingsScrollPanel class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <template #header>
      <div class="flex min-w-0 flex-1 items-start gap-3">
        <button
          type="button"
          class="mt-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          :title="t('settings.addonsBackToHub')"
          @click="emit('back')"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.addonsAiCreditsTitle') }}</h2>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsAiCreditsDesc') }}</p>
        </div>
      </div>
    </template>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
    </div>

    <div v-else-if="error" class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
      <p class="text-sm text-red-800 dark:text-red-300">{{ error }}</p>
    </div>

    <div v-else class="space-y-6">
      <section
        v-if="aiCredits"
        class="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40"
      >
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsAiCreditsBalanceTitle') }}</h3>
        <dl class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.aiTokensAvailable') }}</dt>
            <dd class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ formatNumber(aiCredits.tokensAvailable ?? aiCredits.tokensBalance) }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.aiTokensConsumed') }}</dt>
            <dd class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ formatNumber(aiCredits.tokensConsumed ?? 0) }}
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {{ t('settings.addonsAiCreditsPacksTitle') }}
        </h3>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div
            v-for="pack in tokenPacks"
            :key="pack.packKey"
            class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
          >
            <h4 class="text-base font-semibold text-gray-900 dark:text-white">{{ pack.name }}</h4>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {{ t('settings.addonsAiCreditsPackTokens', { count: formatNumber(pack.tokens) }) }}
            </p>
            <p class="mt-3 text-2xl font-bold text-gray-900 dark:text-white">{{ formatPrice(pack) }}</p>
            <button
              type="button"
              class="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              :disabled="purchasingKey === pack.packKey"
              @click="purchasePack(pack.packKey)"
            >
              {{ purchasingKey === pack.packKey ? t('states.loading') : t('settings.addonsAiCreditsPurchase') }}
            </button>
          </div>
        </div>
      </section>

      <p class="text-xs text-gray-500 dark:text-gray-400">
        {{ t('settings.addonsAiCreditsBillingNote') }}
      </p>
    </div>
  </SettingsScrollPanel>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';

const emit = defineEmits(['back']);

const { t } = useI18n();
const notifications = useNotifications();

const loading = ref(true);
const error = ref('');
const addon = ref(null);
const purchasingKey = ref('');

const aiCredits = computed(() => addon.value?.aiCredits || null);
const tokenPacks = computed(() => addon.value?.pricing?.creditPacks || []);

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatPrice(pack) {
  const cents = Number(pack?.priceCents || 0);
  const currency = String(pack?.currency || 'USD').toUpperCase();
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
}

async function loadAddon() {
  loading.value = true;
  error.value = '';
  try {
    const res = await apiClient('/settings/addons/ai_credits', { method: 'GET' });
    addon.value = res?.addon || null;
    if (!addon.value?.installed) {
      error.value = t('settings.addonsAiCreditsNotInstalled');
    }
  } catch (err) {
    error.value = err?.message || t('settings.addonsLoadFailed');
    addon.value = null;
  } finally {
    loading.value = false;
  }
}

async function purchasePack(packKey) {
  purchasingKey.value = packKey;
  try {
    const res = await apiClient.post('/settings/addons/ai_credits/purchase', { packKey });
    if (res?.data?.tokensBalance != null || res?.data?.tokensAvailable != null) {
      addon.value = {
        ...(addon.value || {}),
        aiCredits: {
          tokensBalance: res.data.tokensAvailable ?? res.data.tokensBalance,
          tokensAvailable: res.data.tokensAvailable ?? res.data.tokensBalance,
          tokensGranted: res.data.tokensGranted,
          tokensConsumed: res.data.tokensConsumed ?? 0,
        },
      };
    } else {
      await loadAddon();
    }
    notifications.success(t('settings.addonsAiCreditsPurchaseSuccess'));
  } catch (err) {
    notifications.error(err?.message || t('settings.addonsAiCreditsPurchaseFailed'));
  } finally {
    purchasingKey.value = '';
  }
}

onMounted(loadAddon);
</script>
