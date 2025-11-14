<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
    <div class="p-6 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Corrective Actions</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
        Add corrective actions for failed questions
      </p>
    </div>
    <div class="p-6 space-y-4">
      <!-- Failed Questions List -->
      <div v-if="failedQuestions.length > 0" class="space-y-4">
        <div
          v-for="(question, index) in failedQuestions"
          :key="question.questionId"
          class="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
        >
          <div class="flex items-start justify-between mb-3">
            <div class="flex-1">
              <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-1">
                {{ question.questionText }}
              </h3>
              <p class="text-xs text-gray-600 dark:text-gray-400">
                Answer: {{ formatAnswer(question.answer) }}
              </p>
            </div>
            <BadgeCell 
              value="Fail" 
              :variant-map="{ 'Fail': 'danger' }" 
            />
          </div>

          <!-- Existing Corrective Action -->
          <div v-if="getCorrectiveAction(question.questionId)" class="mt-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded">
            <div class="flex items-start justify-between mb-2">
              <div class="flex-1">
                <p class="text-sm font-medium text-gray-900 dark:text-white">Manager's Action</p>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {{ getCorrectiveAction(question.questionId).managerAction?.comment || 'No comments' }}
                </p>
                <div v-if="getCorrectiveAction(question.questionId).managerAction?.proof?.length" class="mt-2">
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Proof:</p>
                  <div class="flex flex-wrap gap-2">
                    <a
                      v-for="(proof, pIndex) in getCorrectiveAction(question.questionId).managerAction.proof"
                      :key="pIndex"
                      :href="proof"
                      target="_blank"
                      class="text-xs text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      {{ proof.split('/').pop() }}
                    </a>
                  </div>
                </div>
                <BadgeCell
                  v-if="getCorrectiveAction(question.questionId).managerAction?.status"
                  :value="getCorrectiveAction(question.questionId).managerAction.status"
                  :variant-map="{
                    'Resolved': 'success',
                    'In Progress': 'warning',
                    'Pending': 'default'
                  }"
                  class="mt-2"
                />
              </div>
            </div>
          </div>

          <!-- Add/Edit Corrective Action Form -->
          <div v-if="!getCorrectiveAction(question.questionId) || editingQuestionId === question.questionId" class="mt-3 space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Comments
              </label>
              <textarea
                v-model="getCorrectiveActionData(question.questionId).comment"
                rows="3"
                placeholder="Describe the corrective action taken..."
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              ></textarea>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                v-model="getCorrectiveActionData(question.questionId).status"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              >
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Upload Proof (Optional)
              </label>
              <input
                type="file"
                @change="handleFileUpload($event, question.questionId)"
                multiple
                class="w-full text-sm text-gray-900 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
              />
              <div v-if="getCorrectiveActionData(question.questionId).proofFiles.length" class="mt-2 flex flex-wrap gap-2">
                <span
                  v-for="(file, fIndex) in getCorrectiveActionData(question.questionId).proofFiles"
                  :key="fIndex"
                  class="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                >
                  {{ file.name }}
                  <button
                    @click="removeProofFile(question.questionId, fIndex)"
                    class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    ×
                  </button>
                </span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                @click="saveCorrectiveAction(question.questionId)"
                :disabled="saving"
                class="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium transition-colors disabled:opacity-50"
              >
                {{ saving ? 'Saving...' : 'Save Corrective Action' }}
              </button>
              <button
                v-if="editingQuestionId === question.questionId"
                @click="cancelEdit"
                class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>

          <!-- Edit Button -->
          <button
            v-if="getCorrectiveAction(question.questionId) && editingQuestionId !== question.questionId"
            @click="startEdit(question.questionId)"
            class="mt-3 px-3 py-1.5 text-sm text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded transition-colors"
          >
            Edit Corrective Action
          </button>
        </div>
      </div>

      <!-- No Failed Questions -->
      <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400">
        <svg class="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p>All questions passed. No corrective actions needed.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import apiClient from '@/utils/apiClient';
import BadgeCell from '@/components/common/table/BadgeCell.vue';

const props = defineProps({
  response: {
    type: Object,
    required: true
  },
  form: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['updated']);

// State
const saving = ref(false);
const editingQuestionId = ref(null);
const correctiveActions = ref({});

// Computed
const failedQuestions = computed(() => {
  if (!props.response || !props.response.responseDetails || !props.form) return [];
  
  return props.response.responseDetails
    .filter(rd => rd.passFail === 'Fail')
    .map(rd => {
      // Find question in form structure
      let question = null;
      for (const section of props.form.sections || []) {
        for (const subsection of section.subsections || []) {
          const q = subsection.questions?.find(q => q.questionId === rd.questionId);
          if (q) {
            question = { ...q, answer: rd.answer };
            break;
          }
        }
        if (question) break;
      }
      return question;
    })
    .filter(q => q !== null);
});

// Methods
const getCorrectiveAction = (questionId) => {
  if (!props.response || !props.response.correctiveActions) return null;
  return props.response.correctiveActions.find(ca => ca.questionId === questionId) || null;
};

const getCorrectiveActionData = (questionId) => {
  // Initialize if not exists
  if (!correctiveActions.value[questionId]) {
    const existing = getCorrectiveAction(questionId);
    correctiveActions.value[questionId] = {
      comment: existing?.managerAction?.comment || '',
      status: existing?.managerAction?.status || 'Pending',
      proofFiles: []
    };
  }
  return correctiveActions.value[questionId];
};

const formatAnswer = (answer) => {
  if (answer === null || answer === undefined) return 'No answer';
  if (Array.isArray(answer)) return answer.join(', ');
  return String(answer);
};

const initializeCorrectiveActions = () => {
  failedQuestions.value.forEach(question => {
    if (!correctiveActions.value[question.questionId]) {
      const existing = getCorrectiveAction(question.questionId);
      correctiveActions.value[question.questionId] = {
        comment: existing?.managerAction?.comment || '',
        status: existing?.managerAction?.status || 'Pending',
        proofFiles: []
      };
    }
  });
};

const startEdit = (questionId) => {
  editingQuestionId.value = questionId;
  // Initialize using getCorrectiveActionData which handles initialization
  getCorrectiveActionData(questionId);
};

const cancelEdit = () => {
  editingQuestionId.value = null;
};

const handleFileUpload = (event, questionId) => {
  const files = Array.from(event.target.files);
  // Initialize using getCorrectiveActionData which handles initialization
  const actionData = getCorrectiveActionData(questionId);
  actionData.proofFiles.push(...files);
};

const removeProofFile = (questionId, fileIndex) => {
  const actionData = getCorrectiveActionData(questionId);
  if (actionData && actionData.proofFiles) {
    actionData.proofFiles.splice(fileIndex, 1);
  }
};

const saveCorrectiveAction = async (questionId) => {
  saving.value = true;
  try {
    const actionData = getCorrectiveActionData(questionId);
    
    // Create FormData for file upload
    const formData = new FormData();
    formData.append('questionId', questionId);
    formData.append('comment', actionData.comment);
    formData.append('status', actionData.status);
    
    // Append proof files
    if (actionData.proofFiles && actionData.proofFiles.length > 0) {
      actionData.proofFiles.forEach((file) => {
        formData.append('proof', file);
      });
    }

    // Use fetch for FormData (apiClient might not handle it properly)
    const authStore = JSON.parse(localStorage.getItem('auth') || '{}');
    const token = authStore.user?.token;
    
    const response = await fetch(`/api/forms/${props.form._id}/responses/${props.response._id}/corrective-action`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const result = await response.json();

    if (result.success) {
      editingQuestionId.value = null;
      // Clear proof files after successful upload
      correctiveActions.value[questionId].proofFiles = [];
      emit('updated');
    } else {
      throw new Error(result.message || 'Failed to save corrective action');
    }
  } catch (error) {
    console.error('Error saving corrective action:', error);
    alert('Failed to save corrective action. Please try again.');
  } finally {
    saving.value = false;
  }
};

// Lifecycle
onMounted(() => {
  initializeCorrectiveActions();
});
</script>

