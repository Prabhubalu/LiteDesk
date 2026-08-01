<template>
  <div class="mx-auto w-full max-w-2xl px-6 py-8">
    <div class="mb-6">
      <button type="button" class="mb-2 text-sm text-primary-600 hover:underline" @click="goHome">
        ← {{ t('analytics.homeTitle') }}
      </button>
      <h1 class="text-2xl font-semibold text-neutral-900 dark:text-white">
        {{ t('analytics.settingsTitle') }}
      </h1>
      <p class="mt-1 text-sm text-neutral-500">{{ t('analytics.settingsDescription') }}</p>
    </div>

    <div v-if="loading" class="py-16 text-center text-sm text-neutral-500">{{ t('states.loading') }}</div>

    <form
      v-else
      class="mb-8 space-y-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700"
      @submit.prevent="save"
    >
      <label class="block text-sm">
        <span class="mb-1 block font-medium">{{ t('analytics.settingsCacheTtl') }}</span>
        <input
          v-model.number="form.cacheTtlSeconds"
          type="number"
          min="0"
          class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
        />
      </label>
      <label class="block text-sm">
        <span class="mb-1 block font-medium">{{ t('analytics.settingsExportLimit') }}</span>
        <input
          v-model.number="form.exportRowLimit"
          type="number"
          min="1"
          class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
        />
      </label>
      <label class="block text-sm">
        <span class="mb-1 block font-medium">{{ t('analytics.settingsFiscalMonth') }}</span>
        <input
          v-model.number="form.fiscalYearStartMonth"
          type="number"
          min="1"
          max="12"
          class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
        />
      </label>
      <label class="block text-sm">
        <span class="mb-1 block font-medium">{{ t('analytics.settingsDefaultDatePreset') }}</span>
        <select
          v-model="form.defaultDatePreset"
          class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
        >
          <option value="last7days">{{ t('analytics.datePresetLast7') }}</option>
          <option value="last30days">{{ t('analytics.datePresetLast30') }}</option>
          <option value="thisMonth">{{ t('analytics.datePresetThisMonth') }}</option>
        </select>
      </label>
      <button
        type="submit"
        class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        :disabled="saving"
      >
        {{ t('actions.save') }}
      </button>
    </form>

    <section class="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
      <div class="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 class="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            {{ t('analytics.apiTokensTitle') }}
          </h2>
          <p class="mt-1 text-sm text-neutral-500">{{ t('analytics.apiTokensDescription') }}</p>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-600"
          @click="showTokenForm = !showTokenForm"
        >
          {{ t('analytics.apiTokensCreate') }}
        </button>
      </div>

      <form v-if="showTokenForm" class="mb-4 space-y-3 border-b border-neutral-200 pb-4 dark:border-neutral-700" @submit.prevent="submitToken">
        <label class="block text-sm">
          <span class="mb-1 block font-medium">{{ t('analytics.fieldName') }}</span>
          <input v-model="tokenForm.name" type="text" required class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900" />
        </label>
        <div class="flex flex-wrap gap-3 text-sm">
          <label v-for="scope in availableScopes" :key="scope" class="flex items-center gap-2">
            <input v-model="tokenForm.scopes" type="checkbox" :value="scope" />
            {{ scope }}
          </label>
        </div>
        <button type="submit" class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" :disabled="tokenSaving">
          {{ t('analytics.apiTokensCreate') }}
        </button>
      </form>

      <div
        v-if="createdToken"
        class="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
      >
        <p class="font-medium">{{ t('analytics.apiTokensCopyNow') }}</p>
        <code class="mt-2 block break-all rounded bg-white/80 px-2 py-1 dark:bg-neutral-900">{{ createdToken }}</code>
        <button type="button" class="mt-2 text-primary-600 hover:underline" @click="clearCreatedToken">
          {{ t('analytics.apiTokensDismiss') }}
        </button>
      </div>

      <div v-if="tokensLoading" class="py-6 text-center text-sm text-neutral-500">{{ t('states.loading') }}</div>
      <p v-else-if="!tokens.length" class="py-6 text-center text-sm text-neutral-500">{{ t('analytics.apiTokensEmpty') }}</p>
      <ul v-else class="divide-y divide-neutral-200 dark:divide-neutral-700">
        <li v-for="row in tokens" :key="row._id" class="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
          <div>
            <p class="font-medium">{{ row.name }}</p>
            <p class="text-xs text-neutral-500">{{ row.tokenPrefix }}… · {{ row.scopes.join(', ') }}</p>
            <p v-if="row.lastUsedAt" class="text-xs text-neutral-500">
              {{ t('analytics.apiTokensLastUsed') }}: {{ formatDate(row.lastUsedAt) }}
            </p>
          </div>
          <button
            v-if="row.status === 'active'"
            type="button"
            class="text-red-600 hover:underline disabled:opacity-50"
            :disabled="tokenSaving"
            @click="revoke(row._id)"
          >
            {{ t('analytics.apiTokensRevoke') }}
          </button>
          <span v-else class="text-xs capitalize text-neutral-500">{{ row.status }}</span>
        </li>
      </ul>
      <p class="mt-4 text-xs text-neutral-500">{{ t('analytics.apiTokensV1Hint') }}</p>
    </section>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAnalyticsHome } from '@/composables/useAnalyticsHome';
import { useAnalyticsApiTokens } from '@/composables/useAnalyticsApiTokens';
import {
  captureAnalyticsApiTokenCreated,
  captureAnalyticsSettingsUpdated,
  captureAnalyticsModuleVisited,
} from '@/config/posthogAnalytics';

import { confirmAction } from '@/composables/useConfirmAction';
import { formatUserDateTime } from '@/utils/localeFormat';
const { t } = useI18n();
const router = useRouter();
const { loading, saving, fetchSettings, updateSettings } = useAnalyticsHome();
const {
  tokens,
  loading: tokensLoading,
  saving: tokenSaving,
  createdToken,
  fetchTokens,
  createToken,
  revokeToken,
  clearCreatedToken,
} = useAnalyticsApiTokens();

const showTokenForm = ref(false);
const availableScopes = ['reports:read', 'reports:execute', 'reports:export'];

const form = reactive({
  cacheTtlSeconds: 300,
  exportRowLimit: 10000,
  fiscalYearStartMonth: 1,
  defaultDatePreset: 'last30days',
});

const tokenForm = reactive({
  name: '',
  scopes: ['reports:read', 'reports:execute'],
});

function formatDate(value) {
  if (!value) return '—';
  return formatUserDateTime(value);
}

function goHome() {
  router.push({ name: 'analytics-home' });
}

async function save() {
  const res = await updateSettings({ ...form });
  if (res?.success) {
    captureAnalyticsSettingsUpdated();
  }
}

async function submitToken() {
  const res = await createToken({
    name: tokenForm.name,
    scopes: [...tokenForm.scopes],
  });
  if (res?.success) {
    captureAnalyticsApiTokenCreated({ token_prefix: res.data?.tokenPrefix });
    tokenForm.name = '';
    showTokenForm.value = false;
  }
}

async function revoke(id) {
  if (!await confirmAction(t('analytics.apiTokensRevokeConfirm'))) return;
  await revokeToken(id);
}

onMounted(async () => {
  captureAnalyticsModuleVisited({ surface: 'analytics_settings' });
  const res = await fetchSettings();
  if (res?.success && res.data) {
    Object.assign(form, res.data);
  }
  await fetchTokens();
});
</script>
