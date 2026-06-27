import { computed } from 'vue';
import { useAuthStore } from '@/stores/authRegistry';
import { supportsMassEdit } from '@/utils/massEditFieldPolicy';

/**
 * Composable for managing bulk actions with permission checks
 * @param {String} module - The module name (e.g., 'contacts', 'deals')
 * @returns {Object} - Filtered bulk actions based on permissions
 */
export function useBulkActions(module) {
  const authStore = useAuthStore();

  const bulkActions = computed(() => {
    const actions = [];

    if (module === 'users' || module === 'settings-users') {
      if (authStore.can('users', 'update')) {
        actions.push(
          { label: 'Activate', icon: 'activate', action: 'bulk-activate', variant: 'success' },
          { label: 'Deactivate', icon: 'deactivate', action: 'bulk-deactivate', variant: 'warning' }
        );
      }
      if (authStore.can('users', 'delete')) {
        actions.push({ label: 'Delete', icon: 'trash', action: 'bulk-delete', variant: 'danger' });
      }
      return actions;
    }

    if (module === 'cases' && authStore.can(module, 'edit')) {
      actions.push(
        { label: 'Assign owner', icon: 'user', action: 'bulk-assign-owner', variant: 'secondary' },
        { label: 'Update status', icon: 'refresh', action: 'bulk-update-status', variant: 'secondary' },
        { label: 'Update priority', icon: 'flag', action: 'bulk-update-priority', variant: 'secondary' }
      );
    }
    
    if (supportsMassEdit(module) && authStore.can(module, 'edit')) {
      actions.push({
        label: 'Edit',
        icon: 'edit',
        action: 'mass-edit',
        variant: 'primary',
      });
    }

    if (module === 'sales_orders' && authStore.can(module, 'merge')) {
      actions.push({
        label: 'Merge orders',
        icon: 'merge',
        action: 'merge',
        variant: 'secondary'
      });
    }

    if (module === 'sales_orders' && authStore.can('invoices', 'create')) {
      actions.push({
        label: 'Combined invoice',
        icon: 'invoice',
        action: 'combined-invoice',
        variant: 'secondary'
      });
    }
    
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

