import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import type { CommandPaletteItem } from '@/types/commandPalette.types';
import { getManualCommands } from '@/commands/commandRegistry';
import { buildPaletteCommandsFromSidebar, buildAllDashboardsFromRegistry } from '@/utils/commandPaletteFromRegistry';
import { buildSettingsPaletteCommands } from '@/utils/buildSettingsPaletteCommands';
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
  const { t, locale } = useI18n();
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

  const settingsCommands = computed<CommandPaletteItem[]>(() => {
    void locale.value;
    if (!authStore.user || !authStore.isAuthenticated) return [];
    return buildSettingsPaletteCommands(t, {
      isOwner: !!authStore.user.isOwner,
      role: authStore.user.role,
      permissions: authStore.user.permissions,
    });
  });

  /** Manual (drawers, contextual) + registry (modules, apps) + settings navigation. */
  const allCommands = computed<CommandPaletteItem[]>(() => {
    const manual = manualCommands.value;
    const reservedIds = new Set(manual.map((c) => c.id));
    const fromRegistry = registryCommands.value.filter((c) => !reservedIds.has(c.id));
    for (const cmd of fromRegistry) reservedIds.add(cmd.id);
    const settings = settingsCommands.value.filter((c) => !reservedIds.has(c.id));
    return [...manual, ...fromRegistry, ...settings];
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
