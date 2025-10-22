<template>
  <div class="deals-page">
    <!-- Header -->
    <div class="page-header">
      <div class="header-left">
        <h1>Deals Pipeline</h1>
        <p class="subtitle">Track and manage your sales opportunities</p>
      </div>
      <div class="header-right">
        <button @click="viewMode = 'table'" :class="['view-toggle', {active: viewMode === 'table'}]">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Table
        </button>
        <button @click="viewMode = 'kanban'" :class="['view-toggle', {active: viewMode === 'kanban'}]">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          Pipeline
        </button>
        <button @click="openCreateModal" class="btn-primary">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          New Deal
        </button>
      </div>
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
          <h3>{{ formatCurrency(statistics.pipelineValue || 0) }}</h3>
          <p>Pipeline Value</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon active">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <div class="stat-info">
          <h3>{{ statistics.activeDeals || 0 }}</h3>
          <p>Active Deals</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon won">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="stat-info">
          <h3>{{ formatCurrency(statistics.wonValue || 0) }}</h3>
          <p>Won This Month</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon rate">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
        </div>
        <div class="stat-info">
          <h3>{{ winRate }}%</h3>
          <p>Win Rate</p>
        </div>
      </div>
    </div>

    <!-- Kanban View -->
    <div v-if="viewMode === 'kanban'" class="kanban-view">
      <div class="kanban-board">
        <div v-for="stage in stages" :key="stage" class="kanban-column">
          <div class="column-header">
            <h3>{{ stage }}</h3>
            <span class="deal-count">{{ getDealsInStage(stage).length }}</span>
            <span class="stage-value">{{ formatCurrency(getStageValue(stage)) }}</span>
          </div>
          
          <div class="column-content" @drop="onDrop($event, stage)" @dragover.prevent>
            <div
              v-for="deal in getDealsInStage(stage)"
              :key="deal._id"
              class="deal-card"
              draggable="true"
              @dragstart="onDragStart($event, deal)"
              @click="viewDeal(deal._id)"
            >
              <div class="deal-header">
                <h4>{{ deal.name }}</h4>
                <span :class="['priority-badge', deal.priority?.toLowerCase()]">
                  {{ deal.priority || 'Medium' }}
                </span>
              </div>
              
              <div class="deal-amount">{{ formatCurrency(deal.amount) }}</div>
              
              <div class="deal-meta">
                <div class="deal-contact" v-if="deal.contactId">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {{ deal.contactId.first_name }} {{ deal.contactId.last_name }}
                </div>
                <div class="deal-date">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {{ formatDate(deal.expectedCloseDate) }}
                </div>
              </div>
              
              <div class="deal-footer">
                <div class="deal-owner">
                  <div class="owner-avatar">{{ getInitials(deal.ownerId) }}</div>
                  <span>{{ deal.ownerId?.firstName }}</span>
                </div>
                <div class="deal-probability">{{ deal.probability }}%</div>
              </div>
            </div>
            
            <div v-if="getDealsInStage(stage).length === 0" class="empty-column">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p>No deals</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Table View -->
    <div v-else class="table-view">
      <!-- Search and Filters -->
      <div class="controls">
        <div class="search-box">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search deals..."
            @input="debouncedSearch"
          />
        </div>

        <div class="filters">
          <select v-model="filters.stage" @change="fetchDeals">
            <option value="">All Stages</option>
            <option v-for="stage in stages" :key="stage" :value="stage">{{ stage }}</option>
          </select>

          <select v-model="filters.status" @change="fetchDeals">
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Won">Won</option>
            <option value="Lost">Lost</option>
          </select>

          <select v-model="filters.priority" @change="fetchDeals">
            <option value="">All Priority</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
          </select>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        <p>Loading deals...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="deals.length === 0 && !searchQuery" class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <h3>No deals yet</h3>
        <p>Start tracking your sales opportunities</p>
        <button @click="openCreateModal" class="btn-primary">Create Your First Deal</button>
      </div>

      <!-- Deals Table -->
      <div v-else-if="deals.length > 0" class="table-container">
        <table class="deals-table">
          <thead>
            <tr>
              <th @click="sortBy('name')" class="sortable">
                Deal Name
                <svg v-if="sortField === 'name'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="sortOrder === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'" />
                </svg>
              </th>
              <th>Amount</th>
              <th>Stage</th>
              <th>Contact</th>
              <th>Owner</th>
              <th>Close Date</th>
              <th>Probability</th>
              <th>Priority</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="deal in deals" :key="deal._id" @click="viewDeal(deal._id)" class="clickable">
              <td>
                <div class="deal-name-cell">
                  <strong>{{ deal.name }}</strong>
                  <span class="deal-type" v-if="deal.type">{{ deal.type }}</span>
                </div>
              </td>
              <td><strong>{{ formatCurrency(deal.amount) }}</strong></td>
              <td>
                <span :class="['stage-badge', getStageClass(deal.stage)]">
                  {{ deal.stage }}
                </span>
              </td>
              <td>
                <span v-if="deal.contactId">
                  {{ deal.contactId.first_name }} {{ deal.contactId.last_name }}
                </span>
                <span v-else class="text-muted">-</span>
              </td>
              <td>
                <div class="owner-cell">
                  <div class="owner-avatar-small">{{ getInitials(deal.ownerId) }}</div>
                  {{ deal.ownerId?.firstName }}
                </div>
              </td>
              <td :class="{'overdue': isOverdue(deal.expectedCloseDate)}">
                {{ formatDate(deal.expectedCloseDate) }}
              </td>
              <td>
                <div class="probability-bar">
                  <div class="bar-fill" :style="{width: deal.probability + '%'}"></div>
                  <span>{{ deal.probability }}%</span>
                </div>
              </td>
              <td>
                <span :class="['priority-badge', deal.priority?.toLowerCase()]">
                  {{ deal.priority || 'Medium' }}
                </span>
              </td>
              <td @click.stop>
                <div class="action-buttons">
                  <button @click="viewDeal(deal._id)" class="btn-icon" title="View">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  <button @click="editDeal(deal)" class="btn-icon" title="Edit">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button @click="deleteDeal(deal._id)" class="btn-icon delete" title="Delete">
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
      <div v-if="!loading && deals.length > 0" class="pagination">
        <button 
          @click="changePage(pagination.currentPage - 1)" 
          :disabled="pagination.currentPage === 1"
          class="btn-pagination"
        >
          Previous
        </button>
        <span class="page-info">
          Page {{ pagination.currentPage }} of {{ pagination.totalPages }} ({{ pagination.totalDeals }} deals)
        </span>
        <button 
          @click="changePage(pagination.currentPage + 1)" 
          :disabled="pagination.currentPage === pagination.totalPages"
          class="btn-pagination"
        >
          Next
        </button>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <DealFormModal 
      v-if="showFormModal"
      :deal="editingDeal"
      @close="closeFormModal"
      @saved="handleDealSaved"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';
import DealFormModal from '@/components/deals/DealFormModal.vue';

const router = useRouter();

// State
const deals = ref([]);
const loading = ref(false);
const viewMode = ref('kanban'); // 'kanban' or 'table'
const searchQuery = ref('');
const showFormModal = ref(false);
const editingDeal = ref(null);

const stages = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

const filters = reactive({
  stage: '',
  status: '',
  priority: ''
});

const pagination = ref({
  currentPage: 1,
  totalPages: 1,
  totalDeals: 0,
  limit: 20
});

const statistics = ref({
  totalDeals: 0,
  activeDeals: 0,
  wonDeals: 0,
  lostDeals: 0,
  totalValue: 0,
  wonValue: 0,
  pipelineValue: 0
});

const sortField = ref('createdAt');
const sortOrder = ref('desc');

// Computed
const winRate = computed(() => {
  const total = statistics.value.wonDeals + statistics.value.lostDeals;
  if (total === 0) return 0;
  return Math.round((statistics.value.wonDeals / total) * 100);
});

// Methods
const fetchDeals = async () => {
  loading.value = true;
  
  try {
    const params = new URLSearchParams();
    params.append('page', pagination.value.currentPage);
    params.append('limit', pagination.value.limit);
    params.append('sortBy', sortField.value);
    params.append('sortOrder', sortOrder.value);
    
    if (searchQuery.value) params.append('search', searchQuery.value);
    if (filters.stage) params.append('stage', filters.stage);
    if (filters.status) params.append('status', filters.status);
    if (filters.priority) params.append('priority', filters.priority);

    const data = await apiClient(`/deals?${params.toString()}`, {
      method: 'GET'
    });
    
    if (data.success) {
      deals.value = data.data;
      pagination.value = data.pagination;
      statistics.value = data.statistics || statistics.value;
    }
  } catch (error) {
    console.error('Error fetching deals:', error);
  } finally {
    loading.value = false;
  }
};

let searchTimeout;
const debouncedSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    pagination.value.currentPage = 1;
    fetchDeals();
  }, 500);
};

const sortBy = (field) => {
  if (sortField.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortField.value = field;
    sortOrder.value = 'asc';
  }
  fetchDeals();
};

const changePage = (page) => {
  pagination.value.currentPage = page;
  fetchDeals();
};

const getDealsInStage = (stage) => {
  return deals.value.filter(deal => deal.stage === stage);
};

const getStageValue = (stage) => {
  return getDealsInStage(stage).reduce((sum, deal) => sum + deal.amount, 0);
};

const viewDeal = (dealId) => {
  router.push(`/deals/${dealId}`);
};

const openCreateModal = () => {
  editingDeal.value = null;
  showFormModal.value = true;
};

const editDeal = (deal) => {
  editingDeal.value = deal;
  showFormModal.value = true;
};

const closeFormModal = () => {
  showFormModal.value = false;
  editingDeal.value = null;
};

const handleDealSaved = () => {
  closeFormModal();
  fetchDeals();
};

const deleteDeal = async (dealId) => {
  if (!confirm('Are you sure you want to delete this deal?')) return;
  
  try {
    await apiClient(`/deals/${dealId}`, {
      method: 'DELETE'
    });
    fetchDeals();
  } catch (error) {
    console.error('Error deleting deal:', error);
    alert('Failed to delete deal');
  }
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const isOverdue = (date) => {
  return new Date(date) < new Date();
};

const getInitials = (user) => {
  if (!user) return '?';
  return `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();
};

const getStageClass = (stage) => {
  const classes = {
    'Lead': 'lead',
    'Qualified': 'qualified',
    'Proposal': 'proposal',
    'Negotiation': 'negotiation',
    'Closed Won': 'won',
    'Closed Lost': 'lost'
  };
  return classes[stage] || '';
};

// Drag and Drop
const onDragStart = (event, deal) => {
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('dealId', deal._id);
};

const onDrop = async (event, newStage) => {
  const dealId = event.dataTransfer.getData('dealId');
  const deal = deals.value.find(d => d._id === dealId);
  
  if (deal && deal.stage !== newStage) {
    try {
      await apiClient(`/deals/${dealId}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ stage: newStage })
      });
      
      // Update local state
      deal.stage = newStage;
      
      // Refresh to get updated data
      fetchDeals();
    } catch (error) {
      console.error('Error updating stage:', error);
      alert('Failed to update deal stage');
    }
  }
};

// Lifecycle
onMounted(() => {
  fetchDeals();
});
</script>

<style scoped>
.deals-page {
  padding: 2rem;
  max-width: 1800px;
  margin: 0 auto;
  background: #f9fafb;
  min-height: 100vh;
}

/* Header */
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
  gap: 0.75rem;
  align-items: center;
}

.view-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  color: #6b7280;
}

.view-toggle.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.view-toggle svg {
  width: 18px;
  height: 18px;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-primary svg {
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
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  gap: 1rem;
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon svg {
  width: 28px;
  height: 28px;
  color: white;
}

.stat-icon.total { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
.stat-icon.active { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
.stat-icon.won { background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); }
.stat-icon.rate { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }

.stat-info {
  flex: 1;
}

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

/* Kanban View */
.kanban-board {
  display: flex;
  gap: 1.5rem;
  overflow-x: auto;
  padding-bottom: 1rem;
}

.kanban-column {
  flex: 0 0 300px;
  background: #f3f4f6;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 400px);
}

.column-header {
  padding: 1.25rem;
  background: white;
  border-radius: 12px 12px 0 0;
  border-bottom: 2px solid #e5e7eb;
}

.column-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.deal-count {
  display: inline-block;
  background: #e0e7ff;
  color: #3730a3;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-left: 0.5rem;
}

.stage-value {
  display: block;
  font-size: 0.875rem;
  color: #6b7280;
  margin-top: 0.5rem;
  font-weight: 600;
}

.column-content {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.deal-card {
  background: white;
  border-radius: 10px;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  cursor: grab;
  transition: all 0.2s;
}

.deal-card:hover {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.deal-card:active {
  cursor: grabbing;
}

.deal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.deal-header h4 {
  font-size: 0.95rem;
  font-weight: 600;
  color: #1f2937;
  flex: 1;
}

.priority-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 600;
  flex-shrink: 0;
}

.priority-badge.low { background: #dbeafe; color: #1e40af; }
.priority-badge.medium { background: #fef3c7; color: #92400e; }
.priority-badge.high { background: #fed7aa; color: #9a3412; }
.priority-badge.urgent { background: #fee2e2; color: #991b1b; }

.deal-amount {
  font-size: 1.25rem;
  font-weight: 700;
  color: #059669;
  margin-bottom: 0.75rem;
}

.deal-meta {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #f3f4f6;
}

.deal-contact, .deal-date {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #6b7280;
}

.deal-contact svg, .deal-date svg {
  width: 14px;
  height: 14px;
}

.deal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.deal-owner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #6b7280;
}

.owner-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #3b82f6;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 600;
}

.deal-probability {
  font-size: 0.8rem;
  font-weight: 600;
  color: #3b82f6;
}

.empty-column {
  text-align: center;
  padding: 2rem 1rem;
  color: #9ca3af;
}

.empty-column svg {
  width: 40px;
  height: 40px;
  margin: 0 auto 0.5rem;
  color: #d1d5db;
}

/* Table View */
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

.table-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  margin-bottom: 1.5rem;
}

.deals-table {
  width: 100%;
  border-collapse: collapse;
}

.deals-table thead {
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.deals-table th {
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: #374151;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.deals-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.deals-table th.sortable:hover {
  background: #f3f4f6;
}

.deals-table th svg {
  width: 16px;
  height: 16px;
  display: inline-block;
  vertical-align: middle;
  margin-left: 0.25rem;
}

.deals-table tbody tr {
  border-bottom: 1px solid #f3f4f6;
  transition: background 0.2s;
}

.deals-table tbody tr.clickable {
  cursor: pointer;
}

.deals-table tbody tr:hover {
  background: #f9fafb;
}

.deals-table td {
  padding: 1rem;
  color: #374151;
  font-size: 0.9rem;
}

.deal-name-cell strong {
  display: block;
  color: #1f2937;
  margin-bottom: 0.25rem;
}

.deal-type {
  font-size: 0.8rem;
  color: #6b7280;
}

.stage-badge {
  padding: 0.35rem 0.85rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
}

.stage-badge.lead { background: #fef3c7; color: #92400e; }
.stage-badge.qualified { background: #dbeafe; color: #1e40af; }
.stage-badge.proposal { background: #e0e7ff; color: #3730a3; }
.stage-badge.negotiation { background: #fce7f3; color: #831843; }
.stage-badge.won { background: #d1fae5; color: #065f46; }
.stage-badge.lost { background: #fee2e2; color: #991b1b; }

.owner-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.owner-avatar-small {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #3b82f6;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
}

.probability-bar {
  position: relative;
  width: 100px;
  height: 24px;
  background: #f3f4f6;
  border-radius: 12px;
  overflow: hidden;
}

.bar-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
  transition: width 0.3s;
}

.probability-bar span {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.75rem;
  font-weight: 600;
  color: #1f2937;
  z-index: 1;
}

.overdue {
  color: #dc2626 !important;
  font-weight: 600;
}

.text-muted {
  color: #9ca3af;
}

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

/* Loading & Empty States */
.loading, .empty-state {
  text-align: center;
  padding: 4rem 2rem;
  background: white;
  border-radius: 12px;
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

@media (max-width: 1024px) {
  .kanban-board {
    flex-direction: column;
  }
  
  .kanban-column {
    flex: 1 1 auto;
    max-height: none;
  }
}
</style>

