<template>
  <div class="instance-management">
    <!-- Header -->
    <div class="header">
      <h1>Instance Management</h1>
      <p class="subtitle">Monitor and manage all customer instances</p>
    </div>

    <!-- Statistics Cards -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon total">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <div class="stat-info">
          <h3>{{ statistics.totalInstances || 0 }}</h3>
          <p>Total Instances</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon active">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="stat-info">
          <h3>{{ statistics.activeInstances || 0 }}</h3>
          <p>Active Instances</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon provisioning">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <div class="stat-info">
          <h3>{{ statistics.provisioningInstances || 0 }}</h3>
          <p>Provisioning</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon revenue">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="stat-info">
          <h3>${{ formatNumber(statistics.totalMRR || 0) }}</h3>
          <p>Monthly Revenue</p>
        </div>
      </div>
    </div>

    <!-- Filters and Search -->
    <div class="controls">
      <div class="search-box">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="Search by name, subdomain, or email..."
          @input="debouncedSearch"
        />
      </div>

      <div class="filters">
        <select v-model="filters.status" @change="fetchInstances">
          <option value="">All Status</option>
          <option value="provisioning">Provisioning</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="terminated">Terminated</option>
          <option value="failed">Failed</option>
        </select>

        <select v-model="filters.subscriptionStatus" @change="fetchInstances">
          <option value="">All Subscriptions</option>
          <option value="trial">Trial</option>
          <option value="active">Active</option>
          <option value="past_due">Past Due</option>
          <option value="canceled">Canceled</option>
        </select>

        <select v-model="filters.healthStatus" @change="fetchInstances">
          <option value="">All Health</option>
          <option value="healthy">Healthy</option>
          <option value="degraded">Degraded</option>
          <option value="unhealthy">Unhealthy</option>
          <option value="unknown">Unknown</option>
        </select>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>Loading instances...</p>
    </div>

    <!-- Instances Table -->
    <div v-else-if="instances.length > 0" class="table-container">
      <table class="instances-table">
        <thead>
          <tr>
            <th>Instance</th>
            <th>Subdomain</th>
            <th>Owner</th>
            <th>Status</th>
            <th>Health</th>
            <th>Subscription</th>
            <th>MRR</th>
            <th>Users</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="instance in instances" :key="instance._id">
            <td>
              <div class="instance-cell">
                <strong>{{ instance.instanceName }}</strong>
                <span class="namespace">{{ instance.kubernetesNamespace }}</span>
              </div>
            </td>
            <td>
              <a :href="instance.urls?.frontend" target="_blank" class="subdomain-link">
                {{ instance.subdomain }}
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </td>
            <td>
              <div class="owner-cell">
                <strong>{{ instance.ownerName || 'N/A' }}</strong>
                <span>{{ instance.ownerEmail }}</span>
              </div>
            </td>
            <td>
              <span :class="['badge', 'status', instance.status]">
                {{ instance.status }}
              </span>
            </td>
            <td>
              <span :class="['badge', 'health', instance.healthStatus]">
                {{ instance.healthStatus }}
              </span>
            </td>
            <td>
              <div class="subscription-cell">
                <span :class="['badge', 'sub', instance.subscription?.tier]">
                  {{ instance.subscription?.tier }}
                </span>
                <span class="sub-status">{{ instance.subscription?.status }}</span>
              </div>
            </td>
            <td class="mrr">${{ instance.subscription?.mrr || 0 }}</td>
            <td>{{ instance.metrics?.totalUsers || 0 }}</td>
            <td>{{ formatDate(instance.createdAt) }}</td>
            <td>
              <div class="actions">
                <button @click="viewInstance(instance)" class="btn-icon" title="View Details">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
                <button @click="manageInstance(instance)" class="btn-icon" title="Manage">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
      <h3>No Instances Found</h3>
      <p>No customer instances match your current filters.</p>
    </div>

    <!-- Pagination -->
    <div v-if="pagination.totalPages > 1" class="pagination">
      <button 
        @click="changePage(pagination.currentPage - 1)" 
        :disabled="pagination.currentPage === 1"
        class="btn-pagination"
      >
        Previous
      </button>
      <span class="page-info">
        Page {{ pagination.currentPage }} of {{ pagination.totalPages }}
      </span>
      <button 
        @click="changePage(pagination.currentPage + 1)" 
        :disabled="pagination.currentPage === pagination.totalPages"
        class="btn-pagination"
      >
        Next
      </button>
    </div>

    <!-- Instance Details Modal -->
    <div v-if="selectedInstance" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>{{ selectedInstance.instanceName }}</h2>
          <button @click="closeModal" class="btn-close">×</button>
        </div>

        <div class="modal-body">
          <div class="detail-section">
            <h3>Instance Information</h3>
            <div class="detail-grid">
              <div class="detail-item">
                <label>Instance Name:</label>
                <span>{{ selectedInstance.instanceName }}</span>
              </div>
              <div class="detail-item">
                <label>Subdomain:</label>
                <span>{{ selectedInstance.subdomain }}</span>
              </div>
              <div class="detail-item">
                <label>Kubernetes Namespace:</label>
                <span>{{ selectedInstance.kubernetesNamespace }}</span>
              </div>
              <div class="detail-item">
                <label>Status:</label>
                <span :class="['badge', 'status', selectedInstance.status]">
                  {{ selectedInstance.status }}
                </span>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <h3>URLs</h3>
            <div class="detail-grid">
              <div class="detail-item">
                <label>Frontend:</label>
                <a :href="selectedInstance.urls?.frontend" target="_blank">{{ selectedInstance.urls?.frontend }}</a>
              </div>
              <div class="detail-item">
                <label>API:</label>
                <a :href="selectedInstance.urls?.api" target="_blank">{{ selectedInstance.urls?.api }}</a>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <h3>Subscription</h3>
            <div class="detail-grid">
              <div class="detail-item">
                <label>Tier:</label>
                <span :class="['badge', 'sub', selectedInstance.subscription?.tier]">
                  {{ selectedInstance.subscription?.tier }}
                </span>
              </div>
              <div class="detail-item">
                <label>Status:</label>
                <span>{{ selectedInstance.subscription?.status }}</span>
              </div>
              <div class="detail-item">
                <label>MRR:</label>
                <span>${{ selectedInstance.subscription?.mrr || 0 }}</span>
              </div>
              <div class="detail-item">
                <label>Trial End:</label>
                <span>{{ formatDate(selectedInstance.subscription?.trialEndDate) }}</span>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <h3>Metrics</h3>
            <div class="detail-grid">
              <div class="detail-item">
                <label>Total Users:</label>
                <span>{{ selectedInstance.metrics?.totalUsers || 0 }}</span>
              </div>
              <div class="detail-item">
                <label>Total Contacts:</label>
                <span>{{ selectedInstance.metrics?.totalContacts || 0 }}</span>
              </div>
              <div class="detail-item">
                <label>Total Deals:</label>
                <span>{{ selectedInstance.metrics?.totalDeals || 0 }}</span>
              </div>
              <div class="detail-item">
                <label>Storage Used:</label>
                <span>{{ selectedInstance.metrics?.storageUsedGB || 0 }} GB</span>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <h3>Database Connection</h3>
            <div class="detail-grid">
              <div class="detail-item">
                <label>Host:</label>
                <span>{{ selectedInstance.databaseConnection?.host }}</span>
              </div>
              <div class="detail-item">
                <label>Port:</label>
                <span>{{ selectedInstance.databaseConnection?.port }}</span>
              </div>
              <div class="detail-item">
                <label>Database:</label>
                <span>{{ selectedInstance.databaseConnection?.database }}</span>
              </div>
              <div class="detail-item">
                <label>Username:</label>
                <span>{{ selectedInstance.databaseConnection?.username }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button @click="closeModal" class="btn-secondary">Close</button>
          <button @click="manageInstance(selectedInstance)" class="btn-primary">Manage Instance</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import apiClient from '../utils/apiClient';

const instances = ref([]);
const statistics = ref({});
const loading = ref(false);
const searchQuery = ref('');
const filters = ref({
  status: '',
  subscriptionStatus: '',
  healthStatus: ''
});
const pagination = ref({
  currentPage: 1,
  totalPages: 1,
  totalInstances: 0,
  limit: 20
});
const selectedInstance = ref(null);

let searchTimeout;

const fetchInstances = async () => {
  loading.value = true;
  console.log('🔍 Fetching instances...');
  
  try {
    const params = new URLSearchParams();
    params.append('page', pagination.value.currentPage);
    params.append('limit', pagination.value.limit);
    
    if (searchQuery.value) params.append('search', searchQuery.value);
    if (filters.value.status) params.append('status', filters.value.status);
    if (filters.value.subscriptionStatus) params.append('subscriptionStatus', filters.value.subscriptionStatus);
    if (filters.value.healthStatus) params.append('healthStatus', filters.value.healthStatus);

    console.log('📡 API URL:', `/instances?${params.toString()}`);
    
    const data = await apiClient(`/instances?${params.toString()}`, {
      method: 'GET'
    });

    console.log('📦 Response data:', data);
    console.log('📊 Statistics:', data.statistics);
    
    if (data.success) {
      instances.value = data.data;
      pagination.value = data.pagination;
      statistics.value = data.statistics;
      console.log(`✅ Loaded ${data.data.length} instances`);
      console.log('📊 Statistics updated:', statistics.value);
    } else {
      console.error('❌ API returned success: false', data);
    }
  } catch (error) {
    console.error('❌ Error fetching instances:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
  } finally {
    loading.value = false;
  }
};

const debouncedSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    pagination.value.currentPage = 1; // Reset to first page on search
    fetchInstances();
  }, 500);
};

const changePage = (page) => {
  pagination.value.currentPage = page;
  fetchInstances();
};

const viewInstance = (instance) => {
  selectedInstance.value = instance;
};

const manageInstance = (instance) => {
  // TODO: Implement instance management modal
  console.log('Manage instance:', instance);
  alert('Instance management UI coming soon!');
};

const closeModal = () => {
  selectedInstance.value = null;
};

const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const formatNumber = (num) => {
  return new Intl.NumberFormat('en-US').format(num);
};

onMounted(() => {
  fetchInstances();
});
</script>

<style scoped>
.instance-management {
  padding: 2rem;
  max-width: 1800px;
  margin: 0 auto;
}

.header {
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: #6b7280;
  font-size: 1rem;
}

/* Statistics Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon svg {
  width: 32px;
  height: 32px;
  color: white;
}

.stat-icon.total {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stat-icon.active {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.stat-icon.provisioning {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
}

.stat-icon.revenue {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}

.stat-info h3 {
  font-size: 2rem;
  font-weight: 700;
  color: #FFFFFF;
  margin-bottom: 0.25rem;
}

.stat-info p {
  color: #6b7280;
  font-size: 0.875rem;
}

/* Controls */
.controls {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.search-box {
  flex: 1;
  min-width: 300px;
  position: relative;
}

.search-box svg {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  color: #9ca3af;
}

.search-box input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 3rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
}

.filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.filters select {
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.875rem;
  background: white;
  cursor: pointer;
}

/* Table */
.table-container {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.instances-table {
  width: 100%;
  border-collapse: collapse;
}

.instances-table thead {
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.instances-table th {
  padding: 1rem;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.instances-table tbody tr {
  border-bottom: 1px solid #e5e7eb;
  transition: background-color 0.15s;
}

.instances-table tbody tr:hover {
  background: #f9fafb;
}

.instances-table td {
  padding: 1rem;
  font-size: 0.875rem;
  color: #374151;
}

.instance-cell {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.instance-cell strong {
  color: #1f2937;
}

.namespace {
  font-size: 0.75rem;
  color: #6b7280;
  font-family: 'Monaco', 'Courier New', monospace;
}

.subdomain-link {
  color: #3b82f6;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-family: 'Monaco', 'Courier New', monospace;
}

.subdomain-link svg {
  width: 14px;
  height: 14px;
}

.subdomain-link:hover {
  text-decoration: underline;
}

.owner-cell {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.owner-cell strong {
  color: #1f2937;
}

.owner-cell span {
  font-size: 0.75rem;
  color: #6b7280;
}

.subscription-cell {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.sub-status {
  font-size: 0.75rem;
  color: #6b7280;
}

.mrr {
  font-weight: 600;
  color: #059669;
}

/* Badges */
.badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.badge.status.provisioning {
  background: #dbeafe;
  color: #1e40af;
}

.badge.status.active {
  background: #d1fae5;
  color: #065f46;
}

.badge.status.suspended {
  background: #fef3c7;
  color: #92400e;
}

.badge.status.terminated,
.badge.status.failed {
  background: #fee2e2;
  color: #991b1b;
}

.badge.health.healthy {
  background: #d1fae5;
  color: #065f46;
}

.badge.health.degraded {
  background: #fef3c7;
  color: #92400e;
}

.badge.health.unhealthy {
  background: #fee2e2;
  color: #991b1b;
}

.badge.health.unknown {
  background: #e5e7eb;
  color: #4b5563;
}

.badge.sub.trial {
  background: #dbeafe;
  color: #1e40af;
}

.badge.sub.starter {
  background: #e0e7ff;
  color: #3730a3;
}

.badge.sub.professional {
  background: #fae8ff;
  color: #701a75;
}

.badge.sub.enterprise {
  background: #fef3c7;
  color: #92400e;
}

/* Actions */
.actions {
  display: flex;
  gap: 0.5rem;
}

.btn-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: none;
  background: #f3f4f6;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.btn-icon svg {
  width: 16px;
  height: 16px;
  color: #6b7280;
}

.btn-icon:hover {
  background: #e5e7eb;
}

/* Loading */
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: #6b7280;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: #6b7280;
}

.empty-state svg {
  width: 64px;
  height: 64px;
  margin: 0 auto 1rem;
  color: #d1d5db;
}

.empty-state h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
}

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 2rem;
}

.btn-pagination {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background 0.2s;
}

.btn-pagination:hover:not(:disabled) {
  background: #f9fafb;
}

.btn-pagination:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  color: #6b7280;
  font-size: 0.875rem;
}

/* Modal */
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
  max-width: 900px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
}

.btn-close {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: none;
  background: #f3f4f6;
  cursor: pointer;
  font-size: 1.5rem;
  color: #6b7280;
  transition: background 0.2s;
}

.btn-close:hover {
  background: #e5e7eb;
}

.modal-body {
  padding: 2rem;
}

.detail-section {
  margin-bottom: 2rem;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-section h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 1rem;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.detail-item label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.detail-item span,
.detail-item a {
  font-size: 0.875rem;
  color: #374151;
}

.detail-item a {
  color: #3b82f6;
  text-decoration: none;
}

.detail-item a:hover {
  text-decoration: underline;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1.5rem 2rem;
  border-top: 1px solid #e5e7eb;
}

.btn-secondary,
.btn-primary {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

/* Dark Mode Support */
@media (prefers-color-scheme: dark) {
  .header h1 {
    color: #f9fafb;
  }

  .subtitle,
  .stat-info p,
  .page-info,
  .owner-cell span,
  .sub-status,
  .namespace {
    color: #9ca3af;
  }

  .stat-card,
  .table-container,
  .search-box input,
  .filters select,
  .modal-content,
  .btn-secondary {
    background: #1f2937;
  }

  .instances-table thead,
  .instances-table tbody tr:hover,
  .btn-pagination,
  .btn-icon,
  .btn-close {
    background: #111827;
  }

  .instances-table tbody tr {
    border-color: #374151;
  }

  .instances-table th,
  .loading,
  .empty-state,
  .empty-state h3,
  .detail-item span,
  .btn-secondary {
    color: #d1d5db;
  }

  .instance-cell strong,
  .owner-cell strong,
  .modal-header h2,
  .detail-section h3 {
    color: #f9fafb;
  }

  .search-box input,
  .filters select,
  .btn-pagination {
    border-color: #374151;
    color: #f9fafb;
  }
}
</style>

