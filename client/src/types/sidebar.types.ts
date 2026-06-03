/**
 * ============================================================================
 * PLATFORM SIDEBAR: Pure Data Contract
 * ============================================================================
 * 
 * This file defines the sidebar schema as a pure data contract:
 * - No UI logic
 * - No Vue/React specifics
 * - Registry-driven and permission-aware
 *
 * The authoritative contract is `SidebarStructure` below.
 * 
 * ============================================================================
 */

/**
 * ============================================================================
 * SIDEBAR ARCHITECTURE (LOCKED CONTRACT)
 * ============================================================================
 *
 * Critical invariant:
 * “The sidebar shows surfaces, identities, lenses, and governance — never raw
 * entities, app-agnostic primitives, or infrastructure.”
 *
 * This contract is intentionally strict. Callers must encode navigation intent
 * via `SidebarItem.kind` instead of passing "raw entities" or arbitrary objects.
 * ============================================================================
 */

export type AppSummary = {
  /** Stable app identifier (not a domain grouping key). */
  id: string;
  /** Human-friendly app name. */
  name: string;
  /** Optional i18n key (navigation.app*) when registry name should not be shown verbatim. */
  nameKey?: string;
  /**
   * Dashboard route for this app lens.
   * Required so the App Switcher can change context explicitly without guessing routes.
   */
  dashboardRoute: string;
  /** Optional icon identifier for UI mapping. */
  icon?: string;
  /** Optional ordering for display. */
  order?: number;
};

/** Optional vue-i18n key (navigation.*); `label` is English fallback for tests and registry names. */
type SidebarLabelFields = {
  label: string;
  labelKey?: string;
};

export type SidebarItem =
  | ({
      kind: 'surface';
      id: 'home' | 'inbox' | 'attention' | 'search' | 'trash' | 'approvals';
      route: string;
      icon?: string;
    } & SidebarLabelFields)
  | ({
      kind: 'coreModule';
      id: string; // moduleKey (e.g., 'people', 'organizations', 'tasks', etc.)
      route: string;
      icon?: string;
      moduleKey: string;
      order?: number;
    } & SidebarLabelFields)
  | ({
      kind: 'app';
      id: string;
      route: string;
      icon?: string;
      /**
       * Optional module key for app navigation items.
       * Present for modules; omitted for an app dashboard link.
       */
      moduleKey?: string;
    } & SidebarLabelFields)
  | ({
      kind: 'platform';
      id: string;
      route: string;
      icon?: string;
    } & SidebarLabelFields);

export interface SidebarStructure {
  /**
   * Shell surfaces — global, cross-app, task-oriented.
   * Examples: Home, Inbox, Search.
   * Never app-specific.
   */
  shell: SidebarItem[];

  /**
   * Core Modules — platform-owned modules sourced from Core Modules registry.
   * Examples: People, Organizations, Tasks, Events, Forms, Items.
   * Sourced strictly from GET /api/settings/core-modules.
   * Filtered by permissions (hidden if user has zero access).
   * Ordered as defined in Core Modules configuration.
   */
  coreModules: SidebarItem[];

  /**
   * App lens selector — controls which app's navigation is active.
   * Switching apps changes the meaning of navigation, not core modules.
   */
  appSwitcher: {
    activeAppId: string;
    apps: AppSummary[];
  };

  /**
   * Navigation for the currently active app only.
   * Never shows modules from multiple apps at once.
   */
  appNav: {
    appId: string;
    dashboard?: SidebarItem;
    modules: SidebarItem[];
  };

  /**
   * Platform governance — configuration and administration.
   * Not daily work surfaces.
   */
  platform: SidebarItem[];
}

/**
 * App Registry Module Definition
 * 
 * Module definition with navigation intent flags.
 */
export interface AppRegistryModule {
  /** Unique module identifier */
  moduleKey: string;
  
  /** Display label */
  label: string;
  
  /** Route path for navigation */
  route: string;
  
  /** Optional permission key required to view this module */
  permission?: string;
  
  /** Optional icon identifier */
  icon?: string;
  
  /** Optional display order */
  order?: number;

  /** When false, omit from app sidebar (module metadata may still exist for API/routes). */
  showInSidebar?: boolean;
  
  /** Optional app key (if module belongs to an app) */
  appKey?: string;
  
  /** Optional system flag (legacy, for backward compatibility) */
  system?: boolean;
  
  /** Optional core entity flag (legacy, for backward compatibility) */
  coreEntity?: boolean;
  
  /** Navigation intent: Place in Core section (personal/attention layer) */
  navigationCore?: boolean;
  
  /** Navigation intent: Place in Entities section (shared system primitives) */
  navigationEntity?: boolean;
  
  /** Hard stop: Exclude from Apps section (prevents core entities from appearing under apps) */
  excludeFromApps?: boolean;

  /**
   * Optional list view configuration for the module.
   * Used by registry validators and list builders.
   */
  list?: any;
}

/**
 * App Registry Entry
 * 
 * Expected structure from the app registry for building sidebar.
 */
export interface AppRegistryEntry {
  /** Application key */
  appKey: string;
  
  /** Display label */
  label: string;
  
  /** Dashboard route */
  dashboardRoute: string;
  
  /** Modules available in this app */
  modules?: AppRegistryModule[];
  
  /** Optional icon identifier */
  icon?: string;
  
  /** Optional display order */
  order?: number;

  /**
   * Optional dashboard composition for this app (KPIs, widgets, actions).
   * Not currently required for the legacy sidebar renderer, but validated if present.
   */
  dashboard?: any;
}

/**
 * User Permissions
 * 
 * Structure for user permissions used to filter sidebar items.
 */
export interface UserPermissions {
  /** Map of permission keys to boolean values (e.g., { 'contacts.view': true }) */
  [permissionKey: string]: boolean;
}

/**
 * App Registry
 * 
 * Complete app registry structure.
 */
export interface AppRegistry {
  [appKey: string]: AppRegistryEntry;
}

