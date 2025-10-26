<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 border-t-brand-600 dark:border-t-brand-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-gray-600 dark:text-gray-400 font-medium">Loading contact...</p>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="flex items-center justify-center min-h-screen p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Error Loading Contact</h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">{{ error }}</p>
        <button @click="$router.push('/contacts')" class="px-6 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 font-medium">
          Back to Contacts
        </button>
      </div>
    </div>

    <!-- Contact Detail -->
    <div v-else-if="contact" class="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
      <!-- Header Actions -->
      <div class="flex items-center justify-between mb-4">
        <button @click="$router.push('/contacts')" class="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span class="font-medium">Back</span>
        </button>

        <div class="flex items-center gap-2">
          <button @click="editContact" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-gray-700 dark:text-gray-300 transition-all">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
          <button @click="deleteContact" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-all">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      </div>

      <!-- Main Content Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <!-- Left Column - Profile Card -->
        <div class="lg:col-span-1">
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <!-- Avatar & Name -->
            <div class="text-center mb-4">
              <div class="w-16 h-16 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold mx-auto mb-3">
                {{ getInitials() }}
              </div>
              <h1 class="text-lg font-bold text-gray-900 dark:text-white mb-0.5">
                {{ contact.first_name }} {{ contact.last_name }}
              </h1>
              <p class="text-xs text-gray-600 dark:text-gray-400 mb-2">{{ contact.job_title || 'No title' }}</p>
              <span 
                class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                :class="{
                  'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300': contact.lifecycle_stage === 'Lead',
                  'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300': contact.lifecycle_stage === 'Qualified',
                  'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300': contact.lifecycle_stage === 'Opportunity',
                  'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300': contact.lifecycle_stage === 'Customer',
                  'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300': contact.lifecycle_stage === 'Lost'
                }"
              >
                {{ contact.lifecycle_stage || 'Lead' }}
              </span>
            </div>

            <!-- Contact Methods -->
            <div class="space-y-2 mb-4">
              <a v-if="contact.email" :href="`mailto:${contact.email}`" class="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group">
                <div class="w-7 h-7 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg class="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-xs text-gray-900 dark:text-white font-medium truncate">{{ contact.email }}</p>
                </div>
              </a>

              <a v-if="contact.phone" :href="`tel:${contact.phone}`" class="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group">
                <div class="w-7 h-7 bg-green-100 dark:bg-green-900/30 rounded flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg class="w-3.5 h-3.5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-xs text-gray-900 dark:text-white font-medium">{{ contact.phone }}</p>
                </div>
              </a>

              <a v-if="contact.mobile" :href="`tel:${contact.mobile}`" class="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group">
                <div class="w-7 h-7 bg-purple-100 dark:bg-purple-900/30 rounded flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg class="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-xs text-gray-900 dark:text-white font-medium">{{ contact.mobile }}</p>
                </div>
              </a>
            </div>

            <!-- Quick Info -->
            <div class="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
              <div v-if="contact.organization" class="flex items-start gap-2">
                <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                </svg>
                <div class="flex-1">
                  <p class="text-xs text-gray-900 dark:text-white font-medium">{{ contact.organization.name }}</p>
                </div>
              </div>

              <div v-if="contact.department" class="flex items-start gap-2">
                <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                </svg>
                <div class="flex-1">
                  <p class="text-xs text-gray-900 dark:text-white font-medium">{{ contact.department }}</p>
                </div>
              </div>

              <div v-if="contact.lead_source" class="flex items-start gap-2">
                <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
                <div class="flex-1">
                  <p class="text-xs text-gray-900 dark:text-white font-medium">{{ contact.lead_source }}</p>
                </div>
              </div>

              <div class="flex items-start gap-2">
                <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
                <div class="flex-1">
                  <p class="text-xs text-gray-900 dark:text-white font-medium">{{ formatDate(contact.createdAt) }}</p>
                </div>
              </div>

              <div v-if="contact.do_not_contact" class="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <svg class="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                <span class="text-xs font-medium text-red-900 dark:text-red-200">Do Not Contact</span>
              </div>
            </div>

            <!-- Tags -->
            <div v-if="contact.tags && contact.tags.length > 0" class="pt-4 border-t border-gray-200 dark:border-gray-700">
              <p class="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2">Tags</p>
              <div class="flex flex-wrap gap-1.5">
                <span v-for="tag in contact.tags" :key="tag" class="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs font-medium">
                  {{ tag }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column - Details & Activity -->
        <div class="lg:col-span-2 space-y-4">
          <!-- Stats Row -->
          <div class="grid grid-cols-3 gap-3">
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-xs text-gray-600 dark:text-gray-400 font-medium">Deals</p>
                  <p class="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{{ contact.relatedDeals?.length || 0 }}</p>
                </div>
                <div class="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <svg class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
              </div>
            </div>

            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-xs text-gray-600 dark:text-gray-400 font-medium">Notes</p>
                  <p class="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{{ contact.notes?.length || 0 }}</p>
                </div>
                <div class="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <svg class="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                </div>
              </div>
            </div>

            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-xs text-gray-600 dark:text-gray-400 font-medium">Score</p>
                  <p class="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{{ contact.score || 0 }}</p>
                </div>
                <div class="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <!-- Related Organization Widget -->
          <RelatedOrganizationWidget
            :organization="contact.organization"
            @view-organization="viewOrganization"
            @link-organization="editContact"
            @unlink-organization="unlinkOrganization"
          />

          <!-- Related Deals Widget -->
          <RelatedDealsWidget
            v-if="contact._id"
            :contact-id="contact._id"
            :limit="5"
            @create-deal="openCreateDeal"
            @view-deal="viewDeal"
            ref="dealsWidgetRef"
          />

          <!-- Related Tasks Widget -->
          <RelatedTasksWidget
            v-if="contact._id"
            :contact-id="contact._id"
            :limit="5"
            @create-task="openCreateTask"
            @view-task="viewTask"
            ref="tasksWidgetRef"
          />

          <!-- Old Relations Widget - Grid Layout (HIDDEN, keeping for reference) -->
          <div v-if="false" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h3 class="text-base font-bold text-gray-900 dark:text-white mb-3">Relations</h3>

            <!-- Grid of Relation Tiles -->
            <div class="grid grid-cols-3 sm:grid-cols-3 gap-3">
              <!-- Organization Tile -->
              <div class="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors">
                <div class="flex items-center justify-between mb-2">
                  <div class="w-6 h-6 bg-purple-100 dark:bg-purple-900/50 rounded flex items-center justify-center">
                    <svg class="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                    </svg>
                  </div>
                  <button @click="editContact" class="p-0.5 hover:bg-purple-200 dark:hover:bg-purple-800 rounded transition-colors">
                    <svg class="w-3 h-3 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                    </svg>
                  </button>
                </div>
                
                <div v-if="contact.organization">
                  <p class="text-xl font-bold text-purple-600 dark:text-purple-400">1</p>
                  <p class="text-xs font-medium text-gray-900 dark:text-white truncate mt-0.5">{{ contact.organization.name }}</p>
                </div>
                <div v-else>
                  <p class="text-xl font-bold text-gray-400 dark:text-gray-500">0</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">No org</p>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Organization</p>
              </div>

              <!-- Deals Tile -->
              <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors cursor-pointer" @click="$router.push('/deals')">
                <div class="flex items-center justify-between mb-2">
                  <div class="w-6 h-6 bg-green-100 dark:bg-green-900/50 rounded flex items-center justify-center">
                    <svg class="w-3.5 h-3.5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                  </div>
                  <button @click.stop="$router.push('/deals')" class="p-0.5 hover:bg-green-200 dark:hover:bg-green-800 rounded transition-colors">
                    <svg class="w-3 h-3 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                    </svg>
                  </button>
                </div>
                
                <div v-if="contact.relatedDeals && contact.relatedDeals.length > 0">
                  <p class="text-xl font-bold text-green-600 dark:text-green-400">{{ contact.relatedDeals.length }}</p>
                  <p class="text-xs font-medium text-gray-900 dark:text-white truncate mt-0.5">${{ (contact.relatedDeals.reduce((sum, deal) => sum + (deal.amount || 0), 0) / 1000).toFixed(0) }}K</p>
                </div>
                <div v-else>
                  <p class="text-xl font-bold text-gray-400 dark:text-gray-500">0</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">No deals</p>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Deals</p>
              </div>

              <!-- Tasks Tile -->
              <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors cursor-pointer" @click="$router.push('/tasks')">
                <div class="flex items-center justify-between mb-2">
                  <div class="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded flex items-center justify-center">
                    <svg class="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
                    </svg>
                  </div>
                  <button @click.stop="$router.push('/tasks')" class="p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 rounded transition-colors">
                    <svg class="w-3 h-3 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                    </svg>
                  </button>
                </div>
                
                <div v-if="contact.relatedTasks && contact.relatedTasks.length > 0">
                  <p class="text-xl font-bold text-blue-600 dark:text-blue-400">{{ contact.relatedTasks.length }}</p>
                  <p class="text-xs font-medium text-gray-900 dark:text-white truncate mt-0.5">{{ contact.relatedTasks.filter(t => t.status === 'Completed').length }} done</p>
                </div>
                <div v-else>
                  <p class="text-xl font-bold text-gray-400 dark:text-gray-500">0</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">No tasks</p>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Tasks</p>
              </div>
            </div>
          </div>

          <!-- Related Events Widget -->
          <RelatedEventsWidget
            v-if="contact._id"
            related-type="Contact"
            :related-id="contact._id"
            :limit="10"
            @create-event="openCreateEvent"
            @view-event="viewEvent"
            ref="eventsWidgetRef"
          />

          <!-- Activity Timeline -->
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-base font-bold text-gray-900 dark:text-white">Activity & Notes</h3>
              <button @click="showNoteForm = true" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium transition-colors">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Add
              </button>
            </div>

            <!-- Note Form -->
            <div v-if="showNoteForm" class="mb-4">
              <textarea 
                v-model="newNote" 
                placeholder="Add a note..."
                rows="2"
                class="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent resize-none transition-all"
              ></textarea>
              <div class="flex items-center justify-end gap-2 mt-2">
                <button @click="showNoteForm = false; newNote = ''" class="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  Cancel
                </button>
                <button @click="addNote" :disabled="!newNote.trim()" class="px-3 py-1.5 bg-brand-600 text-white text-xs rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors">
                  Save
                </button>
              </div>
            </div>

            <!-- Notes List -->
            <div class="space-y-2">
              <div v-if="contact.notes && contact.notes.length > 0">
                <div v-for="(note, index) in contact.notes" :key="index" class="flex gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div class="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {{ note.created_by?.firstName?.[0] || 'U' }}{{ note.created_by?.lastName?.[0] || '' }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 mb-1">
                      <span class="font-semibold text-gray-900 dark:text-white text-xs">{{ note.created_by?.firstName || 'Unknown' }} {{ note.created_by?.lastName || '' }}</span>
                      <span class="text-xs text-gray-500 dark:text-gray-400">• {{ formatTimeAgo(note.created_at) }}</span>
                    </div>
                    <p class="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{{ note.text }}</p>
                  </div>
                </div>
              </div>

              <!-- Empty State -->
              <div v-else class="text-center py-8">
                <div class="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg class="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
                  </svg>
                </div>
                <p class="text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">No activity yet</p>
                <p class="text-gray-400 dark:text-gray-500 text-xs">Click "Add" to start tracking</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <ContactFormModal 
      v-if="showEditModal"
      :contact="contact"
      @close="showEditModal = false"
      @saved="handleContactUpdated"
    />

    <!-- Event Form Modal -->
    <EventFormModal
      :is-open="showEventModal"
      :event="eventToEdit"
      @close="showEventModal = false"
      @saved="handleEventSaved"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import ContactFormModal from '@/components/contacts/ContactFormModal.vue';
import RelatedEventsWidget from '@/components/events/RelatedEventsWidget.vue';
import EventFormModal from '@/components/events/EventFormModal.vue';
import RelatedDealsWidget from '@/components/deals/RelatedDealsWidget.vue';
import RelatedTasksWidget from '@/components/tasks/RelatedTasksWidget.vue';
import RelatedOrganizationWidget from '@/components/organizations/RelatedOrganizationWidget.vue';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

// Use tabs composable
const { openTab } = useTabs();

const contact = ref(null);
const loading = ref(true);
const error = ref(null);
const showEditModal = ref(false);
const showNoteForm = ref(false);
const newNote = ref('');
const showEventModal = ref(false);
const eventsWidgetRef = ref(null);
const eventToEdit = ref(null);
const dealsWidgetRef = ref(null);
const tasksWidgetRef = ref(null);

const fetchContact = async () => {
  loading.value = true;
  error.value = null;
  
  try {
    const isAdmin = authStore.isOwner || authStore.userRole === 'admin';
    const endpoint = isAdmin 
      ? `/admin/contacts/${route.params.id}`
      : `/contacts/${route.params.id}`;
    
    const data = await apiClient(endpoint, {
      method: 'GET'
    });
    
    if (data.success) {
      contact.value = data.data;
      console.log('Contact loaded:', contact.value);
      console.log('Organization field:', contact.value.organization);
      console.log('Related deals:', contact.value.relatedDeals);
    }
  } catch (err) {
    console.error('Error fetching contact:', err);
    error.value = err.message || 'Failed to load contact';
  } finally {
    loading.value = false;
  }
};

const getInitials = () => {
  if (!contact.value) return '';
  return `${contact.value.first_name?.[0] || ''}${contact.value.last_name?.[0] || ''}`.toUpperCase();
};

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const formatTimeAgo = (date) => {
  if (!date) return '';
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  
  if (seconds < 60) return `${seconds} secs ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} mins ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
};

const editContact = () => {
  showEditModal.value = true;
};

const handleContactUpdated = () => {
  showEditModal.value = false;
  fetchContact();
};

const deleteContact = async () => {
  if (!confirm('Are you sure you want to delete this contact?')) return;
  
  try {
    await apiClient(`/contacts/${route.params.id}`, {
      method: 'DELETE'
    });
    router.push('/contacts');
  } catch (err) {
    console.error('Error deleting contact:', err);
    alert('Failed to delete contact');
  }
};

const addNote = async () => {
  if (!newNote.value.trim()) return;
  
  try {
    const data = await apiClient.post(`/contacts/${route.params.id}/notes`, {
      text: newNote.value.trim()
    });
    
    if (data.success) {
      contact.value = data.data;
      newNote.value = '';
      showNoteForm.value = false;
    }
  } catch (err) {
    console.error('Error adding note:', err);
    alert('Failed to add note');
  }
};

const openCreateEvent = () => {
  eventToEdit.value = {
    relatedTo: {
      type: 'Contact',
      id: contact.value._id
    }
  };
  showEventModal.value = true;
};

const viewEvent = (eventId) => {
  openTab(`/events/${eventId}`, {
    title: 'Event Detail',
    icon: '📅'
  });
};

const handleEventSaved = () => {
  showEventModal.value = false;
  eventToEdit.value = null;
  if (eventsWidgetRef.value) {
    eventsWidgetRef.value.refresh();
  }
};

// Organization methods
const viewOrganization = (organizationId) => {
  // Get organization name if available
  const orgName = contact.value?.organization?.name || 'Organization Detail';
  
  openTab(`/organizations/${organizationId}`, {
    title: orgName,
    icon: '🏢',
    params: { name: orgName }
  });
};

const unlinkOrganization = async () => {
  if (!confirm('Are you sure you want to unlink this organization?')) return;
  
  try {
    const response = await apiClient.put(`/contacts/${contact.value._id}`, {
      organization: null
    });
    
    if (response.success) {
      contact.value.organization = null;
    }
  } catch (error) {
    console.error('Error unlinking organization:', error);
    alert('Failed to unlink organization');
  }
};

// Deal methods
const openCreateDeal = () => {
  // Navigate to deals page with contact pre-selected
  router.push({
    path: '/deals',
    query: { createNew: 'true', contactId: contact.value._id }
  });
};

const viewDeal = (dealId) => {
  openTab(`/deals/${dealId}`, {
    title: 'Deal Detail',
    icon: '💼'
  });
};

// Task methods
const openCreateTask = () => {
  // Navigate to tasks page with contact pre-selected
  router.push({
    path: '/tasks',
    query: { createNew: 'true', contactId: contact.value._id }
  });
};

const viewTask = (taskId) => {
  openTab(`/tasks/${taskId}`, {
    title: 'Task Detail',
    icon: '✅'
  });
};

onMounted(() => {
  fetchContact();
});
</script>
