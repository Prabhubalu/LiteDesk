/**
 * ============================================================================
 * PLATFORM CORE: App Shell Store (Phase 0D)
 * ============================================================================
 * 
 * This store manages UI composition state:
 * - Available apps for the tenant
 * - Active app context
 * - Sidebar modules
 * - Route definitions
 * 
 * Loads UI metadata once after login and caches it.
 * 
 * See PLATFORM_ARCHITECTURE.md for details.
 * ============================================================================
 */

import { defineStore } from 'pinia';
import { useAuthStore } from './authRegistry';
import { fetchAppRegistryFromNetwork } from '@/utils/appRegistryNetwork';
import apiClient from '@/utils/apiClient';

export const useAppShellStore = defineStore('appShell', {
  state: () => ({
    availableApps: [],
    activeApp: null,
    sidebarModules: [],
    routes: [],
    loading: false,
    error: null,
    lastLoaded: null,
    /** Full app registry (sidebar builder, module list) — network once per session unless invalidated */
    cachedAppRegistry: null,
    appRegistrySessionKey: null,
    _appRegistryPromise: null,
    _loadUIMetadataPromise: null
  }),

  getters: {
    /**
     * Get modules for the active app
     */
    activeAppModules: (state) => {
      if (!state.activeApp) return [];
      const app = state.availableApps.find(a => a.appKey === state.activeApp);
      return app?.modules || [];
    },

    /**
     * Get sidebar definition for the active app
     */
    sidebarDefinition: (state) => {
      if (!state.activeApp) return { modules: [] };
      const app = state.availableApps.find(a => a.appKey === state.activeApp);
      return {
        app: app,
        modules: app?.modules || []
      };
    },

    /**
     * Check if UI metadata is loaded
     */
    isLoaded: (state) => {
      return state.availableApps.length > 0 && state.lastLoaded !== null;
    }
  },

  actions: {
    /**
     * Load UI metadata from the backend (single-flight: concurrent callers share one request).
     */
    async loadUIMetadata() {
      if (this._loadUIMetadataPromise) {
        return this._loadUIMetadataPromise;
      }
      this._loadUIMetadataPromise = this._loadUIMetadataImpl().finally(() => {
        this._loadUIMetadataPromise = null;
      });
      return this._loadUIMetadataPromise;
    },

    async _loadUIMetadataImpl() {
      const authStore = useAuthStore();

      if (!authStore.isAuthenticated) {
        console.warn('[AppShell] Cannot load UI metadata: user not authenticated');
        return;
      }

      this.loading = true;
      this.error = null;

      try {
        const cacheKey = `ui-metadata:${authStore.user?._id || ''}`;
        const noStore = { cache: 'no-store' };

        // App/module composition for the shell sidebar comes from /ui/registry (see ensureCachedAppRegistry).
        // This loader only hydrates dynamic routes — avoids redundant /ui/sidebar alongside Nav registry build.
        await this.ensureCachedAppRegistry();

        const cachedData = sessionStorage.getItem(cacheKey);
        if (cachedData) {
          try {
            const parsed = JSON.parse(cachedData);
            const routesPayload = parsed?.routes ?? null;
            if (routesPayload?.success) {
              this.routes = routesPayload.data || [];
              this.lastLoaded = new Date();
              console.log('[AppShell] Using cached routes from sessionStorage');
              return;
            }
          } catch (e) {
            console.warn('[AppShell] Failed to parse cached routes, fetching fresh:', e);
            sessionStorage.removeItem(cacheKey);
          }
        }

        const routesData = await apiClient('/ui/routes', noStore);

        if (routesData?.success) {
          this.routes = routesData.data || [];
        } else {
          this.routes = [];
        }

        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({ routes: routesData }));
        } catch (e) {
          console.warn('[AppShell] Failed to cache UI routes:', e);
        }

        this.lastLoaded = new Date();
        console.log('[AppShell] ✅ UI routes loaded:', {
          apps: this.availableApps.length,
          modules: this.sidebarModules.length,
          routes: this.routes.length
        });
      } catch (error) {
        console.error('[AppShell] ❌ Error loading UI metadata:', error);
        console.error('[AppShell] Error details:', {
          message: error.message,
          stack: error.stack,
          authenticated: authStore.isAuthenticated,
          hasToken: !!authStore.user?.token,
          organizationId: authStore.user?.organizationId
        });
        this.error = error.message;
        this.routes = [];
      } finally {
        this.loading = false;
      }
    },

    /**
     * Full UI apps/modules registry for dynamic sidebar (cached; invalidate on core module changes).
     */
    async ensureCachedAppRegistry() {
      const authStore = useAuthStore();
      if (!authStore.isAuthenticated) {
        return {};
      }
      const orgId =
        authStore.user?.organizationId ||
        authStore.organization?._id ||
        authStore.user?.organization?._id ||
        '';
      const sessionKey = `${authStore.user?._id || ''}:${orgId}`;

      if (this.cachedAppRegistry && this.appRegistrySessionKey === sessionKey) {
        return this.cachedAppRegistry;
      }
      if (this._appRegistryPromise) {
        return this._appRegistryPromise;
      }

      this._appRegistryPromise = (async () => {
        const registry = await fetchAppRegistryFromNetwork();
        this.cachedAppRegistry = registry;
        this.appRegistrySessionKey = sessionKey;

        this.availableApps = Object.values(registry)
          .filter(app => app && app.appKey !== 'PLATFORM')
          .map(app => ({
            appKey: app.appKey,
            name: app.label || app.appKey,
            icon: app.icon,
            defaultRoute: app.dashboardRoute,
            sidebarOrder: app.order || 0,
            modules: app.modules || []
          }));

        if (!this.activeApp && this.availableApps.length > 0) {
          this.activeApp = this.availableApps[0].appKey;
        }
        this.updateSidebarModules();
        this.lastLoaded = new Date();

        return registry;
      })().finally(() => {
        this._appRegistryPromise = null;
      });

      return this._appRegistryPromise;
    },

    invalidateAppRegistryCache() {
      this.cachedAppRegistry = null;
      this.appRegistrySessionKey = null;
      this._appRegistryPromise = null;
      
      // Also clear UI metadata cache when invalidating app registry
      const authStore = useAuthStore();
      const cacheKey = `ui-metadata:${authStore.user?._id || ''}`;
      try {
        sessionStorage.removeItem(cacheKey);
      } catch (e) {
        console.warn('[AppShell] Failed to clear UI metadata cache:', e);
      }
    },

    /**
     * Set the active app
     */
    setActiveApp(appKey) {
      const authStore = useAuthStore();
      
      // Phase 1A: Block CONTROL_PLANE - platform-only, never for tenants
      const appKeyUpper = appKey?.toUpperCase();
      if (appKeyUpper === 'CONTROL_PLANE' || appKeyUpper === 'CONTROL PLANE') {
        console.warn(`[AppShell] Attempted to set CONTROL_PLANE as active app - blocked`);
        return;
      }
      
      // Verify user has access to this app
      if (!authStore.hasAssignedAppAccess(appKey)) {
        console.warn(`[AppShell] User does not have access to app: ${appKey}`);
        return;
      }

      // Verify app is available for tenant
      const app = this.availableApps.find(a => a.appKey === appKey);
      if (!app) {
        console.warn(`[AppShell] App not available: ${appKey}`);
        return;
      }

      this.activeApp = appKey;
      this.updateSidebarModules();
    },

    /**
     * Update sidebar modules based on active app
     */
    updateSidebarModules() {
      if (!this.activeApp) {
        this.sidebarModules = [];
        return;
      }

      const app = this.availableApps.find(a => a.appKey === this.activeApp);
      if (app) {
        this.sidebarModules = app.modules || [];
      } else {
        this.sidebarModules = [];
      }
    },

    /**
     * Clear UI metadata (on logout)
     */
    clear() {
      this.availableApps = [];
      this.activeApp = null;
      this.sidebarModules = [];
      this.routes = [];
      this.lastLoaded = null;
      this.error = null;
      this.cachedAppRegistry = null;
      this.appRegistrySessionKey = null;
      this._appRegistryPromise = null;
      this._loadUIMetadataPromise = null;

      // sessionStorage entries persist across logout when the tab stays open.
      // Drop every cached UI metadata blob so the next login fetches fresh data
      // for whichever user/tenant signs in next.
      try {
        const keysToRemove = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && key.startsWith('ui-metadata:')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => sessionStorage.removeItem(k));
      } catch (e) {
        console.warn('[AppShell] Failed to clear cached UI metadata on logout:', e);
      }
    },

    /**
     * Refresh UI metadata
     */
    async refresh() {
      await this.loadUIMetadata();
    }
  }
});
