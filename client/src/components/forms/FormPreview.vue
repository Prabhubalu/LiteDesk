<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Form Preview</h2>
      <button
        @click="$emit('close')"
        class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div v-if="form" class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <!-- Form Header -->
      <div class="mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">{{ form.name }}</h1>
        <p v-if="form.description" class="text-gray-600 dark:text-gray-400">{{ form.description }}</p>
        <div class="flex items-center gap-4 mt-2">
          <span class="text-xs px-2 py-1 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded">
            {{ form.formType }}
          </span>
          <span v-if="form.status" class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
            {{ form.status }}
          </span>
        </div>
      </div>

      <!-- Form Sections -->
      <form @submit.prevent="handleSubmit" class="space-y-8">
        <div
          v-for="(section, sectionIndex) in form.sections"
          :key="section.sectionId || sectionIndex"
          class="space-y-4"
        >
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white border-b pb-2">
            {{ section.name }}
          </h2>

          <!-- Subsections -->
          <div
            v-for="(subsection, subIndex) in section.subsections"
            :key="subsection.subsectionId || subIndex"
            class="ml-4 space-y-3"
          >
            <h3 class="text-lg font-medium text-gray-800 dark:text-gray-200">
              {{ subsection.name }}
            </h3>

            <!-- Questions -->
            <div
              v-for="(question, qIndex) in subsection.questions"
              :key="question.questionId || qIndex"
              class="ml-4 space-y-2"
            >
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {{ question.questionText }}
                <span v-if="question.mandatory" class="text-red-500">*</span>
              </label>

              <!-- Render question based on type -->
              <TextQuestion
                v-if="question.type === 'Text' || question.type === 'Email' || question.type === 'Number'"
                :question="question"
                :value="previewData[question.questionId]"
                @update="(val) => updateAnswer(question.questionId, val)"
              />
              <TextareaQuestion
                v-else-if="question.type === 'Textarea'"
                :question="question"
                :value="previewData[question.questionId]"
                @update="(val) => updateAnswer(question.questionId, val)"
              />
              <DateQuestion
                v-else-if="question.type === 'Date'"
                :question="question"
                :value="previewData[question.questionId]"
                @update="(val) => updateAnswer(question.questionId, val)"
              />
              <DropdownQuestion
                v-else-if="question.type === 'Dropdown'"
                :question="question"
                :value="previewData[question.questionId]"
                @update="(val) => updateAnswer(question.questionId, val)"
              />
              <RatingQuestion
                v-else-if="question.type === 'Rating'"
                :question="question"
                :value="previewData[question.questionId]"
                @update="(val) => updateAnswer(question.questionId, val)"
              />
              <YesNoQuestion
                v-else-if="question.type === 'Yes-No'"
                :question="question"
                :value="previewData[question.questionId]"
                @update="(val) => updateAnswer(question.questionId, val)"
              />
              <FileQuestion
                v-else-if="question.type === 'File'"
                :question="question"
                :value="previewData[question.questionId]"
                @update="(val) => updateAnswer(question.questionId, val)"
              />
              <SignatureQuestion
                v-else-if="question.type === 'Signature'"
                :question="question"
                :value="previewData[question.questionId]"
                @update="(val) => updateAnswer(question.questionId, val)"
              />
            </div>
          </div>
        </div>

        <!-- Submit Button -->
        <div class="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="submit"
            class="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium transition-all"
          >
            Submit Form
          </button>
        </div>
      </form>
    </div>

    <div v-else class="text-center py-12 text-gray-600 dark:text-gray-400">
      No form data available for preview
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import TextQuestion from './question-types/TextQuestion.vue';
import TextareaQuestion from './question-types/TextareaQuestion.vue';
import DateQuestion from './question-types/DateQuestion.vue';
import DropdownQuestion from './question-types/DropdownQuestion.vue';
import RatingQuestion from './question-types/RatingQuestion.vue';
import YesNoQuestion from './question-types/YesNoQuestion.vue';
import FileQuestion from './question-types/FileQuestion.vue';
import SignatureQuestion from './question-types/SignatureQuestion.vue';

const props = defineProps({
  form: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['close', 'submit']);

const previewData = ref({});

const updateAnswer = (questionId, value) => {
  previewData.value[questionId] = value;
};

const handleSubmit = () => {
  emit('submit', previewData.value);
};

// Initialize preview data when form changes
watch(() => props.form, (newForm) => {
  previewData.value = {};
  if (newForm && newForm.sections) {
    newForm.sections.forEach(section => {
      if (section.subsections) {
        section.subsections.forEach(subsection => {
          if (subsection.questions) {
            subsection.questions.forEach(question => {
              previewData.value[question.questionId] = '';
            });
          }
        });
      }
    });
  }
}, { immediate: true, deep: true });
</script>

