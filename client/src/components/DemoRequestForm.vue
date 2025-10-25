<template>
  <div class="demo-request-form">
    <form class="space-y-6" @submit.prevent="handleSubmit">

      <div class="form-group">
        <label for="contactName" class="block text-sm/6 font-medium text-gray-900 dark:text-white">Full Name *</label>
        <div class="mt-2">
          <input type="text" id="contactName" v-model="formData.contactName" placeholder="Enter your full name" required
            class="block w-full rounded-md bg-gray-100 px-3 py-1.5 text-gray-900 text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 
            dark:text-white dark:bg-gray-700 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500" />
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="form-group">
          <label for="email" class="block text-sm/6 font-medium text-gray-900 dark:text-white">Work Email *</label>
          <div class="mt-2">
            <input type="email" id="email" v-model="formData.email" placeholder="your@email.com" required
              class="block w-full rounded-md bg-gray-100 px-3 py-1.5 text-gray-900 text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 
            dark:text-white dark:bg-gray-700 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500" />
          </div>
        </div>
        <div class="form-group">
          <label for="phone" class="block text-sm/6 font-medium text-gray-900 dark:text-white">Phone Number *</label>
          <div class="mt-2">
            <input type="tel" id="phone" v-model="formData.phone" placeholder="+91 9972272125" required
              class="block w-full rounded-md bg-gray-100 px-3 py-1.5 text-gray-900 text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 
              dark:text-white dark:bg-gray-700 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500" />
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
            <input type="text" id="jobTitle" v-model="formData.jobTitle" placeholder="e.g. Sales Manager, CEO" required
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
              <!-- <option value="">Select Industry</option> -->
              <option value="Technology">Technology</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Finance">Finance</option>
              <option value="Retail">Retail</option>
              <option value="Manufacturing">Manufacturing</option>
              <option value="Real Estate">Real Estate</option>
              <option value="Education">Education</option>
              <option value="Consulting">Consulting</option>
              <option value="Other">Other</option>
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
              <!-- <option value="">Select Size</option> -->
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
          <label for="message" class="block text-sm/6 font-medium text-gray-900 dark:text-white">Primary Goal</label>
          <div class="mt-2">
            <textarea id="message" v-model="formData.message" rows="4"
              class="block w-full rounded-md bg-gray-100 px-3 py-1.5 text-gray-900 text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6
            dark:text-white dark:bg-gray-700 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
              placeholder="Tell us what are you looking to achieve with Nurtura..."></textarea>
          </div>

        </div>
      </div>

      <!-- Error Message -->
      <div v-if="error" class="text-md text-red-500">
        {{ error }}
      </div>

      <!-- Success Message -->
      <div v-if="success" class="text-md text-green-500">
        🎉 {{ success }}
      </div>

      <!-- Submit Button -->

      <button type="submit" :disabled="loading"
        class="flex w-full justify-center rounded-md bg-indigo-500 px-3 py-2.5 text-md/0 font-semibold text-white hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">

        <span v-if="loading">Submitting...</span>
        <span v-else>Request Demo</span>
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
                    <DialogTitle as="h3" class="text-base font-semibold text-gray-900 dark:text-white">Demo Request Submitted!
                    </DialogTitle>
                    <div class="mt-2">
                      <p class="text-sm text-gray-500 dark:text-gray-400">🎉 Thank you for your interest! Our team will contact you within
                        24 hours.</p>
                    </div>
                  </div>
                </div>
                <div class="mt-5 sm:mt-6">
                  <button type="button"
                    class="inline-flex w-full justify-center rounded-md bg-indigo-600 dark:bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 dark:hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-500"
                    @click="closeAndNavigate">Go back to home</button>
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
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import apiClient from '../utils/apiClient';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { CheckIcon } from '@heroicons/vue/24/outline';

const router = useRouter();
const open = ref(false);

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
const success = ref('');

const handleSubmit = async () => {
  loading.value = true;
  error.value = '';
  success.value = '';

  try {
    const data = await apiClient.post('/demo/request', formData.value);

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
    console.error('Demo request error:', err);
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    });
    error.value = err.message || 'Failed to submit demo request. Please try again.';
  } finally {
    loading.value = false;
  }
};

const closeAndNavigate = () => {
  open.value = false;
  router.push({ name: 'landing' });
};
</script>
