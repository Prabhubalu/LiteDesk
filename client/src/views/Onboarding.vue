<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import { useOnboarding } from '@/composables/useOnboarding';
import apiClient from '@/utils/apiClient';
import { captureInviteSent } from '@/config/posthogOnboarding';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const {
  state,
  loading,
  fetchOnboarding,
  setGoal,
  saveWorkspace,
  skipStep,
  completeStep,
  setPrimaryApp,
  createFirstContact
} = useOnboarding();

const finishWizard = async (patchFn) => {
  const ok = await patchFn();
  if (!ok) return;
  authStore.updateOnboardingSummary({
    redirectTo: state.value.redirectTo,
    persona: state.value.persona,
    origin: state.value.origin,
    completedAt: state.value.completedAt
  });
  router.push('/platform/home');
};

const currentStep = ref(0);
const totalSteps = 5;

const orgName = computed(() => authStore.user?.organization?.name || '');
const userName = computed(() => authStore.user?.firstName || authStore.user?.username || '');

const goalOptions = computed(() => [
  { key: 'sales', label: t('onboarding.goalSales') },
  { key: 'support', label: t('onboarding.goalSupport') },
  { key: 'audit', label: t('onboarding.goalAudit') },
  { key: 'explore', label: t('onboarding.goalExplore') }
]);

const selectedGoal = ref('sales');
const selectedApp = ref('SALES');

const workspaceForm = ref({
  name: orgName.value,
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  currency: 'USD',
  dateFormat: 'MM/DD/YYYY',
  language: 'en'
});

const contactForm = ref({
  firstName: '',
  lastName: '',
  email: ''
});

const inviteForm = ref({
  firstName: '',
  lastName: '',
  email: ''
});

const inviteError = ref('');

const availableApps = computed(() => state.value.availableApps || ['SALES']);
const showAppStep = computed(() => availableApps.value.length > 1);

const canContinueGoal = computed(() => Boolean(selectedGoal.value));

const recordStepIndex = computed(() => (showAppStep.value ? 3 : 2));
const inviteStepIndex = computed(() => (showAppStep.value ? 4 : 3));

function resolveInitialStep(steps) {
  const map = Object.fromEntries((steps || []).map((s) => [s.key, s.status]));
  if (map.founder_goal === 'pending') return 0;
  if (map.founder_workspace === 'pending') return 1;
  if (showAppStep.value && map.founder_first_app === 'pending') return 2;
  if (map.founder_first_record === 'pending') return recordStepIndex.value;
  if (map.founder_invite_teammate === 'pending') return inviteStepIndex.value;
  return 0;
}

onMounted(async () => {
  workspaceForm.value.name = orgName.value;
  await fetchOnboarding();
  if (state.value.goalKey) selectedGoal.value = state.value.goalKey;
  if (state.value.context?.primaryAppKey) selectedApp.value = state.value.context.primaryAppKey;
  currentStep.value = resolveInitialStep(state.value.steps);
});

const handleGoalContinue = async () => {
  const ok = await setGoal(selectedGoal.value);
  if (ok) currentStep.value = 1;
};

const handleGoalSkip = async () => {
  const ok = await skipStep('founder_goal');
  if (ok) currentStep.value = 1;
};

const handleWorkspaceContinue = async () => {
  const ok = await saveWorkspace(workspaceForm.value);
  if (!ok) return;
  currentStep.value = showAppStep.value ? 2 : recordStepIndex.value;
  if (!showAppStep.value) await skipStep('founder_first_app');
};

const handleWorkspaceSkip = async () => {
  const ok = await skipStep('founder_workspace');
  if (!ok) return;
  currentStep.value = showAppStep.value ? 2 : recordStepIndex.value;
  if (!showAppStep.value) await skipStep('founder_first_app');
};

const handleAppContinue = async () => {
  const ok = await setPrimaryApp(selectedApp.value);
  if (ok) currentStep.value = recordStepIndex.value;
};

const handleAppSkip = async () => {
  const ok = await skipStep('founder_first_app');
  if (ok) currentStep.value = recordStepIndex.value;
};

const goToInviteStep = () => {
  currentStep.value = inviteStepIndex.value;
};

const handleContactContinue = async () => {
  const ok = await createFirstContact(contactForm.value);
  if (ok) goToInviteStep();
};

const handleContactSkip = async () => {
  const ok = await skipStep('founder_first_record');
  if (ok) goToInviteStep();
};

const buildInvitePayload = () => {
  const primaryApp = state.value.context?.primaryAppKey || selectedApp.value || 'SALES';
  return {
    firstName: inviteForm.value.firstName,
    lastName: inviteForm.value.lastName,
    email: inviteForm.value.email,
    roleId: authStore.user?.roleId,
    userType: 'INTERNAL',
    appAccess: [{ appKey: primaryApp, roleKey: 'USER' }],
    sendEmail: true
  };
};

const handleInviteContinue = async () => {
  inviteError.value = '';
  if (!inviteForm.value.email || !inviteForm.value.firstName) {
    inviteError.value = t('onboarding.inviteRequiredFields');
    return;
  }

  try {
    const response = await apiClient.post('/users', buildInvitePayload());
    if (!response.success) {
      inviteError.value = response.message || t('onboarding.inviteFailed');
      return;
    }
    captureInviteSent({ source: 'founder_wizard', send_email: true });
    await finishWizard(() => completeStep('founder_invite_teammate'));
  } catch (err) {
    console.error('[Onboarding] invite error:', err);
    inviteError.value = t('onboarding.inviteFailed');
  }
};

const handleInviteSkip = async () => {
  await finishWizard(() => skipStep('founder_invite_teammate'));
};
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-lg">
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">
        {{ t('onboarding.stepIndicator', { current: currentStep + 1, total: totalSteps }) }}
      </p>

      <div v-if="loading && !state.steps.length" class="text-center text-gray-500 dark:text-gray-400">
        …
      </div>

      <div v-else-if="currentStep === 0" class="space-y-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ t('onboarding.founderWelcomeTitle', { name: userName }) }}
          </h1>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {{ t('onboarding.founderWelcomeSubtitle', { organization: orgName }) }}
          </p>
        </div>

        <fieldset>
          <legend class="text-sm font-medium text-gray-900 dark:text-white mb-3">
            {{ t('onboarding.goalPrompt') }}
          </legend>
          <div class="space-y-2">
            <label
              v-for="option in goalOptions"
              :key="option.key"
              class="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3"
              :class="selectedGoal === option.key ? 'border-indigo-500 ring-1 ring-indigo-500' : ''"
            >
              <input v-model="selectedGoal" type="radio" name="goal" :value="option.key" class="text-indigo-600" />
              <span class="text-sm text-gray-900 dark:text-white">{{ option.label }}</span>
            </label>
          </div>
        </fieldset>

        <div class="flex gap-3">
          <button type="button" class="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50" :disabled="!canContinueGoal || loading" @click="handleGoalContinue">
            {{ t('onboarding.continue') }}
          </button>
          <button type="button" class="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400" :disabled="loading" @click="handleGoalSkip">
            {{ t('onboarding.skipStep') }}
          </button>
        </div>
      </div>

      <div v-else-if="currentStep === 1" class="space-y-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('onboarding.workspaceTitle') }}</h1>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ t('onboarding.workspaceSubtitle') }}</p>
        </div>

        <form class="space-y-4" @submit.prevent="handleWorkspaceContinue">
          <div>
            <label for="org-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('onboarding.orgNameLabel') }}</label>
            <input id="org-name" v-model="workspaceForm.name" type="text" required class="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label for="timezone" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('onboarding.timeZoneLabel') }}</label>
            <input id="timezone" v-model="workspaceForm.timeZone" type="text" class="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label for="currency" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('onboarding.currencyLabel') }}</label>
            <input id="currency" v-model="workspaceForm.currency" type="text" maxlength="3" class="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 uppercase text-gray-900 dark:text-white" />
          </div>
          <div class="flex gap-3 pt-2">
            <button type="submit" class="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50" :disabled="loading">{{ t('onboarding.continue') }}</button>
            <button type="button" class="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400" :disabled="loading" @click="handleWorkspaceSkip">{{ t('onboarding.skipStep') }}</button>
          </div>
        </form>
      </div>

      <div v-else-if="currentStep === 2 && showAppStep" class="space-y-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('onboarding.firstAppTitle') }}</h1>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ t('onboarding.firstAppSubtitle') }}</p>
        </div>
        <div class="space-y-2">
          <label v-for="app in availableApps" :key="app" class="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3" :class="selectedApp === app ? 'border-indigo-500 ring-1 ring-indigo-500' : ''">
            <input v-model="selectedApp" type="radio" name="app" :value="app" class="text-indigo-600" />
            <span class="text-sm text-gray-900 dark:text-white">{{ app }}</span>
          </label>
        </div>
        <div class="flex gap-3">
          <button type="button" class="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500" :disabled="loading" @click="handleAppContinue">{{ t('onboarding.continue') }}</button>
          <button type="button" class="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400" :disabled="loading" @click="handleAppSkip">{{ t('onboarding.skipStep') }}</button>
        </div>
      </div>

      <div v-else-if="currentStep === recordStepIndex" class="space-y-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('onboarding.firstRecordTitle') }}</h1>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ t('onboarding.firstRecordSubtitle') }}</p>
        </div>
        <form class="space-y-4" @submit.prevent="handleContactContinue">
          <div>
            <label for="contact-first" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('onboarding.firstNameLabel') }}</label>
            <input id="contact-first" v-model="contactForm.firstName" type="text" required class="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label for="contact-last" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('onboarding.lastNameLabel') }}</label>
            <input id="contact-last" v-model="contactForm.lastName" type="text" class="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label for="contact-email" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('onboarding.emailLabel') }}</label>
            <input id="contact-email" v-model="contactForm.email" type="email" class="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white" />
          </div>
          <div class="flex gap-3 pt-2">
            <button type="submit" class="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50" :disabled="loading">{{ t('onboarding.continue') }}</button>
            <button type="button" class="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400" :disabled="loading" @click="handleContactSkip">{{ t('onboarding.skipStep') }}</button>
          </div>
        </form>
      </div>

      <div v-else class="space-y-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('onboarding.inviteTeammateTitle') }}</h1>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ t('onboarding.inviteTeammateSubtitle') }}</p>
        </div>
        <p v-if="inviteError" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          {{ inviteError }}
        </p>
        <form class="space-y-4" @submit.prevent="handleInviteContinue">
          <div>
            <label for="invite-first" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('onboarding.firstNameLabel') }}</label>
            <input id="invite-first" v-model="inviteForm.firstName" type="text" required class="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label for="invite-last" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('onboarding.lastNameLabel') }}</label>
            <input id="invite-last" v-model="inviteForm.lastName" type="text" class="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label for="invite-email" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('onboarding.emailLabel') }}</label>
            <input id="invite-email" v-model="inviteForm.email" type="email" required class="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white" />
          </div>
          <div class="flex gap-3 pt-2">
            <button type="submit" class="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50" :disabled="loading">{{ t('onboarding.finishSetup') }}</button>
            <button type="button" class="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400" :disabled="loading" @click="handleInviteSkip">{{ t('onboarding.skipStep') }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
