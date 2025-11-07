<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 border-t-brand-600 dark:border-t-brand-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-gray-600 dark:text-gray-400 font-medium">Loading deal...</p>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="flex items-center justify-center min-h-screen p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Error Loading Deal</h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">{{ error }}</p>
        <button @click="$router.push('/deals')" class="px-6 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 font-medium">
          Back to Deals
        </button>
      </div>
    </div>

    <!-- Deal Detail -->
    <div v-else-if="deal" class="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
      <!-- Header Actions -->
      <div class="flex items-center justify-between mb-4">
        <button @click="$router.push('/deals')" class="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span class="font-medium">Back</span>
        </button>

        <div class="flex items-center gap-2">
          <button @click="editDeal" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-gray-700 dark:text-gray-300 transition-all">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
          <button @click="deleteDeal" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-all">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      </div>

      <!-- Main Content Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <!-- Left Column - Deal Info Card -->
        <div class="lg:col-span-1">
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <!-- Deal Header -->
            <div class="mb-4">
              <div class="flex items-start justify-between mb-3">
                <div class="flex-1">
                  <h1 class="text-lg font-bold text-gray-900 dark:text-white mb-1">
                    {{ deal.name }}
                  </h1>
                  <p class="text-2xl font-bold text-green-600 dark:text-green-400">
                    ${{ deal.amount?.toLocaleString() || 0 }}
                  </p>
                </div>
              </div>
              
              <div class="flex items-center gap-2 mb-2">
                <span 
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  :class="getStageClass(deal.stage)"
                >
                  {{ deal.stage }}
                </span>
                <span 
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  :class="getStatusClass(deal.status)"
                >
                  {{ deal.status }}
                </span>
              </div>

              <div class="flex items-center gap-2">
                <span 
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  :class="getPriorityClass(deal.priority)"
                >
                  {{ deal.priority || 'Medium' }}
                </span>
                <div class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    class="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all"
                    :style="{ width: `${deal.probability || 0}%` }"
                  ></div>
                </div>
                <span class="text-xs font-medium text-gray-600 dark:text-gray-400">{{ deal.probability || 0 }}%</span>
              </div>
            </div>

            <!-- Contact Info -->
            <div v-if="deal.contactId" class="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div class="flex items-center gap-2 mb-2">
                <svg class="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span class="text-xs font-medium text-gray-500 dark:text-gray-400">Contact</span>
              </div>
              <p class="text-sm font-semibold text-gray-900 dark:text-white">
                {{ deal.contactId.first_name }} {{ deal.contactId.last_name }}
              </p>
              <p class="text-xs text-gray-600 dark:text-gray-400">{{ deal.contactId.email }}</p>
            </div>

            <!-- Quick Info -->
            <div class="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div v-if="deal.ownerId" class="flex items-start gap-2">
                <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <div class="flex-1">
                  <p class="text-xs text-gray-500 dark:text-gray-400">Owner</p>
                  <p class="text-xs font-medium text-gray-900 dark:text-white">
                    {{ deal.ownerId.firstName }} {{ deal.ownerId.lastName }}
                  </p>
                </div>
              </div>

              <div v-if="deal.type" class="flex items-start gap-2">
                <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <div class="flex-1">
                  <p class="text-xs text-gray-500 dark:text-gray-400">Type</p>
                  <p class="text-xs font-medium text-gray-900 dark:text-white">{{ deal.type }}</p>
                </div>
              </div>

              <div v-if="deal.source" class="flex items-start gap-2">
                <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <div class="flex-1">
                  <p class="text-xs text-gray-500 dark:text-gray-400">Source</p>
                  <p class="text-xs font-medium text-gray-900 dark:text-white">{{ deal.source }}</p>
                </div>
              </div>

              <div v-if="deal.expectedCloseDate" class="flex items-start gap-2">
                <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div class="flex-1">
                  <p class="text-xs text-gray-500 dark:text-gray-400">Expected Close</p>
                  <p class="text-xs font-medium text-gray-900 dark:text-white">{{ formatDate(deal.expectedCloseDate) }}</p>
                </div>
              </div>

              <div class="flex items-start gap-2">
                <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div class="flex-1">
                  <p class="text-xs text-gray-500 dark:text-gray-400">Created</p>
                  <p class="text-xs font-medium text-gray-900 dark:text-white">{{ formatDate(deal.createdAt) }}</p>
                </div>
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
                  <p class="text-xs text-gray-600 dark:text-gray-400 font-medium">Weighted</p>
                  <p class="text-xl font-bold text-gray-900 dark:text-white mt-0.5">
                    ${{ ((deal.amount || 0) * (deal.probability || 0) / 100).toLocaleString() }}
                  </p>
                </div>
                <div class="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <svg class="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-xs text-gray-600 dark:text-gray-400 font-medium">Notes</p>
                  <p class="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{{ deal.notes?.length || 0 }}</p>
                </div>
                <div class="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                </div>
              </div>
            </div>

            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-xs text-gray-600 dark:text-gray-400 font-medium">Age</p>
                  <p class="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{{ getDealAge() }}d</p>
                </div>
                <div class="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                  <svg class="w-4 h-4 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <!-- Description -->
          <div v-if="deal.description" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h3 class="text-base font-bold text-gray-900 dark:text-white mb-2">Description</h3>
            <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{{ deal.description }}</p>
          </div>

          <!-- Stage History -->
          <div v-if="deal.stageHistory && deal.stageHistory.length > 0" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h3 class="text-base font-bold text-gray-900 dark:text-white mb-3">Stage History</h3>
            <div class="space-y-2">
              <div v-for="(history, index) in deal.stageHistory.slice(0, 5)" :key="index" class="flex items-center gap-2 text-xs">
                <div class="w-2 h-2 rounded-full bg-brand-600 dark:bg-brand-500"></div>
                <span class="font-medium text-gray-900 dark:text-white">{{ history.stage }}</span>
                <span class="text-gray-500 dark:text-gray-400">•</span>
                <span class="text-gray-600 dark:text-gray-400">{{ formatDate(history.changedAt) }}</span>
                <span v-if="history.changedBy" class="text-gray-500 dark:text-gray-400">by {{ history.changedBy.firstName }}</span>
              </div>
            </div>
          </div>

          <!-- Related Events -->
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-base font-bold text-gray-900 dark:text-white">Events</h3>
              <button @click="openCreateEvent" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium transition-colors">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Event
              </button>
            </div>
            
            <RelatedEventsWidget
              v-if="deal._id"
              related-type="Deal"
              :related-id="deal._id"
              :limit="5"
              @create-event="openCreateEvent"
              @view-event="viewEvent"
              ref="eventsWidgetRef"
            />
          </div>

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
              <div v-if="deal.notes && deal.notes.length > 0">
                <div v-for="(note, index) in deal.notes" :key="index" class="flex gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div class="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {{ note.createdBy?.firstName?.[0] || 'U' }}{{ note.createdBy?.lastName?.[0] || '' }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 mb-1">
                      <span class="font-semibold text-gray-900 dark:text-white text-xs">
                        {{ note.createdBy?.firstName || 'Unknown' }} {{ note.createdBy?.lastName || '' }}
                      </span>
                      <span class="text-xs text-gray-500 dark:text-gray-400">• {{ formatTimeAgo(note.createdAt) }}</span>
                    </div>
                    <p class="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{{ note.text }}</p>
                  </div>
                </div>
              </div>

              <!-- Empty State -->
              <div v-else class="text-center py-8">
                <div class="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg class="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
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

    <!-- Edit Drawer -->
    <CreateRecordDrawer 
      :isOpen="showEditModal"
      moduleKey="deals"
      :record="deal"
      @close="showEditModal = false"
      @saved="handleDealUpdated"
    />

    <!-- Event Form Drawer -->
    <CreateRecordDrawer
      :isOpen="showEventModal"
      moduleKey="events"
      :record="eventToEdit"
      @close="showEventModal = false"
      @saved="handleEventSaved"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import CreateRecordDrawer from '@/components/common/CreateRecordDrawer.vue';
import RelatedEventsWidget from '@/components/events/RelatedEventsWidget.vue';

const route = useRoute();
const router = useRouter();

// Use tabs composable
const { openTab } = useTabs();

const deal = ref(null);
const loading = ref(true);
const error = ref(null);
const showEditModal = ref(false);
const showNoteForm = ref(false);
const newNote = ref('');
const showEventModal = ref(false);
const eventToEdit = ref(null);
const eventsWidgetRef = ref(null);

const fetchDeal = async () => {
  loading.value = true;
  error.value = null;
  
  try {
    const data = await apiClient.get(`/deals/${route.params.id}`);
    
    if (data.success) {
      deal.value = data.data;
      console.log('Deal loaded:', deal.value);
    }
  } catch (err) {
    console.error('Error fetching deal:', err);
    error.value = err.message || 'Failed to load deal';
  } finally {
    loading.value = false;
  }
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

const getDealAge = () => {
  if (!deal.value?.createdAt) return 0;
  const days = Math.floor((new Date() - new Date(deal.value.createdAt)) / (1000 * 60 * 60 * 24));
  return days;
};

const getStageClass = (stage) => {
  const classes = {
    'Qualification': 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
    'Proposal': 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
    'Negotiation': 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
    'Contract Sent': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
    'Closed Won': 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    'Closed Lost': 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
  };
  return classes[stage] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
};

const getStatusClass = (status) => {
  const classes = {
    'Open': 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    'Won': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300',
    'Lost': 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
    'Stalled': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
  };
  return classes[status] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
};

const getPriorityClass = (priority) => {
  const classes = {
    'High': 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
    'Medium': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
    'Low': 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
  };
  return classes[priority] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
};

const editDeal = () => {
  showEditModal.value = true;
};

const handleDealUpdated = () => {
  showEditModal.value = false;
  fetchDeal();
};

const deleteDeal = async () => {
  if (!confirm('Are you sure you want to delete this deal?')) return;
  
  try {
    await apiClient.delete(`/deals/${route.params.id}`);
    router.push('/deals');
  } catch (err) {
    console.error('Error deleting deal:', err);
    alert('Failed to delete deal');
  }
};

const addNote = async () => {
  if (!newNote.value.trim()) return;
  
  try {
    const data = await apiClient.post(`/deals/${route.params.id}/notes`, {
      text: newNote.value.trim()
    });
    
    if (data.success) {
      deal.value = data.data;
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
      type: 'Deal',
      id: deal.value._id
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

onMounted(() => {
  fetchDeal();
});

// Watch for route param changes to reload data when switching tabs
watch(() => route.params.id, (newId, oldId) => {
  if (newId && newId !== oldId) {
    fetchDeal();
  }
}, { immediate: false });
</script>
