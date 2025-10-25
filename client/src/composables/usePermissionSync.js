import { onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '@/stores/auth';

/**
 * Composable to automatically sync user permissions periodically
 * This ensures permissions are up-to-date even without manual refresh
 */
export function usePermissionSync(intervalMinutes = 5) {
  const authStore = useAuthStore();
  let intervalId = null;

  const syncPermissions = async () => {
    if (!authStore.isAuthenticated) {
      return;
    }

    // Store current permissions hash to detect changes
    const oldPermissions = JSON.stringify(authStore.user?.permissions || {});
    
    console.log('Background sync: Checking for permission updates...');
    const success = await authStore.refreshUser();
    
    if (success) {
      const newPermissions = JSON.stringify(authStore.user?.permissions || {});
      
      // Check if permissions actually changed
      if (oldPermissions !== newPermissions) {
        console.log('⚠️ Permissions changed! Navigation will update on next action.');
        // Don't force reload - let navigation naturally reflect changes
        // User will see updated nav on next page interaction
      } else {
        console.log('✓ Permissions unchanged');
      }
    }
  };

  onMounted(() => {
    // Start periodic sync
    const intervalMs = intervalMinutes * 60 * 1000;
    intervalId = setInterval(syncPermissions, intervalMs);
    console.log(`🔄 Auto permission sync enabled (every ${intervalMinutes} min)`);
  });

  onUnmounted(() => {
    // Clean up interval on component unmount
    if (intervalId) {
      clearInterval(intervalId);
      console.log('Permission sync disabled');
    }
  });

  return {
    syncPermissions
  };
}

