import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';

/**
 * Composable for managing bulk actions with permission checks
 * @param {String} module - The module name (e.g., 'contacts', 'deals')
 * @returns {Object} - Filtered bulk actions based on permissions
 */
export function useBulkActions(module) {
  const authStore = useAuthStore();

  const bulkActions = computed(() => {
    const actions = [];
    
    // Delete action - requires delete permission
    if (authStore.can(module, 'delete')) {
      actions.push({ 
        label: 'Delete', 
        icon: 'trash', 
        action: 'delete', 
        variant: 'danger' 
      });
    }
    
    // Export action - requires exportData permission
    if (authStore.can(module, 'exportData')) {
      actions.push({ 
        label: 'Export', 
        icon: 'export', 
        action: 'export', 
        variant: 'secondary' 
      });
    }
    
    return actions;
  });

  return {
    bulkActions
  };
}

