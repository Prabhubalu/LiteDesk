<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import { getApiUrlForFetch } from '@/config/apiBase';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();

const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const loading = ref(false);
const error = ref('');

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    await router.replace({ name: 'login' });
    return;
  }
  if (!authStore.user?.mustChangePassword) {
    await router.replace(authStore.resolvePostLoginRoute());
  }
});

const submit = async () => {
  error.value = '';
  if (newPassword.value !== confirmPassword.value) {
    error.value = t('auth.portalSetPasswordMismatch');
    return;
  }
  loading.value = true;
  try {
    const response = await fetch(getApiUrlForFetch('/api/users/profile/password'), {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${authStore.user?.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        currentPassword: currentPassword.value,
        newPassword: newPassword.value
      })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || t('auth.portalSetPasswordFailed'));
    }
    authStore.user = {
      ...authStore.user,
      mustChangePassword: false
    };
    localStorage.setItem('user', JSON.stringify(authStore.user));
    await router.replace(authStore.resolvePostLoginRoute());
  } catch (err) {
    error.value = err.message || t('auth.portalSetPasswordFailed');
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-gray-900">
    <div class="mx-auto flex min-h-screen max-w-lg items-center px-6 py-16">
      <form class="w-full space-y-6" @submit.prevent="submit">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ t('auth.portalSetPasswordTitle') }}
          </h1>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {{ t('auth.portalSetPasswordSubtitle') }}
          </p>
        </div>

        <div
          v-if="error"
          class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200"
        >
          {{ error }}
        </div>

        <div>
          <label for="currentPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('auth.portalSetPasswordCurrentLabel') }}
          </label>
          <input
            id="currentPassword"
            v-model="currentPassword"
            type="password"
            autocomplete="current-password"
            required
            class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div>
          <label for="newPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('auth.portalSetPasswordNewLabel') }}
          </label>
          <input
            id="newPassword"
            v-model="newPassword"
            type="password"
            minlength="8"
            autocomplete="new-password"
            required
            class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:text-white dark:border-gray-600 dark:bg-gray-700"
          />
        </div>

        <div>
          <label for="confirmPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('auth.portalSetPasswordConfirmLabel') }}
          </label>
          <input
            id="confirmPassword"
            v-model="confirmPassword"
            type="password"
            minlength="8"
            autocomplete="new-password"
            required
            class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:text-white dark:border-gray-600 dark:bg-gray-700"
          />
        </div>

        <button
          type="submit"
          :disabled="loading"
          class="flex w-full justify-center rounded-md bg-indigo-500 px-3 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
        >
          {{ loading ? t('auth.portalSetPasswordSubmitting') : t('auth.portalSetPasswordSubmit') }}
        </button>
      </form>
    </div>
  </div>
</template>
