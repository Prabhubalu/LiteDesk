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
          <router-link to="/login" class="mt-4 inline-flex text-sm font-semibold text-indigo-600 hover:text-indigo-500">
            {{ t('auth.acceptInviteBackToLogin') }}
          </router-link>
        </div>

        <form v-else-if="step === 'password'" class="space-y-6" @submit.prevent="goToProfile">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('auth.acceptInviteTitle') }}</h1>
            <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {{ t('auth.acceptInviteSubtitle', { organization: invite.organizationName }) }}
            </p>
          </div>

          <div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
            <p class="text-sm text-gray-700 dark:text-gray-300">{{ invite.firstName }} {{ invite.lastName }}</p>
            <p class="text-sm font-medium text-gray-900 dark:text-white">{{ invite.email }}</p>
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('auth.acceptInvitePasswordLabel') }}</label>
            <input id="password" v-model="password" type="password" minlength="8" required class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
          </div>

          <div>
            <label for="confirmPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('auth.acceptInviteConfirmPasswordLabel') }}</label>
            <input id="confirmPassword" v-model="confirmPassword" type="password" minlength="8" required class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
          </div>

          <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400">{{ errorMessage }}</p>

          <button type="submit" class="flex w-full justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
            {{ t('onboarding.continue') }}
          </button>
        </form>

        <form v-else class="space-y-6" @submit.prevent="submitAccept">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('onboarding.profileTitle') }}</h1>
            <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ t('onboarding.profileSubtitle') }}</p>
          </div>

          <div v-if="invite.entitledApps?.length" class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
            <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('onboarding.appsPreviewLabel') }}</p>
            <div class="mt-2 flex flex-wrap gap-2">
              <span v-for="app in invite.entitledApps" :key="app" class="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700">{{ app }}</span>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label for="first-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('onboarding.firstNameLabel') }}</label>
              <input id="first-name" v-model="profileForm.firstName" type="text" class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label for="last-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('onboarding.lastNameLabel') }}</label>
              <input id="last-name" v-model="profileForm.lastName" type="text" class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            </div>
          </div>

          <div>
            <label for="timezone" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('onboarding.timeZoneLabel') }}</label>
            <input id="timezone" v-model="profileForm.timeZone" type="text" class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
          </div>

          <div>
            <label for="language" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('onboarding.languageLabel') }}</label>
            <select id="language" v-model="profileForm.language" class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
            </select>
          </div>

          <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400">{{ errorMessage }}</p>

          <div class="flex gap-3">
            <button type="submit" :disabled="submitting" class="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {{ submitting ? t('auth.acceptInviteSubmitting') : t('auth.acceptInviteSignIn') }}
            </button>
            <button type="button" :disabled="submitting" class="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400" @click="submitAccept(true)">
              {{ t('onboarding.skipStep') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { getApiUrlForFetch } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';
import { captureInviteAccepted, captureOnboardingStarted } from '@/config/posthogOnboarding';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const loading = ref(true);
const inviteValid = ref(false);
const submitting = ref(false);
const step = ref('password');
const errorMessage = ref('');
const password = ref('');
const confirmPassword = ref('');
const invite = ref({
  email: '',
  firstName: '',
  lastName: '',
  organizationName: '',
  entitledApps: []
});

const profileForm = ref({
  firstName: '',
  lastName: '',
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  language: 'en'
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
    profileForm.value.firstName = data.data.firstName || '';
    profileForm.value.lastName = data.data.lastName || '';
    inviteValid.value = true;
  } catch (_error) {
    inviteValid.value = false;
    errorMessage.value = t('auth.acceptInviteInvalidBody');
  } finally {
    loading.value = false;
  }
}

function goToProfile() {
  errorMessage.value = '';
  if (password.value !== confirmPassword.value) {
    errorMessage.value = t('auth.acceptInvitePasswordMismatch');
    return;
  }
  step.value = 'profile';
}

async function submitAccept(skipProfile = false) {
  errorMessage.value = '';
  if (step.value === 'password' && password.value !== confirmPassword.value) {
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
        password: password.value,
        ...(skipProfile ? {} : {
          firstName: profileForm.value.firstName,
          lastName: profileForm.value.lastName,
          timeZone: profileForm.value.timeZone,
          language: profileForm.value.language
        })
      })
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      errorMessage.value = data.message || t('auth.acceptInviteFailed');
      return;
    }

    if (data.data?.session) {
      authStore.setUser(data.data.session);
      captureInviteAccepted({
        entitled_apps: invite.value.entitledApps?.length || 0,
      });
      captureOnboardingStarted({
        persona: 'member',
        origin: 'invited',
        organizationId: data.data.session.organizationId,
      });
      const redirectTo = data.data.session.onboarding?.redirectTo || '/platform/home';
      await router.push(redirectTo);
      return;
    }

    await router.push('/login');
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
