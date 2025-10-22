<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2>{{ isEditing ? 'Edit Contact' : 'New Contact' }}</h2>
        <button @click="$emit('close')" class="btn-close">×</button>
      </div>

      <form @submit.prevent="handleSubmit" class="modal-body">
        <!-- Basic Information -->
        <div class="form-section">
          <h3>Basic Information</h3>
          
          <div class="form-row">
            <div class="form-group">
              <label>Salutation</label>
              <select v-model="form.salutation">
                <option value="">None</option>
                <option value="Mr.">Mr.</option>
                <option value="Ms.">Ms.</option>
                <option value="Mrs.">Mrs.</option>
                <option value="Dr.">Dr.</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group required">
              <label>First Name</label>
              <input 
                v-model="form.first_name" 
                type="text" 
                placeholder="John"
                required
              />
            </div>

            <div class="form-group required">
              <label>Last Name</label>
              <input 
                v-model="form.last_name" 
                type="text" 
                placeholder="Doe"
                required
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group required">
              <label>Email</label>
              <input 
                v-model="form.email" 
                type="email" 
                placeholder="john.doe@example.com"
                required
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Phone</label>
              <input 
                v-model="form.phone" 
                type="tel" 
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div class="form-group">
              <label>Mobile</label>
              <input 
                v-model="form.mobile" 
                type="tel" 
                placeholder="+1 (555) 987-6543"
              />
            </div>
          </div>
        </div>

        <!-- Company Information -->
        <div class="form-section">
          <h3>Company Information</h3>
          
          <div class="form-row">
            <div class="form-group">
              <label>Job Title</label>
              <input 
                v-model="form.job_title" 
                type="text" 
                placeholder="Sales Manager"
              />
            </div>

            <div class="form-group">
              <label>Department</label>
              <input 
                v-model="form.department" 
                type="text" 
                placeholder="Sales"
              />
            </div>
          </div>
        </div>

        <!-- Address -->
        <div class="form-section">
          <h3>Address</h3>
          
          <div class="form-row">
            <div class="form-group full-width">
              <label>Street</label>
              <input 
                v-model="form.address.street" 
                type="text" 
                placeholder="123 Main Street"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>City</label>
              <input 
                v-model="form.address.city" 
                type="text" 
                placeholder="New York"
              />
            </div>

            <div class="form-group">
              <label>State</label>
              <input 
                v-model="form.address.state" 
                type="text" 
                placeholder="NY"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Postal Code</label>
              <input 
                v-model="form.address.postal_code" 
                type="text" 
                placeholder="10001"
              />
            </div>

            <div class="form-group">
              <label>Country</label>
              <input 
                v-model="form.address.country" 
                type="text" 
                placeholder="United States"
              />
            </div>
          </div>
        </div>

        <!-- Social & Communication -->
        <div class="form-section">
          <h3>Social & Communication</h3>
          
          <div class="form-row">
            <div class="form-group">
              <label>Website</label>
              <input 
                v-model="form.website" 
                type="url" 
                placeholder="https://example.com"
              />
            </div>

            <div class="form-group">
              <label>LinkedIn URL</label>
              <input 
                v-model="form.linkedin_url" 
                type="url" 
                placeholder="https://linkedin.com/in/johndoe"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Twitter Handle</label>
              <input 
                v-model="form.twitter_handle" 
                type="text" 
                placeholder="@johndoe"
              />
            </div>

            <div class="form-group">
              <label>Preferred Channel</label>
              <select v-model="form.preferred_channel">
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
              </select>
            </div>
          </div>
        </div>

        <!-- CRM Metadata -->
        <div class="form-section">
          <h3>CRM Information</h3>
          
          <div class="form-row">
            <div class="form-group">
              <label>Lead Source</label>
              <input 
                v-model="form.lead_source" 
                type="text" 
                placeholder="Website, Referral, LinkedIn, etc."
              />
            </div>

            <div class="form-group">
              <label>Lifecycle Stage</label>
              <select v-model="form.lifecycle_stage">
                <option value="Lead">Lead</option>
                <option value="Qualified">Qualified</option>
                <option value="Opportunity">Opportunity</option>
                <option value="Customer">Customer</option>
                <option value="Lost">Lost</option>
                <option value="Subscriber">Subscriber</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Status</label>
              <select v-model="form.status">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Archived">Archived</option>
              </select>
            </div>

            <div class="form-group">
              <label>Tags (comma separated)</label>
              <input 
                v-model="tagsString" 
                type="text" 
                placeholder="vip, partner, demo"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>
                <input 
                  v-model="form.do_not_contact" 
                  type="checkbox"
                  style="width: auto; margin-right: 0.5rem;"
                />
                Do Not Contact
              </label>
            </div>
          </div>
        </div>

        <!-- Form Actions -->
        <div class="form-actions">
          <button type="button" @click="$emit('close')" class="btn-secondary">
            Cancel
          </button>
          <button type="submit" :disabled="saving" class="btn-primary">
            {{ saving ? 'Saving...' : (isEditing ? 'Update Contact' : 'Create Contact') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  contact: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['close', 'saved']);

const isEditing = computed(() => !!props.contact);
const saving = ref(false);

const form = ref({
  salutation: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  mobile: '',
  job_title: '',
  department: '',
  address: {
    street: '',
    city: '',
    state: '',
    postal_code: '',
    country: ''
  },
  website: '',
  linkedin_url: '',
  twitter_handle: '',
  preferred_channel: 'email',
  lead_source: '',
  lifecycle_stage: 'Lead',
  status: 'Active',
  tags: [],
  do_not_contact: false
});

const tagsString = ref('');

// Watch for tags string changes
watch(tagsString, (newValue) => {
  form.value.tags = newValue.split(',').map(tag => tag.trim()).filter(tag => tag);
});

// Load contact data if editing
if (props.contact) {
  form.value = {
    ...form.value,
    ...props.contact,
    address: {
      ...form.value.address,
      ...(props.contact.address || {})
    }
  };
  
  if (props.contact.tags && Array.isArray(props.contact.tags)) {
    tagsString.value = props.contact.tags.join(', ');
  }
}

const handleSubmit = async () => {
  saving.value = true;
  
  try {
    const url = isEditing.value ? `/contacts/${props.contact._id}` : '/contacts';
    const method = isEditing.value ? 'PUT' : 'POST';
    
    const data = await apiClient(url, {
      method,
      body: JSON.stringify(form.value)
    });
    
    if (data.success) {
      emit('saved', data.data);
    }
  } catch (error) {
    console.error('Error saving contact:', error);
    alert(error.message || 'Failed to save contact');
  } finally {
    saving.value = false;
  }
};
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
.form-group select {
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.95rem;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
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

