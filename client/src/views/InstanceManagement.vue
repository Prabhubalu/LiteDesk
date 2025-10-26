<template>
  <div class="mx-auto">
    <!-- Header -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Instance Management</h1>
        <p class="text-lg text-gray-600 dark:text-gray-400 mt-2">Monitor and manage all customer instances</p>
      </div>
    </div>

    <!-- Statistics Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ statistics.totalInstances || 0 }}</p>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Total Instances</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ statistics.activeInstances || 0 }}</p>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Active Instances</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ statistics.provisioningInstances || 0 }}</p>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Provisioning</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">${{ formatNumber(statistics.totalMRR || 0) }}</p>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Monthly Revenue</p>
        </div>
      </div>
    </div>

    <!-- Filters and Search -->
    <div class="flex flex-col lg:flex-row gap-4 mb-6">
      <div class="w-full lg:w-80">
        <div class="relative">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search instances..."
            @input="debouncedSearch"
            class="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          />
        </div>
      </div>

      <div class="flex flex-wrap gap-3">
        <select v-model="filters.status" @change="fetchInstances" class="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer text-sm">
          <option value="">All Status</option>
          <option value="provisioning">Provisioning</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="terminated">Terminated</option>
          <option value="failed">Failed</option>
        </select>

        <select v-model="filters.subscriptionStatus" @change="fetchInstances" class="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer text-sm">
          <option value="">All Subscriptions</option>
          <option value="trial">Trial</option>
          <option value="active">Active</option>
          <option value="past_due">Past Due</option>
          <option value="canceled">Canceled</option>
        </select>

        <select v-model="filters.healthStatus" @change="fetchInstances" class="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer text-sm">
          <option value="">All Health</option>
          <option value="healthy">Healthy</option>
          <option value="degraded">Degraded</option>
          <option value="unhealthy">Unhealthy</option>
          <option value="unknown">Unknown</option>
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

    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-12 text-gray-600 dark:text-gray-400">
      <div class="w-10 h-10 border-3 border-gray-300 dark:border-gray-600 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
      <p>Loading instances...</p>
    </div>

    <!-- Instances Table -->
    <div v-else-if="instances.length > 0" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
      <table class="w-full border-collapse">
        <thead class="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">Instance</th>
            <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">Subdomain</th>
            <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">Owner</th>
            <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">Status</th>
            <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">Health</th>
            <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">Subscription</th>
            <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">MRR</th>
            <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">Users</th>
            <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">Created</th>
            <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="instance in instances" :key="instance._id" class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            <td class="px-6 py-4 text-sm border-b border-gray-200 dark:border-gray-700">
              <div class="flex flex-col gap-1">
                <strong class="text-gray-900 dark:text-white">{{ instance.instanceName }}</strong>
                <span class="text-xs text-gray-500 dark:text-gray-400 font-mono">{{ instance.kubernetesNamespace }}</span>
              </div>
            </td>
            <td class="px-6 py-4 text-sm border-b border-gray-200 dark:border-gray-700">
              <a :href="instance.urls?.frontend" target="_blank" class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 font-mono hover:underline">
                {{ instance.subdomain }}
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-3.5 h-3.5">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </td>
            <td class="px-6 py-4 text-sm border-b border-gray-200 dark:border-gray-700">
              <div class="flex flex-col gap-1">
                <strong class="text-gray-900 dark:text-white">{{ instance.ownerName || 'N/A' }}</strong>
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ instance.ownerEmail }}</span>
              </div>
            </td>
            <td class="px-6 py-4 text-sm border-b border-gray-200 dark:border-gray-700">
              <span :class="getStatusClass(instance.status)">
                {{ instance.status }}
              </span>
            </td>
            <td class="px-6 py-4 text-sm border-b border-gray-200 dark:border-gray-700">
              <span :class="getHealthClass(instance.healthStatus)">
                {{ instance.healthStatus }}
              </span>
            </td>
            <td class="px-6 py-4 text-sm border-b border-gray-200 dark:border-gray-700">
              <div class="flex flex-col gap-1">
                <span :class="getSubscriptionClass(instance.subscription?.tier)">
                  {{ instance.subscription?.tier }}
                </span>
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ instance.subscription?.status }}</span>
              </div>
            </td>
            <td class="px-6 py-4 text-sm font-semibold text-green-600 dark:text-green-400 border-b border-gray-200 dark:border-gray-700">${{ instance.subscription?.mrr || 0 }}</td>
            <td class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">{{ instance.metrics?.totalUsers || 0 }}</td>
            <td class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">{{ formatDate(instance.createdAt) }}</td>
            <td class="px-6 py-4 text-sm border-b border-gray-200 dark:border-gray-700">
              <div class="flex gap-2">
                <button @click="viewInstance(instance)" class="w-8 h-8 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center transition-colors" title="View Details">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4 text-gray-600 dark:text-gray-400">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
                <button @click="manageInstance(instance)" class="w-8 h-8 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center transition-colors" title="Manage">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4 text-gray-600 dark:text-gray-400">
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
    <div v-else class="text-center py-12">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
      <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Instances Found</h3>
      <p class="text-gray-600 dark:text-gray-400">No customer instances match your current filters.</p>
    </div>

    <!-- Pagination -->
    <div v-if="pagination.totalPages > 1" class="flex items-center justify-center gap-4 mt-6">
      <button 
        @click="changePage(pagination.currentPage - 1)" 
        :disabled="pagination.currentPage === 1"
        class="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Previous
      </button>
      <span class="text-gray-600 dark:text-gray-400 text-sm">
        Page {{ pagination.currentPage }} of {{ pagination.totalPages }}
      </span>
      <button 
        @click="changePage(pagination.currentPage + 1)" 
        :disabled="pagination.currentPage === pagination.totalPages"
        class="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Next
      </button>
    </div>

    <!-- Instance Details Modal -->
    <div v-if="selectedInstance" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" @click="closeModal">
      <div class="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" @click.stop>
        <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ selectedInstance.instanceName }}</h2>
          <button @click="closeModal" class="w-8 h-8 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center transition-colors">
            <span class="text-gray-600 dark:text-gray-400 text-xl font-bold">×</span>
          </button>
        </div>

        <div class="p-6">
          <div class="mb-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Instance Information</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Instance Name:</label>
                <span class="text-sm text-gray-900 dark:text-white">{{ selectedInstance.instanceName }}</span>
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Subdomain:</label>
                <span class="text-sm text-gray-900 dark:text-white">{{ selectedInstance.subdomain }}</span>
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Kubernetes Namespace:</label>
                <span class="text-sm text-gray-900 dark:text-white">{{ selectedInstance.kubernetesNamespace }}</span>
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Status:</label>
                <span :class="getStatusClass(selectedInstance.status)">
                  {{ selectedInstance.status }}
                </span>
              </div>
            </div>
          </div>

          <div class="mb-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">URLs</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Frontend:</label>
                <a :href="selectedInstance.urls?.frontend" target="_blank" class="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">{{ selectedInstance.urls?.frontend }}</a>
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">API:</label>
                <a :href="selectedInstance.urls?.api" target="_blank" class="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">{{ selectedInstance.urls?.api }}</a>
              </div>
            </div>
          </div>

          <div class="mb-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Subscription</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Tier:</label>
                <span :class="getSubscriptionClass(selectedInstance.subscription?.tier)">
                  {{ selectedInstance.subscription?.tier }}
                </span>
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Status:</label>
                <span class="text-sm text-gray-900 dark:text-white">{{ selectedInstance.subscription?.status }}</span>
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">MRR:</label>
                <span class="text-sm text-gray-900 dark:text-white">${{ selectedInstance.subscription?.mrr || 0 }}</span>
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Trial End:</label>
                <span class="text-sm text-gray-900 dark:text-white">{{ formatDate(selectedInstance.subscription?.trialEndDate) }}</span>
              </div>
            </div>
          </div>

          <div class="mb-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Metrics</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Total Users:</label>
                <span class="text-sm text-gray-900 dark:text-white">{{ selectedInstance.metrics?.totalUsers || 0 }}</span>
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Total Contacts:</label>
                <span class="text-sm text-gray-900 dark:text-white">{{ selectedInstance.metrics?.totalContacts || 0 }}</span>
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Total Deals:</label>
                <span class="text-sm text-gray-900 dark:text-white">{{ selectedInstance.metrics?.totalDeals || 0 }}</span>
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Storage Used:</label>
                <span class="text-sm text-gray-900 dark:text-white">{{ selectedInstance.metrics?.storageUsedGB || 0 }} GB</span>
              </div>
            </div>
          </div>

          <div class="mb-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Database Connection</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Host:</label>
                <span class="text-sm text-gray-900 dark:text-white">{{ selectedInstance.databaseConnection?.host }}</span>
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Port:</label>
                <span class="text-sm text-gray-900 dark:text-white">{{ selectedInstance.databaseConnection?.port }}</span>
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Database:</label>
                <span class="text-sm text-gray-900 dark:text-white">{{ selectedInstance.databaseConnection?.database }}</span>
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Username:</label>
                <span class="text-sm text-gray-900 dark:text-white">{{ selectedInstance.databaseConnection?.username }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button @click="closeModal" class="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors">
            Close
          </button>
          <button @click="manageInstance(selectedInstance)" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors">
            Manage Instance
          </button>
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

// Check if any filters are active
const hasActiveFilters = computed(() => {
  return searchQuery.value.trim() !== '' || 
         (filters.value?.status || '') !== '' || 
         (filters.value?.subscriptionStatus || '') !== '' || 
         (filters.value?.healthStatus || '') !== '';
});

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

const clearFilters = () => {
  searchQuery.value = '';
  filters.value = {
    status: '',
    subscriptionStatus: '',
    healthStatus: ''
  };
  fetchInstances();
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

const getStatusClass = (status) => {
  const classes = {
    provisioning: 'inline-block px-3 py-1 text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full uppercase tracking-wider',
    active: 'inline-block px-3 py-1 text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full uppercase tracking-wider',
    suspended: 'inline-block px-3 py-1 text-xs font-semibold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-full uppercase tracking-wider',
    terminated: 'inline-block px-3 py-1 text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-full uppercase tracking-wider',
    failed: 'inline-block px-3 py-1 text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-full uppercase tracking-wider'
  };
  return classes[status] || 'inline-block px-3 py-1 text-xs font-semibold bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-200 rounded-full uppercase tracking-wider';
};

const getHealthClass = (healthStatus) => {
  const classes = {
    healthy: 'inline-block px-3 py-1 text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full uppercase tracking-wider',
    degraded: 'inline-block px-3 py-1 text-xs font-semibold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-full uppercase tracking-wider',
    unhealthy: 'inline-block px-3 py-1 text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-full uppercase tracking-wider',
    unknown: 'inline-block px-3 py-1 text-xs font-semibold bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-200 rounded-full uppercase tracking-wider'
  };
  return classes[healthStatus] || 'inline-block px-3 py-1 text-xs font-semibold bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-200 rounded-full uppercase tracking-wider';
};

const getSubscriptionClass = (tier) => {
  const classes = {
    trial: 'inline-block px-3 py-1 text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full uppercase tracking-wider',
    starter: 'inline-block px-3 py-1 text-xs font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 rounded-full uppercase tracking-wider',
    professional: 'inline-block px-3 py-1 text-xs font-semibold bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-200 rounded-full uppercase tracking-wider',
    enterprise: 'inline-block px-3 py-1 text-xs font-semibold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-full uppercase tracking-wider'
  };
  return classes[tier] || 'inline-block px-3 py-1 text-xs font-semibold bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-200 rounded-full uppercase tracking-wider';
};

onMounted(() => {
  fetchInstances();
});
</script>


