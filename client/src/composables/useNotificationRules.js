import { ref, computed } from 'vue';
import apiClient from '@/utils/apiClient';
import { fetchModulesListCached, parseModulesListResponse } from '@/utils/tenantSchemaApiCache';
import { useNotificationStore } from '@/stores/notifications';
import { useNotificationPreferencesStore } from '@/stores/notificationPreferences';

/**
 * Composable for notification rules API calls
 * Phase 17: User-Defined Notification Rules UI
 */
export function useNotificationRules() {
  const notificationStore = useNotificationStore();
  const prefsStore = useNotificationPreferencesStore();
  
  const loading = ref(false);
  const error = ref(null);
  const rules = ref([]);

  const currentAppKey = computed(() => {
    const appKey = notificationStore.currentAppKey();
    // Map CRM to SALES (they're the same)
    if (appKey === 'CRM') return 'SALES';
    return appKey || 'SALES';
  });

  /**
   * Fetch all notification rules for current app
   */
  async function fetchRules() {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await apiClient.get('/notification-rules', {
        params: { appKey: currentAppKey.value }
      });
      
      // Handle different response formats
      // apiClient returns the parsed JSON directly
      if (response?.success) {
        rules.value = Array.isArray(response.data) ? response.data : [];
      } else if (response?.data?.success) {
        rules.value = Array.isArray(response.data.data) ? response.data.data : [];
      } else if (Array.isArray(response)) {
        rules.value = response;
      } else if (Array.isArray(response.data)) {
        rules.value = response.data;
      } else {
        console.warn('[useNotificationRules] Unexpected response format:', response);
        rules.value = [];
      }
    } catch (err) {
      error.value = err.response?.data?.message || err.message || 'Failed to fetch notification rules';
      console.error('[useNotificationRules] Error fetching rules:', err);
      console.error('[useNotificationRules] Error details:', {
        status: err.status,
        response: err.response,
        message: err.message
      });
      rules.value = [];
    } finally {
      loading.value = false;
    }
  }

  /**
   * Create a new notification rule
   */
  async function createRule(ruleData) {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await apiClient.post('/notification-rules', {
        ...ruleData,
        appKey: currentAppKey.value
      });
      
      // Handle different response formats
      if (response?.success) {
        await fetchRules(); // Refresh list
        return { success: true, data: response.data };
      } else if (response?.data?.success) {
        await fetchRules(); // Refresh list
        return { success: true, data: response.data.data };
      } else {
        const errorMsg = response?.message || response?.data?.message || 'Failed to create rule';
        throw new Error(errorMsg);
      }
    } catch (err) {
      // Extract error message from different error formats
      const errorMsg = err.response?.data?.message || 
                       err.response?.data?.error || 
                       err.message || 
                       'Failed to create notification rule';
      error.value = errorMsg;
      console.error('[useNotificationRules] Error creating rule:', err);
      console.error('[useNotificationRules] Error details:', {
        status: err.status,
        response: err.response,
        message: err.message,
        ruleData
      });
      throw new Error(errorMsg);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Update an existing notification rule
   */
  async function updateRule(ruleId, ruleData) {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await apiClient.put(`/notification-rules/${ruleId}`, {
        ...ruleData,
        appKey: currentAppKey.value
      });
      
      // apiClient returns parsed JSON directly: { success: true, data: {...} }
      if (response?.success) {
        await fetchRules(); // Refresh list
        return { success: true, data: response.data };
      } else if (response?.data?.success) {
        await fetchRules(); // Refresh list
        return { success: true, data: response.data.data };
      } else {
        throw new Error(response?.message || response?.data?.message || 'Failed to update rule');
      }
    } catch (err) {
      error.value = err.response?.data?.message || err.message || 'Failed to update notification rule';
      console.error('[useNotificationRules] Error updating rule:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Delete a notification rule
   */
  async function deleteRule(ruleId) {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await apiClient.delete(`/notification-rules/${ruleId}`, {
        params: { appKey: currentAppKey.value }
      });
      
      // apiClient returns parsed JSON directly: { success: true } or { success: true, data: {...} }
      if (response?.success || response?.data?.success) {
        await fetchRules(); // Refresh list
        return { success: true };
      } else {
        throw new Error(response?.message || response?.data?.message || 'Failed to delete rule');
      }
    } catch (err) {
      error.value = err.response?.data?.message || err.message || 'Failed to delete notification rule';
      console.error('[useNotificationRules] Error deleting rule:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Toggle rule enabled/disabled
   */
  async function toggleRule(ruleId) {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await apiClient.post(`/notification-rules/${ruleId}/toggle`, {
        appKey: currentAppKey.value
      });
      
      // apiClient returns parsed JSON directly (not axios response)
      // Backend returns: { success: true, data: { id, enabled } }
      if (response?.success) {
        await fetchRules(); // Refresh list
        return { success: true, data: response.data };
      } else {
        // If success is false or undefined, throw error
        throw new Error(response?.message || 'Failed to toggle rule');
      }
    } catch (err) {
      error.value = err.response?.data?.message || err.message || 'Failed to toggle notification rule';
      console.error('[useNotificationRules] Error toggling rule:', err);
      console.error('[useNotificationRules] Error details:', {
        ruleId,
        appKey: currentAppKey.value,
        status: err.response?.status,
        response: err.response?.data,
        message: err.message
      });
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Get available modules that are rule-eligible
   */
  async function getEligibleModules() {
    try {
      const response = await fetchModulesListCached({
        appKey: currentAppKey.value,
        context: 'all',
      });
      
      // Handle response format - apiClient already parses JSON
      let modules = parseModulesListResponse(response);
      
      // Filter to only rule-eligible modules
      return modules.filter(module => 
        module.notifications?.ruleEligible === true && module.enabled !== false
      );
    } catch (err) {
      console.error('[useNotificationRules] Error fetching modules:', err);
      return [];
    }
  }

  /**
   * Get channel availability from preferences
   */
  const channelAvailability = computed(() => {
    try {
      // Access the computed property correctly from Pinia store
      const appPrefs = prefsStore.appPreferences || {};
      const events = Object.values(appPrefs);
      
      // Check if any event has each channel available
      const availability = {
        inApp: true, // Always available
        email: true, // Always available
        push: false,
        whatsapp: false,
        sms: false
      };
      
      events.forEach(event => {
        if (event?.push?.available) availability.push = true;
        if (event?.whatsapp?.available) availability.whatsapp = true;
        if (event?.sms?.available) availability.sms = true;
      });
      
      return availability;
    } catch (err) {
      console.error('[useNotificationRules] Error getting channel availability:', err);
      // Return safe defaults
      return {
        inApp: true,
        email: true,
        push: false,
        whatsapp: false,
        sms: false
      };
    }
  });

  /**
   * Get rule count limits
   */
  function getRuleLimits() {
    // Count current rules
    const totalRules = rules.value.length;
    const rulesByModule = {};
    
    rules.value.forEach(rule => {
      const moduleKey = rule.moduleKey;
      if (moduleKey) {
        if (!rulesByModule[moduleKey]) {
          rulesByModule[moduleKey] = 0;
        }
        rulesByModule[moduleKey]++;
      }
    });
    
    return {
      total: totalRules,
      maxTotal: 10,
      byModule: rulesByModule,
      maxPerModule: 5
    };
  }

  return {
    // State
    loading,
    error,
    rules,
    currentAppKey,
    channelAvailability,
    
    // Methods
    fetchRules,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
    getEligibleModules,
    getRuleLimits
  };
}

