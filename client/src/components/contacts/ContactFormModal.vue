<template>
  <Teleport to="body">
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4 sm:p-8" @click="$emit('close')">
      <div class="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl" @click.stop>
        <!-- Header -->
        <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ isEditing ? 'Edit Contact' : 'New Contact' }}
          </h2>
          <button @click="$emit('close')" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="p-6 space-y-8">
          <!-- Basic Information -->
          <div class="space-y-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              Basic Information
            </h3>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div class="sm:col-span-2">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Salutation</label>
                <select v-model="form.salutation" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all">
                  <option value="">None</option>
                  <option value="Mr.">Mr.</option>
                  <option value="Ms.">Ms.</option>
                  <option value="Mrs.">Mrs.</option>
                  <option value="Dr.">Dr.</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  First Name <span class="text-red-500">*</span>
                </label>
                <input 
                  v-model="form.first_name" 
                  type="text" 
                  placeholder="John"
                  required
                  class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Last Name <span class="text-red-500">*</span>
                </label>
                <input 
                  v-model="form.last_name" 
                  type="text" 
                  placeholder="Doe"
                  required
                  class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
                />
              </div>

              <div class="sm:col-span-2">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email <span class="text-red-500">*</span>
                </label>
                <input 
                  v-model="form.email" 
                  type="email" 
                  placeholder="john.doe@example.com"
                  required
                  class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phone</label>
                <input 
                  v-model="form.phone" 
                  type="tel" 
                  placeholder="+1 (555) 123-4567"
                  class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Mobile</label>
                <input 
                  v-model="form.mobile" 
                  type="tel" 
                  placeholder="+1 (555) 987-6543"
                  class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
                />
              </div>
            </div>
          </div>

          <!-- Company Information -->
          <div class="space-y-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              Company Information
            </h3>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div class="sm:col-span-2">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Organization</label>
                <select v-model="form.organization" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all">
                  <option value="">-- Select Organization --</option>
                  <option 
                    v-for="org in organizations" 
                    :key="org._id" 
                    :value="org._id"
                  >
                    {{ org.name }}
                  </option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Job Title</label>
                <input 
                  v-model="form.job_title" 
                  type="text" 
                  placeholder="Sales Manager"
                  class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Department</label>
                <input 
                  v-model="form.department" 
                  type="text" 
                  placeholder="Sales"
                  class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
                />
              </div>
            </div>
          </div>

          <!-- Address -->
          <div class="space-y-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              Address
            </h3>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div class="sm:col-span-2">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Street</label>
                <input 
                  v-model="form.address.street" 
                  type="text" 
                  placeholder="123 Main Street"
                  class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">City</label>
                <input 
                  v-model="form.address.city" 
                  type="text" 
                  placeholder="New York"
                  class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">State</label>
                <input 
                  v-model="form.address.state" 
                  type="text" 
                  placeholder="NY"
                  class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Postal Code</label>
                <input 
                  v-model="form.address.postal_code" 
                  type="text" 
                  placeholder="10001"
                  class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Country</label>
                <input 
                  v-model="form.address.country" 
                  type="text" 
                  placeholder="United States"
                  class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
                />
              </div>
            </div>
          </div>

          <!-- Social & Communication -->
          <div class="space-y-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              Social & Communication
            </h3>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Website</label>
                <input 
                  v-model="form.website" 
                  type="url" 
                  placeholder="https://example.com"
                  class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">LinkedIn URL</label>
                <input 
                  v-model="form.linkedin_url" 
                  type="url" 
                  placeholder="https://linkedin.com/in/johndoe"
                  class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Twitter Handle</label>
                <input 
                  v-model="form.twitter_handle" 
                  type="text" 
                  placeholder="@johndoe"
                  class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preferred Channel</label>
                <select v-model="form.preferred_channel" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all">
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
            </div>
          </div>

          <!-- CRM Metadata -->
          <div class="space-y-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              CRM Information
            </h3>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Lead Source</label>
                <input 
                  v-model="form.lead_source" 
                  type="text" 
                  placeholder="Website, Referral, etc."
                  class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Lifecycle Stage</label>
                <select v-model="form.lifecycle_stage" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all">
                  <option value="Lead">Lead</option>
                  <option value="Qualified">Qualified</option>
                  <option value="Customer">Customer</option>
                  <option value="Lost">Lost</option>
                  <option value="Subscriber">Subscriber</option>
                  <option value="Opportunity">Opportunity</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
                <select v-model="form.status" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags (comma separated)</label>
                <input 
                  v-model="tagsString" 
                  type="text" 
                  placeholder="vip, partner, demo"
                  class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
                />
              </div>

              <div class="sm:col-span-2">
                <label class="flex items-center space-x-3 cursor-pointer">
                  <input 
                    v-model="form.do_not_contact" 
                    type="checkbox"
                    class="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-brand-600 dark:text-brand-500 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 cursor-pointer"
                  />
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Do Not Contact</span>
                </label>
              </div>
            </div>
          </div>

          <!-- Form Actions -->
          <div class="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 pt-6 -mx-6 -mb-6 px-6 pb-6 flex items-center justify-end gap-3">
            <button 
              type="button" 
              @click="$emit('close')" 
              class="px-6 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              :disabled="saving" 
              class="px-6 py-2.5 rounded-lg bg-brand-600 dark:bg-brand-700 text-white font-medium hover:bg-brand-700 dark:hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {{ saving ? 'Saving...' : (isEditing ? 'Update Contact' : 'Create Contact') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
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
const organizations = ref([]);

const form = ref({
  salutation: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  mobile: '',
  organization: '',
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

// Fetch organizations for dropdown
const fetchOrganizations = async () => {
  try {
    const response = await apiClient.get('/admin/organizations/all');
    if (response.success) {
      organizations.value = response.data;
    }
  } catch (error) {
    console.error('Error fetching organizations:', error);
  }
};

// Load contact data if editing
if (props.contact) {
  form.value = {
    ...form.value,
    ...props.contact,
    organization: props.contact.organization?._id || props.contact.organization || '',
    address: {
      ...form.value.address,
      ...(props.contact.address || {})
    }
  };
  
  if (props.contact.tags && Array.isArray(props.contact.tags)) {
    tagsString.value = props.contact.tags.join(', ');
  }
}

// Fetch organizations on mount
onMounted(() => {
  fetchOrganizations();
});

const handleSubmit = async () => {
  saving.value = true;
  
  try {
    // Prepare form data - only send the fields we want to update
    // Extract ObjectIds from populated fields
    const formData = {
      salutation: form.value.salutation,
      first_name: form.value.first_name,
      last_name: form.value.last_name,
      email: form.value.email,
      phone: form.value.phone || '',
      mobile: form.value.mobile || '',
      organization: form.value.organization || null,
      job_title: form.value.job_title || '',
      department: form.value.department || '',
      address: form.value.address,
      website: form.value.website || '',
      linkedin_url: form.value.linkedin_url || '',
      twitter_handle: form.value.twitter_handle || '',
      preferred_channel: form.value.preferred_channel,
      lead_source: form.value.lead_source || '',
      lifecycle_stage: form.value.lifecycle_stage,
      status: form.value.status,
      tags: form.value.tags || [],
      do_not_contact: form.value.do_not_contact || false
    };
    
    console.log('Submitting contact form:', formData);
    console.log('Organization field:', formData.organization);
    
    let data;
    if (isEditing.value) {
      data = await apiClient.put(`/contacts/${props.contact._id}`, formData);
    } else {
      data = await apiClient.post('/contacts', formData);
    }
    
    console.log('Contact saved successfully:', data);
    
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
