<template>
  <div class="demo-request-form">
    <div class="form-header">
      <h2 class="text-2xl font-bold mb-2">Request a Demo</h2>
      <p class="text-gray-600 dark:text-gray-400 mb-6">
        See how LiteDesk can transform your business. Schedule a personalized demo with our team.
      </p>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-4">
      <!-- Company Information -->
      <div class="form-section">
        <h3 class="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">Company Information</h3>
        
        <div class="form-group">
          <label for="companyName" class="form-label">Company Name *</label>
          <input
            type="text"
            id="companyName"
            v-model="formData.companyName"
            class="form-input"
            placeholder="Enter your company name"
            required
          />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-group">
            <label for="industry" class="form-label">Industry *</label>
            <select
              id="industry"
              v-model="formData.industry"
              class="form-input"
              required
            >
              <option value="">Select Industry</option>
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

          <div class="form-group">
            <label for="companySize" class="form-label">Company Size *</label>
            <select
              id="companySize"
              v-model="formData.companySize"
              class="form-input"
              required
            >
              <option value="">Select Size</option>
              <option value="1-10">1-10 employees</option>
              <option value="11-50">11-50 employees</option>
              <option value="51-200">51-200 employees</option>
              <option value="201-500">201-500 employees</option>
              <option value="500+">500+ employees</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Contact Information -->
      <div class="form-section">
        <h3 class="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">Contact Information</h3>
        
        <div class="form-group">
          <label for="contactName" class="form-label">Full Name *</label>
          <input
            type="text"
            id="contactName"
            v-model="formData.contactName"
            class="form-input"
            placeholder="Enter your full name"
            required
          />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-group">
            <label for="email" class="form-label">Email *</label>
            <input
              type="email"
              id="email"
              v-model="formData.email"
              class="form-input"
              placeholder="your@email.com"
              required
            />
          </div>

          <div class="form-group">
            <label for="phone" class="form-label">Phone</label>
            <input
              type="tel"
              id="phone"
              v-model="formData.phone"
              class="form-input"
              placeholder="+1 (555) 000-0000"
            />
          </div>
        </div>

        <div class="form-group">
          <label for="jobTitle" class="form-label">Job Title</label>
          <input
            type="text"
            id="jobTitle"
            v-model="formData.jobTitle"
            class="form-input"
            placeholder="e.g. Sales Manager, CEO"
          />
        </div>
      </div>

      <!-- Additional Information -->
      <div class="form-section">
        <h3 class="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">Tell Us More</h3>
        
        <div class="form-group">
          <label for="message" class="form-label">What are you looking to achieve?</label>
          <textarea
            id="message"
            v-model="formData.message"
            rows="4"
            class="form-input"
            placeholder="Tell us about your needs and goals..."
          ></textarea>
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <!-- Success Message -->
      <div v-if="success" class="success-message">
        🎉 {{ success }}
      </div>

      <!-- Submit Button -->
      <button
        type="submit"
        :disabled="loading"
        class="submit-button"
      >
        <span v-if="loading">Submitting...</span>
        <span v-else>Request Demo</span>
      </button>

      <p class="text-sm text-gray-500 dark:text-gray-400 text-center mt-4">
        Already have an account? 
        <router-link to="/login" class="text-blue-600 hover:underline">Sign in</router-link>
      </p>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import apiClient from '../utils/apiClient';

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
    const data = await apiClient('/demo/request', {
      method: 'POST',
      body: JSON.stringify(formData.value)
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
    }
  } catch (err) {
    console.error('Demo request error:', err);
    error.value = err.message || 'Failed to submit demo request. Please try again.';
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.demo-request-form {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.dark .demo-request-form {
  background: #1f2937;
}

.form-section {
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.dark .form-section {
  border-bottom-color: #374151;
}

.form-section:last-of-type {
  border-bottom: none;
  padding-bottom: 0;
}

.form-group {
  margin-bottom: 1rem;
}

.form-label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #374151;
}

.dark .form-label {
  color: #d1d5db;
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.dark .form-input {
  background: #374151;
  border-color: #4b5563;
  color: white;
}

.dark .form-input:focus {
  border-color: #60a5fa;
}

.submit-button {
  width: 100%;
  padding: 1rem;
  background: #3b82f6;
  color: white;
  font-weight: 600;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.submit-button:hover:not(:disabled) {
  background: #2563eb;
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  padding: 1rem;
  background: #fee2e2;
  border: 1px solid #fca5a5;
  border-radius: 6px;
  color: #991b1b;
  margin-bottom: 1rem;
}

.success-message {
  padding: 1rem;
  background: #d1fae5;
  border: 1px solid #6ee7b7;
  border-radius: 6px;
  color: #065f46;
  margin-bottom: 1rem;
}

.dark .error-message {
  background: #7f1d1d;
  border-color: #991b1b;
  color: #fca5a5;
}

.dark .success-message {
  background: #064e3b;
  border-color: #059669;
  color: #6ee7b7;
}
</style>

