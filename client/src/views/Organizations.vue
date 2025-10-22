<template>
  <div class="organizations-page">
    <!-- Header -->
    <div class="page-header">
      <div class="header-left">
        <h1>Organizations</h1>
        <p class="subtitle">Manage all customer organizations</p>
      </div>
      <div class="header-right">
        <button @click="exportOrganizations" class="btn-secondary">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
          Export
        </button>
        <button @click="openCreateModal" class="btn-primary">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          New Organization
        </button>
      </div>
    </div>

    <!-- Statistics Cards -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon total">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <div class="stat-info">
          <h3>{{ statistics.totalOrganizations || 0 }}</h3>
          <p>Total Organizations</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon active">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="stat-info">
          <h3>{{ statistics.activeOrganizations || 0 }}</h3>
          <p>Active</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon trial">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="stat-info">
          <h3>{{ statistics.trialOrganizations || 0 }}</h3>
          <p>On Trial</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon paid">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="stat-info">
          <h3>{{ statistics.paidOrganizations || 0 }}</h3>
          <p>Paying Customers</p>
        </div>
      </div>
    </div>

    <!-- Search and Filters -->
    <div class="controls">
      <div class="search-box">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="Search organizations by name or industry..."
          @input="debouncedSearch"
        />
      </div>

      <div class="filters">
        <select v-model="filters.industry" @change="fetchOrganizations">
          <option value="">All Industries</option>
          <option value="Technology">Technology</option>
          <option value="Finance">Finance</option>
          <option value="Healthcare">Healthcare</option>
          <option value="Education">Education</option>
          <option value="Retail">Retail</option>
          <option value="Manufacturing">Manufacturing</option>
          <option value="Other">Other</option>
        </select>

        <select v-model="filters.tier" @change="fetchOrganizations">
          <option value="">All Tiers</option>
          <option value="trial">Trial</option>
          <option value="starter">Starter</option>
          <option value="professional">Professional</option>
          <option value="enterprise">Enterprise</option>
        </select>

        <select v-model="filters.status" @change="fetchOrganizations">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <button @click="clearFilters" class="btn-clear">Clear Filters</button>
      </div>
    </div>

    <!-- Organizations Table -->
    <div class="table-container">
      <div v-if="loading" class="loading">Loading organizations...</div>
      
      <div v-else-if="organizations.length === 0" class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <p>No organizations found</p>
      </div>

      <table v-else class="organizations-table">
        <thead>
          <tr>
            <th @click="sortBy('name')" class="sortable">
              Organization Name
              <svg v-if="sortField === 'name'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="sortOrder === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'" />
              </svg>
            </th>
            <th>Industry</th>
            <th>Subscription</th>
            <th>Status</th>
            <th>Contacts</th>
            <th @click="sortBy('createdAt')" class="sortable">
              Created
              <svg v-if="sortField === 'createdAt'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="sortOrder === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'" />
              </svg>
            </th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="org in organizations" :key="org._id" @click="viewOrganization(org._id)" class="clickable">
            <td>
              <div class="org-name">
                <div class="org-avatar">{{ getInitials(org.name) }}</div>
                <div>
                  <div class="name">{{ org.name }}</div>
                  <div class="slug">{{ org.slug }}</div>
                </div>
              </div>
            </td>
            <td>{{ org.industry || '-' }}</td>
            <td>
              <span :class="['badge', 'tier', org.subscription?.tier]">
                {{ org.subscription?.tier || 'trial' }}
              </span>
            </td>
            <td>
              <span :class="['badge', 'status', org.isActive ? 'active' : 'inactive']">
                {{ org.isActive ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td>{{ org.contactCount || 0 }}</td>
            <td>{{ formatDate(org.createdAt) }}</td>
            <td @click.stop>
              <div class="action-buttons">
                <button @click="viewOrganization(org._id)" class="btn-icon" title="View">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
                <button @click="editOrganization(org)" class="btn-icon" title="Edit">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button @click="deleteOrganization(org._id)" class="btn-icon delete" title="Delete">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="pagination.totalPages > 1" class="pagination">
      <button 
        @click="changePage(pagination.currentPage - 1)"
        :disabled="pagination.currentPage === 1"
        class="btn-page"
      >
        Previous
      </button>
      
      <div class="page-numbers">
        <button 
          v-for="page in Math.min(pagination.totalPages, 5)" 
          :key="page"
          @click="changePage(page)"
          :class="['btn-page', { active: pagination.currentPage === page }]"
        >
          {{ page }}
        </button>
      </div>
      
      <button 
        @click="changePage(pagination.currentPage + 1)"
        :disabled="pagination.currentPage === pagination.totalPages"
        class="btn-page"
      >
        Next
      </button>
    </div>

    <!-- Organization Form Modal (placeholder for now) -->
    <div v-if="showFormModal" class="modal-overlay" @click="closeFormModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>{{ editingOrganization ? 'Edit Organization' : 'New Organization' }}</h2>
          <button @click="closeFormModal" class="btn-close">×</button>
        </div>
        <div class="modal-body">
          <p>Organization form coming soon...</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';

const router = useRouter();

// State
const organizations = ref([]);
const loading = ref(false);
const searchQuery = ref('');
const showFormModal = ref(false);
const editingOrganization = ref(null);

const filters = reactive({
  industry: '',
  tier: '',
  status: ''
});

const pagination = ref({
  currentPage: 1,
  totalPages: 1,
  totalOrganizations: 0,
  limit: 20
});

const statistics = ref({
  totalOrganizations: 0,
  activeOrganizations: 0,
  trialOrganizations: 0,
  paidOrganizations: 0
});

const sortField = ref('createdAt');
const sortOrder = ref('desc');

// Methods
const fetchOrganizations = async () => {
  loading.value = true;
  console.log('🔍 Fetching organizations...');
  
  try {
    const params = new URLSearchParams();
    params.append('page', pagination.value.currentPage);
    params.append('limit', pagination.value.limit);
    params.append('sortBy', sortField.value);
    params.append('sortOrder', sortOrder.value);
    
    if (searchQuery.value) params.append('search', searchQuery.value);
    if (filters.industry) params.append('industry', filters.industry);
    if (filters.tier) params.append('tier', filters.tier);
    if (filters.status) params.append('status', filters.status);

    const data = await apiClient(`/admin/organizations/all?${params.toString()}`, {
      method: 'GET'
    });

    console.log('📦 Organizations data:', data);
    
    if (data.success) {
      organizations.value = data.data;
      pagination.value = data.pagination;
      
      // Calculate statistics
      statistics.value = {
        totalOrganizations: data.pagination.totalOrganizations,
        activeOrganizations: data.data.filter(o => o.isActive).length,
        trialOrganizations: data.data.filter(o => o.subscription?.status === 'trial').length,
        paidOrganizations: data.data.filter(o => o.subscription?.status === 'active').length
      };
      
      console.log(`✅ Loaded ${data.data.length} organizations`);
    }
  } catch (error) {
    console.error('❌ Error fetching organizations:', error);
  } finally {
    loading.value = false;
  }
};

let searchTimeout = null;
const debouncedSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    pagination.value.currentPage = 1;
    fetchOrganizations();
  }, 500);
};

const sortBy = (field) => {
  if (sortField.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortField.value = field;
    sortOrder.value = 'asc';
  }
  fetchOrganizations();
};

const changePage = (page) => {
  pagination.value.currentPage = page;
  fetchOrganizations();
};

const viewOrganization = (orgId) => {
  router.push(`/organizations/${orgId}`);
};

const openCreateModal = () => {
  editingOrganization.value = null;
  showFormModal.value = true;
};

const editOrganization = (org) => {
  editingOrganization.value = org;
  showFormModal.value = true;
};

const closeFormModal = () => {
  showFormModal.value = false;
  editingOrganization.value = null;
};

const deleteOrganization = async (orgId) => {
  if (!confirm('Are you sure you want to delete this organization? This action cannot be undone.')) return;
  
  try {
    await apiClient(`/admin/organizations/${orgId}`, {
      method: 'DELETE'
    });
    fetchOrganizations();
  } catch (error) {
    console.error('Error deleting organization:', error);
  }
};

const exportOrganizations = () => {
  const headers = ['Name', 'Industry', 'Tier', 'Status', 'Contacts', 'Created'];
  const rows = organizations.value.map(o => [
    o.name,
    o.industry || '',
    o.subscription?.tier || 'trial',
    o.isActive ? 'Active' : 'Inactive',
    o.contactCount || 0,
    formatDate(o.createdAt)
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(field => `"${field}"`).join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `organizations-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
};

const clearFilters = () => {
  searchQuery.value = '';
  filters.industry = '';
  filters.tier = '';
  filters.status = '';
  fetchOrganizations();
};

const getInitials = (name) => {
  return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
};

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// Lifecycle
onMounted(() => {
  fetchOrganizations();
});
</script>

<style scoped>
.organizations-page {
  padding: 2rem;
  max-width: 1800px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header-left h1 {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: #6b7280;
  font-size: 1rem;
}

.header-right {
  display: flex;
  gap: 1rem;
}

.btn-primary, .btn-secondary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  border: none;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.btn-secondary {
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover {
  background: #f9fafb;
}

.btn-primary svg, .btn-secondary svg {
  width: 20px;
  height: 20px;
}

/* Statistics Cards */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon svg {
  width: 28px;
  height: 28px;
  color: white;
}

.stat-icon.total {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
}

.stat-icon.active {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.stat-icon.trial {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}

.stat-icon.paid {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
}

.stat-info h3 {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 0.25rem;
}

.stat-info p {
  color: #6b7280;
  font-size: 0.875rem;
}

/* Controls */
.controls {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.search-box {
  position: relative;
  margin-bottom: 1rem;
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
  padding: 0.875rem 1rem 0.875rem 3rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
}

.filters {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.filters select {
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  flex: 1;
  min-width: 150px;
}

.btn-clear {
  padding: 0.75rem 1.5rem;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
}

.btn-clear:hover {
  background: #e5e7eb;
}

/* Table */
.table-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  margin-bottom: 1.5rem;
}

.organizations-table {
  width: 100%;
  border-collapse: collapse;
}

.organizations-table thead {
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.organizations-table th {
  padding: 1rem 1.5rem;
  text-align: left;
  font-weight: 600;
  color: #374151;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.sortable {
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sortable svg {
  width: 16px;
  height: 16px;
}

.organizations-table tbody tr {
  border-bottom: 1px solid #f3f4f6;
  transition: background 0.2s;
}

.organizations-table tbody tr.clickable:hover {
  background: #f9fafb;
  cursor: pointer;
}

.organizations-table td {
  padding: 1rem 1.5rem;
  color: #374151;
}

.org-name {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.org-avatar {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1rem;
}

.name {
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.25rem;
}

.slug {
  font-size: 0.875rem;
  color: #6b7280;
}

.badge {
  padding: 0.375rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}

.badge.tier.trial {
  background: #fef3c7;
  color: #92400e;
}

.badge.tier.starter {
  background: #dbeafe;
  color: #1e40af;
}

.badge.tier.professional {
  background: #ddd6fe;
  color: #5b21b6;
}

.badge.tier.enterprise {
  background: #d1fae5;
  color: #065f46;
}

.badge.status.active {
  background: #d1fae5;
  color: #065f46;
}

.badge.status.inactive {
  background: #fee2e2;
  color: #991b1b;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.btn-icon {
  padding: 0.5rem;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-icon svg {
  width: 18px;
  height: 18px;
  color: #6b7280;
}

.btn-icon:hover {
  background: #f3f4f6;
}

.btn-icon.delete:hover {
  background: #fee2e2;
}

.btn-icon.delete:hover svg {
  color: #dc2626;
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
}

.btn-page {
  padding: 0.5rem 1rem;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}

.btn-page:hover:not(:disabled) {
  background: #f9fafb;
}

.btn-page:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-page.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.page-numbers {
  display: flex;
  gap: 0.5rem;
}

/* Empty State */
.loading, .empty-state {
  text-align: center;
  padding: 3rem;
  color: #6b7280;
}

.empty-state svg {
  width: 64px;
  height: 64px;
  margin: 0 auto 1rem;
  color: #d1d5db;
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
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  font-size: 1.25rem;
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
}

.btn-close:hover {
  background: #f3f4f6;
}

.modal-body {
  padding: 1.5rem;
}
</style>

