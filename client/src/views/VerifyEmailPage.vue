<template>
  <div class="min-h-screen bg-white dark:bg-gray-900">
    <div class="mx-auto flex min-h-screen max-w-lg items-center px-6 py-16">
      <div class="w-full text-center">
        <div v-if="loading">
          <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('auth.verifyEmailLoading') }}</p>
        </div>

        <div v-else-if="success" class="rounded-xl border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-900/20">
          <h1 class="text-lg font-semibold text-green-900 dark:text-green-100">{{ t('auth.verifyEmailSuccessTitle') }}</h1>
          <p class="mt-2 text-sm text-green-800 dark:text-green-200">{{ t('auth.verifyEmailSuccessBody') }}</p>
          <router-link
            to="/login?verified=1"
            class="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {{ t('auth.verifyEmailSignIn') }}
          </router-link>
        </div>

        <div v-else class="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
          <h1 class="text-lg font-semibold text-red-900 dark:text-red-100">{{ t('auth.verifyEmailFailedTitle') }}</h1>
          <p class="mt-2 text-sm text-red-800 dark:text-red-200">{{ errorMessage || t('auth.verifyEmailFailedBody') }}</p>
          <router-link
            to="/login"
            class="mt-4 inline-flex text-sm font-semibold text-indigo-600 hover:text-indigo-500"
          >
            {{ t('auth.verifyEmailBackToLogin') }}
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { getApiUrlForFetch } from '@/config/apiBase';

const { t } = useI18n();
const route = useRoute();

const loading = ref(true);
const success = ref(false);
const errorMessage = ref('');

onMounted(async () => {
  const token = String(route.query.token || '').trim();
  if (!token) {
    loading.value = false;
    errorMessage.value = t('auth.verifyEmailFailedBody');
    return;
  }

  try {
    const url = getApiUrlForFetch(`/api/auth/verify-email/confirm?token=${encodeURIComponent(token)}`);
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await response.json();
    success.value = response.ok && data.success;
    if (!success.value) {
      errorMessage.value = data.message || t('auth.verifyEmailFailedBody');
    }
  } catch (_error) {
    errorMessage.value = t('auth.verifyEmailFailedBody');
  } finally {
    loading.value = false;
  }
});
</script>
