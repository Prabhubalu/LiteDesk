<template>
  <div class="min-h-screen bg-gray-50 px-4 py-10 dark:bg-gray-950">
    <div class="mx-auto max-w-lg">
      <div v-if="loading" class="py-16 text-center text-sm text-gray-500">
        {{ t('states.loading') }}
      </div>

      <div v-else-if="error" class="rounded-xl border border-red-200 bg-white p-6 text-center dark:border-red-900/40 dark:bg-gray-900">
        <p class="text-sm text-red-700 dark:text-red-300">{{ error }}</p>
      </div>

      <div v-else-if="saved" class="rounded-xl border border-emerald-200 bg-white p-6 text-center dark:border-emerald-900/40 dark:bg-gray-900">
        <h1 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('marketing.preferencesSavedTitle') }}
        </h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {{ t('marketing.preferencesSavedMessage') }}
        </p>
      </div>

      <div v-else-if="payload" class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h1 class="text-xl font-semibold text-gray-900 dark:text-white">
          {{ t('marketing.preferencesTitle') }}
        </h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ t('marketing.preferencesDescription', { org: payload.organizationName, email: payload.email }) }}
        </p>

        <form class="mt-6 space-y-4" @submit.prevent="savePreferences">
          <label
            v-for="category in categoryOptions"
            :key="category.key"
            class="flex items-start gap-3 rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700"
          >
            <input
              v-model="categoryState[category.key]"
              type="checkbox"
              class="mt-1 rounded border-gray-300"
            />
            <span>
              <span class="block text-sm font-medium text-gray-900 dark:text-white">{{ category.label }}</span>
              <span class="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{{ category.description }}</span>
            </span>
          </label>

          <div class="flex flex-col gap-3 pt-2 sm:flex-row">
            <button
              type="submit"
              class="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              :disabled="saving"
            >
              {{ saving ? t('states.saving') : t('marketing.preferencesSave') }}
            </button>
            <button
              type="button"
              class="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 dark:border-red-800 dark:text-red-300"
              :disabled="saving"
              @click="unsubscribeAll"
            >
              {{ t('marketing.preferencesUnsubscribeAll') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { getApiUrlForFetch } from '@/config/apiBase';

const { t } = useI18n();
const route = useRoute();

const loading = ref(true);
const saving = ref(false);
const saved = ref(false);
const error = ref('');
const payload = ref(null);
const categoryState = reactive({
  marketing: true,
  newsletter: true,
  productUpdates: true
});

const categoryOptions = computed(() => [
  {
    key: 'marketing',
    label: t('marketing.preferencesCategoryMarketing'),
    description: t('marketing.preferencesCategoryMarketingHint')
  },
  {
    key: 'newsletter',
    label: t('marketing.preferencesCategoryNewsletter'),
    description: t('marketing.preferencesCategoryNewsletterHint')
  },
  {
    key: 'productUpdates',
    label: t('marketing.preferencesCategoryProductUpdates'),
    description: t('marketing.preferencesCategoryProductUpdatesHint')
  }
]);

function hydrateCategories(categories = {}) {
  for (const option of categoryOptions.value) {
    categoryState[option.key] = categories?.[option.key]?.subscribed !== false;
  }
}

async function loadPreferenceCenter() {
  loading.value = true;
  error.value = '';
  try {
    const token = encodeURIComponent(String(route.params.token || ''));
    const response = await fetch(getApiUrlForFetch(`/public/marketing/preferences/${token}`), {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });
    const body = await response.json();
    if (!response.ok || !body?.success) {
      throw new Error(body?.message || t('marketing.preferencesLoadError'));
    }
    payload.value = body.data;
    hydrateCategories(body.data?.categories);

    if (route.query.action === 'unsubscribe') {
      await unsubscribeAll(false);
    }
  } catch (err) {
    error.value = err?.message || t('marketing.preferencesLoadError');
  } finally {
    loading.value = false;
  }
}

async function savePreferences() {
  saving.value = true;
  error.value = '';
  try {
    const token = encodeURIComponent(String(route.params.token || ''));
    const response = await fetch(getApiUrlForFetch(`/public/marketing/preferences/${token}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ categories: { ...categoryState } })
    });
    const body = await response.json();
    if (!response.ok || !body?.success) {
      throw new Error(body?.message || t('states.genericFailure'));
    }
    saved.value = true;
  } catch (err) {
    error.value = err?.message || t('states.genericFailure');
  } finally {
    saving.value = false;
  }
}

async function unsubscribeAll(showSaved = true) {
  saving.value = true;
  error.value = '';
  try {
    const token = encodeURIComponent(String(route.params.token || ''));
    const response = await fetch(getApiUrlForFetch(`/public/marketing/preferences/${token}/unsubscribe`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({})
    });
    const body = await response.json();
    if (!response.ok || !body?.success) {
      throw new Error(body?.message || t('states.genericFailure'));
    }
    if (showSaved) saved.value = true;
    else {
      saved.value = true;
      payload.value = null;
    }
  } catch (err) {
    error.value = err?.message || t('states.genericFailure');
  } finally {
    saving.value = false;
  }
}

onMounted(loadPreferenceCenter);
</script>
