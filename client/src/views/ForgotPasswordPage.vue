<template>
  <div class="min-h-screen bg-white dark:bg-gray-900">
    <div class="mx-auto flex min-h-screen max-w-lg items-center px-6 py-16">
      <div class="w-full">
        <div v-if="submitted" class="rounded-xl border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-900/20">
          <h1 class="text-lg font-semibold text-green-900 dark:text-green-100">{{ t('auth.forgotPasswordSuccessTitle') }}</h1>
          <p class="mt-2 text-sm text-green-800 dark:text-green-200">{{ t('auth.forgotPasswordSuccessBody') }}</p>
          <router-link
            to="/login"
            class="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {{ t('auth.forgotPasswordBackToLogin') }}
          </router-link>
        </div>

        <form v-else class="space-y-6" @submit.prevent="submit">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('auth.forgotPasswordTitle') }}</h1>
            <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ t('auth.forgotPasswordSubtitle') }}</p>
          </div>

          <div>
            <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('auth.emailLabel') }}</label>
            <input
              id="email"
              v-model="email"
              type="email"
              autocomplete="email"
              required
              :placeholder="t('auth.emailPlaceholder')"
              class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400">{{ errorMessage }}</p>

          <button
            type="submit"
            :disabled="submitting"
            class="flex w-full justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {{ submitting ? t('auth.forgotPasswordSubmitting') : t('auth.forgotPasswordSubmit') }}
          </button>

          <router-link to="/login" class="block text-center text-sm font-semibold text-indigo-600 hover:text-indigo-500">
            {{ t('auth.forgotPasswordBackToLogin') }}
          </router-link>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { getApiUrlForFetch } from '@/config/apiBase';

const { t } = useI18n();

const email = ref('');
const submitting = ref(false);
const submitted = ref(false);
const errorMessage = ref('');

async function submit() {
  errorMessage.value = '';
  submitting.value = true;
  try {
    const response = await fetch(getApiUrlForFetch('/api/auth/forgot-password'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ email: email.value.trim() })
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      errorMessage.value = data.message || t('auth.forgotPasswordFailed');
      return;
    }
    submitted.value = true;
  } catch (_error) {
    errorMessage.value = t('auth.forgotPasswordFailed');
  } finally {
    submitting.value = false;
  }
}
</script>
