<template>
  <div class="page-container">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Organizations</h1>
        <p class="page-subtitle">Manage all customer organizations</p>
      </div>
      <div class="flex gap-4">
        <button @click="exportOrganizations" class="btn-secondary flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
          Export
        </button>
        <button @click="openCreateModal" class="btn-primary flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          New Organization
        </button>
      </div>
    </div>

    <!-- Statistics Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div class="stat-card">
        <div class="stat-icon bg-gradient-to-br from-brand-500 to-brand-600">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-7 h-7 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <div>
          <p class="stat-value">{{ statistics.totalOrganizations || 0 }}</p>
          <p class="stat-label">Total Organizations</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon bg-gradient-to-br from-success-500 to-success-600">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-7 h-7 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p class="stat-value">{{ statistics.activeOrganizations || 0 }}</p>
          <p class="stat-label">Active</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon bg-gradient-to-br from-warning-500 to-warning-600">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-7 h-7 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p class="stat-value">{{ statistics.trialOrganizations || 0 }}</p>
          <p class="stat-label">On Trial</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon bg-gradient-to-br from-purple-500 to-purple-600">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-7 h-7 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p class="stat-value">{{ statistics.paidOrganizations || 0 }}</p>
          <p class="stat-label">Paying Customers</p>
        </div>
      </div>
    </div>

    <!-- Search and Filters -->
    <div class="card mb-6">
      <div class="card-body">
        <!-- Search Bar -->
        <div class="relative mb-4">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5 text-gray-400">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search organizations by name or industry..."
            @input="debouncedSearch"
            class="input pl-10"
          />
        </div>

        <!-- Filters -->
        <div class="flex flex-wrap gap-3">
          <select v-model="filters.industry" @change="fetchOrganizations" class="input flex-1 min-w-[150px]">
            <option value="">All Industries</option>
            <option value="Technology">Technology</option>
            <option value="Finance">Finance</option>
            <option value="Healthcare">Healthcare</option>
            <option value="Education">Education</option>
            <option value="Retail">Retail</option>
            <option value="Manufacturing">Manufacturing</option>
            <option value="Other">Other</option>
          </select>

          <select v-model="filters.tier" @change="fetchOrganizations" class="input flex-1 min-w-[150px]">
            <option value="">All Tiers</option>
            <option value="trial">Trial</option>
            <option value="starter">Starter</option>
            <option value="professional">Professional</option>
            <option value="enterprise">Enterprise</option>
          </select>

          <select v-model="filters.status" @change="fetchOrganizations" class="input flex-1 min-w-[150px]">
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <button @click="clearFilters" class="btn-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4 mr-1">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear
          </button>
        </div>
      </div>
    </div>

    <!-- Organizations Table -->
    <div class="table-container">
      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
        <p class="text-gray-600 dark:text-gray-400 mt-4">Loading organizations...</p>
      </div>
      
      <!-- Empty State -->
      <div v-else-if="organizations.length === 0" class="text-center py-16">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-600">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <p class="text-lg font-medium text-gray-900 dark:text-white mb-2">No organizations found</p>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">Get started by creating your first organization</p>
        <button @click="openCreateModal" class="btn-primary">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5 mr-2">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Create Organization
        </button>
      </div>

      <!-- Table -->
      <table v-else class="table">
        <thead>
          <tr>
            <th @click="sortBy('name')" class="cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <div class="flex items-center gap-2">
                <span>Organization</span>
                <svg v-if="sortField === 'name'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="sortOrder === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'" />
                </svg>
              </div>
            </th>
            <th>Industry</th>
            <th>Subscription</th>
            <th>Status</th>
            <th>Contacts</th>
            <th @click="sortBy('createdAt')" class="cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <div class="flex items-center gap-2">
                <span>Created</span>
                <svg v-if="sortField === 'createdAt'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="sortOrder === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'" />
                </svg>
              </div>
            </th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="org in organizations" :key="org._id" @click="viewOrganization(org._id)" class="cursor-pointer">
            <td>
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
                  {{ getInitials(org.name) }}
                </div>
                <div>
                  <div class="font-semibold text-gray-900 dark:text-white">{{ org.name }}</div>
                  <div class="text-sm text-gray-500 dark:text-gray-400">{{ org.slug }}</div>
                </div>
              </div>
            </td>
            <td>
              <span class="text-gray-700 dark:text-gray-300">{{ org.industry || '-' }}</span>
            </td>
            <td>
              <span :class="[
                'badge',
                org.subscription?.tier === 'trial' ? 'badge-warning' :
                org.subscription?.tier === 'starter' ? 'badge-info' :
                org.subscription?.tier === 'professional' ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400' :
                org.subscription?.tier === 'enterprise' ? 'badge-success' :
                'badge-warning'
              ]">
                {{ org.subscription?.tier || 'trial' }}
              </span>
            </td>
            <td>
              <span :class="[
                'badge',
                org.isActive ? 'badge-success' : 'badge-danger'
              ]">
                {{ org.isActive ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td>
              <span class="text-gray-700 dark:text-gray-300 font-medium">{{ org.contactCount || 0 }}</span>
            </td>
            <td>
              <span class="text-sm text-gray-600 dark:text-gray-400">{{ formatDate(org.createdAt) }}</span>
            </td>
            <td @click.stop>
              <div class="flex items-center gap-2">
                <button @click="viewOrganization(org._id)" class="p-2 text-gray-600 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all" title="View">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
                <button @click="editOrganization(org)" class="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all" title="Edit">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button @click="deleteOrganization(org._id)" class="p-2 text-gray-600 dark:text-gray-400 hover:text-danger-600 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg transition-all" title="Delete">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
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
    <div v-if="pagination.totalPages > 1" class="flex items-center justify-center gap-2 mt-6">
      <button 
        @click="changePage(pagination.currentPage - 1)"
        :disabled="pagination.currentPage === 1"
        class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      
      <div class="flex gap-2">
        <button 
          v-for="page in Math.min(pagination.totalPages, 5)" 
          :key="page"
          @click="changePage(page)"
          :class="[
            'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
            pagination.currentPage === page
              ? 'bg-brand-600 text-white'
              : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
          ]"
        >
          {{ page }}
        </button>
      </div>
      
      <button 
        @click="changePage(pagination.currentPage + 1)"
        :disabled="pagination.currentPage === pagination.totalPages"
        class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>

    <!-- Organization Form Modal -->
    <div v-if="showFormModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" @click="closeFormModal">
      <div class="card max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slide-up" @click.stop>
        <div class="card-header flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ editingOrganization ? 'Edit Organization' : 'New Organization' }}
          </h2>
          <button @click="closeFormModal" class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="card-body">
          <div class="text-center py-12">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-16 h-16 mx-auto mb-4 text-brand-500">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <p class="text-lg font-medium text-gray-900 dark:text-white mb-2">Organization Form</p>
            <p class="text-sm text-gray-600 dark:text-gray-400">Form functionality coming soon...</p>
          </div>
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


