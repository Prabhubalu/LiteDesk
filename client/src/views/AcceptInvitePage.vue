<template>
  <div class="min-h-screen bg-white dark:bg-gray-900">
    <div class="mx-auto flex min-h-screen max-w-lg items-center px-6 py-16">
      <div class="w-full">
        <div v-if="loading" class="text-center">
          <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('auth.acceptInviteLoading') }}</p>
        </div>

        <div v-else-if="!inviteValid" class="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
          <h1 class="text-lg font-semibold text-red-900 dark:text-red-100">{{ t('auth.acceptInviteInvalidTitle') }}</h1>
          <p class="mt-2 text-sm text-red-800 dark:text-red-200">{{ errorMessage || t('auth.acceptInviteInvalidBody') }}</p>
          <router-link
            to="/login"
            class="mt-4 inline-flex text-sm font-semibold text-indigo-600 hover:text-indigo-500"
          >
            {{ t('auth.acceptInviteBackToLogin') }}
          </router-link>
        </div>

        <div v-else-if="accepted" class="rounded-xl border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-900/20">
          <h1 class="text-lg font-semibold text-green-900 dark:text-green-100">{{ t('auth.acceptInviteSuccessTitle') }}</h1>
          <p class="mt-2 text-sm text-green-800 dark:text-green-200">
            {{ t('auth.acceptInviteSuccessBody', { organization: invite.organizationName }) }}
          </p>
          <router-link
            to="/login"
            class="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {{ t('auth.acceptInviteSignIn') }}
          </router-link>
        </div>

        <form v-else class="space-y-6" @submit.prevent="submitAccept">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('auth.acceptInviteTitle') }}</h1>
            <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {{ t('auth.acceptInviteSubtitle', { organization: invite.organizationName }) }}
            </p>
          </div>

          <div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
            <p class="text-sm text-gray-700 dark:text-gray-300">
              {{ invite.firstName }} {{ invite.lastName }}
            </p>
            <p class="text-sm font-medium text-gray-900 dark:text-white">{{ invite.email }}</p>
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {{ t('auth.acceptInvitePasswordLabel') }}
            </label>
            <input
              id="password"
              v-model="password"
              type="password"
              minlength="8"
              required
              class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label for="confirmPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {{ t('auth.acceptInviteConfirmPasswordLabel') }}
            </label>
            <input
              id="confirmPassword"
              v-model="confirmPassword"
              type="password"
              minlength="8"
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
            {{ submitting ? t('auth.acceptInviteSubmitting') : t('auth.acceptInviteSubmit') }}
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
const inviteValid = ref(false);
const accepted = ref(false);
const submitting = ref(false);
const errorMessage = ref('');
const password = ref('');
const confirmPassword = ref('');
const invite = ref({
  email: '',
  firstName: '',
  lastName: '',
  organizationName: ''
});

const token = () => String(route.query.token || '').trim();

async function loadInvite() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const url = getApiUrlForFetch(`/api/auth/invite/validate?token=${encodeURIComponent(token())}`);
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await response.json();
    if (!response.ok || !data.success) {
      inviteValid.value = false;
      errorMessage.value = data.message || t('auth.acceptInviteInvalidBody');
      return;
    }
    invite.value = data.data;
    inviteValid.value = true;
  } catch (_error) {
    inviteValid.value = false;
    errorMessage.value = t('auth.acceptInviteInvalidBody');
  } finally {
    loading.value = false;
  }
}

async function submitAccept() {
  errorMessage.value = '';
  if (password.value !== confirmPassword.value) {
    errorMessage.value = t('auth.acceptInvitePasswordMismatch');
    return;
  }

  submitting.value = true;
  try {
    const response = await fetch(getApiUrlForFetch('/api/auth/invite/accept'), {
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
    const data = await response.json();
    if (!response.ok || !data.success) {
      errorMessage.value = data.message || t('auth.acceptInviteFailed');
      return;
    }
    accepted.value = true;
  } catch (_error) {
    errorMessage.value = t('auth.acceptInviteFailed');
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  if (!token()) {
    loading.value = false;
    inviteValid.value = false;
    errorMessage.value = t('auth.acceptInviteInvalidBody');
    return;
  }
  void loadInvite();
});
</script>
