<template>
  <div class="demo-requests-container p-6">
    <div class="header-section mb-6">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        Demo Requests
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Manage and track all demo requests from potential customers
      </p>
    </div>

    <!-- Stats Cards -->
    <div v-if="stats" class="stats-grid grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div class="stat-card">
        <div class="stat-label">Total Requests</div>
        <div class="stat-value">{{ stats.total || 0 }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">This Month</div>
        <div class="stat-value">{{ stats.thisMonth || 0 }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Pending</div>
        <div class="stat-value">{{ stats.byStatus?.pending || 0 }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Converted</div>
        <div class="stat-value">{{ stats.byStatus?.converted || 0 }}</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-section mb-6 flex gap-4">
      <select 
        v-model="filterStatus" 
        @change="fetchDemoRequests"
        class="filter-select"
      >
        <option value="">All Status</option>
        <option value="pending">Pending</option>
        <option value="contacted">Contacted</option>
        <option value="demo_scheduled">Demo Scheduled</option>
        <option value="demo_completed">Demo Completed</option>
        <option value="converted">Converted</option>
        <option value="rejected">Rejected</option>
      </select>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12">
      <p class="text-gray-600 dark:text-gray-400">Loading demo requests...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-card">
      {{ error }}
    </div>

    <!-- Demo Requests Table -->
    <div v-else-if="demoRequests.length > 0" class="requests-table-container">
      <table class="requests-table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Contact</th>
            <th>Email</th>
            <th>Industry</th>
            <th>Size</th>
            <th>Status</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="request in demoRequests" :key="request._id">
            <td class="font-semibold">{{ request.companyName }}</td>
            <td>{{ request.contactName }}</td>
            <td>{{ request.email }}</td>
            <td>{{ request.industry }}</td>
            <td>{{ request.companySize }}</td>
            <td>
              <span :class="getStatusClass(request.status)">
                {{ formatStatus(request.status) }}
              </span>
            </td>
            <td>{{ formatDate(request.createdAt) }}</td>
            <td>
              <div class="action-buttons">
                <button 
                  @click="viewDetails(request)"
                  class="btn-view"
                  title="View Details"
                >
                  👁️
                </button>
                <button 
                  v-if="request.status !== 'converted'"
                  @click="openConvertModal(request)"
                  class="btn-convert"
                  title="Convert to Organization"
                >
                  ✅
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <p class="text-gray-600 dark:text-gray-400 text-center py-12">
        No demo requests found
      </p>
    </div>

    <!-- Details Modal -->
    <div v-if="selectedRequest" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2 class="text-2xl font-bold">Demo Request Details</h2>
          <button @click="closeModal" class="close-button">×</button>
        </div>
        
        <div class="modal-body">
          <div class="detail-section">
            <h3 class="detail-section-title">Company Information</h3>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">Company Name:</span>
                <span class="detail-value">{{ selectedRequest.companyName }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Industry:</span>
                <span class="detail-value">{{ selectedRequest.industry }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Company Size:</span>
                <span class="detail-value">{{ selectedRequest.companySize }}</span>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <h3 class="detail-section-title">Contact Information</h3>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">Contact Name:</span>
                <span class="detail-value">{{ selectedRequest.contactName }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Email:</span>
                <span class="detail-value">{{ selectedRequest.email }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Phone:</span>
                <span class="detail-value">{{ selectedRequest.phone || 'N/A' }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Job Title:</span>
                <span class="detail-value">{{ selectedRequest.jobTitle || 'N/A' }}</span>
              </div>
            </div>
          </div>

          <div v-if="selectedRequest.message" class="detail-section">
            <h3 class="detail-section-title">Message</h3>
            <p class="detail-message">{{ selectedRequest.message }}</p>
          </div>

          <!-- CRM Integration Section -->
          <div v-if="selectedRequest.organizationId || selectedRequest.contactId" class="detail-section crm-section">
            <h3 class="detail-section-title">✅ CRM Integration</h3>
            <div class="crm-alert">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>This prospect is already in your CRM!</span>
            </div>
            
            <div class="detail-grid">
              <div v-if="selectedRequest.organizationId" class="detail-item">
                <span class="detail-label">Organization:</span>
                <span class="detail-value">
                  {{ selectedRequest.organizationId.name }} 
                  <span class="text-gray-500">({{ selectedRequest.organizationId.industry }})</span>
                </span>
              </div>
              <div v-if="selectedRequest.contactId" class="detail-item">
                <span class="detail-label">Contact:</span>
                <span class="detail-value">
                  {{ selectedRequest.contactId.first_name }} {{ selectedRequest.contactId.last_name }}
                  <span class="badge badge-lead">{{ selectedRequest.contactId.lifecycle_stage }}</span>
                </span>
              </div>
              <div v-if="selectedRequest.contactId" class="detail-item">
                <span class="detail-label">Contact Email:</span>
                <span class="detail-value">{{ selectedRequest.contactId.email }}</span>
              </div>
              <div v-if="selectedRequest.contactId && selectedRequest.contactId.phone" class="detail-item">
                <span class="detail-label">Contact Phone:</span>
                <span class="detail-value">{{ selectedRequest.contactId.phone }}</span>
              </div>
            </div>
            
            <div class="crm-note">
              <strong>Note:</strong> This contact exists in a separate organization. They will see their own CRM data when they log in.
            </div>
          </div>

          <div class="detail-section">
            <h3 class="detail-section-title">Update Status</h3>
            <select 
              v-model="updateStatusValue" 
              class="status-select"
            >
              <option value="pending">Pending</option>
              <option value="contacted">Contacted</option>
              <option value="demo_scheduled">Demo Scheduled</option>
              <option value="demo_completed">Demo Completed</option>
              <option value="converted">Converted</option>
              <option value="rejected">Rejected</option>
            </select>
            <button 
              @click="updateStatus" 
              class="btn-update-status"
              :disabled="updatingStatus"
            >
              {{ updatingStatus ? 'Updating...' : 'Update Status' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Convert Modal -->
    <div v-if="convertModalRequest" class="modal-overlay" @click="closeConvertModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2 class="text-2xl font-bold">Convert to Organization</h2>
          <button @click="closeConvertModal" class="close-button">×</button>
        </div>
        
        <div class="modal-body">
          <p class="mb-4">Convert <strong>{{ convertModalRequest.companyName }}</strong> to an active organization?</p>
          
          <div class="form-group">
            <label class="form-label">Temporary Password *</label>
            <input 
              v-model="convertPassword" 
              type="password" 
              class="form-input"
              placeholder="Enter temporary password for owner"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label">Subscription Tier</label>
            <select v-model="convertTier" class="form-input">
              <option value="trial">Trial (15 days)</option>
              <option value="starter">Starter</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          <div class="flex gap-3 mt-6">
            <button 
              @click="convertRequest" 
              class="btn-convert-confirm"
              :disabled="converting || !convertPassword"
            >
              {{ converting ? 'Converting...' : 'Convert' }}
            </button>
            <button @click="closeConvertModal" class="btn-cancel">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import apiClient from '../utils/apiClient';

const demoRequests = ref([]);
const stats = ref(null);
const loading = ref(true);
const error = ref('');
const filterStatus = ref('');

const selectedRequest = ref(null);
const updateStatusValue = ref('');
const updatingStatus = ref(false);

const convertModalRequest = ref(null);
const convertPassword = ref('');
const convertTier = ref('trial');
const converting = ref(false);

const fetchDemoRequests = async () => {
  loading.value = true;
  error.value = '';
  
  try {
    let url = '/demo/requests';
    if (filterStatus.value) {
      url += `?status=${filterStatus.value}`;
    }

    const data = await apiClient(url);
    
    if (data.success) {
      demoRequests.value = data.data;
    }
  } catch (err) {
    console.error('Error fetching demo requests:', err);
    error.value = 'Failed to load demo requests';
  } finally {
    loading.value = false;
  }
};

const fetchStats = async () => {
  try {
    const data = await apiClient('/demo/requests/stats');
    if (data.success) {
      stats.value = data.data;
    }
  } catch (err) {
    console.error('Error fetching stats:', err);
  }
};

const viewDetails = (request) => {
  selectedRequest.value = request;
  updateStatusValue.value = request.status;
};

const closeModal = () => {
  selectedRequest.value = null;
};

const updateStatus = async () => {
  if (!selectedRequest.value) return;
  
  updatingStatus.value = true;
  
  try {
    const data = await apiClient(`/demo/requests/${selectedRequest.value._id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: updateStatusValue.value
      })
    });
    
    if (data.success) {
      // Update the request in the list
      const index = demoRequests.value.findIndex(r => r._id === selectedRequest.value._id);
      if (index !== -1) {
        demoRequests.value[index] = data.data;
      }
      
      selectedRequest.value = data.data;
      await fetchStats();
    }
  } catch (err) {
    console.error('Error updating status:', err);
    alert('Failed to update status');
  } finally {
    updatingStatus.value = false;
  }
};

const openConvertModal = (request) => {
  convertModalRequest.value = request;
  convertPassword.value = '';
  convertTier.value = 'trial';
};

const closeConvertModal = () => {
  convertModalRequest.value = null;
  convertPassword.value = '';
};

const convertRequest = async () => {
  if (!convertModalRequest.value || !convertPassword.value) return;
  
  converting.value = true;
  
  try {
    const data = await apiClient(
      `/demo/requests/${convertModalRequest.value._id}/convert`,
      {
        method: 'POST',
        body: JSON.stringify({
          password: convertPassword.value,
          subscriptionTier: convertTier.value
        })
      }
    );
    
    if (data.success) {
      alert('Successfully converted to organization!');
      closeConvertModal();
      await fetchDemoRequests();
      await fetchStats();
    }
  } catch (err) {
    console.error('Error converting request:', err);
    alert(err.message || 'Failed to convert request');
  } finally {
    converting.value = false;
  }
};

const getStatusClass = (status) => {
  const classes = {
    pending: 'status-badge status-pending',
    contacted: 'status-badge status-contacted',
    demo_scheduled: 'status-badge status-scheduled',
    demo_completed: 'status-badge status-completed',
    converted: 'status-badge status-converted',
    rejected: 'status-badge status-rejected'
  };
  return classes[status] || 'status-badge';
};

const formatStatus = (status) => {
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

onMounted(() => {
  fetchDemoRequests();
  fetchStats();
});
</script>

<style scoped>
.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.dark .stat-card {
  background: #1f2937;
}

.stat-label {
  color: #6b7280;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.dark .stat-label {
  color: #9ca3af;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #111827;
}

.dark .stat-value {
  color: #f9fafb;
}

.filter-select {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
}

.dark .filter-select {
  background: #374151;
  border-color: #4b5563;
  color: white;
}

.requests-table-container {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.dark .requests-table-container {
  background: #1f2937;
}

.requests-table {
  width: 100%;
  border-collapse: collapse;
}

.requests-table th {
  background: #f9fafb;
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 1px solid #e5e7eb;
}

.dark .requests-table th {
  background: #111827;
  color: #d1d5db;
  border-bottom-color: #374151;
}

.requests-table td {
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
  color: #111827;
}

.dark .requests-table td {
  border-bottom-color: #374151;
  color: #f9fafb;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
}

.status-pending { background: #fef3c7; color: #92400e; }
.status-contacted { background: #dbeafe; color: #1e40af; }
.status-scheduled { background: #e0e7ff; color: #3730a3; }
.status-completed { background: #d1fae5; color: #065f46; }
.status-converted { background: #d1fae5; color: #065f46; }
.status-rejected { background: #fee2e2; color: #991b1b; }

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.btn-view, .btn-convert {
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: #f3f4f6;
}

.btn-view:hover, .btn-convert:hover {
  background: #e5e7eb;
}

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
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.dark .modal-content {
  background: #1f2937;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.dark .modal-header {
  border-bottom-color: #374151;
}

.close-button {
  font-size: 2rem;
  border: none;
  background: none;
  cursor: pointer;
  color: #6b7280;
}

.modal-body {
  padding: 1.5rem;
}

.detail-section {
  margin-bottom: 1.5rem;
}

.detail-section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: #111827;
}

.dark .detail-section-title {
  color: #f9fafb;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
}

.detail-label {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.25rem;
}

.detail-value {
  font-weight: 500;
  color: #111827;
}

.dark .detail-value {
  color: #f9fafb;
}

.detail-message {
  padding: 1rem;
  background: #f9fafb;
  border-radius: 6px;
  color: #374151;
}

.dark .detail-message {
  background: #111827;
  color: #d1d5db;
}

.status-select, .form-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  margin-bottom: 0.5rem;
}

.dark .status-select, .dark .form-input {
  background: #374151;
  border-color: #4b5563;
  color: white;
}

.btn-update-status, .btn-convert-confirm {
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}

.btn-update-status:hover, .btn-convert-confirm:hover {
  background: #2563eb;
}

.btn-update-status:disabled, .btn-convert-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-cancel {
  padding: 0.5rem 1rem;
  background: #6b7280;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.btn-cancel:hover {
  background: #4b5563;
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

.error-card {
  padding: 1rem;
  background: #fee2e2;
  border: 1px solid #fca5a5;
  border-radius: 6px;
  color: #991b1b;
}

.dark .error-card {
  background: #7f1d1d;
  border-color: #991b1b;
  color: #fca5a5;
}

/* CRM Integration Section */
.crm-section {
  background: #f0fdf4;
  border: 2px solid #86efac;
  border-radius: 8px;
  padding: 1.5rem;
}

.crm-alert {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #dcfce7;
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1rem;
  font-weight: 500;
  color: #166534;
}

.crm-alert svg {
  width: 24px;
  height: 24px;
  color: #22c55e;
  flex-shrink: 0;
}

.badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  margin-left: 0.5rem;
}

.badge-lead {
  background: #fef3c7;
  color: #92400e;
}

.crm-note {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #fefce8;
  border-left: 4px solid #facc15;
  border-radius: 4px;
  font-size: 0.875rem;
  color: #713f12;
}

.dark .crm-section {
  background: #064e3b;
  border-color: #059669;
}

.dark .crm-alert {
  background: #065f46;
  color: #d1fae5;
}

.dark .crm-note {
  background: #422006;
  border-color: #fbbf24;
  color: #fef3c7;
}
</style>

