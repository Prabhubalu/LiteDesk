<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2>{{ isEditing ? 'Edit Deal' : 'New Deal' }}</h2>
        <button @click="$emit('close')" class="btn-close">×</button>
      </div>

      <form @submit.prevent="handleSubmit" class="modal-body">
        <!-- Basic Information -->
        <div class="form-section">
          <h3>Deal Information</h3>
          
          <div class="form-row">
            <div class="form-group full-width required">
              <label>Deal Name</label>
              <input 
                v-model="form.name" 
                type="text" 
                placeholder="e.g., Acme Corp - CRM Implementation"
                required
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group required">
              <label>Amount</label>
              <div class="input-group">
                <span class="input-prefix">$</span>
                <input 
                  v-model.number="form.amount" 
                  type="number" 
                  min="0"
                  step="0.01"
                  placeholder="50000"
                  required
                />
              </div>
            </div>

            <div class="form-group required">
              <label>Expected Close Date</label>
              <input 
                v-model="form.expectedCloseDate" 
                type="date" 
                required
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group required">
              <label>Stage</label>
              <select v-model="form.stage" required>
                <option value="Lead">Lead</option>
                <option value="Qualified">Qualified</option>
                <option value="Proposal">Proposal</option>
                <option value="Negotiation">Negotiation</option>
                <option value="Closed Won">Closed Won</option>
                <option value="Closed Lost">Closed Lost</option>
              </select>
            </div>

            <div class="form-group required">
              <label>Probability (%)</label>
              <input 
                v-model.number="form.probability" 
                type="number" 
                min="0"
                max="100"
                placeholder="50"
                required
              />
            </div>
          </div>
        </div>

        <!-- Classification -->
        <div class="form-section">
          <h3>Classification</h3>
          
          <div class="form-row">
            <div class="form-group">
              <label>Deal Type</label>
              <select v-model="form.type">
                <option value="">Select Type</option>
                <option value="New Business">New Business</option>
                <option value="Existing Business">Existing Business</option>
                <option value="Renewal">Renewal</option>
                <option value="Upsell">Upsell</option>
              </select>
            </div>

            <div class="form-group">
              <label>Priority</label>
              <select v-model="form.priority">
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Source</label>
              <input 
                v-model="form.source" 
                type="text" 
                placeholder="e.g., Website, Referral, Cold Call"
              />
            </div>

            <div class="form-group">
              <label>Tags (comma separated)</label>
              <input 
                v-model="tagsString" 
                type="text" 
                placeholder="enterprise, priority, demo"
              />
            </div>
          </div>
        </div>

        <!-- Relationships -->
        <div class="form-section">
          <h3>Relationships</h3>
          
          <div class="form-row">
            <div class="form-group">
              <label>Contact</label>
              <select v-model="form.contactId">
                <option value="">Select Contact</option>
                <option v-for="contact in contacts" :key="contact._id" :value="contact._id">
                  {{ contact.first_name }} {{ contact.last_name }} ({{ contact.email }})
                </option>
              </select>
              <p class="field-hint">Link this deal to a contact</p>
            </div>

            <div class="form-group">
              <label>Owner</label>
              <select v-model="form.ownerId">
                <option v-for="user in users" :key="user._id" :value="user._id">
                  {{ user.firstName }} {{ user.lastName }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <!-- Additional Details -->
        <div class="form-section">
          <h3>Additional Details</h3>
          
          <div class="form-row">
            <div class="form-group full-width">
              <label>Description</label>
              <textarea 
                v-model="form.description" 
                rows="4"
                placeholder="Add details about this deal, requirements, notes, etc."
              ></textarea>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Next Follow-up Date</label>
              <input 
                v-model="form.nextFollowUpDate" 
                type="date"
              />
            </div>
          </div>
        </div>

        <!-- Form Actions -->
        <div class="form-actions">
          <button type="button" @click="$emit('close')" class="btn-secondary">
            Cancel
          </button>
          <button type="submit" :disabled="saving" class="btn-primary">
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
  stage: 'Lead',
  probability: 10,
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
    'Lead': 10,
    'Qualified': 25,
    'Proposal': 50,
    'Negotiation': 75,
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
    const url = isEditing.value ? `/deals/${props.deal._id}` : '/deals';
    const method = isEditing.value ? 'PUT' : 'POST';
    
    // Clean up empty values
    const payload = { ...form.value };
    if (!payload.contactId) delete payload.contactId;
    if (!payload.type) delete payload.type;
    if (!payload.source) delete payload.source;
    if (!payload.description) delete payload.description;
    if (!payload.nextFollowUpDate) delete payload.nextFollowUpDate;
    
    const data = await apiClient(url, {
      method,
      body: JSON.stringify(payload)
    });
    
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

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 100%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.modal-header {
  padding: 1.5rem 2rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  background: white;
  z-index: 10;
}

.modal-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
}

.btn-close {
  background: none;
  border: none;
  font-size: 2rem;
  color: #9ca3af;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: background 0.2s;
}

.btn-close:hover {
  background: #f3f4f6;
}

.modal-body {
  padding: 2rem;
}

.form-section {
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid #f3f4f6;
}

.form-section:last-of-type {
  border-bottom: none;
}

.form-section h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 1.5rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.form-row:last-child {
  margin-bottom: 0;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
}

.form-group.required label::after {
  content: '*';
  color: #dc2626;
  margin-left: 0.25rem;
}

.form-group input,
.form-group select,
.form-group textarea {
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.95rem;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input-group {
  position: relative;
}

.input-prefix {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #6b7280;
  font-weight: 500;
  pointer-events: none;
}

.input-group input {
  padding-left: 2rem;
}

.field-hint {
  font-size: 0.8rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding-top: 1.5rem;
  margin-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
  position: sticky;
  bottom: 0;
  background: white;
}

.btn-primary,
.btn-secondary {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  font-size: 0.95rem;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover {
  background: #f9fafb;
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .modal-overlay {
    padding: 0;
  }
  
  .modal-content {
    border-radius: 0;
    max-height: 100vh;
  }
}
</style>

