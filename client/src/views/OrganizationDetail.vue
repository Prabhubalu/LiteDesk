<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 border-t-indigo-600 dark:border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-gray-600 dark:text-gray-400 font-medium">Loading organization...</p>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="flex items-center justify-center min-h-screen p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Error Loading Organization</h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">{{ error }}</p>
        <button @click="goBack" class="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium">
          Back to Organizations
        </button>
      </div>
    </div>

    <!-- Organization Detail -->
    <div v-else-if="organization" class="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
      <!-- Header Actions -->
      <div class="flex items-center justify-between mb-4">
        <button @click="goBack" class="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span class="font-medium">Back</span>
        </button>

        <div class="flex items-center gap-2">
          <button @click="editOrganization" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-gray-700 dark:text-gray-300 transition-all">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
          <button @click="deleteOrganization" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-all">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      </div>

      <!-- Main Content Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <!-- Left Column - Organization Card -->
        <div class="lg:col-span-1">
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <!-- Avatar & Name -->
            <div class="text-center mb-4">
              <div class="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold mx-auto mb-3">
                {{ getInitials(organization.name) }}
              </div>
              <h1 class="text-lg font-bold text-gray-900 dark:text-white mb-0.5">
                {{ organization.name }}
              </h1>
              <p class="text-xs text-gray-600 dark:text-gray-400 mb-2">{{ organization.industry || 'No industry specified' }}</p>
              <div class="flex flex-wrap gap-1.5 justify-center">
                <span 
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  :class="{
                    'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300': organization.subscription?.tier === 'trial',
                    'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300': organization.subscription?.tier === 'starter',
                    'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300': organization.subscription?.tier === 'professional',
                    'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300': organization.subscription?.tier === 'enterprise'
                  }"
                >
                  {{ organization.subscription?.tier || 'trial' }}
                </span>
                <span 
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  :class="{
                    'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300': organization.isActive,
                    'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300': !organization.isActive
                  }"
                >
                  {{ organization.isActive ? 'Active' : 'Inactive' }}
                </span>
              </div>
            </div>

            <!-- Quick Info -->
            <div class="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
              <div v-if="organization.slug" class="flex items-start gap-2">
                <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <div class="flex-1">
                  <p class="text-xs text-gray-900 dark:text-white font-medium">{{ organization.slug }}</p>
                </div>
              </div>

              <div v-if="organization.subscription?.status" class="flex items-start gap-2">
                <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div class="flex-1">
                  <p class="text-xs text-gray-900 dark:text-white font-medium">{{ organization.subscription.status }}</p>
                </div>
              </div>

              <div v-if="organization.limits?.maxUsers" class="flex items-start gap-2">
                <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                <div class="flex-1">
                  <p class="text-xs text-gray-900 dark:text-white font-medium">{{ organization.limits.maxUsers }} max users</p>
                </div>
              </div>

              <div class="flex items-start gap-2">
                <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div class="flex-1">
                  <p class="text-xs text-gray-900 dark:text-white font-medium">{{ formatDate(organization.createdAt) }}</p>
                </div>
              </div>
            </div>

            <!-- Enabled Modules -->
            <div v-if="organization.enabledModules && organization.enabledModules.length > 0" class="pt-4 border-t border-gray-200 dark:border-gray-700">
              <p class="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2">Enabled Modules</p>
              <div class="flex flex-wrap gap-1.5">
                <span v-for="module in organization.enabledModules" :key="module" class="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs font-medium">
                  {{ module }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column - Details & Stats -->
        <div class="lg:col-span-2 space-y-4">
          <!-- Stats Row -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-xs text-gray-600 dark:text-gray-400 font-medium">Contacts</p>
                  <p class="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{{ organizationStats.contacts || 0 }}</p>
                </div>
                <div class="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-xs text-gray-600 dark:text-gray-400 font-medium">Users</p>
                  <p class="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{{ organizationStats.users || 0 }}</p>
                </div>
                <div class="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <svg class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-xs text-gray-600 dark:text-gray-400 font-medium">Deals</p>
                  <p class="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{{ organizationStats.deals || 0 }}</p>
                </div>
                <div class="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <svg class="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-xs text-gray-600 dark:text-gray-400 font-medium">Created</p>
                  <p class="text-sm font-bold text-gray-900 dark:text-white mt-0.5">{{ formatDateShort(organization.createdAt) }}</p>
                </div>
                <div class="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                  <svg class="w-4 h-4 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <!-- Details Section -->
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Organization Details</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="space-y-1">
                <label class="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">Slug</label>
                <p class="text-sm text-gray-900 dark:text-white font-medium">{{ organization.slug }}</p>
              </div>
              <div class="space-y-1">
                <label class="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">Industry</label>
                <p class="text-sm text-gray-900 dark:text-white font-medium">{{ organization.industry || '-' }}</p>
              </div>
              <div class="space-y-1">
                <label class="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">Subscription Tier</label>
                <p class="text-sm text-gray-900 dark:text-white font-medium">{{ organization.subscription?.tier || 'trial' }}</p>
              </div>
              <div class="space-y-1">
                <label class="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">Subscription Status</label>
                <p class="text-sm text-gray-900 dark:text-white font-medium">{{ organization.subscription?.status || 'trial' }}</p>
              </div>
              <div class="space-y-1">
                <label class="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">Max Users</label>
                <p class="text-sm text-gray-900 dark:text-white font-medium">{{ organization.limits?.maxUsers || 0 }}</p>
              </div>
              <div class="space-y-1">
                <label class="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">Created Date</label>
                <p class="text-sm text-gray-900 dark:text-white font-medium">{{ formatDate(organization.createdAt) }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="flex items-center justify-center min-h-screen p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Organization Not Found</h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">The organization you're looking for doesn't exist.</p>
        <button @click="goBack" class="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium">
          Back to Organizations
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import apiClient from '@/utils/apiClient';

const router = useRouter();
const route = useRoute();

const organization = ref(null);
const organizationStats = ref({
  contacts: 0,
  users: 0,
  deals: 0
});
const loading = ref(false);
const error = ref(null);

const fetchOrganization = async () => {
  loading.value = true;
  error.value = null;
  try {
    // This endpoint doesn't exist yet, but we can create it later
    const data = await apiClient(`/admin/organizations/${route.params.id}`, {
      method: 'GET'
    });
    
    if (data.success) {
      organization.value = data.data;
      organizationStats.value = data.stats || organizationStats.value;
    }
  } catch (err) {
    console.error('Error fetching organization:', err);
    error.value = err.message || 'Failed to load organization';
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  router.push('/organizations');
};

const editOrganization = () => {
  // TODO: Implement edit functionality
  console.log('Edit organization:', organization.value);
};

const deleteOrganization = () => {
  // TODO: Implement delete functionality
  console.log('Delete organization:', organization.value);
};

const getInitials = (name) => {
  return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
};

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const formatDateShort = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
};

onMounted(() => {
  fetchOrganization();
});
</script>


