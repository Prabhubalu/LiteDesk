<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
    <div class="max-w-3xl mx-auto">
      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <div class="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 border-t-brand-600 dark:border-t-brand-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-gray-600 dark:text-gray-400">Loading form...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
        <svg class="w-12 h-12 text-red-600 dark:text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 class="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">Form Not Found</h2>
        <p class="text-red-600 dark:text-red-400">{{ error }}</p>
      </div>

      <!-- Form Display -->
      <div v-else-if="form" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
        <!-- Form Header -->
        <div class="mb-8">
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">{{ form.name }}</h1>
          <p v-if="form.description" class="text-gray-600 dark:text-gray-400">{{ form.description }}</p>
          <div class="flex items-center gap-4 mt-4 text-sm text-gray-500 dark:text-gray-400">
            <span>Form ID: {{ form.formId }}</span>
            <span v-if="form.formType">Type: {{ form.formType }}</span>
          </div>
        </div>

        <!-- Form Sections -->
        <form @submit.prevent="submitForm" class="space-y-8">
          <div v-for="(section, sectionIndex) in form.sections" :key="section.sectionId || sectionIndex" class="border-b border-gray-200 dark:border-gray-700 pb-6 last:border-b-0">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">{{ section.name }}</h2>
            
            <!-- Subsections -->
            <div v-for="(subsection, subIndex) in section.subsections" :key="subsection.subsectionId || subIndex" class="ml-4 mb-6">
              <h3 class="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3">{{ subsection.name }}</h3>
              
              <!-- Questions -->
              <div class="ml-4 space-y-4">
                <div v-for="(question, qIndex) in subsection.questions" :key="question.questionId || qIndex" class="mb-4">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {{ question.questionText }}
                    <span v-if="question.mandatory" class="text-red-500">*</span>
                  </label>
                  
                  <!-- Text Input -->
                  <input
                    v-if="question.type === 'Text'"
                    v-model="formData[question.questionId]"
                    type="text"
                    :required="question.mandatory"
                    class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                  
                  <!-- Yes-No -->
                  <div v-else-if="question.type === 'Yes-No'" class="flex gap-4">
                    <label class="flex items-center">
                      <input
                        type="radio"
                        :name="question.questionId"
                        :value="'Yes'"
                        v-model="formData[question.questionId]"
                        :required="question.mandatory"
                        class="w-4 h-4 text-brand-600 border-gray-300 focus:ring-brand-500"
                      />
                      <span class="ml-2 text-gray-700 dark:text-gray-300">Yes</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        type="radio"
                        :name="question.questionId"
                        :value="'No'"
                        v-model="formData[question.questionId]"
                        :required="question.mandatory"
                        class="w-4 h-4 text-brand-600 border-gray-300 focus:ring-brand-500"
                      />
                      <span class="ml-2 text-gray-700 dark:text-gray-300">No</span>
                    </label>
                  </div>
                  
                  <!-- Dropdown -->
                  <select
                    v-else-if="question.type === 'Dropdown'"
                    v-model="formData[question.questionId]"
                    :required="question.mandatory"
                    class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  >
                    <option value="">Select an option</option>
                    <option v-for="option in question.options" :key="option" :value="option">{{ option }}</option>
                  </select>
                  
                  <!-- Rating -->
                  <div v-else-if="question.type === 'Rating'" class="flex gap-2">
                    <button
                      v-for="rating in 5"
                      :key="rating"
                      type="button"
                      @click="formData[question.questionId] = rating"
                      :class="[
                        'w-10 h-10 rounded-lg border-2 transition-colors',
                        formData[question.questionId] >= rating
                          ? 'bg-brand-600 border-brand-600 text-white'
                          : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                      ]"
                    >
                      {{ rating }}
                    </button>
                  </div>
                  
                  <!-- Textarea -->
                  <textarea
                    v-else-if="question.type === 'Textarea'"
                    v-model="formData[question.questionId]"
                    :required="question.mandatory"
                    rows="4"
                    class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  ></textarea>
                  
                  <!-- Date -->
                  <input
                    v-else-if="question.type === 'Date'"
                    v-model="formData[question.questionId]"
                    type="date"
                    :required="question.mandatory"
                    class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                  
                  <!-- File Upload -->
                  <input
                    v-else-if="question.type === 'File'"
                    type="file"
                    @change="handleFileUpload(question.questionId, $event)"
                    :required="question.mandatory"
                    class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                  
                  <!-- Signature -->
                  <SignaturePad
                    v-else-if="question.type === 'Signature'"
                    v-model="formData[question.questionId]"
                    :label="question.questionText"
                    :required="question.mandatory"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Submit Button -->
          <div class="flex justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="submit"
              :disabled="submitting"
              class="px-6 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="submitting">Submitting...</span>
              <span v-else>Submit Form</span>
            </button>
          </div>
        </form>

        <!-- Success Message -->
        <div v-if="submitted" class="mt-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 text-center">
          <svg class="w-12 h-12 text-green-600 dark:text-green-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 class="text-xl font-semibold text-green-800 dark:text-green-200 mb-2">Form Submitted Successfully!</h2>
          <p class="text-green-600 dark:text-green-400">Thank you for your submission.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import SignaturePad from '@/components/forms/SignaturePad.vue';
import apiClient from '@/utils/apiClient';

const route = useRoute();
const slug = route.params.slug;

const loading = ref(true);
const error = ref(null);
const form = ref(null);
const formData = ref({});
const submitting = ref(false);
const submitted = ref(false);

const fetchForm = async () => {
  loading.value = true;
  error.value = null;
  try {
    // Public endpoint - apiClient adds /api prefix, so this becomes /api/public/forms/:slug
    const response = await fetch(`/api/public/forms/${slug}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }).then(res => res.json());

    if (response.success && response.data) {
      form.value = response.data;
      // Initialize formData object with question IDs
      if (form.value.sections) {
        form.value.sections.forEach(section => {
          if (section.subsections) {
            section.subsections.forEach(subsection => {
              if (subsection.questions) {
                subsection.questions.forEach(question => {
                  formData.value[question.questionId] = '';
                });
              }
            });
          }
        });
      }
    } else {
      error.value = response.message || 'Form not found';
    }
  } catch (err) {
    console.error('Error fetching form:', err);
    error.value = err.message || 'Failed to load form. Please try again.';
  } finally {
    loading.value = false;
  }
};

const handleFileUpload = (questionId, event) => {
  const file = event.target.files[0];
  if (file) {
    // For now, just store the file name
    // In production, you'd upload to a file storage service
    formData.value[questionId] = file.name;
  }
};

const submitForm = async () => {
  submitting.value = true;
  try {
    // Prepare submission data - backend expects responseDetails array
    const responseDetails = Object.keys(formData.value)
      .filter(questionId => formData.value[questionId] !== '' && formData.value[questionId] !== null)
      .map(questionId => {
        // Find the question to get section/subsection IDs
        let sectionId = '';
        let subsectionId = '';
        
        if (form.value.sections) {
          for (const section of form.value.sections) {
            if (section.subsections) {
              for (const subsection of section.subsections) {
                if (subsection.questions) {
                  const question = subsection.questions.find(q => q.questionId === questionId);
                  if (question) {
                    sectionId = section.sectionId;
                    subsectionId = subsection.subsectionId;
                    break;
                  }
                }
              }
            }
            if (sectionId) break;
          }
        }
        
        return {
          questionId,
          sectionId: sectionId || undefined,
          subsectionId: subsectionId || undefined,
          answer: formData.value[questionId]
        };
      });

    const submissionData = {
      responseDetails,
      linkedTo: null // Can be set if linking to a CRM entity
    };

    // Public endpoint - use fetch directly since apiClient might require auth
    const response = await fetch(`/api/public/forms/${slug}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(submissionData)
    });

    let responseData;
    try {
      responseData = await response.json();
    } catch (parseError) {
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }

    if (!response.ok) {
      console.error('Form submission error:', responseData);
      throw new Error(responseData.message || responseData.error || `Server error: ${response.status}`);
    }

    if (responseData && responseData.success) {
      submitted.value = true;
      // Reset form after 3 seconds
      setTimeout(() => {
        submitted.value = false;
        formData.value = {};
        // Re-initialize formData
        if (form.value.sections) {
          form.value.sections.forEach(section => {
            if (section.subsections) {
              section.subsections.forEach(subsection => {
                if (subsection.questions) {
                  subsection.questions.forEach(question => {
                    formData.value[question.questionId] = '';
                  });
                }
              });
            }
          });
        }
      }, 3000);
    }
  } catch (err) {
    console.error('Error submitting form:', err);
    error.value = err.message || 'Failed to submit form. Please try again.';
    // Clear error after 5 seconds
    setTimeout(() => {
      error.value = null;
    }, 5000);
  } finally {
    submitting.value = false;
  }
};

onMounted(() => {
  fetchForm();
});
</script>

