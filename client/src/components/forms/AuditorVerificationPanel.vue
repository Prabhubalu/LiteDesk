<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
    <div class="p-6 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Auditor Verification</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
        Review and verify corrective actions
      </p>
    </div>
    <div class="p-6 space-y-4">
      <!-- Corrective Actions Needing Verification -->
      <div v-if="actionsNeedingVerification.length > 0" class="space-y-4">
        <div
          v-for="action in actionsNeedingVerification"
          :key="action.questionId"
          class="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
        >
          <div class="mb-3">
            <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-1">
              {{ action.questionText }}
            </h3>
            <p class="text-xs text-gray-600 dark:text-gray-400 mb-2">
              Manager's Action: {{ action.managerAction?.comment || 'No comments' }}
            </p>
            <div v-if="action.managerAction?.proof?.length" class="mb-2">
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Proof:</p>
              <div class="flex flex-wrap gap-2">
                <a
                  v-for="(proof, pIndex) in action.managerAction.proof"
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
              :value="action.managerAction?.status || 'Pending'"
              :variant-map="{
                'Resolved': 'success',
                'In Progress': 'warning',
                'Pending': 'default'
              }"
            />
          </div>

          <!-- Verification Form -->
          <div v-if="!action.auditorVerification || editingQuestionId === action.questionId" class="mt-3 space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Verification Comments
              </label>
              <textarea
                v-model="verifications[action.questionId].comment"
                rows="3"
                placeholder="Add your verification comments..."
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              ></textarea>
            </div>
            <div class="flex items-center gap-2">
              <button
                @click="verifyAction(action.questionId, true)"
                :disabled="verifying"
                class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors disabled:opacity-50"
              >
                {{ verifying ? 'Verifying...' : 'Approve' }}
              </button>
              <button
                @click="verifyAction(action.questionId, false)"
                :disabled="verifying"
                class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50"
              >
                {{ verifying ? 'Verifying...' : 'Reject' }}
              </button>
              <button
                v-if="editingQuestionId === action.questionId"
                @click="cancelEdit"
                class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>

          <!-- Existing Verification -->
          <div v-else class="mt-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <p class="text-sm font-medium text-gray-900 dark:text-white mb-1">
                  Verification Status: 
                  <BadgeCell
                    :value="action.auditorVerification.approved ? 'Approved' : 'Rejected'"
                    :variant-map="{
                      'Approved': 'success',
                      'Rejected': 'danger'
                    }"
                  />
                </p>
                <p v-if="action.auditorVerification.comment" class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {{ action.auditorVerification.comment }}
                </p>
                <p v-if="action.auditorVerification.verifiedBy" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Verified by: {{ action.auditorVerification.verifiedBy.firstName }} {{ action.auditorVerification.verifiedBy.lastName }}
                  on {{ formatDate(action.auditorVerification.verifiedAt) }}
                </p>
              </div>
              <button
                @click="startEdit(action.questionId)"
                class="px-3 py-1.5 text-sm text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded transition-colors"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- No Actions Needing Verification -->
      <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400">
        <svg class="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p>No corrective actions need verification.</p>
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
const verifying = ref(false);
const editingQuestionId = ref(null);
const verifications = ref({});

// Computed
const actionsNeedingVerification = computed(() => {
  if (!props.response || !props.response.correctiveActions) return [];
  
  return props.response.correctiveActions
    .filter(ca => ca.managerAction && ca.managerAction.status === 'Resolved')
    .map(ca => ({
      questionId: ca.questionId,
      questionText: ca.questionText,
      managerAction: ca.managerAction,
      auditorVerification: ca.auditorVerification
    }));
});

// Methods
const initializeVerifications = () => {
  actionsNeedingVerification.value.forEach(action => {
    if (!verifications.value[action.questionId]) {
      const existing = action.auditorVerification;
      verifications.value[action.questionId] = {
        comments: existing?.comments || '',
        status: existing?.status || null
      };
    }
  });
};

const startEdit = (questionId) => {
  editingQuestionId.value = questionId;
  const action = actionsNeedingVerification.value.find(a => a.questionId === questionId);
  if (action && action.auditorVerification) {
    verifications.value[questionId] = {
      comment: action.auditorVerification.comment || '',
      approved: action.auditorVerification.approved || null
    };
  } else {
    verifications.value[questionId] = {
      comment: '',
      approved: null
    };
  }
};

const cancelEdit = () => {
  editingQuestionId.value = null;
};

const verifyAction = async (questionId, approved) => {
  verifying.value = true;
  try {
    const result = await apiClient(`/forms/${props.form._id}/responses/${props.response._id}/verify`, {
      method: 'POST',
      data: {
        questionId,
        approved,
        comment: verifications.value[questionId]?.comment || ''
      }
    });

    if (result.success) {
      editingQuestionId.value = null;
      emit('updated');
    }
  } catch (error) {
    console.error('Error verifying action:', error);
    alert('Failed to verify action. Please try again.');
  } finally {
    verifying.value = false;
  }
};

const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Lifecycle
onMounted(() => {
  initializeVerifications();
});
</script>

