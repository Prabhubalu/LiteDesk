<template>
  <div class="demo-request-form">
    <div
      v-if="submittedEmail"
      class="rounded-2xl border border-gray-200/70 bg-white/90 px-6 py-8 text-center shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-gray-800/90"
      role="status"
    >
      <div class="mx-auto flex size-11 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/15">
        <CheckIcon class="size-5 text-green-600 dark:text-green-400" aria-hidden="true" />
      </div>

      <h3 class="mt-4 text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
        {{ t('auth.startTrialVerifySuccessTitle') }}
      </h3>

      <p class="mt-5 text-sm font-normal leading-6 text-gray-600 dark:text-gray-300">
        {{ t('auth.startTrialVerifySuccessBodyLead') }}
        <span class="font-medium break-all text-gray-900 dark:text-white">{{ submittedEmail }}</span>{{ t('auth.startTrialVerifySuccessBodyTail') }}
      </p>

      <p class="mt-4 text-xs font-normal leading-5 text-gray-400 dark:text-gray-500">
        {{ t('auth.startTrialVerifySuccessHint') }}
      </p>

      <div class="mt-6 space-y-3 border-t border-gray-200 pt-5 dark:border-white/10">
        <p class="text-sm font-normal text-gray-500 dark:text-gray-400">
          <span>{{ t('auth.startTrialVerifyResendPrompt') }}</span>
          {{ ' ' }}
          <button
            type="button"
            class="font-medium text-indigo-600 hover:text-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:text-indigo-400 dark:hover:text-indigo-300"
            :disabled="resendLoading || resendCooldown > 0"
            @click="handleResendVerification"
          >
            <span v-if="resendLoading">{{ t('auth.emailVerificationResending') }}</span>
            <span v-else-if="resendCooldown > 0">{{ t('auth.startTrialVerifyResendCooldown', { seconds: resendCooldown }) }}</span>
            <span v-else>{{ t('auth.emailVerificationResend') }}</span>
          </button>
        </p>

        <p
          v-if="resendFeedback"
          class="text-sm font-normal"
          :class="resendFeedbackIsError ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'"
          role="alert"
        >
          {{ resendFeedback }}
        </p>

        <button
          type="button"
          class="text-sm font-normal text-gray-500 underline-offset-2 hover:text-gray-700 hover:underline dark:text-gray-400 dark:hover:text-gray-200"
          @click="resetVerificationState"
        >
          {{ t('auth.startTrialWrongEmail') }}
        </button>
      </div>
    </div>

    <form v-else class="space-y-6" novalidate @submit.prevent="handleSubmit">

      <div class="form-group">
        <label for="contactName" class="block text-sm/6 font-medium text-gray-900 dark:text-white">Full Name *</label>
        <div class="mt-2">
          <input type="text" id="contactName" v-model="formData.contactName" :placeholder="t('auth.demoRequestFormEnterYourFullName')" required
            class="block w-full rounded-md bg-gray-100 px-3 py-1.5 text-gray-900 text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 
            dark:text-white dark:bg-gray-700 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500" />
        </div>
      </div>
      <div class="form-group">
        <label for="email" class="block text-sm/6 font-medium text-gray-900 dark:text-white">Work Email *</label>
        <div class="mt-2">
          <input type="text" id="email" v-model="formData.email" autocomplete="email" inputmode="email" :placeholder="t('auth.demoRequestFormYourEmailCom')" required
            :aria-invalid="emailInvalid || undefined"
            class="block w-full rounded-md bg-gray-100 px-3 py-1.5 text-gray-900 text-base font-normal outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:text-white dark:bg-gray-700 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
            @blur="validateEmailField"
          />
          <p v-if="emailError" class="mt-2 text-sm font-normal text-red-600 dark:text-red-400" role="alert">
            {{ emailError }}
          </p>
        </div>
      </div>

      <div class="form-group">
        <label for="phone" class="block text-sm/6 font-medium text-gray-900 dark:text-white">Phone Number *</label>
        <div class="mt-2">
          <PhoneInput
            id="phone"
            :model-value="formData.phone"
            :default-country="defaultPhoneCountry"
            :placeholder="t('settings.profilePhone')"
            required
            input-class="block w-full rounded-md bg-gray-100 px-3 py-1.5 text-gray-900 text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:text-white dark:bg-gray-700 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
            @update:model-value="formData.phone = $event"
            @blur="validatePhoneField"
          />
          <p v-if="phoneError" class="mt-2 text-sm font-normal text-red-600 dark:text-red-400" role="alert">
            {{ phoneError }}
          </p>
        </div>
      </div>

      <div class="form-group">
        <label for="companyName" class="block text-sm/6 font-medium text-gray-900 dark:text-white">Company Name *</label>
        <div class="mt-2">
          <input type="text" id="companyName" v-model="formData.companyName" required
            class="block w-full rounded-md bg-gray-100 px-3 py-1.5 text-gray-900 text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 
            dark:text-white dark:bg-gray-700 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500" />
        </div>
      </div>

      <!-- Existing account — recovery path -->
      <div
        v-if="errorCode === 'EXISTING_USER'"
        role="alert"
        class="rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-500/30 dark:bg-indigo-500/10"
      >
        <p class="text-sm font-medium text-indigo-900 dark:text-indigo-100">
          {{ t('auth.demoRequestExistingAccount') }}
        </p>
        <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <router-link
            :to="{ name: 'login', query: { email: formData.email.trim() } }"
            class="text-sm font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            {{ t('auth.signIn') }}
          </router-link>
          <router-link
            :to="{ name: 'forgot-password' }"
            class="text-sm font-medium text-indigo-700/80 hover:text-indigo-600 dark:text-indigo-300/80 dark:hover:text-indigo-200"
          >
            {{ t('auth.forgotPassword') }}
          </router-link>
        </div>
      </div>

      <!-- Soft block — demo already requested -->
      <div
        v-else-if="errorCode === 'DEMO_EXISTS'"
        role="status"
        class="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
      >
        {{ t('auth.demoRequestAlreadyExists') }}
      </div>

      <!-- Generic error (form-level only — not field validation) -->
      <div
        v-if="error && !emailError && !phoneError"
        class="text-sm font-normal text-red-600 dark:text-red-400"
        role="alert"
      >
        {{ error }}
      </div>

      <!-- Submit Button -->

      <button type="submit" :disabled="loading"
        class="flex w-full justify-center rounded-md bg-indigo-500 px-3 py-2.5 text-md/0 font-semibold text-white hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">

        <span v-if="loading">{{ t('forms.hubFillSubmitting') }}</span>
        <span v-else>{{ t('auth.demoRequestFormRequestDemo') }}</span>
      </button>
    </form>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { ref, computed, watch, onUnmounted } from 'vue';
import apiClient from '../utils/apiClient';
import PhoneInput from '@/components/common/PhoneInput.vue';
import {
  sanitizeInternationalPhone,
  resolveBrowserPhoneCountry,
  validatePhoneValue,
} from '../utils/phoneInput';
import { isValidEmailFormat } from '@/utils/smtpProviderPresets';
import { CheckIcon } from '@heroicons/vue/24/outline';

const emit = defineEmits(['verification-pending-change']);

const RESEND_COOLDOWN_SECONDS = 60;

const defaultPhoneCountry = computed(() => resolveBrowserPhoneCountry());

const formData = ref({
  companyName: '',
  contactName: '',
  email: '',
  phone: '',
});

const loading = ref(false);
const error = ref('');
const errorCode = ref('');
const submittedEmail = ref('');
const resendLoading = ref(false);
const resendFeedback = ref('');
const resendFeedbackIsError = ref(false);
const resendCooldown = ref(0);
let resendCooldownTimer = null;

const phoneError = ref('');
const emailInvalid = ref(false);
const emailError = ref('');

watch(
  submittedEmail,
  (value) => {
    emit('verification-pending-change', Boolean(value));
  },
  { immediate: true },
);

onUnmounted(() => {
  if (resendCooldownTimer) {
    clearInterval(resendCooldownTimer);
  }
});

function startResendCooldown() {
  resendCooldown.value = RESEND_COOLDOWN_SECONDS;
  if (resendCooldownTimer) {
    clearInterval(resendCooldownTimer);
  }
  resendCooldownTimer = setInterval(() => {
    if (resendCooldown.value <= 1) {
      resendCooldown.value = 0;
      clearInterval(resendCooldownTimer);
      resendCooldownTimer = null;
      return;
    }
    resendCooldown.value -= 1;
  }, 1000);
}

function resetVerificationState() {
  const previousEmail = submittedEmail.value;
  submittedEmail.value = '';
  resendFeedback.value = '';
  resendFeedbackIsError.value = false;
  resendCooldown.value = 0;
  if (resendCooldownTimer) {
    clearInterval(resendCooldownTimer);
    resendCooldownTimer = null;
  }
  formData.value.email = previousEmail;
}

watch(
  () => formData.value.email,
  () => {
    emailInvalid.value = false;
    emailError.value = '';
    if (errorCode.value === 'EXISTING_USER' || errorCode.value === 'DEMO_EXISTS') {
      error.value = '';
      errorCode.value = '';
    }
  }
);

watch(
  () => formData.value.phone,
  () => {
    phoneError.value = '';
  }
);

function validateEmailField() {
  const normalizedEmail = formData.value.email.trim().toLowerCase();
  if (!normalizedEmail) {
    emailInvalid.value = false;
    emailError.value = '';
    return true;
  }
  if (!isValidEmailFormat(normalizedEmail)) {
    emailInvalid.value = true;
    emailError.value = t('auth.startTrialEmailInvalid');
    error.value = '';
    return false;
  }
  emailInvalid.value = false;
  emailError.value = '';
  return true;
}

function validatePhoneField() {
  const sanitizedPhone = sanitizeInternationalPhone(
    formData.value.phone,
    defaultPhoneCountry.value
  );
  if (!sanitizedPhone) {
    if (!formData.value.phone.trim()) {
      phoneError.value = '';
      return true;
    }
    phoneError.value = t('auth.startTrialPhoneRequired');
    error.value = '';
    return false;
  }
  const phoneValidation = validatePhoneValue(sanitizedPhone, defaultPhoneCountry.value);
  if (!phoneValidation.isValid) {
    phoneError.value = t('auth.startTrialPhoneInvalid');
    error.value = '';
    return false;
  }
  phoneError.value = '';
  return true;
}

const handleSubmit = async () => {
  loading.value = true;
  error.value = '';
  errorCode.value = '';
  phoneError.value = '';
  emailInvalid.value = false;
  emailError.value = '';

  const normalizedEmail = formData.value.email.trim().toLowerCase();
  if (!validateEmailField()) {
    loading.value = false;
    return;
  }

  const sanitizedPhone = sanitizeInternationalPhone(
    formData.value.phone,
    defaultPhoneCountry.value
  );

  if (!sanitizedPhone) {
    phoneError.value = t('auth.startTrialPhoneRequired');
    error.value = '';
    loading.value = false;
    return;
  }

  if (!validatePhoneField()) {
    loading.value = false;
    return;
  }

  try {
    const data = await apiClient.post('/demo/request', {
      companyName: formData.value.companyName,
      contactName: formData.value.contactName,
      email: normalizedEmail,
      phone: sanitizedPhone,
    });

    if (data.success) {
      submittedEmail.value = normalizedEmail;
      resendFeedback.value = '';
      resendFeedbackIsError.value = false;

      formData.value = {
        companyName: '',
        contactName: '',
        email: '',
        phone: '',
      };
    }
  } catch (err) {
    const code = err?.response?.data?.code || '';
    const serverMessage = err?.response?.data?.message || '';
    errorCode.value = code;

    if (code === 'INVALID_EMAIL') {
      emailInvalid.value = true;
      emailError.value = serverMessage || t('auth.startTrialEmailInvalid');
      error.value = '';
    } else if (code === 'INVALID_PHONE') {
      phoneError.value = serverMessage || t('auth.startTrialPhoneInvalid');
      error.value = '';
    } else if (code === 'EXISTING_USER') {
      error.value = t('auth.demoRequestExistingAccount');
    } else if (code === 'DEMO_EXISTS') {
      error.value = t('auth.demoRequestAlreadyExists');
    } else {
      error.value = serverMessage || err.message || t('auth.demoRequestSubmitFailed');
    }
  } finally {
    loading.value = false;
  }
};

async function handleResendVerification() {
  if (!submittedEmail.value || resendLoading.value || resendCooldown.value > 0) {
    return;
  }

  resendLoading.value = true;
  resendFeedback.value = '';
  resendFeedbackIsError.value = false;

  try {
    const data = await apiClient.post('/demo/resend-verification', {
      email: submittedEmail.value,
    });
    if (data?.success) {
      resendFeedback.value = data.message || t('auth.emailVerificationResent');
      resendFeedbackIsError.value = false;
      startResendCooldown();
    }
  } catch (err) {
    resendFeedback.value = err?.response?.data?.message || err.message || t('auth.emailVerificationResendFailed');
    resendFeedbackIsError.value = true;
  } finally {
    resendLoading.value = false;
  }
}
</script>
