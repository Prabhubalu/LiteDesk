<template>
  <div class="min-h-screen bg-white dark:bg-gray-900">
    <div class="mx-auto flex min-h-screen max-w-lg items-center px-6 py-16">
      <div class="w-full">
        <div v-if="loading" class="text-center">
          <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('auth.resetPasswordLoading') }}</p>
        </div>

        <div v-else-if="success" class="rounded-xl border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-900/20">
          <h1 class="text-lg font-semibold text-green-900 dark:text-green-100">{{ t('auth.resetPasswordSuccessTitle') }}</h1>
          <p class="mt-2 text-sm text-green-800 dark:text-green-200">{{ t('auth.resetPasswordSuccessBody') }}</p>
          <router-link
            to="/login"
            class="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {{ t('auth.resetPasswordSignIn') }}
          </router-link>
        </div>

        <div v-else-if="!tokenValid" class="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
          <h1 class="text-lg font-semibold text-red-900 dark:text-red-100">{{ t('auth.resetPasswordInvalidTitle') }}</h1>
          <p class="mt-2 text-sm text-red-800 dark:text-red-200">{{ errorMessage || t('auth.resetPasswordInvalidBody') }}</p>
          <router-link
            to="/forgot-password"
            class="mt-4 inline-flex text-sm font-semibold text-indigo-600 hover:text-indigo-500"
          >
            {{ t('auth.resetPasswordRequestNew') }}
          </router-link>
        </div>

        <form v-else class="space-y-6" @submit.prevent="submit">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('auth.resetPasswordTitle') }}</h1>
            <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ t('auth.resetPasswordSubtitle') }}</p>
          </div>

          <div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
            <p class="text-sm font-medium text-gray-900 dark:text-white">{{ resetEmail }}</p>
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('auth.resetPasswordNewLabel') }}</label>
            <input
              id="password"
              v-model="password"
              type="password"
              minlength="8"
              autocomplete="new-password"
              required
              class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label for="confirmPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('auth.resetPasswordConfirmLabel') }}</label>
            <input
              id="confirmPassword"
              v-model="confirmPassword"
              type="password"
              minlength="8"
              autocomplete="new-password"
              required
              class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400">{{ errorMessage }}</p>

          <button
            type="submit"
            :disabled="submitting"
            class="flex w-full justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {{ submitting ? t('auth.resetPasswordSubmitting') : t('auth.resetPasswordSubmit') }}
          </button>
        </form>
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
const tokenValid = ref(false);
const success = ref(false);
const submitting = ref(false);
const errorMessage = ref('');
const resetEmail = ref('');
const password = ref('');
const confirmPassword = ref('');

const token = () => String(route.query.token || '').trim();

async function loadToken() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const url = getApiUrlForFetch(`/api/auth/reset-password/validate?token=${encodeURIComponent(token())}`);
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      tokenValid.value = false;
      errorMessage.value = data.message || data.error || t('auth.resetPasswordInvalidBody');
      return;
    }
    resetEmail.value = data.data?.email || '';
    tokenValid.value = true;
  } catch (_error) {
    tokenValid.value = false;
    errorMessage.value = t('auth.resetPasswordInvalidBody');
  } finally {
    loading.value = false;
  }
}

async function submit() {
  errorMessage.value = '';
  if (password.value !== confirmPassword.value) {
    errorMessage.value = t('auth.resetPasswordMismatch');
    return;
  }

  submitting.value = true;
  try {
    const response = await fetch(getApiUrlForFetch('/api/auth/reset-password'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        token: token(),
        password: password.value
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      errorMessage.value = data.message || data.error || t('auth.resetPasswordFailed');
      return;
    }
    success.value = true;
  } catch (_error) {
    errorMessage.value = t('auth.resetPasswordFailed');
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  if (!token()) {
    loading.value = false;
    tokenValid.value = false;
    errorMessage.value = t('auth.resetPasswordInvalidBody');
    return;
  }
  void loadToken();
});
</script>
