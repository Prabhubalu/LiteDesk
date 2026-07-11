/**
 * ============================================================================
 * PLATFORM SIDEBAR: State Management Composable
 * ============================================================================
 * 
 * Manages ONLY the minimal sidebar state allowed by the locked SidebarStructure.
 *
 * Why multi-app expansion is intentionally unsupported:
 * The sidebar has exactly one active app lens at a time. Showing or persisting
 * multiple expanded apps reintroduces a multi-app navigation surface.
 *
 * Invariant:
 * “The sidebar has exactly one active app lens at a time.
 * App switching is explicit and does not rely on expand/collapse state.”
 * 
 * State Persistence:
 * - collapsed (shell chrome only)
 * - lastActiveAppId (app lens fallback when route is ambiguous)
 * 
 * ============================================================================
 */

import { ref, watch } from 'vue';
import type { Ref } from 'vue';

const COLLAPSED_KEY = 'arivu-sidebar-collapsed';
const LAST_ACTIVE_APP_ID_KEY = 'arivu-sidebar-last-active-app-id';
const CORE_MODULES_COLLAPSED_KEY = 'arivu-sidebar-core-modules-collapsed';

function loadBoolean(key: string, fallback: boolean): boolean {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    return stored === 'true';
  } catch (error) {
    console.warn(`Failed to load ${key}:`, error);
    return fallback;
  }
}

function saveBoolean(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value.toString());
  } catch (error) {
    console.warn(`Failed to save ${key}:`, error);
  }
}

function loadString(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch (error) {
    console.warn(`Failed to load ${key}:`, error);
    return fallback;
  }
}

function saveString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`Failed to save ${key}:`, error);
  }
}

/**
 * Sidebar state (locked contract doctrine).
 *
 * Exposes:
 * - collapsed: boolean (entire sidebar collapsed state)
 * - lastActiveAppId: string (last active app lens)
 * - coreModulesCollapsed: boolean (Core Modules section collapse state)
 */
export function readLastActiveAppIdFromStorage(): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(LAST_ACTIVE_APP_ID_KEY);
  } catch {
    return null;
  }
}

export function useSidebarState(): {
  collapsed: Ref<boolean>;
  lastActiveAppId: Ref<string>;
  coreModulesCollapsed: Ref<boolean>;
} {
  const collapsed = ref<boolean>(loadBoolean(COLLAPSED_KEY, false));
  const lastActiveAppId = ref<string>(loadString(LAST_ACTIVE_APP_ID_KEY, ''));
  const coreModulesCollapsed = ref<boolean>(loadBoolean(CORE_MODULES_COLLAPSED_KEY, false));

  watch(collapsed, (value) => saveBoolean(COLLAPSED_KEY, value));
  watch(lastActiveAppId, (value) => saveString(LAST_ACTIVE_APP_ID_KEY, value));
  watch(coreModulesCollapsed, (value) => saveBoolean(CORE_MODULES_COLLAPSED_KEY, value));

  return { collapsed, lastActiveAppId, coreModulesCollapsed };
}

