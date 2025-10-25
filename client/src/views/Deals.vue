<template>
  <div class="p-8 max-w-[1800px] mx-auto bg-gray-50 dark:bg-gray-900 min-h-screen">
    <!-- Header -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Deals Pipeline</h1>
        <p class="text-gray-600 dark:text-gray-400">Track and manage your sales opportunities</p>
      </div>
      <div class="flex gap-3 items-center">
        <!-- View Toggle Buttons -->
        <button 
          @click="viewMode = 'table'" 
          :class="[
            'flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all',
            viewMode === 'table' 
              ? 'bg-brand-600 text-white border-2 border-brand-600' 
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-2 border-gray-300 dark:border-gray-600 hover:border-brand-500'
          ]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Table
        </button>
        <button 
          @click="viewMode = 'kanban'" 
          :class="[
            'flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all',
            viewMode === 'kanban' 
              ? 'bg-brand-600 text-white border-2 border-brand-600' 
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-2 border-gray-300 dark:border-gray-600 hover:border-brand-500'
          ]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          Pipeline
        </button>
        
        <!-- Divider -->
        <div class="w-px h-10 bg-gray-300 dark:bg-gray-600"></div>
        
        <!-- Module Actions -->
        <ModuleActions 
          module="deals"
          create-label="New Deal"
          @create="openCreateModal"
          @import="showImportModal = true"
          @export="exportDeals"
        />
      </div>
    </div>

    <!-- Statistics Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow flex gap-4">
        <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-7 h-7 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <div class="flex-1">
          <h3 class="text-3xl font-bold text-gray-900 dark:text-white mb-1">{{ formatCurrency(statistics.pipelineValue || 0) }}</h3>
          <p class="text-gray-600 dark:text-gray-400 text-sm">Pipeline Value</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow flex gap-4">
        <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-500 to-red-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-7 h-7 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <div class="flex-1">
          <h3 class="text-3xl font-bold text-gray-900 dark:text-white mb-1">{{ statistics.activeDeals || 0 }}</h3>
          <p class="text-gray-600 dark:text-gray-400 text-sm">Active Deals</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow flex gap-4">
        <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-7 h-7 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="flex-1">
          <h3 class="text-3xl font-bold text-gray-900 dark:text-white mb-1">{{ formatCurrency(statistics.wonValue || 0) }}</h3>
          <p class="text-gray-600 dark:text-gray-400 text-sm">Won This Month</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow flex gap-4">
        <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-7 h-7 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
        </div>
        <div class="flex-1">
          <h3 class="text-3xl font-bold text-gray-900 dark:text-white mb-1">{{ winRate }}%</h3>
          <p class="text-gray-600 dark:text-gray-400 text-sm">Win Rate</p>
        </div>
      </div>
    </div>

    <!-- Kanban View -->
    <div v-if="viewMode === 'kanban'" class="overflow-x-auto pb-4">
      <div class="flex gap-6">
        <div v-for="stage in stages" :key="stage" class="kanban-column bg-gray-100 dark:bg-gray-800 rounded-xl flex flex-col max-h-[calc(100vh-400px)]">
          <div class="p-5 bg-white dark:bg-gray-700 rounded-t-xl border-b-2 border-gray-200 dark:border-gray-600">
            <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-2">{{ stage }}</h3>
            <span class="inline-block bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 px-3 py-1 rounded-xl text-xs font-semibold ml-2">{{ getDealsInStage(stage).length }}</span>
            <span class="block text-sm text-gray-600 dark:text-gray-400 mt-2 font-semibold">{{ formatCurrency(getStageValue(stage)) }}</span>
          </div>
          
          <div class="flex-1 p-4 overflow-y-auto flex flex-col gap-4" @drop="onDrop($event, stage)" @dragover.prevent>
            <div
              v-for="deal in getDealsInStage(stage)"
              :key="deal._id"
              class="kanban-card bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 cursor-grab hover:shadow-md hover:-translate-y-0.5 transition-all active:cursor-grabbing"
              draggable="true"
              @dragstart="onDragStart($event, deal)"
              @click="viewDeal(deal._id)"
            >
              <div class="flex justify-between items-start mb-3">
                <h4 class="text-base font-semibold text-gray-900 dark:text-white flex-1">{{ deal.name }}</h4>
                <span 
                  :class="[
                    'px-2 py-1 rounded-md text-xs font-semibold flex-shrink-0',
                    deal.priority?.toLowerCase() === 'low' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
                    deal.priority?.toLowerCase() === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
                    deal.priority?.toLowerCase() === 'high' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300' :
                    'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                  ]"
                >
                  {{ deal.priority || 'Medium' }}
                </span>
              </div>
              
              <div class="text-xl font-bold text-green-600 dark:text-green-400 mb-3">{{ formatCurrency(deal.amount) }}</div>
              
              <div class="flex flex-col gap-2 mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                <div class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400" v-if="deal.contactId">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-3.5 h-3.5">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {{ deal.contactId.first_name }} {{ deal.contactId.last_name }}
                </div>
                <div class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-3.5 h-3.5">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {{ formatDate(deal.expectedCloseDate) }}
                </div>
              </div>
              
              <div class="flex justify-between items-center">
                <div class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <div class="w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-semibold">{{ getInitials(deal.ownerId) }}</div>
                  <span>{{ deal.ownerId?.firstName }}</span>
                </div>
                <div class="text-xs font-semibold text-brand-600 dark:text-brand-400">{{ deal.probability }}%</div>
              </div>
            </div>
            
            <div v-if="getDealsInStage(stage).length === 0" class="text-center py-8 text-gray-400 dark:text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-gray-600">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p class="text-sm">No deals</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Table View -->
    <div v-else>
      <!-- Search and Filters -->
      <div class="flex gap-4 mb-6">
        <div class="flex-1 relative">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search deals..."
            @input="debouncedSearch"
            class="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>

        <div class="flex gap-3">
          <select 
            v-model="filters.stage" 
            @change="fetchDeals"
            class="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 cursor-pointer"
          >
            <option value="">All Stages</option>
            <option v-for="stage in stages" :key="stage" :value="stage">{{ stage }}</option>
          </select>

          <select 
            v-model="filters.status" 
            @change="fetchDeals"
            class="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 cursor-pointer"
          >
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Won">Won</option>
            <option value="Lost">Lost</option>
          </select>

          <select 
            v-model="filters.priority" 
            @change="fetchDeals"
            class="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 cursor-pointer"
          >
            <option value="">All Priority</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
          </select>
        </div>
      </div>

      <!-- Deals Table with DataTable Component -->
      <DataTable
        :data="deals"
        :columns="tableColumns"
        :loading="loading"
        :paginated="true"
        :per-page="20"
        :total-records="pagination.totalDeals"
        :show-controls="false"
        :selectable="true"
        :resizable="true"
        :column-settings="true"
        :server-side="true"
        table-id="deals-table"
        :mass-actions="massActions"
        row-key="_id"
        empty-title="No deals yet"
        empty-message="Start tracking your sales opportunities"
        @select="handleSelect"
        @bulk-action="handleBulkAction"
        @row-click="handleRowClick"
        @edit="editDeal"
        @delete="handleDeleteDeal"
        @page-change="handlePageChange"
        @sort="handleSort"
      >
        <!-- Custom Deal Name Cell -->
        <template #cell-name="{ row }">
          <span class="font-semibold text-gray-900 dark:text-white">{{ row.name }}</span>
        </template>

        <!-- Custom Amount Cell -->
        <template #cell-amount="{ value }">
          <strong>{{ formatCurrency(value) }}</strong>
        </template>

        <!-- Custom Stage Cell with Badge -->
        <template #cell-stage="{ value }">
          <BadgeCell 
            :value="value" 
            :variant-map="{
              'Lead': 'warning',
              'Qualified': 'info',
              'Proposal': 'primary',
              'Negotiation': 'warning',
              'Closed Won': 'success',
              'Closed Lost': 'danger'
            }"
          />
        </template>

        <!-- Custom Contact Cell -->
        <template #cell-contactId="{ row }">
          <span v-if="row.contactId">
            {{ row.contactId.first_name }} {{ row.contactId.last_name }}
          </span>
          <span v-else class="text-gray-500 dark:text-gray-400">-</span>
        </template>

        <!-- Custom Owner Cell -->
        <template #cell-ownerId="{ row }">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-sm font-medium">
              {{ getInitials(row.ownerId) }}
            </div>
            <span>{{ row.ownerId?.firstName }}</span>
          </div>
        </template>

        <!-- Custom Close Date Cell with overdue highlight -->
        <template #cell-expectedCloseDate="{ row }">
          <span :class="{'text-danger-600 dark:text-danger-400 font-medium': isOverdue(row.expectedCloseDate)}">
            {{ formatDate(row.expectedCloseDate) }}
          </span>
        </template>

        <!-- Custom Probability Cell -->
        <template #cell-probability="{ value }">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ value }}%</span>
        </template>

        <!-- Custom Priority Cell with Badge -->
        <template #cell-priority="{ value }">
          <BadgeCell 
            :value="value || 'Medium'" 
            :variant-map="{
              'Low': 'default',
              'Medium': 'info',
              'High': 'warning',
              'Urgent': 'danger'
            }"
          />
        </template>

        <!-- Custom Actions -->
        <template #actions="{ row }">
          <RowActions 
            :row="row"
            module="deals"
            @view="viewDeal(row._id)"
            @edit="editDeal(row)"
            @delete="deleteDeal(row._id)"
          />
        </template>
      </DataTable>

      <!-- Old table code below (commented out for reference)
      <div v-if="false && deals.length > 0" class="table-container">
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

      <!-- Pagination (commented out - handled by DataTable) -->
      -->
    </div>

    <!-- Create/Edit Modal -->
    <DealFormModal 
      v-if="showFormModal"
      :deal="editingDeal"
      @close="closeFormModal"
      @saved="handleDealSaved"
    />

    <!-- CSV Import Modal -->
    <CSVImportModal
      v-if="showImportModal"
      entity-type="Deals"
      @close="showImportModal = false"
      @import-complete="handleImportComplete"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useBulkActions } from '@/composables/useBulkActions';
import apiClient from '@/utils/apiClient';
import DataTable from '@/components/common/DataTable.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import DealFormModal from '@/components/deals/DealFormModal.vue';
import CSVImportModal from '@/components/import/CSVImportModal.vue';
import ModuleActions from '@/components/common/ModuleActions.vue';
import RowActions from '@/components/common/RowActions.vue';

const router = useRouter();
const authStore = useAuthStore();

// State
const deals = ref([]);
const loading = ref(false);
const viewMode = ref('kanban'); // 'kanban' or 'table'
const searchQuery = ref('');
const showFormModal = ref(false);
const showImportModal = ref(false);
const editingDeal = ref(null);

const stages = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

// Mass Actions
// Use bulk actions composable with permissions
const { bulkActions: baseMassActions } = useBulkActions('deals');

// Add custom "Move to Stage" action for deals
const massActions = computed(() => {
  const actions = [...baseMassActions.value];
  
  // Add Move to Stage action at the beginning if user can edit
  if (authStore.can('deals', 'edit')) {
    actions.unshift({ label: 'Move to Stage', icon: 'edit', action: 'bulk-move-stage' });
  }
  
  return actions;
});

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

// Column definitions for table view
const tableColumns = [
  { key: 'name', label: 'Deal Name', sortable: true },
  { key: 'amount', label: 'Amount', sortable: true },
  { key: 'stage', label: 'Stage', sortable: true },
  { key: 'contactId', label: 'Contact', sortable: true },
  { key: 'ownerId', label: 'Owner', sortable: true },
  { key: 'expectedCloseDate', label: 'Close Date', sortable: true },
  { key: 'probability', label: 'Probability', sortable: true },
  { key: 'priority', label: 'Priority', sortable: true }
];

// Event handlers for DataTable
const handleRowClick = (row) => {
  viewDeal(row._id);
};

const handleDeleteDeal = (row) => {
  deleteDeal(row._id);
};

const handlePageChange = (page) => {
  pagination.value.currentPage = page;
  fetchDeals();
};

const handleSort = ({ key, order }) => {
  // If key is empty, reset to default sort
  if (!key) {
    sortField.value = 'createdAt';
    sortOrder.value = 'desc';
  } else {
    sortField.value = key;
    sortOrder.value = order;
  }
  fetchDeals();
};

const isOverdue = (date) => {
  if (!date) return false;
  return new Date(date) < new Date();
};

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

// Export deals to CSV
const exportDeals = async () => {
  try {
    const response = await fetch('/api/csv/export/deals', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).token : ''}`
      }
    });
    
    if (!response.ok) throw new Error('Export failed');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deals_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Error exporting deals:', error);
    alert('Failed to export deals');
  }
};

// Handle import complete
const handleImportComplete = () => {
  showImportModal.value = false;
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

// Bulk Actions Handlers
const handleSelect = (selectedRows) => {
  console.log(`${selectedRows.length} deals selected`);
};

const handleBulkAction = async ({ action, selectedRows }) => {
  const dealIds = selectedRows.map(deal => deal._id);
  
  try {
    if (action === 'bulk-delete') {
      if (!confirm(`Delete ${selectedRows.length} deals?`)) return;
      
      await Promise.all(dealIds.map(id => 
        apiClient(`/deals/${id}`, { method: 'DELETE' })
      ));
      fetchDeals();
      
    } else if (action === 'bulk-move-stage') {
      const stage = prompt(`Move ${selectedRows.length} deals to stage:\n\nOptions: ${stages.join(', ')}`);
      if (!stage || !stages.includes(stage)) return;
      
      await Promise.all(dealIds.map(id => 
        apiClient.patch(`/deals/${id}`, { stage })
      ));
      fetchDeals();
      
    } else if (action === 'bulk-export') {
      exportDealsToCSV(selectedRows);
    }
  } catch (error) {
    console.error('Error performing bulk action:', error);
    alert('Error performing bulk action. Please try again.');
  }
};

const exportDealsToCSV = (dealsToExport) => {
  const csv = [
    ['Deal Name', 'Amount', 'Stage', 'Priority', 'Probability', 'Close Date'].join(','),
    ...dealsToExport.map(deal => [
      deal.name,
      deal.amount || 0,
      deal.stage,
      deal.priority || '',
      deal.probability || '',
      deal.expectedCloseDate || ''
    ].join(','))
  ].join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `deals-export-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
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
      // Use convenience method that handles JSON.stringify automatically
      await apiClient.patch(`/deals/${dealId}/stage`, { stage: newStage });
      
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
  // Load saved sort state from localStorage before fetching
  const savedSort = localStorage.getItem('datatable-deals-table-sort');
  if (savedSort) {
    try {
      const { by, order } = JSON.parse(savedSort);
      sortField.value = by || 'createdAt';
      sortOrder.value = order || 'desc';
      console.log('Loaded saved sort in Deals:', { by, order });
    } catch (e) {
      console.error('Failed to parse saved sort:', e);
    }
  }
  
  fetchDeals();
});
</script>

<style scoped>
/* Kanban Column Width */
.kanban-column {
  flex: 0 0 400px;
  min-width: 400px;
  max-width: 400px;
}

/* Kanban Card Width */
.kanban-card {
  min-width: 360px;
}

/* Custom Scrollbar Styling */
.overflow-y-auto::-webkit-scrollbar,
.overflow-x-auto::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.overflow-y-auto::-webkit-scrollbar-track,
.overflow-x-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb,
.overflow-x-auto::-webkit-scrollbar-thumb {
  background: rgb(203 213 225 / 0.5);
  border-radius: 4px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover,
.overflow-x-auto::-webkit-scrollbar-thumb:hover {
  background: rgb(148 163 184 / 0.7);
}

:global(.dark) .overflow-y-auto::-webkit-scrollbar-thumb,
:global(.dark) .overflow-x-auto::-webkit-scrollbar-thumb {
  background: rgb(71 85 105 / 0.5);
}

:global(.dark) .overflow-y-auto::-webkit-scrollbar-thumb:hover,
:global(.dark) .overflow-x-auto::-webkit-scrollbar-thumb:hover {
  background: rgb(100 116 139 / 0.7);
}
</style>

