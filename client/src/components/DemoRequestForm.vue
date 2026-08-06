<template>
  <div class="demo-request-form">
    <form class="space-y-6" @submit.prevent="handleSubmit">

      <div class="form-group">
        <label for="contactName" class="block text-sm/6 font-medium text-gray-900 dark:text-white">Full Name *</label>
        <div class="mt-2">
          <input type="text" id="contactName" v-model="formData.contactName" :placeholder="t('auth.demoRequestFormEnterYourFullName')" required
            class="block w-full rounded-md bg-gray-100 px-3 py-1.5 text-gray-900 text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 
            dark:text-white dark:bg-gray-700 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500" />
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="form-group">
          <label for="email" class="block text-sm/6 font-medium text-gray-900 dark:text-white">Work Email *</label>
          <div class="mt-2">
            <input type="email" id="email" v-model="formData.email" :placeholder="t('auth.demoRequestFormYourEmailCom')" required
              class="block w-full rounded-md bg-gray-100 px-3 py-1.5 text-gray-900 text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 
            dark:text-white dark:bg-gray-700 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500" />
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
            />
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="form-group">
          <label for="companyName" class="block text-sm/6 font-medium text-gray-900 dark:text-white">Company Name
            *</label>
          <div class="mt-2">
            <input type="text" id="companyName" v-model="formData.companyName" required
              class="block w-full rounded-md bg-gray-100 px-3 py-1.5 text-gray-900 text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 
            dark:text-white dark:bg-gray-700 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500" />
          </div>
        </div>
        <div class="form-group">
          <label for="jobTitle" class="block text-sm/6 font-medium text-gray-900 dark:text-white">Job Title *</label>
          <div class="mt-2">
            <input type="text" id="jobTitle" v-model="formData.jobTitle" :placeholder="t('auth.demoRequestFormEGSalesManagerCeo')" required
              class="block w-full rounded-md bg-gray-100 px-3 py-1.5 text-gray-900 text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 
            dark:text-white dark:bg-gray-700 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500" />
          </div>
        </div>

      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="form-group">
          <label for="industry" class="block text-sm/6 font-medium text-gray-900 dark:text-white">Industry *</label>
          <div class="mt-2">
            <select id="industry" v-model="formData.industry" required
              class="block w-full rounded-md bg-gray-100 px-3 py-2 text-gray-900 text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 
              dark:text-white dark:bg-gray-700 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500">
              <!-- <option value="">{{ t('auth.demoRequestFormSelectIndustry') }}</option> -->
              <option value="Technology">{{ t('auth.demoRequestFormTechnology') }}</option>
              <option value="Healthcare">{{ t('auth.demoRequestFormHealthcare') }}</option>
              <option value="Finance">{{ t('auth.demoRequestFormFinance') }}</option>
              <option value="Retail">{{ t('auth.demoRequestFormRetail') }}</option>
              <option value="Manufacturing">{{ t('auth.demoRequestFormManufacturing') }}</option>
              <option value="Real Estate">{{ t('auth.demoRequestFormRealEstate') }}</option>
              <option value="Education">{{ t('auth.demoRequestFormEducation') }}</option>
              <option value="Consulting">{{ t('auth.demoRequestFormConsulting') }}</option>
              <option value="Other">{{ t('settings.settingsBhTzGroupOther') }}</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label for="companySize" class="block text-sm/6 font-medium text-gray-900 dark:text-white">Company
            Size *</label>
          <div class="mt-2">
            <select id="companySize" v-model="formData.companySize" required
              class="block w-full rounded-md bg-gray-100 px-3 py-2 text-gray-900 text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 
              dark:text-white dark:bg-gray-700 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500">
              <!-- <option value="">{{ t('auth.demoRequestFormSelectSize') }}</option> -->
              <option value="1-10">1-10 employees</option>
              <option value="11-50">11-50 employees</option>
              <option value="51-200">51-200 employees</option>
              <option value="201-500">201-500 employees</option>
              <option value="500+">500+ employees</option>
            </select>
          </div>
        </div>
      </div>


      <div class="form-section">

        <div class="form-group">
          <label for="message" class="block text-sm/6 font-medium text-gray-900 dark:text-white">{{ t('auth.demoRequestFormPrimaryGoal') }}</label>
          <div class="mt-2">
            <textarea id="message" v-model="formData.message" rows="4"
              class="block w-full rounded-md bg-gray-100 px-3 py-1.5 text-gray-900 text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6
            dark:text-white dark:bg-gray-700 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
              :placeholder="t('auth.demoRequestFormTellUsWhatAreYouLooking')"></textarea>
          </div>

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

      <!-- Generic error -->
      <div v-else-if="error" class="text-sm text-red-600 dark:text-red-400" role="alert">
        {{ error }}
      </div>

      <!-- Success Message -->
      <div v-if="success" class="text-md text-green-500">
        🎉 {{ success }}
      </div>

      <!-- Submit Button -->

      <button type="submit" :disabled="loading"
        class="flex w-full justify-center rounded-md bg-indigo-500 px-3 py-2.5 text-md/0 font-semibold text-white hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">

        <span v-if="loading">{{ t('forms.hubFillSubmitting') }}</span>
        <span v-else>{{ t('auth.demoRequestFormRequestDemo') }}</span>
      </button>
    </form>

    <!-- Success Modal -->
    <TransitionRoot as="template" :show="open">
      <Dialog class="relative z-10" @close="closeAndNavigate">
        <TransitionChild as="template" enter="ease-out duration-300" enter-from="opacity-0" enter-to="opacity-100"
          leave="ease-in duration-200" leave-from="opacity-100" leave-to="opacity-0">
          <div class="fixed inset-0 bg-gray-300/100 dark:bg-gray-900/100 transition-opacity" />
        </TransitionChild>

        <div class="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <TransitionChild as="template" enter="ease-out duration-300"
              enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enter-to="opacity-100 translate-y-0 sm:scale-100" leave="ease-in duration-200"
              leave-from="opacity-100 translate-y-0 sm:scale-100"
              leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
              <DialogPanel
                class="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pt-5 pb-4 text-left shadow-xl outline -outline-offset-1 outline-white/10 transition-all sm:my-8 sm:w-full sm:max-w-sm sm:p-6">
                <div>
                  <div class="mx-auto flex size-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/10">
                    <CheckIcon class="size-6 text-green-600 dark:text-green-400" aria-hidden="true" />
                  </div>
                  <div class="mt-3 text-center sm:mt-5">
                    <DialogTitle as="h3" class="text-base font-semibold text-gray-900 dark:text-white">{{ t('auth.demoRequestFormDemoRequestSubmitted') }}</DialogTitle>
                    <div class="mt-2">
                      <p class="text-sm text-gray-500 dark:text-gray-400">🎉 Thank you for your interest! Our team will contact you within
                        24 hours.</p>
                    </div>
                  </div>
                </div>
                <div class="mt-5 sm:mt-6">
                  <button type="button"
                    class="inline-flex w-full justify-center rounded-md bg-indigo-600 dark:bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 dark:hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-500"
                    @click="closeAndNavigate">{{ t('auth.demoRequestFormGoBackToHome') }}</button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import apiClient from '../utils/apiClient';
import PhoneInput from '@/components/common/PhoneInput.vue';
import { sanitizeInternationalPhone, resolveDefaultPhoneCountry } from '../utils/phoneInput';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { CheckIcon } from '@heroicons/vue/24/outline';

const router = useRouter();
const open = ref(false);

function getBrowserLocale() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || navigator.language || 'en-US';
  } catch {
    return 'en-US';
  }
}

const defaultPhoneCountry = computed(() =>
  resolveDefaultPhoneCountry({ orgLocale: getBrowserLocale() })
);

const formData = ref({
  companyName: '',
  industry: '',
  companySize: '',
  contactName: '',
  email: '',
  phone: '',
  jobTitle: '',
  message: ''
});

const loading = ref(false);
const error = ref('');
const errorCode = ref('');
const success = ref('');

watch(
  () => formData.value.email,
  () => {
    if (errorCode.value === 'EXISTING_USER' || errorCode.value === 'DEMO_EXISTS') {
      error.value = '';
      errorCode.value = '';
    }
  }
);

const handleSubmit = async () => {
  loading.value = true;
  error.value = '';
  errorCode.value = '';
  success.value = '';

  try {
    const data = await apiClient.post('/demo/request', {
      ...formData.value,
      phone: sanitizeInternationalPhone(formData.value.phone, defaultPhoneCountry.value),
    });

    if (data.success) {
      success.value = data.message;

      // Reset form
      formData.value = {
        companyName: '',
        industry: '',
        companySize: '',
        contactName: '',
        email: '',
        phone: '',
        jobTitle: '',
        message: ''
      };

      // Open success modal
      open.value = true;
    }
  } catch (err) {
    const code = err?.response?.data?.code || '';
    errorCode.value = code;
    if (code === 'EXISTING_USER') {
      error.value = t('auth.demoRequestExistingAccount');
    } else if (code === 'DEMO_EXISTS') {
      error.value = t('auth.demoRequestAlreadyExists');
    } else {
      error.value = err.message || t('auth.demoRequestSubmitFailed');
    }
  } finally {
    loading.value = false;
  }
};

const closeAndNavigate = () => {
  open.value = false;
  router.push({ name: 'landing' });
};
</script>
