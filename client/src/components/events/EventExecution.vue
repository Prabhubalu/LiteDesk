<template>
  <div class="space-y-6">
    <!-- Execution Status Card -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('events.eventExecutionEventExecution') }}</h3>
        <span :class="getStatusBadgeClass(event.status)">{{ event.status }}</span>
      </div>

      <!-- Execution Actions -->
      <div v-if="event.status === 'PLANNED' && !isAuditEvent" class="space-y-3">
        <button
          @click="startEvent"
          :disabled="starting"
          class="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>{{ t('events.eventExecutionStartEvent') }}</button>
      </div>

      <!-- Check-In for Audit Events (when auditState = Ready to start) -->
      <div v-if="isAuditEvent && event.auditState === 'Ready to start' && !isReadOnly" class="space-y-3">
        <div class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p class="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">{{ t('events.eventExecutionReadyToStartAudit') }}</p>
          <p class="text-xs text-blue-700 dark:text-blue-400">{{ t('events.eventExecutionCheckInToBeginTheAudit') }}</p>
          <p v-if="event.geoRequired && !currentLocation" class="text-xs text-yellow-700 dark:text-yellow-400 mt-2">{{ t('events.eventExecutionWaitingForGpsLocation') }}</p>
        </div>
        <button
          @click="checkIn"
          :disabled="checkingIn || (event.geoRequired && !currentLocation)"
          class="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>{{ t('events.eventExecutionCheckIn3') }}</button>
      </div>

      <!-- Check-In/Check-Out (GEO Mode) -->
      <div v-if="!isReadOnly && event.geoRequired && (event.status === 'STARTED' || event.status === 'CHECKED_OUT')" class="space-y-3">
        <div v-if="!isCheckedIn" class="space-y-3">
          <div class="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p class="text-sm text-yellow-800 dark:text-yellow-300 mb-2">
              <strong>{{ t('events.eventExecutionGeoCheckInRequired') }}</strong>
            </p>
            <p class="text-xs text-yellow-700 dark:text-yellow-400">
              You must check in at the event location to proceed. GPS accuracy: {{ gpsAccuracy ? `${Math.round(gpsAccuracy)}m` : 'Checking...' }}
            </p>
          </div>
          <button
            @click="checkIn"
            :disabled="checkingIn || !currentLocation"
            class="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>{{ t('events.eventExecutionCheckIn2') }}</button>
        </div>

        <div v-else-if="event.status !== 'CHECKED_OUT'" class="space-y-3">
          <div class="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p class="text-sm text-green-800 dark:text-green-300">
              <strong>{{ t('events.eventExecutionCheckedIn') }}</strong> at {{ formatTime(event.checkIn?.timestamp) }}
            </p>
            <p v-if="event.checkIn?.location" class="text-xs text-green-700 dark:text-green-400 mt-1">
              Location: {{ event.checkIn.location.latitude.toFixed(6) }}, {{ event.checkIn.location.longitude.toFixed(6) }}
            </p>
          </div>
          <!-- Only show checkout button if form is not submitted yet (for GEO events) -->
          <button
            v-if="!isFormSubmitted"
            @click="checkOut"
            :disabled="checkingOut"
            class="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>{{ t('events.eventExecutionCheckOut') }}</button>
        </div>
      </div>

      <!-- Multi-Org Route Progress -->
      <div v-if="event.isMultiOrg && event.orgList && event.orgList.length > 0" class="mt-6 space-y-4">
        <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('events.eventExecutionRouteProgress') }}</h4>
        <div class="space-y-2">
          <div
            v-for="(org, index) in event.orgList"
            :key="index"
            class="flex items-center gap-3 p-3 rounded-lg border"
            :class="getOrgStatusClass(org.status)"
          >
            <div class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                 :class="getOrgStatusBadgeClass(org.status)">
              {{ org.sequence }}
            </div>
            <div class="flex-1">
              <div class="text-sm font-medium text-gray-900 dark:text-white">
                {{ getOrgName(org.organizationId) }}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400">
                Status: {{ org.status }}
                <span v-if="org.checkIn?.timestamp">
                  • Checked in: {{ formatTime(org.checkIn.timestamp) }}
                </span>
              </div>
            </div>
            <button
              v-if="org.status === 'PENDING' && index === event.currentOrgIndex"
              @click="checkInOrg(org.sequence)"
              :disabled="checkingIn"
              class="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            >{{ t('events.eventExecutionCheckIn') }}</button>
            <button
              v-if="org.status === 'IN_PROGRESS'"
              @click="moveToNextOrg"
              :disabled="moving"
              class="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >{{ t('actions.next') }}</button>
          </div>
        </div>
      </div>

      <!-- Form Submission -->
      <div v-if="requiresAuditForm && !isReadOnly && isCheckedIn && (event.auditState === 'checked_in' || event.auditState === 'submitted' || event.status === 'SUBMITTED' || event.status === 'CHECKED_OUT' || isFormSubmitted)" class="mt-6 space-y-3">
        <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.modFieldsPbResourceForm') }}</h4>
        <div v-if="linkedFormIdValue" class="space-y-2">
          <!-- Show "Open Response" button when form is submitted -->
          <div v-if="isFormSubmitted || event.auditState === 'submitted' || event.status === 'SUBMITTED' || event.status === 'CHECKED_OUT'" class="space-y-3">
            <div class="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div class="flex items-center gap-2 mb-2">
                <svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <p class="text-sm font-medium text-green-800 dark:text-green-300">{{ t('events.eventExecutionFormSubmitted') }}</p>
              </div>
              <p class="text-xs text-green-700 dark:text-green-400">{{ t('events.eventExecutionTheFormHasBeenSuccessfullySubmitted') }}</p>
            </div>
            <button
              v-if="hasFormResponse"
              @click="viewFormResponse"
              class="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>{{ t('events.eventExecutionOpenResponse') }}</button>
          </div>
          
          <!-- Show "Open Form" when checked in but not submitted -->
          <template v-else-if="event.auditState === 'checked_in' && !isFormSubmitted">
            <div class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg mb-3">
              <p class="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">{{ t('settings.modFieldsPbResourceForm') }}</p>
              <p class="text-xs text-blue-700 dark:text-blue-400">{{ t('events.eventExecutionOpenTheFormToFillAnd') }}</p>
            </div>
            <button
              @click="openAuditForm"
              class="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>{{ t('events.eventExecutionOpenForm') }}</button>
          </template>
        </div>
        <p v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('events.eventExecutionNoFormLinkedToThisEvent') }}</p>
      </div>

      <!-- Field Sales Actions -->
      <div v-if="!isReadOnly && event.eventType === 'Field Sales Beat' && isCheckedIn" class="mt-6 space-y-3">
        <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('events.eventExecutionSalesActions') }}</h4>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-if="event.allowedActions?.orders"
            @click="createOrder"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >{{ t('events.eventExecutionCreateOrder') }}</button>
          <button
            v-if="event.allowedActions?.payments"
            @click="collectPayment"
            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
          >{{ t('events.eventExecutionCollectPayment') }}</button>
        </div>
      </div>

      <!-- Complete Event -->
      <div v-if="canComplete" class="mt-6">
        <button
          @click="completeEvent"
          :disabled="completing"
          class="w-full px-4 py-3 bg-gray-800 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-900 dark:hover:bg-gray-600 font-medium transition-colors disabled:opacity-50"
        >{{ t('events.eventExecutionCompleteEvent') }}</button>
      </div>
    </div>

      <!-- Offline Indicator -->
      <div v-if="!isOnline" class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
        <div class="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-300">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{{ t('events.eventExecutionYouAreOfflineActionsWillBe') }}</span>
        </div>
      </div>

      <!-- GPS Status & Map -->
      <div v-if="event.geoRequired" class="space-y-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('events.eventExecutionGpsStatus') }}</h4>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">{{ t('events.eventExecutionStatus') }}</span>
            <span :class="gpsStatus === 'active' ? 'text-green-600' : 'text-red-600'">
              {{ gpsStatus === 'active' ? 'Active' : 'Inactive' }}
            </span>
          </div>
          <div v-if="currentLocation" class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">{{ t('events.eventExecutionCurrentLocation') }}</span>
            <span class="text-gray-900 dark:text-white">
              {{ currentLocation.latitude.toFixed(6) }}, {{ currentLocation.longitude.toFixed(6) }}
            </span>
          </div>
          <div v-if="gpsAccuracy" class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">{{ t('events.eventExecutionAccuracy') }}</span>
            <span class="text-gray-900 dark:text-white">{{ Math.round(gpsAccuracy) }}m</span>
          </div>
        </div>
      </div>
      
      <!-- Map View -->
      <EventMapView :event="event" :currentLocation="currentLocation" />
    </div>

    <!-- Order Creation Modal -->
    <OrderCreationModal
      :isOpen="showOrderModal"
      :event="event"
      :orgIndex="event.isMultiOrg ? event.currentOrgIndex : null"
      @close="showOrderModal = false"
      @created="handleOrderCreated"
    />

    <!-- Payment Collection Modal -->
    <PaymentCollectionModal
      :isOpen="showPaymentModal"
      :event="event"
      :orgIndex="event.isMultiOrg ? event.currentOrgIndex : null"
      @close="showPaymentModal = false"
      @collected="handlePaymentCollected"
    />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import apiClient from '@/utils/apiClient';
import { useRouter } from 'vue-router';
import OrderCreationModal from './OrderCreationModal.vue';
import PaymentCollectionModal from './PaymentCollectionModal.vue';
import EventMapView from './EventMapView.vue';
import { useEventOffline } from '@/composables/useEventOffline';
import { useEventNotifications } from '@/composables/useEventNotifications';

const props = defineProps({
  event: {
    type: Object,
    required: true
  }
});

const { t } = useI18n();

const emit = defineEmits(['updated']);

const router = useRouter();

const starting = ref(false);
const checkingIn = ref(false);
const checkingOut = ref(false);
const submitting = ref(false);
const moving = ref(false);
const completing = ref(false);

const currentLocation = ref(null);
const gpsAccuracy = ref(null);
const gpsStatus = ref('inactive');
const watchId = ref(null);
const organizations = ref([]);

// Offline support
const { isOnline, queueAction, cacheEvent } = useEventOffline();

// Notifications
const { notifyEvent, NotificationTypes: NotifTypes } = useEventNotifications();

// Computed properties
const isCheckedIn = computed(() => {
  if (props.event.isMultiOrg) {
    const currentOrg = props.event.orgList?.[props.event.currentOrgIndex];
    return currentOrg?.checkIn?.timestamp != null;
  }
  return props.event.checkIn?.timestamp != null;
});

// Check if event is an audit event
const isAuditEvent = computed(() => {
  return ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'].includes(props.event.eventType);
});

// Check if event is read-only (approved or closed)
const isReadOnly = computed(() => {
  return props.event.auditState === 'approved' || props.event.auditState === 'closed';
});

const requiresAuditForm = computed(() => {
  return isAuditEvent.value;
});

// Handle linkedFormId whether it's a string ID or populated object
const linkedFormIdValue = computed(() => {
  if (!props.event.linkedFormId) {
    console.log('[EventExecution] No linkedFormId found in event:', {
      eventId: props.event.eventId || props.event._id,
      linkedFormId: props.event.linkedFormId,
      eventKeys: Object.keys(props.event)
    });
    return null;
  }
  // If it's an object (populated), get the _id
  if (typeof props.event.linkedFormId === 'object') {
    // Mongoose populated objects have _id, but handle both _id and direct access
    const formId = props.event.linkedFormId._id || props.event.linkedFormId.id || props.event.linkedFormId;
    console.log('[EventExecution] linkedFormId is object, extracted:', formId, 'from:', props.event.linkedFormId);
    return formId;
  }
  // Otherwise it's already a string ID
  console.log('[EventExecution] linkedFormId is string:', props.event.linkedFormId);
  return props.event.linkedFormId;
});

const formResponseId = ref(null);
const formResponseStatus = ref(null); // Track the execution status of the form response
const hasFormResponse = computed(() => {
  return formResponseId.value !== null;
});
const isFormSubmitted = computed(() => {
  return formResponseStatus.value === 'Submitted';
});

const canComplete = computed(() => {
  if (props.event.isMultiOrg) {
    const allCompleted = props.event.orgList?.every(org => org.status === 'COMPLETED');
    return allCompleted && props.event.status !== 'CLOSED';
  }
  return props.event.status === 'CHECKED_OUT' || props.event.status === 'SUBMITTED';
});

// Methods
const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
};

const startWatchingLocation = () => {
  if (!navigator.geolocation || !props.event.geoRequired) return;

  watchId.value = navigator.geolocation.watchPosition(
    (position) => {
      currentLocation.value = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      };
      gpsAccuracy.value = position.coords.accuracy;
      gpsStatus.value = 'active';
    },
    (error) => {
      console.error('GPS error:', error);
      gpsStatus.value = 'inactive';
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000
    }
  );
};

const stopWatchingLocation = () => {
  if (watchId.value !== null) {
    navigator.geolocation.clearWatch(watchId.value);
    watchId.value = null;
  }
};

const startEvent = async () => {
  try {
    starting.value = true;
    
    let location = null;
    if (props.event.geoRequired) {
      location = await getCurrentLocation();
    }

    const response = await apiClient.post(`/events/${props.event.eventId || props.event._id}/start`, {
      location: location
    });

    if (response.success) {
      emit('updated', response.data);
      cacheEvent(response.data);
      notifyEvent(response.data, NotifTypes.EVENT_STARTED, `Event "${response.data.eventName}" has been started`);
      if (props.event.geoRequired) {
        startWatchingLocation();
      }
    } else {
      alert(response.message || t('events.eventExecutionToastFailedToStartEvent'));
    }
  } catch (error) {
    console.error('Error starting event:', error);
    alert(t('events.eventExecutionToastFailedToStartEvent2') + (error.message || 'Unknown error'));
  } finally {
    starting.value = false;
  }
};

const checkIn = async () => {
  try {
    checkingIn.value = true;
    
    if (!currentLocation.value) {
      currentLocation.value = await getCurrentLocation();
    }

    const response = await apiClient.post(`/events/${props.event.eventId || props.event._id}/check-in`, {
      location: currentLocation.value
    });

    if (response.success) {
      emit('updated', response.data);
      cacheEvent(response.data);
      notifyEvent(response.data, NotifTypes.EVENT_CHECK_IN, `Check-in completed for "${response.data.eventName}"`);
      
      // Event → Response execution handoff
      if (response.formResponseId && response.hasForm && linkedFormIdValue.value) {
        // Redirect immediately to form fill page with query params
        const eventIdValue = props.event.eventId || props.event._id;
        const formId = linkedFormIdValue.value;
        const responseId = response.formResponseId;
        
        console.log('[EventExecution] Redirecting to form with:', {
          formId: formId,
          eventId: eventIdValue,
          responseId: responseId
        });
        
        // Build full URL with query params to ensure they're preserved
        const formUrl = `/forms/${formId}/fill?eventId=${encodeURIComponent(eventIdValue)}&responseId=${encodeURIComponent(responseId)}`;
        console.log('[EventExecution] Full form URL:', formUrl);
        
        // Store responseId in sessionStorage as backup (in case URL params get lost)
        sessionStorage.setItem(`formResponse_${formId}_${eventIdValue}`, responseId);
        console.log('[EventExecution] Stored responseId in sessionStorage:', {
          key: `formResponse_${formId}_${eventIdValue}`,
          value: responseId
        });
        
        // Use window.location.href for absolute reliability (ensures query params are preserved)
        // This causes a full page reload but guarantees query params are in the URL
        window.location.href = formUrl;
      } else if (!response.hasForm) {
        // Show message if no form is assigned
        alert(t('events.eventExecutionToastNoFormIsAssignedTo'));
      }
      
      if (response.warning) {
        alert(response.warning);
      }
    } else {
      // Queue for offline retry
      if (!isOnline.value) {
        queueAction({
          type: 'checkIn',
          eventId: props.event.eventId || props.event._id,
          data: { location: currentLocation.value }
        });
        alert(t('events.eventExecutionToastYouAreOfflineCheckIn'));
      } else {
        alert(response.message || t('events.eventExecutionToastFailedToCheckIn'));
      }
    }
  } catch (error) {
    console.error('Error checking in:', error);
    alert(t('events.eventExecutionToastFailedToCheckIn2') + (error.message || 'Unknown error'));
  } finally {
    checkingIn.value = false;
  }
};

const checkInOrg = async (orgSequence) => {
  try {
    checkingIn.value = true;
    
    if (!currentLocation.value) {
      currentLocation.value = await getCurrentLocation();
    }

    const response = await apiClient.post(`/events/${props.event.eventId || props.event._id}/check-in`, {
      location: currentLocation.value,
      orgIndex: orgSequence
    });

    if (response.success) {
      emit('updated', response.data);
      
      // Event → Response execution handoff
      if (response.formResponseId && response.hasForm && linkedFormIdValue.value) {
        // Redirect immediately to form fill page with query params
        const eventIdValue = props.event.eventId || props.event._id;
        const formId = linkedFormIdValue.value;
        const responseId = response.formResponseId;
        
        console.log('[EventExecution] Redirecting to form (multi-org) with:', {
          formId: formId,
          eventId: eventIdValue,
          responseId: responseId,
          orgIndex: orgSequence
        });
        
        // Build full URL with query params to ensure they're preserved
        const formUrl = `/forms/${formId}/fill?eventId=${encodeURIComponent(eventIdValue)}&responseId=${encodeURIComponent(responseId)}&orgIndex=${encodeURIComponent(orgSequence)}`;
        console.log('[EventExecution] Full form URL (multi-org):', formUrl);
        
        // Store responseId in sessionStorage as backup (in case URL params get lost)
        sessionStorage.setItem(`formResponse_${formId}_${eventIdValue}`, responseId);
        console.log('[EventExecution] Stored responseId in sessionStorage (multi-org):', {
          key: `formResponse_${formId}_${eventIdValue}`,
          value: responseId
        });
        
        // Use window.location.href for absolute reliability (ensures query params are preserved)
        window.location.href = formUrl;
      } else if (!response.hasForm) {
        // Show message if no form is assigned
        alert(t('events.eventExecutionToastNoFormIsAssignedTo2'));
      }
    } else {
      alert(response.message || t('events.eventExecutionToastFailedToCheckIn3'));
    }
  } catch (error) {
    console.error('Error checking in:', error);
    alert(t('events.eventExecutionToastFailedToCheckIn4') + (error.message || 'Unknown error'));
  } finally {
    checkingIn.value = false;
  }
};

const checkOut = async () => {
  try {
    checkingOut.value = true;
    
    // Capture location if GEO is enabled (or if event requires it)
    let location = null;
    if (props.event.geoRequired) {
      try {
        location = await getCurrentLocation();
      } catch (error) {
        console.warn('Could not get location for check-out:', error);
        // For non-GEO events or if location fails, still allow checkout
        if (props.event.status === 'CHECKOUT_PENDING') {
          // Allow checkout without location if form is submitted
          console.log('[EventExecution] Proceeding with checkout without location (form submitted)');
        } else {
          alert(t('events.eventExecutionToastCouldNotGetLocationFor'));
          checkingOut.value = false;
          return;
        }
      }
    }

    const response = await apiClient.post(`/events/${props.event.eventId || props.event._id}/check-out`, {
      location: location
    });

    if (response.success) {
      emit('updated', response.data);
      cacheEvent(response.data);
      notifyEvent(response.data, NotifTypes.EVENT_CHECK_OUT, `Check-out completed for "${response.data.eventName}"`);
      stopWatchingLocation();
    } else {
      // Queue for offline retry
      if (!isOnline.value) {
        queueAction({
          type: 'checkOut',
          eventId: props.event.eventId || props.event._id,
          data: { location: location }
        });
        alert(t('events.eventExecutionToastYouAreOfflineCheckOut'));
      } else {
        alert(response.message || t('events.eventExecutionToastFailedToCheckOut'));
      }
    }
  } catch (error) {
    console.error('Error checking out:', error);
    alert(t('events.eventExecutionToastFailedToCheckOut2') + (error.message || 'Unknown error'));
  } finally {
    checkingOut.value = false;
  }
};

const submitAudit = async () => {
  try {
    submitting.value = true;
    
    if (!formResponseId.value) {
      alert(t('events.eventExecutionToastPleaseFillAndSubmitThe'));
      return;
    }
    
    const response = await apiClient.post(`/events/${props.event.eventId || props.event._id}/submit-audit`, {
      formResponseId: formResponseId.value,
      orgIndex: props.event.isMultiOrg ? props.event.currentOrgIndex : null
    });

    if (response.success) {
      emit('updated', response.data);
      cacheEvent(response.data);
      notifyEvent(response.data, NotifTypes.AUDIT_SUBMITTED, `Audit submitted for "${response.data.eventName}"`);
      // Update form response status to 'Submitted'
      formResponseStatus.value = 'Submitted';
      // Note: Event is automatically checked out on form submission
      if (response.requiresCorrective) {
        alert(t('events.eventExecutionToastAuditSubmittedAndCheckedOut'));
      } else {
        alert(t('events.eventExecutionToastAuditSubmittedSuccessfullyAndYou'));
      }
    } else {
      // Queue for offline retry
      if (!isOnline.value) {
        queueAction({
          type: 'submitAudit',
          eventId: props.event.eventId || props.event._id,
          data: { formResponseId: formResponseId.value }
        });
        alert(t('events.eventExecutionToastYouAreOfflineAuditSubmission'));
      } else {
        alert(response.message || t('events.eventExecutionToastFailedToSubmitAudit'));
      }
    }
  } catch (error) {
    console.error('Error submitting audit:', error);
    alert(t('events.eventExecutionToastFailedToSubmitAudit2') + (error.message || 'Unknown error'));
  } finally {
    submitting.value = false;
  }
};

const viewFormResponse = () => {
  if (!formResponseId.value || !linkedFormIdValue.value) return;
  
  const formId = linkedFormIdValue.value;
  const responseId = formResponseId.value;
  
  // Open form response in a new tab (read-only view)
  const responseUrl = `/forms/${formId}/responses/${responseId}`;
  router.push(responseUrl).catch((err) => {
    console.warn('[EventExecution] Router push failed:', err);
    window.location.href = responseUrl;
  });
};

const moveToNextOrg = async () => {
  try {
    moving.value = true;
    
    const response = await apiClient.post(`/events/${props.event.eventId || props.event._id}/next-org`);

    if (response.success) {
      emit('updated', response.data);
    } else {
      alert(response.message || t('events.eventExecutionToastFailedToMoveToNext'));
    }
  } catch (error) {
    console.error('Error moving to next org:', error);
    alert(t('events.eventExecutionToastFailedToMoveToNext2') + (error.message || 'Unknown error'));
  } finally {
    moving.value = false;
  }
};

const showOrderModal = ref(false);
const showPaymentModal = ref(false);

const createOrder = () => {
  showOrderModal.value = true;
};

const collectPayment = () => {
  showPaymentModal.value = true;
};

const handleOrderCreated = (order) => {
  emit('updated');
  showOrderModal.value = false;
};

const handlePaymentCollected = (payment) => {
  emit('updated');
  showPaymentModal.value = false;
};

const openAuditForm = () => {
  // Disable form reopening after checkout
  if (props.event.status === 'CHECKED_OUT') {
    alert(t('events.eventExecutionToastThisEventHasBeenChecked'));
    return;
  }
  
  const formId = linkedFormIdValue.value;
  if (formId) {
    // Open form in same tab with event context
    const eventIdValue = props.event.eventId || props.event._id;
    
    // Get responseId from formResponseId ref, or from event metadata, or from sessionStorage
    let responseId = formResponseId.value;
    if (!responseId && props.event.metadata?.formResponses && props.event.metadata.formResponses.length > 0) {
      // Use the most recent form response
      responseId = props.event.metadata.formResponses[props.event.metadata.formResponses.length - 1];
    }
    if (!responseId) {
      // Try sessionStorage as fallback
      try {
        const storedResponseId = sessionStorage.getItem(`formResponse_${formId}_${eventIdValue}`);
        if (storedResponseId) {
          responseId = storedResponseId;
        }
      } catch (e) {
        console.warn('[EventExecution] Failed to read responseId from sessionStorage:', e);
      }
    }
    
    console.log('[EventExecution] Opening audit form with:', {
      formId: formId,
      eventId: eventIdValue,
      responseId: responseId
    });
    
    // Build full URL with query params - include responseId if available
    let formUrl = `/forms/${formId}/fill?eventId=${encodeURIComponent(eventIdValue)}`;
    if (responseId) {
      formUrl += `&responseId=${encodeURIComponent(responseId)}`;
    }
    console.log('[EventExecution] Full audit form URL:', formUrl);
    
    // Use router.push with full URL string (Vue Router supports this)
    router.push(formUrl).catch((err) => {
      console.warn('[EventExecution] Router push failed, using window.location:', err);
      // Fallback to window.location if router fails
      window.location.href = formUrl;
    });
    
    // Also listen for form submission via storage event (for cross-tab)
    const handleStorageChange = (e) => {
      if (e.key === `formResponse_${formId}` && e.newValue) {
        try {
          const response = JSON.parse(e.newValue);
          if (response.eventId === (props.event.eventId || props.event._id)) {
            formResponseId.value = response.responseId;
            // Fetch the status to check if form is already submitted
            fetchFormResponseStatus(response.responseId);
            // Refresh event data
            fetchEvent();
          }
        } catch (err) {
          console.error('Error parsing form response:', err);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for same-tab storage events
    const handleSameTabStorage = (e) => {
      if (e.key === `formResponse_${formId}` && e.newValue) {
        try {
          const response = JSON.parse(e.newValue);
          if (response.eventId === (props.event.eventId || props.event._id)) {
            formResponseId.value = response.responseId;
            // Fetch the status to check if form is already submitted
            fetchFormResponseStatus(response.responseId);
            // Refresh event data
            fetchEvent();
          }
        } catch (err) {
          console.error('Error parsing form response:', err);
        }
      }
    };
    window.addEventListener('storage', handleSameTabStorage);
  }
};

const fetchEvent = async () => {
  try {
    const response = await apiClient.get(`/events/${props.event.eventId || props.event._id}`);
    if (response.success) {
      emit('updated', response.data);
    }
  } catch (error) {
    console.error('Error fetching event:', error);
  }
};

const completeEvent = async () => {
  if (!confirm('Are you sure you want to complete this event?')) return;

  try {
    completing.value = true;
    
    const response = await apiClient.post(`/events/${props.event.eventId || props.event._id}/complete`);

    if (response.success) {
      emit('updated', response.data);
      cacheEvent(response.data);
      notifyEvent(response.data, NotifTypes.EVENT_COMPLETED, `Event "${response.data.eventName}" has been completed`);
      alert(t('events.eventExecutionToastEventCompletedSuccessfully'));
    } else {
      // Queue for offline retry
      if (!isOnline.value) {
        queueAction({
          type: 'completeEvent',
          eventId: props.event.eventId || props.event._id,
          data: {}
        });
        alert(t('events.eventExecutionToastYouAreOfflineEventCompletion'));
      } else {
        alert(response.message || t('events.eventExecutionToastFailedToCompleteEvent'));
      }
    }
  } catch (error) {
    console.error('Error completing event:', error);
    alert(t('events.eventExecutionToastFailedToCompleteEvent2') + (error.message || 'Unknown error'));
  } finally {
    completing.value = false;
  }
};

const getStatusBadgeClass = (status) => {
  const classes = {
    PLANNED: 'px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-full text-xs font-medium',
    STARTED: 'px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium',
    CHECKED_IN: 'px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-xs font-medium',
    IN_PROGRESS: 'px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded-full text-xs font-medium',
    CHECKOUT_PENDING: 'px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded-full text-xs font-medium',
    CHECKED_OUT: 'px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-full text-xs font-medium',
    SUBMITTED: 'px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full text-xs font-medium',
    CLOSED: 'px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-full text-xs font-medium'
  };
  return classes[status] || classes.PLANNED;
};

const getOrgStatusClass = (status) => {
  const classes = {
    PENDING: 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700',
    IN_PROGRESS: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    COMPLETED: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    SKIPPED: 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 opacity-50'
  };
  return classes[status] || classes.PENDING;
};

const getOrgStatusBadgeClass = (status) => {
  const classes = {
    PENDING: 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
    IN_PROGRESS: 'bg-blue-600 text-white',
    COMPLETED: 'bg-green-600 text-white',
    SKIPPED: 'bg-gray-400 text-white'
  };
  return classes[status] || classes.PENDING;
};

const getOrgName = (orgId) => {
  if (typeof orgId === 'object' && orgId?.name) {
    return orgId.name;
  }
  const org = organizations.value.find(o => o._id === orgId);
  return org?.name || 'Organization';
};

const formatTime = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleString();
};

const fetchOrganizations = async () => {
  try {
    const response = await apiClient.get('/organization');
    if (response.success) {
      organizations.value = response.data || [];
    }
  } catch (error) {
    console.error('Error fetching organizations:', error);
  }
};

// Watch for event changes to debug linkedFormId
watch(() => props.event, (newEvent) => {
  console.log('[EventExecution] Event updated:', {
    eventId: newEvent?.eventId || newEvent?._id,
    linkedFormId: newEvent?.linkedFormId,
    linkedFormIdType: typeof newEvent?.linkedFormId,
    linkedFormIdValue: linkedFormIdValue.value,
    isCheckedIn: isCheckedIn.value,
    requiresAuditForm: requiresAuditForm.value,
    status: newEvent?.status
  });
}, { immediate: true, deep: true });

onMounted(() => {
  // Start location watching if:
  // 1. Event requires GEO AND (status is STARTED OR already checked in), OR
  // 2. Event is an audit event in "Ready to start" state (needs location for check-in)
  const shouldWatchLocation = props.event.geoRequired && (
    props.event.status === 'STARTED' || 
    isCheckedIn.value ||
    (isAuditEvent.value && props.event.auditState === 'Ready to start')
  );
  
  if (shouldWatchLocation) {
    startWatchingLocation();
    getCurrentLocation().then(loc => {
      currentLocation.value = loc;
    }).catch(err => {
      console.error('Error getting initial location:', err);
    });
  }
  
  if (props.event.isMultiOrg) {
    fetchOrganizations();
  }
  
  // Check for form response when component mounts (e.g., returning from form fill)
  if (linkedFormIdValue.value) {
    checkForFormResponse();
    // Also check if event already has form responses in metadata
    loadExistingFormResponse();
  }
  
  // Listen for form submission notifications
  const handleFormResponse = (e) => {
    if (e.key && e.key.startsWith('formResponse_')) {
      try {
        const notification = JSON.parse(e.newValue || localStorage.getItem(e.key));
        if (notification.eventId === (props.event.eventId || props.event._id)) {
        // Only update if responseId changed to prevent loops
        if (formResponseId.value !== notification.responseId) {
          console.log('[EventExecution] Form response notification received:', notification.responseId);
          formResponseId.value = notification.responseId;
          // Fetch the status to check if form is already submitted
          fetchFormResponseStatus(notification.responseId);
          // Don't call fetchEvent here - let the parent handle updates through normal flow
          // The parent will fetch when needed (e.g., on user action or page refresh)
        }
        }
      } catch (err) {
        console.error('Error parsing form response notification:', err);
      }
    }
  };
  
  window.addEventListener('storage', handleFormResponse);
  
  // Also check on focus (when returning from form fill tab) - but with debounce
  let focusCheckTimeout = null;
  window.addEventListener('focus', () => {
    if (focusCheckTimeout) clearTimeout(focusCheckTimeout);
    focusCheckTimeout = setTimeout(() => {
      checkForFormResponse();
    }, 500); // Debounce focus checks
  });
});

// Guard to prevent infinite loops
let isCheckingFormResponse = false;
let lastCheckedTimestamp = 0;
const CHECK_INTERVAL = 2000; // Only check once every 2 seconds

const checkForFormResponse = () => {
  const formId = linkedFormIdValue.value;
  if (!formId) return;
  
  // Prevent infinite loops - don't check if already checking or checked recently
  const now = Date.now();
  if (isCheckingFormResponse || (now - lastCheckedTimestamp < CHECK_INTERVAL)) {
    console.log('[EventExecution] Skipping checkForFormResponse - already checking or too soon');
    return;
  }
  
  isCheckingFormResponse = true;
  lastCheckedTimestamp = now;
  
  try {
    const key = `formResponse_${formId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const notification = JSON.parse(stored);
      if (notification.eventId === (props.event.eventId || props.event._id)) {
        // Only update if responseId changed
        if (formResponseId.value !== notification.responseId) {
          console.log('[EventExecution] Form response found, updating responseId:', notification.responseId);
          formResponseId.value = notification.responseId;
          // Fetch the status to check if form is already submitted
          fetchFormResponseStatus(notification.responseId);
          // Don't call fetchEvent here - let the parent handle updates
          // fetchEvent() will be called by the parent when needed
        }
      }
    }
  } catch (err) {
    console.error('Error checking for form response:', err);
  } finally {
    isCheckingFormResponse = false;
  }
};

// Function to fetch form response status
const fetchFormResponseStatus = async (responseId) => {
  const formId = linkedFormIdValue.value;
  if (!formId || !responseId) return;
  
  try {
    const response = await apiClient.get(`/forms/${formId}/responses/${responseId}`);
    if (response.success && response.data) {
      formResponseStatus.value = response.data.executionStatus || null;
      console.log('[EventExecution] Fetched form response status:', {
        responseId: responseId,
        executionStatus: formResponseStatus.value
      });
    }
  } catch (err) {
    console.warn('[EventExecution] Error fetching form response status:', err);
  }
};

const loadExistingFormResponse = async () => {
  const formId = linkedFormIdValue.value;
  if (!formId) return;
  
  // Check if event already has form responses in metadata
  if (props.event.metadata?.formResponses && props.event.metadata.formResponses.length > 0) {
    // Use the most recent form response (last in array)
    const latestResponseId = props.event.metadata.formResponses[props.event.metadata.formResponses.length - 1];
    
    // Verify the form response exists and belongs to the correct form
    try {
      const response = await apiClient.get(`/forms/${formId}/responses/${latestResponseId}`);
      if (response.success && response.data) {
        formResponseId.value = latestResponseId;
        // Store the execution status to check if form is already submitted
        formResponseStatus.value = response.data.executionStatus || null;
        console.log('[EventExecution] Loaded existing form response:', {
          responseId: latestResponseId,
          executionStatus: formResponseStatus.value
        });
      }
    } catch (err) {
      console.error('Error loading existing form response:', err);
      // If form response doesn't exist, it will be cleaned up by backend on next access
    }
  }
  
  // Also check if we have a responseId from other sources (e.g., from check-in)
  if (formResponseId.value && !formResponseStatus.value) {
    await fetchFormResponseStatus(formResponseId.value);
  }
};

// Watch for formResponseId changes and fetch status
watch(() => formResponseId.value, async (newResponseId) => {
  if (newResponseId && !formResponseStatus.value) {
    await fetchFormResponseStatus(newResponseId);
  }
});

onUnmounted(() => {
  stopWatchingLocation();
});
</script>

