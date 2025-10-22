<template>
  <div class="contacts-page">
    <!-- Header -->
    <div class="page-header">
      <div class="header-left">
        <h1>Contacts</h1>
        <p class="subtitle">Manage your customer relationships</p>
      </div>
      <div class="header-right">
        <button @click="showImportModal = true" class="btn-secondary">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Import
        </button>
        <button @click="exportContacts" class="btn-secondary">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
          Export
        </button>
        <button @click="openCreateModal" class="btn-primary">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          New Contact
        </button>
      </div>
    </div>

    <!-- Statistics Cards -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon total">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <div class="stat-info">
          <h3>{{ statistics.totalContacts || 0 }}</h3>
          <p>Total Contacts</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon leads">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <div class="stat-info">
          <h3>{{ statistics.leadContacts || 0 }}</h3>
          <p>Leads</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon customers">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="stat-info">
          <h3>{{ statistics.customerContacts || 0 }}</h3>
          <p>Customers</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon active">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="stat-info">
          <h3>{{ statistics.activeThisMonth || 0 }}</h3>
          <p>Active This Month</p>
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
          placeholder="Search contacts by name, email, company..."
          @input="debouncedSearch"
        />
      </div>

      <div class="filters">
        <select v-model="filters.lifecycle_stage" @change="fetchContacts">
          <option value="">All Stages</option>
          <option value="Lead">Lead</option>
          <option value="Qualified">Qualified</option>
          <option value="Opportunity">Opportunity</option>
          <option value="Customer">Customer</option>
          <option value="Lost">Lost</option>
        </select>

        <select v-model="filters.status" @change="fetchContacts">
          <option value="">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Archived">Archived</option>
        </select>

        <select v-model="filters.owner_id" @change="fetchContacts">
          <option value="">All Owners</option>
          <option value="me">My Contacts</option>
          <!-- TODO: Load team members dynamically -->
        </select>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>Loading contacts...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="contacts.length === 0 && !searchQuery" class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      <h3>No contacts yet</h3>
      <p>Start building your network by adding your first contact</p>
      <button @click="openCreateModal" class="btn-primary">Add Your First Contact</button>
    </div>

    <!-- No Search Results -->
    <div v-else-if="contacts.length === 0 && searchQuery" class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <h3>No contacts found</h3>
      <p>Try adjusting your search or filters</p>
      <button @click="clearFilters" class="btn-secondary">Clear Filters</button>
    </div>

    <!-- Contacts Table -->
    <div v-else class="table-container">
      <table class="contacts-table">
        <thead>
          <tr>
            <th>
              <input type="checkbox" @change="toggleSelectAll" :checked="allSelected" />
            </th>
            <th @click="sortBy('first_name')" class="sortable">
              Name
              <svg v-if="sortField === 'first_name'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="sortOrder === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'" />
              </svg>
            </th>
            <th v-if="isAdmin">Organization</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Company</th>
            <th>Stage</th>
            <th>Owner</th>
            <th>Last Contact</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="contact in contacts" :key="contact._id" @click="viewContact(contact._id)" class="clickable">
            <td @click.stop>
              <input type="checkbox" v-model="selectedContacts" :value="contact._id" />
            </td>
            <td>
              <div class="contact-name">
                <div class="avatar">{{ getInitials(contact) }}</div>
                <div>
                  <div class="name">{{ contact.first_name }} {{ contact.last_name }}</div>
                  <div class="job-title">{{ contact.job_title || 'No title' }}</div>
                </div>
              </div>
            </td>
            <td v-if="isAdmin">
              <div class="org-info">
                <strong>{{ contact.organizationId?.name || 'N/A' }}</strong>
                <span class="org-industry">{{ contact.organizationId?.industry || '-' }}</span>
              </div>
            </td>
            <td>{{ contact.email }}</td>
            <td>{{ contact.phone || contact.mobile || '-' }}</td>
            <td>{{ contact.account_id?.name || '-' }}</td>
            <td>
              <span :class="['badge', 'stage', contact.lifecycle_stage?.toLowerCase()]">
                {{ contact.lifecycle_stage || 'Lead' }}
              </span>
            </td>
            <td>{{ contact.owner_id?.firstName || 'Unassigned' }}</td>
            <td>{{ formatDate(contact.last_contacted_at) }}</td>
            <td @click.stop>
              <div class="action-buttons">
                <button @click="viewContact(contact._id)" class="btn-icon" title="View">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
                <button @click="editContact(contact)" class="btn-icon" title="Edit">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button @click="deleteContact(contact._id)" class="btn-icon delete" title="Delete">
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

    <!-- Bulk Actions -->
    <div v-if="selectedContacts.length > 0" class="bulk-actions">
      <span>{{ selectedContacts.length }} contact(s) selected</span>
      <button @click="bulkDelete" class="btn-danger">Delete Selected</button>
      <button @click="bulkExport" class="btn-secondary">Export Selected</button>
      <button @click="selectedContacts = []" class="btn-text">Clear Selection</button>
    </div>

    <!-- Pagination -->
    <div v-if="!loading && contacts.length > 0" class="pagination">
      <button 
        @click="changePage(pagination.currentPage - 1)" 
        :disabled="pagination.currentPage === 1"
        class="btn-pagination"
      >
        Previous
      </button>
      <span class="page-info">
        Page {{ pagination.currentPage }} of {{ pagination.totalPages }} ({{ pagination.totalContacts }} contacts)
      </span>
      <button 
        @click="changePage(pagination.currentPage + 1)" 
        :disabled="pagination.currentPage === pagination.totalPages"
        class="btn-pagination"
      >
        Next
      </button>
    </div>

    <!-- Create/Edit Modal -->
    <ContactFormModal 
      v-if="showFormModal"
      :contact="editingContact"
      @close="closeFormModal"
      @saved="handleContactSaved"
    />

    <!-- Import Modal -->
    <div v-if="showImportModal" class="modal-overlay" @click="showImportModal = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>Import Contacts</h2>
          <button @click="showImportModal = false" class="btn-close">×</button>
        </div>
        <div class="modal-body">
          <p>Upload a CSV file with your contacts. The first row should contain headers.</p>
          <p class="text-sm">Required fields: first_name, last_name, email</p>
          <input type="file" accept=".csv" @change="handleFileUpload" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import apiClient from '@/utils/apiClient';
import ContactFormModal from '@/components/contacts/ContactFormModal.vue';

const router = useRouter();
const authStore = useAuthStore();

// State
const contacts = ref([]);
const loading = ref(false);
const searchQuery = ref('');
const selectedContacts = ref([]);
const showFormModal = ref(false);
const showImportModal = ref(false);
const editingContact = ref(null);

const filters = reactive({
  lifecycle_stage: '',
  status: '',
  owner_id: ''
});

const pagination = ref({
  currentPage: 1,
  totalPages: 1,
  totalContacts: 0,
  limit: 20
});

const statistics = ref({
  totalContacts: 0,
  leadContacts: 0,
  customerContacts: 0,
  activeThisMonth: 0
});

const sortField = ref('createdAt');
const sortOrder = ref('desc');

// Computed
const allSelected = computed(() => {
  return contacts.value.length > 0 && selectedContacts.value.length === contacts.value.length;
});

// Computed
const isAdmin = computed(() => authStore.isOwner || authStore.userRole === 'admin');

// Methods
const fetchContacts = async () => {
  loading.value = true;
  console.log('🔍 Fetching contacts...');
  console.log('👤 Is Admin:', isAdmin.value);
  
  try {
    const params = new URLSearchParams();
    params.append('page', pagination.value.currentPage);
    params.append('limit', pagination.value.limit);
    params.append('sortBy', sortField.value);
    params.append('sortOrder', sortOrder.value);
    
    if (searchQuery.value) params.append('search', searchQuery.value);
    if (filters.lifecycle_stage) params.append('lifecycle_stage', filters.lifecycle_stage);
    if (filters.status) params.append('status', filters.status);
    if (filters.owner_id === 'me') params.append('owner', 'me');

    // Admins/Owners see ALL contacts across organizations
    const endpoint = isAdmin.value
      ? `/admin/contacts/all?${params.toString()}`
      : `/contacts?${params.toString()}`;

    console.log('🌐 API Endpoint:', endpoint);

    const data = await apiClient(endpoint, {
      method: 'GET'
    });

    console.log('📦 Contacts data:', data);
    
    if (data.success) {
      contacts.value = data.data;
      pagination.value = data.pagination;
      statistics.value = data.statistics || statistics.value;
      console.log(`✅ Loaded ${data.data.length} contacts`);
    }
  } catch (error) {
    console.error('❌ Error fetching contacts:', error);
  } finally {
    loading.value = false;
  }
};

let searchTimeout;
const debouncedSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    pagination.value.currentPage = 1;
    fetchContacts();
  }, 500);
};

const sortBy = (field) => {
  if (sortField.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortField.value = field;
    sortOrder.value = 'asc';
  }
  fetchContacts();
};

const changePage = (page) => {
  pagination.value.currentPage = page;
  fetchContacts();
};

const viewContact = (contactId) => {
  router.push(`/contacts/${contactId}`);
};

const openCreateModal = () => {
  editingContact.value = null;
  showFormModal.value = true;
};

const editContact = (contact) => {
  editingContact.value = contact;
  showFormModal.value = true;
};

const closeFormModal = () => {
  showFormModal.value = false;
  editingContact.value = null;
};

const handleContactSaved = () => {
  closeFormModal();
  fetchContacts();
};

const deleteContact = async (contactId) => {
  if (!confirm('Are you sure you want to delete this contact?')) return;
  
  try {
    await apiClient(`/contacts/${contactId}`, {
      method: 'DELETE'
    });
    fetchContacts();
  } catch (error) {
    console.error('Error deleting contact:', error);
    alert('Failed to delete contact');
  }
};

const toggleSelectAll = () => {
  if (allSelected.value) {
    selectedContacts.value = [];
  } else {
    selectedContacts.value = contacts.value.map(c => c._id);
  }
};

const bulkDelete = async () => {
  if (!confirm(`Are you sure you want to delete ${selectedContacts.value.length} contact(s)?`)) return;
  
  try {
    await apiClient('/contacts/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids: selectedContacts.value })
    });
    selectedContacts.value = [];
    fetchContacts();
  } catch (error) {
    console.error('Error bulk deleting contacts:', error);
    alert('Failed to delete contacts');
  }
};

const bulkExport = () => {
  const selectedData = contacts.value.filter(c => selectedContacts.value.includes(c._id));
  exportToCSV(selectedData);
};

const exportContacts = async () => {
  try {
    // Fetch all contacts (or current filtered set)
    const data = await apiClient('/contacts?limit=10000', {
      method: 'GET'
    });
    exportToCSV(data.data);
  } catch (error) {
    console.error('Error exporting contacts:', error);
  }
};

const exportToCSV = (data) => {
  const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Company', 'Job Title', 'Stage', 'Status'];
  const rows = data.map(c => [
    c.first_name,
    c.last_name,
    c.email,
    c.phone || c.mobile || '',
    c.account_id?.name || '',
    c.job_title || '',
    c.lifecycle_stage,
    c.status
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(field => `"${field}"`).join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `contacts_${new Date().toISOString()}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
};

const handleFileUpload = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    const csv = e.target.result;
    // TODO: Parse CSV and import contacts
    console.log('CSV content:', csv);
    alert('Import functionality coming soon!');
    showImportModal.value = false;
  };
  reader.readAsText(file);
};

const clearFilters = () => {
  searchQuery.value = '';
  filters.lifecycle_stage = '';
  filters.status = '';
  filters.owner_id = '';
  fetchContacts();
};

const getInitials = (contact) => {
  return `${contact.first_name?.[0] || ''}${contact.last_name?.[0] || ''}`.toUpperCase();
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
  fetchContacts();
});
</script>

<style scoped>
.contacts-page {
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
  font-size: 0.95rem;
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
  border: none;
  font-size: 0.95rem;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
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

/* Stats Grid */
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
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon svg {
  width: 24px;
  height: 24px;
  color: white;
}

.stat-icon.total { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
.stat-icon.leads { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
.stat-icon.customers { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
.stat-icon.active { background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); }

.stat-info h3 {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 0.25rem;
}

.stat-info p {
  color: #6b7280;
  font-size: 0.9rem;
}

/* Controls */
.controls {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}

.search-box {
  flex: 1;
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
  font-size: 0.95rem;
}

.filters {
  display: flex;
  gap: 0.75rem;
}

.filters select {
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.95rem;
  background: white;
  cursor: pointer;
}

/* Table */
.table-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  margin-bottom: 1.5rem;
}

.contacts-table {
  width: 100%;
  border-collapse: collapse;
}

.contacts-table thead {
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.contacts-table th {
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: #374151;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.contacts-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.contacts-table th.sortable:hover {
  background: #f3f4f6;
}

.contacts-table th svg {
  width: 16px;
  height: 16px;
  display: inline-block;
  vertical-align: middle;
  margin-left: 0.25rem;
}

.contacts-table tbody tr {
  border-bottom: 1px solid #f3f4f6;
  transition: background 0.2s;
}

.contacts-table tbody tr.clickable {
  cursor: pointer;
}

.contacts-table tbody tr:hover {
  background: #f9fafb;
}

.contacts-table td {
  padding: 1rem;
  color: #374151;
  font-size: 0.9rem;
}

.contact-name {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #3b82f6;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.85rem;
}

.contact-name .name {
  font-weight: 600;
  color: #1f2937;
}

.contact-name .job-title {
  font-size: 0.8rem;
  color: #6b7280;
}

.badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
}

.badge.stage.lead { background: #fef3c7; color: #92400e; }
.badge.stage.qualified { background: #dbeafe; color: #1e40af; }
.badge.stage.opportunity { background: #e0e7ff; color: #3730a3; }
.badge.stage.customer { background: #d1fae5; color: #065f46; }
.badge.stage.lost { background: #fee2e2; color: #991b1b; }

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.btn-icon {
  padding: 0.5rem;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 6px;
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

/* Bulk Actions */
.bulk-actions {
  background: white;
  padding: 1rem 1.5rem;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin-bottom: 1.5rem;
}

.bulk-actions span {
  font-weight: 600;
  color: #374151;
}

.btn-danger {
  padding: 0.5rem 1rem;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}

.btn-danger:hover {
  background: #b91c1c;
}

.btn-text {
  padding: 0.5rem 1rem;
  background: transparent;
  color: #6b7280;
  border: none;
  cursor: pointer;
  font-weight: 500;
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 2rem;
}

.btn-pagination {
  padding: 0.5rem 1rem;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
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
  font-size: 0.9rem;
}

/* Loading & Empty States */
.loading {
  text-align: center;
  padding: 4rem 2rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  background: white;
  border-radius: 12px;
}

.empty-state svg {
  width: 64px;
  height: 64px;
  color: #d1d5db;
  margin: 0 auto 1rem;
}

.empty-state h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.empty-state p {
  color: #6b7280;
  margin-bottom: 1.5rem;
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
  width: 90%;
  max-width: 500px;
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

.text-sm {
  font-size: 0.875rem;
  color: #6b7280;
  margin-top: 0.5rem;
}

/* Organization Info (for admin view) */
.org-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.org-info strong {
  font-weight: 600;
  color: #1f2937;
}

.org-industry {
  font-size: 0.8rem;
  color: #6b7280;
}
</style>

