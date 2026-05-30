import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import type { CommandPaletteItem } from '@/types/commandPalette.types';
import { getManualCommands } from '@/commands/commandRegistry';
import { buildPaletteCommandsFromSidebar, buildAllDashboardsFromRegistry } from '@/utils/commandPaletteFromRegistry';
import { buildSidebarStructureForSession } from '@/utils/buildSidebarForSession';
import { createPermissionSnapshot } from '@/types/permission-snapshot.types';
import { useAuthStore } from '@/stores/authRegistry';
import type { AppRegistry } from '@/types/sidebar.types';

/**
 * Registry-driven command palette: learns modules, apps, and surfaces from the
 * same sidebar/app registry used for navigation (updates when modules change).
 */
export function useCommandPaletteCommands() {
  const router = useRouter();
  const authStore = useAuthStore();
  const registryCommands = ref<CommandPaletteItem[]>([]);
  const loading = ref(false);
  const loadError = ref<string | null>(null);

  async function reloadCommands() {
    if (!authStore.user || !authStore.isAuthenticated) {
      registryCommands.value = [];
      return;
    }

    loading.value = true;
    loadError.value = null;
    try {
      const { structure, entitlementScopedRegistry } = await buildSidebarStructureForSession(
        authStore.user,
        authStore.hasAppAccess
      );
      const snapshot = createPermissionSnapshot(authStore.user);
      const dashboards = buildAllDashboardsFromRegistry(
        entitlementScopedRegistry as AppRegistry,
        snapshot
      );
      registryCommands.value = buildPaletteCommandsFromSidebar(
        structure,
        dashboards,
        entitlementScopedRegistry,
        snapshot
      );
    } catch (e: unknown) {
      console.error('[CommandPalette] Failed to load registry commands:', e);
      loadError.value = e instanceof Error ? e.message : 'Failed to load commands';
      registryCommands.value = [];
    } finally {
      loading.value = false;
    }
  }

  const manualCommands = computed(() => getManualCommands(router));

  /** Manual (drawers, contextual) + registry (entitled modules, apps, settings). */
  const allCommands = computed<CommandPaletteItem[]>(() => {
    const manual = manualCommands.value;
    const manualIds = new Set(manual.map((c) => c.id));
    const fromRegistry = registryCommands.value.filter((c) => !manualIds.has(c.id));
    return [...manual, ...fromRegistry];
  });

  const onModulesUpdated = () => {
    void reloadCommands();
  };

  onMounted(() => {
    void reloadCommands();
    window.addEventListener('arivu:core-modules-updated', onModulesUpdated);
  });

  onUnmounted(() => {
    window.removeEventListener('arivu:core-modules-updated', onModulesUpdated);
  });

  return {
    allCommands,
    registryCommands,
    manualCommands,
    loading,
    loadError,
    reloadCommands
  };
}
