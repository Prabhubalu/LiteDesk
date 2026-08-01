<template>
  <SettingsScrollPanel :save-bar-visible="!loading && !error && hasChanges && canEdit">
    <template #header>
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.tabCurrency') }}</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ t('settings.currencyPageSubtitle') }}
        </p>
      </div>
    </template>

    <div v-if="loading" class="flex items-center justify-center py-24">
      <div class="flex flex-col items-center gap-3">
        <div class="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-indigo-600 dark:border-gray-700 dark:border-t-indigo-400"></div>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.currencyLoading') }}</p>
      </div>
    </div>

    <div
      v-else-if="error"
      class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3"
    >
      <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex-shrink-0">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div>
        <h3 class="text-sm font-semibold text-red-900 dark:text-red-200">{{ t('settings.currencyLoadFailed') }}</h3>
        <p class="text-sm text-red-700 dark:text-red-300 mt-1">{{ error.message || t('settings.pleaseTryAgain') }}</p>
        <button
          type="button"
          class="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100"
          @click="fetchSettings"
        >
          {{ t('actions.retry') }}
        </button>
      </div>
    </div>

    <div v-else class="space-y-6">
      <!-- Base currency -->
      <section class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.currencyBaseLabel') }}</h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.currencyBaseHint') }}</p>
        <div class="mt-4 flex flex-wrap items-center gap-3">
          <span
            class="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-white"
          >
            <span class="text-base text-emerald-600 dark:text-emerald-400">{{ baseCurrencyMeta?.symbol || '' }}</span>
            {{ baseCurrencyLabel }}
          </span>
          <RouterLink
            :to="{ path: '/settings', query: { tab: 'organization' } }"
            class="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
          >
            {{ t('settings.currencyEditBaseLink') }}
          </RouterLink>
        </div>
      </section>

      <!-- Currency list -->
      <section class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.currencyListTitle') }}</h3>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {{ t('settings.currencyListHint', { base: baseCurrency }) }}
          </p>
        </div>

        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-900/40">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {{ t('settings.currencyColCurrency') }}
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {{ t('settings.currencyColEnabled') }}
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {{ t('settings.currencyColConversion', { base: baseCurrency }) }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr
                v-for="row in rows"
                :key="row.code"
                class="hover:bg-gray-50/80 dark:hover:bg-gray-900/30"
                :class="row.isBase ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''"
              >
                <td class="px-6 py-3.5 whitespace-nowrap">
                  <div class="flex items-center gap-2.5">
                    <span class="text-sm font-medium text-gray-500 dark:text-gray-400 w-8">{{ row.symbol }}</span>
                    <div>
                      <div class="text-sm font-semibold text-gray-900 dark:text-white">
                        {{ row.code }}
                        <span
                          v-if="row.isBase"
                          class="ml-1.5 inline-flex items-center rounded-md bg-indigo-100 dark:bg-indigo-900/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300"
                        >
                          {{ t('settings.currencyBaseBadge') }}
                        </span>
                      </div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">{{ row.name }}</div>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-3.5 whitespace-nowrap">
                  <button
                    type="button"
                    role="switch"
                    :aria-checked="row.enabled"
                    :disabled="!canEdit || row.isBase"
                    class="relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    :class="row.enabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'"
                    @click="toggleEnabled(row)"
                  >
                    <span
                      class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                      :class="row.enabled ? 'translate-x-5' : 'translate-x-0'"
                    />
                  </button>
                </td>
                <td class="px-6 py-3.5 whitespace-nowrap">
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      1 {{ baseCurrency }} =
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      :value="row.conversionRate"
                      :disabled="!canEdit || row.isBase || !row.enabled"
                      class="w-28 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 dark:disabled:bg-gray-800 dark:disabled:text-gray-500"
                      @input="onRateInput(row, $event)"
                    />
                    <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ row.code }}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <SettingsSaveBar
      :visible="!loading && !error && hasChanges && canEdit"
      :saving="saving"
      @reset="resetForm"
      @save="handleSubmit"
    />
  </SettingsScrollPanel>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import SettingsSaveBar from '@/components/settings/SettingsSaveBar.vue';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotifications } from '@/composables/useNotifications';
import { ORG_CURRENCIES } from '@/utils/orgRegionalOptions';

const { t } = useI18n();
const authStore = useAuthStore();
const { success: notifySuccess, error: notifyError } = useNotifications();

const loading = ref(true);
const saving = ref(false);
const error = ref(null);
const baseCurrency = ref('USD');
const rows = ref([]);
const originalRows = ref([]);

const canEdit = computed(() => {
  if (authStore.user?.isOwner) return true;
  if (String(authStore.user?.role || '').toLowerCase() === 'admin') return true;
  return Boolean(authStore.user?.permissions?.settings?.edit);
});

const baseCurrencyMeta = computed(() =>
  ORG_CURRENCIES.find((c) => c.code === baseCurrency.value) || null
);

const baseCurrencyLabel = computed(() => {
  const meta = baseCurrencyMeta.value;
  if (!meta) return baseCurrency.value;
  return `${meta.symbol}  ${meta.code} — ${meta.name}`;
});

const hasChanges = computed(() =>
  JSON.stringify(serializeRows(rows.value)) !== JSON.stringify(serializeRows(originalRows.value))
);

function serializeRows(list) {
  return list
    .filter((r) => !r.isBase)
    .map((r) => ({
      code: r.code,
      enabled: Boolean(r.enabled),
      conversionRate: Number(r.conversionRate) > 0 ? Number(r.conversionRate) : 1,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

function buildRows(base, savedCurrencies) {
  const byCode = new Map(
    (Array.isArray(savedCurrencies) ? savedCurrencies : []).map((c) => [c.code, c])
  );

  return ORG_CURRENCIES.map((meta) => {
    const isBase = meta.code === base;
    const saved = byCode.get(meta.code);
    return {
      code: meta.code,
      name: meta.name,
      symbol: meta.symbol,
      isBase,
      enabled: isBase ? true : Boolean(saved?.enabled),
      conversionRate: isBase ? 1 : (Number(saved?.conversionRate) > 0 ? Number(saved.conversionRate) : 1),
    };
  });
}

const fetchSettings = async () => {
  loading.value = true;
  error.value = null;
  try {
    const data = await apiClient('/settings/organization', { method: 'GET', cache: 'no-store' });
    if (!data?.success || !data.data) {
      error.value = new Error('Invalid response from server');
      return;
    }
    const base = data.data.currency || 'USD';
    baseCurrency.value = base;
    const next = buildRows(base, data.data.currencies);
    rows.value = next;
    originalRows.value = JSON.parse(JSON.stringify(next));
  } catch (err) {
    console.error('Failed to fetch currency settings:', err);
    error.value = err;
  } finally {
    loading.value = false;
  }
};

const toggleEnabled = (row) => {
  if (!canEdit.value || row.isBase) return;
  row.enabled = !row.enabled;
  if (row.enabled && !(Number(row.conversionRate) > 0)) {
    row.conversionRate = 1;
  }
};

const onRateInput = (row, event) => {
  if (!canEdit.value || row.isBase) return;
  const raw = event?.target?.value;
  const num = Number(raw);
  row.conversionRate = Number.isFinite(num) ? num : 0;
};

const resetForm = () => {
  rows.value = JSON.parse(JSON.stringify(originalRows.value));
};

const handleSubmit = async () => {
  if (!canEdit.value) return;
  saving.value = true;
  try {
    const payload = {
      currencies: serializeRows(rows.value),
    };

    for (const row of payload.currencies) {
      if (row.enabled && (!(Number(row.conversionRate) > 0))) {
        notifyError(t('settings.currencyRateInvalid', { code: row.code }));
        saving.value = false;
        return;
      }
    }

    const data = await apiClient('/settings/organization', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    if (data?.success) {
      const next = buildRows(baseCurrency.value, data.data?.currencies ?? payload.currencies);
      rows.value = next;
      originalRows.value = JSON.parse(JSON.stringify(next));
      if (authStore.organization) {
        authStore.organization = {
          ...authStore.organization,
          settings: {
            ...(authStore.organization.settings || {}),
            currencies: serializeRows(next),
          },
        };
        localStorage.setItem('organization', JSON.stringify(authStore.organization));
      }
      if (typeof authStore.syncI18nFromOrganization === 'function') {
        await authStore.syncI18nFromOrganization();
      }
      notifySuccess(t('settings.currencySaveSuccess'));
    } else {
      notifyError(data?.message || t('settings.currencySaveFailed'));
    }
  } catch (err) {
    console.error('Failed to update currency settings:', err);
    notifyError(err?.message || t('settings.currencySaveFailed'));
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  fetchSettings();
});
</script>
