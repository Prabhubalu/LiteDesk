<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

// Form Data State
const username = ref('');
const email = ref('');
const password = ref('');
const passwordConfirm = ref('');
const vertical = ref(''); // Required for template selection

// Available Verticals (as defined in requirements)
const verticalOptions = [
    'Retail (Fashion, Electronics, Footwear, etc.)',
    'Real Estate',
    'Service-Based (Gyms, Salons)',
    'Education Institutes',
    'Healthcare Clinics',
    'IT & SaaS Agencies',
    'Auditing Firms / Inspection Services',
    'Automotive Dealers',
    'Event Management Firms',
    'Pest Control / Facility Maintenance',
];

const handleRegistration = async () => {
    // Basic Client-side Validation
    if (password.value !== passwordConfirm.value) {
        authStore.error = 'Passwords do not match.';
        return;
    }

    if (!vertical.value) {
        authStore.error = 'Please select your business vertical.';
        return;
    }
    
    authStore.error = null; // Clear previous errors
    const success = await authStore.register({
    username: username.value,
    email: email.value,
    password: password.value,
    vertical: vertical.value
  });



        if (success) {
            // redirect to dashboard after successful register/login
    router.push({ name: 'dashboard' });
        }

    // } catch (error) {
    //     console.error('Registration error:', error);
    //     authStore.error = 'Registration failed. Please try again.';
    // }
    // Error handling is managed by the Pinia store and displayed below
};
</script>

<template>

        <h2 class="mb-6 text-center text-2xl/9 font-bold tracking-tight text-gray-900 dark:text-white">Register Your Business</h2>

  <form class="space-y-6" @submit.prevent="handleRegistration">
    <div>
          <label for="username" class="block text-sm/6 font-medium text-gray-900 dark:text-white">Username</label>
          <div class="mt-2">
            <input type="username" id="username" v-model="username" autocomplete="username" required placeholder="Username" 
            class="block w-full rounded-md bg-gray-100 px-3 py-1.5 text-gray-900 outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 
            dark:text-white dark:bg-gray-700 dark:focus:bg-gray-800"/>
          </div>
    </div>
    <div>
          <label for="email" class="block text-sm/6 font-medium text-gray-900 dark:text-white">Email</label>
          <div class="mt-2">
            <input type="email" id="email" v-model="email" autocomplete="email" required placeholder="Email" 
            class="block w-full rounded-md bg-gray-100 px-3 py-1.5 text-gray-900 outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 
            dark:text-white dark:bg-gray-700 dark:focus:bg-gray-800"/>
          </div>
    </div>
    <div>
          <label for="password" class="block text-sm/6 font-medium text-gray-900 dark:text-white">Password</label>
          <div class="mt-2">
            <input type="password" id="password" v-model="password" autocomplete="password" required placeholder="Password" 
            class="block w-full rounded-md bg-gray-100 px-3 py-1.5 text-gray-900 outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 
            dark:text-white dark:bg-gray-700 dark:focus:bg-gray-800"/>
          </div>
    </div>
    <div>
          <label for="passwordConfirm" class="block text-sm/6 font-medium text-gray-900 dark:text-white">Confirm Password</label>
          <div class="mt-2">
            <input type="password" id="passwordConfirm" v-model="passwordConfirm" required placeholder="Confirm Password" 
            class="block w-full rounded-md bg-gray-100 px-3 py-1.5 text-gray-900 outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 
            dark:text-white dark:bg-gray-700 dark:focus:bg-gray-800"/>
          </div>
    </div>
    <div>
          <label for="vertical" class="block text-sm/6 font-medium text-gray-900 dark:text-white">Business Vertical</label>
          <div class="mt-2">
            <select id="vertical" v-model="vertical" required 
            class="block w-full rounded-md bg-gray-100 px-3 py-1.5 text-gray-900 outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 
            dark:text-white dark:bg-gray-700 dark:focus:bg-gray-800">
            <option value="" disabled>Select your industry</option>
            <option v-for="option in verticalOptions" :key="option" :value="option">
                {{ option }}
            </option>
            </select>
          </div>
    </div>



    <!-- <div class="form-group">
        <label for="vertical" class="input-label">Business Vertical</label>
        <select id="vertical" class="text-input" v-model="vertical" required>
            <option value="" disabled>Select your industry</option>
            <option v-for="option in verticalOptions" :key="option" :value="option">
                {{ option }}
            </option>
        </select>
    </div> -->


        <div>
          <button type="submit" :disabled="authStore.loading" class="flex w-full justify-center rounded-md bg-indigo-500 px-3 py-1.5 text-sm/6 font-semibold text-white hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">
            {{ authStore.loading ? 'Registering...' : 'Get Started' }}
          </button>
          <p v-if="authStore.error" class="error-message">{{ authStore.error }}</p>
        </div>

  </form>
</template>

<style scoped>
/* Welcome Text */
.welcome-section {
  margin-bottom: 20px;
}

.welcome-heading {
  font-size: 1.75rem; /* Larger than app name */
  font-weight: 700;
  color: #101828;
  margin-bottom: 4px;
}

.welcome-subtext {
  font-size: 1rem;
  color: #667085; /* Grey subtext */
}

/* Form Styling */
.form-group {
  margin-bottom: 15px;
}
.input-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #344054;
  margin-bottom: 6px;
}

.text-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #d0d5dd;
  border-radius: 8px;
  font-size: 1rem;
  color: #101828;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05);
}

.text-input::placeholder {
  color: #98a2b3;
}
/* Sign In Button */
.sign-up-button {
  width: 100%;
  padding: 12px;
  margin-top: 15px;
  background-color: #7f56d9; /* Primary purple */
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05);
}
.sign-up-button:hover:not(:disabled) {
  background-color: #6941c6; /* Slightly darker purple on hover */
}

.error-message {
    color: #d9534f;
    text-align: center;
    margin-top: 10px;
}
</style>