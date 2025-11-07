<template>
  <div class="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-[1000] p-8" @click="$emit('close')">
    <div class="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl" @click.stop>
      <div class="sticky top-0 px-8 py-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between z-10">
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">{{ isEditing ? 'Edit Deal' : 'New Deal' }}</h2>
        <button @click="$emit('close')" class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-2xl">×</button>
      </div>

      <form @submit.prevent="handleSubmit" class="p-8">
        <!-- Basic Information -->
        <div class="mb-8 pb-8 border-b border-gray-200 dark:border-gray-700 last:border-0">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-6">Deal Information</h3>
          
          <div class="grid grid-cols-1 gap-6 mb-6">
            <div class="flex flex-col">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Deal Name <span class="text-red-600">*</span>
              </label>
              <input 
                v-model="form.name" 
                type="text" 
                placeholder="e.g., Acme Corp - CRM Implementation"
                required
                class="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div class="flex flex-col">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Amount <span class="text-red-600">*</span>
              </label>
              <div class="relative">
                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400 font-medium pointer-events-none">$</span>
                <input 
                  v-model.number="form.amount" 
                  type="number" 
                  min="0"
                  step="0.01"
                  placeholder="50000"
                  required
                  class="w-full pl-8 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                />
              </div>
            </div>

            <div class="flex flex-col">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Expected Close Date <span class="text-red-600">*</span>
              </label>
              <input 
                v-model="form.expectedCloseDate" 
                type="date" 
                required
                class="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="flex flex-col">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Stage <span class="text-red-600">*</span>
              </label>
              <select 
                v-model="form.stage" 
                required
                class="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all cursor-pointer"
              >
                <option value="Qualification">Qualification</option>
                <option value="Proposal">Proposal</option>
                <option value="Negotiation">Negotiation</option>
                <option value="Contract Sent">Contract Sent</option>
                <option value="Closed Won">Closed Won</option>
                <option value="Closed Lost">Closed Lost</option>
              </select>
            </div>

            <div class="flex flex-col">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Probability (%) <span class="text-red-600">*</span>
              </label>
              <input 
                v-model.number="form.probability" 
                type="number" 
                min="0"
                max="100"
                placeholder="50"
                required
                class="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
              />
            </div>
          </div>
        </div>

        <!-- Classification -->
        <div class="mb-8 pb-8 border-b border-gray-200 dark:border-gray-700 last:border-0">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-6">Classification</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="flex flex-col">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Deal Type</label>
              <select 
                v-model="form.type"
                class="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all cursor-pointer"
              >
                <option value="">Select Type</option>
                <option value="New Business">New Business</option>
                <option value="Existing Customer">Existing Customer</option>
                <option value="Upsell">Upsell</option>
                <option value="Renewal">Renewal</option>
                <option value="Cross-Sell">Cross-Sell</option>
              </select>
            </div>

            <div class="flex flex-col">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Priority</label>
              <select 
                v-model="form.priority"
                class="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all cursor-pointer"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="flex flex-col">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Source</label>
              <input 
                v-model="form.source" 
                type="text" 
                placeholder="e.g., Website, Referral, Cold Call"
                class="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
              />
            </div>

            <div class="flex flex-col">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags (comma separated)</label>
              <input 
                v-model="tagsString" 
                type="text" 
                placeholder="enterprise, priority, demo"
                class="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
              />
            </div>
          </div>
        </div>

        <!-- Relationships -->
        <div class="mb-8 pb-8 border-b border-gray-200 dark:border-gray-700 last:border-0">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-6">Relationships</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="flex flex-col">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contact</label>
              <select 
                v-model="form.contactId"
                class="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all cursor-pointer"
              >
                <option value="">Select Contact</option>
                <option v-for="contact in contacts" :key="contact._id" :value="contact._id">
                  {{ contact.first_name }} {{ contact.last_name }} ({{ contact.email }})
                </option>
              </select>
              <p class="text-xs text-gray-600 dark:text-gray-400 mt-2">Link this deal to a contact</p>
            </div>

            <div class="flex flex-col">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Owner</label>
              <select 
                v-model="form.ownerId"
                class="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all cursor-pointer"
              >
                <option v-for="user in users" :key="user._id" :value="user._id">
                  {{ user.firstName }} {{ user.lastName }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <!-- Additional Details -->
        <div class="mb-8 pb-8 border-b border-gray-200 dark:border-gray-700 last:border-0">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-6">Additional Details</h3>
          
          <div class="grid grid-cols-1 gap-6 mb-6">
            <div class="flex flex-col">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
              <textarea 
                v-model="form.description" 
                rows="4"
                placeholder="Add details about this deal, requirements, notes, etc."
                class="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all resize-none"
              ></textarea>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="flex flex-col">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Next Follow-up Date</label>
              <input 
                v-model="form.nextFollowUpDate" 
                type="date"
                class="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
              />
            </div>
          </div>
        </div>

        <!-- Form Actions -->
        <div class="sticky bottom-0 bg-white dark:bg-gray-900 flex justify-end gap-4 pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
          <button 
            type="button" 
            @click="$emit('close')" 
            class="px-6 py-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            :disabled="saving" 
            class="px-6 py-3 bg-brand-600 hover:bg-brand-700 dark:bg-brand-600 dark:hover:bg-brand-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ saving ? 'Saving...' : (isEditing ? 'Update Deal' : 'Create Deal') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/auth';

const props = defineProps({
  deal: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['close', 'saved']);
const authStore = useAuthStore();

const isEditing = computed(() => !!props.deal);
const saving = ref(false);
const contacts = ref([]);
const users = ref([]);

const form = ref({
  name: '',
  amount: 0,
  expectedCloseDate: '',
  stage: 'Qualification',
  probability: 25,
  type: '',
  priority: 'Medium',
  source: '',
  contactId: '',
  ownerId: authStore.user?._id || '',
  description: '',
  nextFollowUpDate: '',
  tags: []
});

const tagsString = ref('');

// Watch for tags string changes
watch(tagsString, (newValue) => {
  form.value.tags = newValue.split(',').map(tag => tag.trim()).filter(tag => tag);
});

// Auto-update probability based on stage
watch(() => form.value.stage, (newStage) => {
  const probabilities = {
    'Qualification': 25,
    'Proposal': 50,
    'Negotiation': 70,
    'Contract Sent': 85,
    'Closed Won': 100,
    'Closed Lost': 0
  };
  form.value.probability = probabilities[newStage] || form.value.probability;
});

// Load deal data if editing
if (props.deal) {
  form.value = {
    ...form.value,
    ...props.deal,
    contactId: props.deal.contactId?._id || '',
    ownerId: props.deal.ownerId?._id || authStore.user?._id,
    expectedCloseDate: props.deal.expectedCloseDate ? new Date(props.deal.expectedCloseDate).toISOString().split('T')[0] : '',
    nextFollowUpDate: props.deal.nextFollowUpDate ? new Date(props.deal.nextFollowUpDate).toISOString().split('T')[0] : ''
  };
  
  if (props.deal.tags && Array.isArray(props.deal.tags)) {
    tagsString.value = props.deal.tags.join(', ');
  }
}

// Fetch contacts for dropdown
const fetchContacts = async () => {
  try {
    const data = await apiClient('/contacts?limit=100', {
      method: 'GET'
    });
    
    if (data.success) {
      contacts.value = data.data;
    }
  } catch (error) {
    console.error('Error fetching contacts:', error);
  }
};

// Fetch users for owner dropdown
const fetchUsers = async () => {
  try {
    const data = await apiClient('/users', {
      method: 'GET'
    });
    
    if (data.success) {
      users.value = data.data;
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    // Fallback to current user
    users.value = [authStore.user];
  }
};

const handleSubmit = async () => {
  saving.value = true;
  
  try {
    // Clean up empty values
    const payload = { ...form.value };
    if (!payload.contactId) delete payload.contactId;
    if (!payload.type) delete payload.type;
    if (!payload.source) delete payload.source;
    if (!payload.description) delete payload.description;
    if (!payload.nextFollowUpDate) delete payload.nextFollowUpDate;
    
    // Use convenience methods that handle JSON.stringify automatically
    const data = isEditing.value 
      ? await apiClient.put(`/deals/${props.deal._id}`, payload)
      : await apiClient.post('/deals', payload);
    
    if (data.success) {
      emit('saved', data.data);
    }
  } catch (error) {
    console.error('Error saving deal:', error);
    alert(error.message || 'Failed to save deal');
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  fetchContacts();
  fetchUsers();
});
</script>

<!-- All styling now uses pure Tailwind (no scoped CSS needed) -->

