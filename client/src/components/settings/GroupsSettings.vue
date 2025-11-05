<template>
  <div class="p-6 h-full flex flex-col overflow-hidden">
    <!-- Header with back button when group is selected -->
    <div class="mb-4 flex items-center justify-between gap-3">
      <template v-if="selectedGroupId">
        <div class="flex items-center gap-3">
          <button @click="clearSelection" class="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5" title="Back to groups">
            <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M12.78 15.22a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 010-1.06l4.5-4.5a.75.75 0 111.06 1.06L8.56 10l4.22 4.22a.75.75 0 010 1.06z" clip-rule="evenodd"/></svg>
          </button>
          <div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ selectedGroup?.name }}</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Manage group members, settings, and details</p>
          </div>
        </div>
      </template>
      <template v-else>
        <div>
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Groups & Teams</h2>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Organize users into teams, departments, and project groups</p>
        </div>
        <button @click="openCreateModal" class="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Create Group
        </button>
      </template>
    </div>

    <!-- If no group selected: show grid listing -->
    <div v-if="!selectedGroupId" class="flex-1 overflow-y-auto">
      <!-- Stats Row -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400 font-medium">Total Groups</p>
              <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ statistics.totalGroups || 0 }}</p>
            </div>
            <div class="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
              <svg class="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400 font-medium">Active Groups</p>
              <p class="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{{ statistics.activeGroups || 0 }}</p>
            </div>
            <div class="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400 font-medium">Total Members</p>
              <p class="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{{ statistics.totalMembers || 0 }}</p>
            </div>
            <div class="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400 font-medium">Avg Members/Group</p>
              <p class="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{{ statistics.avgMembersPerGroup || 0 }}</p>
            </div>
            <div class="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <svg class="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Search and Filters -->
      <div class="flex flex-col lg:flex-row gap-4 mb-4">
        <div class="flex gap-2">
          <div class="relative flex-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="Search groups..."
              @input="debouncedSearch"
              class="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
          </div>
          <select v-model="filters.type" @change="fetchGroups" class="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer text-sm">
            <option value="">All Types</option>
            <option value="Team">Team</option>
            <option value="Department">Department</option>
            <option value="Project">Project</option>
            <option value="Custom">Custom</option>
          </select>
          <select v-model="filters.isActive" @change="fetchGroups" class="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer text-sm">
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <button 
            @click="clearFilters" 
            :disabled="!hasActiveFilters"
            class="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear
          </button>
        </div>
      </div>

      <!-- Groups Grid -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>

      <div v-else-if="groups.length === 0" class="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <h3 class="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No groups</h3>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by creating your first group.</p>
        <div class="mt-6">
          <button @click="openCreateModal" class="inline-flex items-center px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium text-sm">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            New Group
          </button>
        </div>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div 
          v-for="group in groups" 
          :key="group._id" 
          class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 cursor-pointer hover:shadow-md transition-shadow"
          @click="selectGroup(group)"
        >
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-3 flex-1 min-w-0">
              <div 
                class="w-12 h-12 rounded-lg text-white flex items-center justify-center font-semibold text-sm flex-shrink-0"
                :style="{ backgroundColor: group.color || '#3B82F6' }"
              >
                {{ getInitials(group.name) }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-white truncate">{{ group.name }}</h3>
                  <BadgeCell 
                    :value="group.isActive ? 'Active' : 'Inactive'" 
                    :variant-map="{
                      'Active': 'success',
                      'Inactive': 'danger'
                    }"
                  />
                </div>
                <p v-if="group.description" class="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">{{ group.description }}</p>
                <div class="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <BadgeCell 
                    :value="group.type || 'Team'" 
                    :variant-map="{
                      'Team': 'primary',
                      'Department': 'info',
                      'Project': 'warning',
                      'Custom': 'secondary'
                    }"
                  />
                  <span>{{ group.memberCount || (group.members?.length || 0) }} member{{ (group.memberCount || group.members?.length || 0) !== 1 ? 's' : '' }}</span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-1 ml-2">
              <button 
                @click.stop="editGroup(group)" 
                class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Edit"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button 
                @click.stop="handleDelete(group)" 
                class="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Delete"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="pagination.totalPages > 1" class="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div class="text-sm text-gray-700 dark:text-gray-300">
          Showing {{ ((pagination.currentPage - 1) * pagination.limit) + 1 }} to {{ Math.min(pagination.currentPage * pagination.limit, pagination.totalGroups) }} of {{ pagination.totalGroups }} groups
        </div>
        <div class="flex gap-2">
          <button 
            @click="changePage(pagination.currentPage - 1)"
            :disabled="pagination.currentPage === 1"
            class="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button 
            @click="changePage(pagination.currentPage + 1)"
            :disabled="pagination.currentPage >= pagination.totalPages"
            class="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- If group selected: show detail view -->
    <div v-else class="flex-1 overflow-hidden flex flex-col gap-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col flex-1">
        <div class="p-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Group Name</label>
              <div class="text-lg font-semibold text-gray-900 dark:text-white">{{ selectedGroup?.name }}</div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type</label>
              <BadgeCell 
                :value="selectedGroup?.type || 'Team'" 
                :variant-map="{
                  'Team': 'primary',
                  'Department': 'info',
                  'Project': 'warning',
                  'Custom': 'secondary'
                }"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
              <BadgeCell 
                :value="selectedGroup?.isActive ? 'Active' : 'Inactive'" 
                :variant-map="{
                  'Active': 'success',
                  'Inactive': 'danger'
                }"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Roles & Permissions</label>
              <div v-if="selectedGroup?.roleIds && selectedGroup.roleIds.length > 0" class="flex flex-wrap gap-2">
                <div
                  v-for="role in selectedGroup.roleIds"
                  :key="role._id || role"
                  class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium text-white"
                  :style="{ backgroundColor: (role.color || (typeof role === 'object' && role.color)) || '#6366f1' }"
                >
                  <span>{{ typeof role === 'object' ? role.name : role }}</span>
                </div>
              </div>
              <span v-else class="text-sm text-gray-500 dark:text-gray-400">No roles assigned</span>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Members</label>
              <div class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ selectedGroup?.memberCount || (selectedGroup?.members?.length || 0) }} member{{ (selectedGroup?.memberCount || selectedGroup?.members?.length || 0) !== 1 ? 's' : '' }}
              </div>
            </div>
            <div class="md:col-span-2" v-if="selectedGroup?.description">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
              <div class="text-sm text-gray-600 dark:text-gray-400">{{ selectedGroup.description }}</div>
            </div>
          </div>

          <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Group Members</h3>
              <button 
                @click="editGroup(selectedGroup)" 
                class="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium text-sm transition-colors"
              >
                Edit Group
              </button>
            </div>
            <div v-if="selectedGroup?.members && selectedGroup.members.length > 0" class="mt-4 space-y-2">
              <div 
                v-for="member in selectedGroup.members" 
                :key="member._id || member"
                class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div 
                  v-if="member.avatar"
                  class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0"
                >
                  <img :src="member.avatar" :alt="getUserDisplayName(member)" class="w-full h-full object-cover" />
                </div>
                <div 
                  v-else
                  class="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                >
                  {{ getUserInitials(member) }}
                </div>
                <div class="flex-1">
                  <div class="text-sm font-medium text-gray-900 dark:text-white">{{ getUserDisplayName(member) }}</div>
                  <div v-if="member.email" class="text-xs text-gray-500 dark:text-gray-400">{{ member.email }}</div>
                </div>
              </div>
            </div>
            <div v-else class="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
              No members in this group
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Group Form Modal -->
    <GroupFormModal
      v-if="showFormModal"
      :group="editingGroup"
      @close="closeFormModal"
      @saved="handleGroupSaved"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import GroupFormModal from '@/components/groups/GroupFormModal.vue';

const router = useRouter();
const { openTab } = useTabs();

// State
const groups = ref([]);
const loading = ref(false);
const searchQuery = ref('');
const showFormModal = ref(false);
const editingGroup = ref(null);
const selectedGroupId = ref(null);

const filters = reactive({
  type: '',
  isActive: ''
});

const pagination = ref({
  currentPage: 1,
  totalPages: 1,
  totalGroups: 0,
  limit: 20
});

const statistics = ref({
  totalGroups: 0,
  activeGroups: 0,
  totalMembers: 0,
  avgMembersPerGroup: 0
});

const sortField = ref('createdAt');
const sortOrder = ref('desc');

// Computed
const selectedGroup = computed(() => {
  return groups.value.find(g => g._id === selectedGroupId.value);
});

// Check if any filters are active
const hasActiveFilters = computed(() => {
  return searchQuery.value.trim() !== '' || 
         (filters?.type || '') !== '' || 
         (filters?.isActive || '') !== '';
});

// Fetch groups
const fetchGroups = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    params.append('page', pagination.value.currentPage.toString());
    params.append('limit', pagination.value.limit.toString());
    params.append('sortBy', sortField.value);
    params.append('sortOrder', sortOrder.value);
    
    if (searchQuery.value.trim()) {
      params.append('search', searchQuery.value.trim());
    }
    if (filters.type) {
      params.append('type', filters.type);
    }
    if (filters.isActive) {
      params.append('isActive', filters.isActive);
    }

    const data = await apiClient.get(`/groups?${params.toString()}`);

    if (data.success) {
      groups.value = data.data;
      pagination.value = data.pagination;
      
      // Calculate statistics
      statistics.value = {
        totalGroups: data.pagination.totalGroups,
        activeGroups: data.data.filter(g => g.isActive).length,
        totalMembers: data.data.reduce((sum, g) => sum + (g.memberCount || g.members?.length || 0), 0),
        avgMembersPerGroup: data.data.length > 0 
          ? Math.round(data.data.reduce((sum, g) => sum + (g.memberCount || g.members?.length || 0), 0) / data.data.length)
          : 0
      };
    }
  } catch (error) {
    console.error('❌ Error fetching groups:', error);
  } finally {
    loading.value = false;
  }
};

let searchTimeout = null;
const debouncedSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    pagination.value.currentPage = 1;
    fetchGroups();
  }, 500);
};

const changePage = (page) => {
  pagination.value.currentPage = page;
  fetchGroups();
};

const handleSort = (field, order) => {
  sortField.value = field;
  sortOrder.value = order;
  fetchGroups();
};

const clearFilters = () => {
  searchQuery.value = '';
  filters.type = '';
  filters.isActive = '';
  pagination.value.currentPage = 1;
  fetchGroups();
};

const selectGroup = (group) => {
  selectedGroupId.value = group._id;
};

const clearSelection = () => {
  selectedGroupId.value = null;
};

const openCreateModal = () => {
  editingGroup.value = null;
  showFormModal.value = true;
};

const editGroup = (group) => {
  editingGroup.value = group;
  showFormModal.value = true;
};

const closeFormModal = () => {
  showFormModal.value = false;
  editingGroup.value = null;
};

const handleGroupSaved = (savedGroup) => {
  closeFormModal();
  // If we were viewing this group, refresh the selection
  if (selectedGroupId.value === savedGroup._id) {
    fetchGroups().then(() => {
      // Ensure the group is still selected after refresh
      selectedGroupId.value = savedGroup._id;
    });
  } else {
    fetchGroups(); // Refresh the list
  }
};

const handleDelete = async (group) => {
  if (!confirm(`Are you sure you want to delete "${group.name}"? This action cannot be undone.`)) return;
  
  try {
    await apiClient.delete(`/groups/${group._id}`);
    // If we were viewing this group, clear selection
    if (selectedGroupId.value === group._id) {
      selectedGroupId.value = null;
    }
    fetchGroups();
  } catch (error) {
    console.error('Error deleting group:', error);
    alert('Error deleting group. Please try again.');
  }
};

// Helper functions
const getInitials = (name) => {
  if (!name) return '?';
  const words = name.trim().split(' ');
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const getUserInitials = (user) => {
  if (!user) return '?';
  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  }
  if (user.username) {
    return user.username.substring(0, 2).toUpperCase();
  }
  if (user.email) {
    return user.email.substring(0, 2).toUpperCase();
  }
  return '?';
};

const getUserDisplayName = (user) => {
  if (!user) return 'Unknown';
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`.trim();
  }
  if (user.username) return user.username;
  if (user.email) return user.email;
  return 'Unknown User';
};

// Lifecycle
onMounted(() => {
  fetchGroups();
});
</script>

