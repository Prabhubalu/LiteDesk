import { ref, computed, watch, getCurrentInstance, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import appRouter from '@/router';
import { 
  HomeIcon,
  InboxIcon,
  UsersIcon,
  BuildingOfficeIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  CalendarIcon,
  MagnifyingGlassIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  Squares2X2Icon,
  PresentationChartLineIcon,
  DocumentMagnifyingGlassIcon,
  ArrowDownTrayIcon,
  FolderIcon,
  BookOpenIcon,
  ComputerDesktopIcon,
  DocumentTextIcon,
  TrashIcon,
  Cog6ToothIcon,
  LifebuoyIcon,
  TicketIcon,
  CreditCardIcon,
  DocumentCurrencyDollarIcon,
  ShoppingCartIcon
} from '@heroicons/vue/24/outline';
import { MODULE_ICON_IDS, resolveStoredModuleIconId } from '@/utils/moduleIcons';
import {
  getPersistedRecordTabName,
  getTabTitleMetaForPath,
  hydrateTabFromStorage,
  isRecordDetailTabPath,
  shouldPreserveRecordTabTitle
} from '@/utils/navigationLabels';
import { resolveModuleDisplayName } from '@/utils/configurableLabelResolver';
import { i18n } from '@/i18n/index';
import { createHelpdeskTabAlertController } from '@/utils/helpdeskTabAlerts';

const tabsDebugEnabled = () => {
  if (!import.meta.env.DEV) return false;
  try {
    return localStorage.getItem('arivu:debug:tabs') === '1';
  } catch (_e) {
    return false;
  }
};

const logTabsDebug = (...args) => {
  if (!tabsDebugEnabled()) return;
  globalThis.console.log(...args);
};

// File-local console wrapper so existing tab debug logs stay opt-in without
// rewriting every callsite in this large module.
const console = {
  ...globalThis.console,
  log: (...args) => logTabsDebug(...args),
  info: (...args) => {
    if (!tabsDebugEnabled()) return;
    globalThis.console.info(...args);
  },
  debug: (...args) => {
    if (!tabsDebugEnabled()) return;
    globalThis.console.debug(...args);
  },
};

// Tab state management
const tabs = ref([]);
const activeTabId = ref(null);

const helpdeskTabAlertController = createHelpdeskTabAlertController(tabs, activeTabId);

function i18nTabHelpers() {
  return {
    t: i18n.global.t.bind(i18n.global),
    te: i18n.global.te.bind(i18n.global)
  };
}

/** Mark an open case tab when inbound email/chat arrives (background tabs only). */
export function markHelpdeskTabAlertForCase(caseId, kind) {
  return helpdeskTabAlertController.markTabAlertForCase(caseId, kind, i18nTabHelpers());
}

/** Mark case or Cases list tab when a new case is created (background tabs only). */
export function markHelpdeskTabAlertForNewCase(caseId, kind) {
  return helpdeskTabAlertController.markTabAlertForNewCase(caseId, kind, i18nTabHelpers());
}

export function tabShowsHelpdeskAlert(tab, activeId = activeTabId.value) {
  return helpdeskTabAlertController.tabShowsAlertHighlight(tab, activeId);
}
// Storage key is computed per instance+user to prevent tab leakage across instances/users.
// Design invariant: Persistent UI state must be scoped at the same granularity as access control.
// Tabs are therefore scoped strictly by instanceId + userId.
let storageKey = null;
let storageConfigured = false;
let tabsInitialized = false;
const TABS_SCHEMA_VERSION = 3;

// Flag to track programmatic navigation (to avoid circular loops)
let isProgrammaticNavigation = false;
let lastProgrammaticPath = null;
// Flag to track browser navigation (popstate) to prevent route watcher from interfering
let isBrowserNavigation = false;
// Flag to prevent concurrent calls to createDefaultTab
let isCreatingHomeTab = false;

/** Public booking / manage URLs must not be overridden by persisted CRM tabs. */
export function isStandalonePublicRoute(path) {
  const p = String(path || '').split('?')[0];
  return p.startsWith('/book/') || p.startsWith('/appointments/manage/');
}

// Icon mapping for serialization/deserialization
const iconMap = {
  'home': HomeIcon,
  'inbox': InboxIcon,
  'users': UsersIcon,
  'building': BuildingOfficeIcon,
  'briefcase': BriefcaseIcon,
  'check': CheckCircleIcon,
  'check-circle': CheckCircleIcon,
  'calendar': CalendarIcon,
  'clipboard-list': ClipboardDocumentListIcon,
  'clipboard-document-list': ClipboardDocumentListIcon,
  'exclamation': ExclamationTriangleIcon,
  'exclamation-triangle': ExclamationTriangleIcon,
  'shield': ShieldCheckIcon,
  'shield-check': ShieldCheckIcon,
  'magnifying-glass': MagnifyingGlassIcon,
  'squares': Squares2X2Icon,
  'presentation-chart': PresentationChartLineIcon,
  'document-magnifying-glass': DocumentMagnifyingGlassIcon,
  // Audit app module aliases from registry/backend
  'audits': DocumentMagnifyingGlassIcon,
  'cases': TicketIcon,
  'ticket': TicketIcon,
  'responses': ClipboardDocumentListIcon,
  'download': ArrowDownTrayIcon,
  'folder': FolderIcon,
  'book': BookOpenIcon,
  'computer': ComputerDesktopIcon,
  'trash': TrashIcon,
  'document': DocumentTextIcon,
  'cog': Cog6ToothIcon,
  'lifebuoy': LifebuoyIcon,
  'helpdesk': LifebuoyIcon,
  'support': LifebuoyIcon,
  'document-text': DocumentTextIcon,
  'shopping-cart': ShoppingCartIcon,
  'document-currency-dollar': DocumentCurrencyDollarIcon,
  'credit-card': CreditCardIcon,
  quotes: DocumentTextIcon,
  sales_orders: ShoppingCartIcon,
  invoices: DocumentCurrencyDollarIcon,
  payments: CreditCardIcon
};

// Map emoji icons to icon identifiers
const migrateEmojiToIconId = (emojiIcon, path = '') => {
  const pathOnly = String(path || '').split('?')[0].split('#')[0].toLowerCase();
  if (emojiIcon === '📦') {
    if (pathOnly.startsWith('/sales-orders')) return MODULE_ICON_IDS.sales_orders;
    return 'cube';
  }
  if (emojiIcon === '🧾') {
    if (pathOnly.startsWith('/invoices')) return MODULE_ICON_IDS.invoices;
    if (pathOnly.startsWith('/quotes')) return MODULE_ICON_IDS.quotes;
    return MODULE_ICON_IDS.quotes;
  }
  const emojiToIconIdMap = {
    '🏠': 'home',
    '👥': 'users',
    '👤': 'users', // Contact detail icon
    '🏢': 'building',
    '💼': 'briefcase',
    '✅': 'check',
    '📅': 'calendar',
    '📋': 'shield-check',
    '🛡️': 'shield-check',
    '🎧': 'lifebuoy',
    '🛟': 'lifebuoy',
    '⬇️': 'download',
    '📁': 'folder',
    '📚': 'book',
    '🖥️': 'computer',
    '📄': 'document',
    '🎫': 'ticket',
    '💳': 'credit-card'
  };

  return emojiToIconIdMap[emojiIcon] || 'document';
};

// Convert icon identifier to component
const getIconComponent = (iconId) => {
  const rawIcon = String(iconId || '');
  const normalized = rawIcon.trim().toLowerCase();

  const aliases = {
    helpdesk: 'lifebuoy',
    audit: 'shield-check',
    '🛡️': 'shield-check',
    '📋': 'shield-check',
    '🎧': 'lifebuoy',
    '🛟': 'lifebuoy',
  };

  const resolved = aliases[normalized] || resolveStoredModuleIconId(rawIcon) || normalized;
  return iconMap[resolved] || iconMap[rawIcon] || DocumentTextIcon;
};

const APP_KEYS = ['sales', 'helpdesk', 'audit', 'portal', 'projects'];
const inferAppKeyFromTitle = (title = '') => {
  const normalized = String(title || '').toLowerCase();
  for (const appKey of APP_KEYS) {
    if (normalized.includes(appKey)) return appKey;
  }
  return null;
};

const normalizeLegacyDashboardPath = (path, title) => {
  const normalizedPath = String(path || '');
  const inferredFromTitle = inferAppKeyFromTitle(title);

  // Very old shared dashboard route.
  if (normalizedPath === '/dashboard') {
    return inferredFromTitle ? `/dashboard/${inferredFromTitle}` : '/dashboard/sales';
  }

  // Legacy sales alias; keep Sales, but recover other app tabs incorrectly saved as sales.
  if (normalizedPath === '/sales/dashboard') {
    if (inferredFromTitle && inferredFromTitle !== 'sales') {
      return `/dashboard/${inferredFromTitle}`;
    }
    return '/dashboard/sales';
  }

  // Already app-scoped route.
  if (normalizedPath.startsWith('/dashboard/')) {
    return normalizedPath;
  }

  // Legacy Helpdesk tab route persisted before cases namespace was introduced.
  if (normalizedPath === '/cases' || normalizedPath === '/cases/') {
    return '/helpdesk/cases';
  }

  return normalizedPath;
};

// Compute storage key based on instance and user identifiers
const getStorageKey = (instanceId, userId) => {
  if (!instanceId || !userId) {
    // Fail loud: tabs must never initialize without instance + user context.
    throw new Error('[Tabs] Missing instanceId or userId. Tabs storage must never initialize without both.');
  }
  return `arivu-tabs:${instanceId}:${userId}`;
};

// Allow app bootstrap to configure per-instance, per-user storage scoping (one-time)
export const configureTabsStorage = ({ instanceId, userId }) => {
  if (storageConfigured) {
    console.warn('[Tabs] configureTabsStorage called multiple times; ignoring reconfiguration.', {
      currentKey: storageKey
    });
    return;
  }
  storageKey = getStorageKey(instanceId, userId);
  storageConfigured = true;
};

// Clear in-memory tab state (used on logout/auth reset). Does not touch persisted storage.
export const resetTabsState = () => {
  tabs.value = [];
  activeTabId.value = null;
  isProgrammaticNavigation = false;
  lastProgrammaticPath = null;
};

// Load tabs from localStorage on initialization
const loadTabsFromStorage = () => {
  try {
    if (!storageConfigured || !storageKey) {
      throw new Error('[Tabs] loadTabsFromStorage called before storage was configured.');
    }
    const stored = localStorage.getItem(storageKey);
    logTabsDebug('🔄 [loadTabsFromStorage] Loading from storage key:', storageKey, 'stored:', !!stored);
    
    if (stored) {
      const parsed = JSON.parse(stored);
      logTabsDebug('🔄 [loadTabsFromStorage] Parsed tabs:', parsed.tabs?.length || 0);
      let loadedTabs = parsed.tabs || [];
      let loadedActiveTabId = parsed.activeTabId || null;
      const hasLegacySchema = Number(parsed.schemaVersion || 1) < TABS_SCHEMA_VERSION;
      
      // Deduplicate home tabs before setting tabs.value
      // Keep only the first home tab found (by ID or path)
      const homeTabs = loadedTabs.filter(tab => tab.id === 'home' || tab.path === '/platform/home');
      if (homeTabs.length > 1) {
        console.warn('⚠️ [loadTabsFromStorage] Found', homeTabs.length, 'duplicate home tabs, removing duplicates');
        // Keep the first home tab, remove the rest
        const firstHomeTabIndex = loadedTabs.findIndex(tab => tab.id === 'home' || tab.path === '/platform/home');
        const firstHomeTab = loadedTabs[firstHomeTabIndex];
        const removedHomeTabIds = homeTabs.slice(1).map(tab => tab.id);
        
        loadedTabs = loadedTabs.filter((tab, index) => {
          const isHomeTab = tab.id === 'home' || tab.path === '/platform/home';
          // Keep if it's not a home tab, or if it's the first home tab
          return !isHomeTab || index === firstHomeTabIndex;
        });
        
        // If the active tab was one of the removed duplicates, update it to the remaining home tab
        if (loadedActiveTabId && removedHomeTabIds.includes(loadedActiveTabId)) {
          logTabsDebug('🔄 [loadTabsFromStorage] Active tab was a duplicate home tab, updating to remaining home tab');
          loadedActiveTabId = firstHomeTab.id;
        }
        
        logTabsDebug('✅ [loadTabsFromStorage] Removed duplicate home tabs, remaining tabs:', loadedTabs.length);
      }
      
      if (hasLegacySchema) {
        loadedTabs = loadedTabs.map((tab) => ({
          ...tab,
          path: normalizeLegacyDashboardPath(tab.path, tab.title)
        }));
      }

      tabs.value = loadedTabs.map((tab) => hydrateTabFromStorage(tab));
      activeTabId.value = loadedActiveTabId;
      
      // Convert icon identifiers back to components
      tabs.value.forEach(tab => {
        if (typeof tab.icon === 'string') {
          // Check if it's an emoji (for migration)
          if (tab.icon.match(/[\u{1F300}-\u{1F9FF}]/u)) {
            logTabsDebug('🔄 Migrating emoji icon to icon ID:', tab.icon, 'for tab:', tab.title);
            tab.icon = migrateEmojiToIconId(tab.icon, tab.path);
          }
          // Convert icon ID to component
          tab.icon = getIconComponent(tab.icon);
        }

        // Recovery: older persisted tabs may contain un-serializable icon objects.
        // If icon cannot be recognized, infer from path to avoid generic-document icons.
        const currentIconId = getIconId(tab.icon);
        if (currentIconId === 'document') {
          const inferredIconId = getIconForPath(tab.path || '');
          if (inferredIconId !== 'document') {
            tab.icon = getIconComponent(inferredIconId);
          }
        }

        // Registry may expose a wrong leaf icon (e.g. cog) while the shell renders Cases via moduleKey.
        const tabPathBase = String(tab.path || '').split('?')[0].split('#')[0];
        const isHelpdeskCasesPath =
          tabPathBase === '/helpdesk/cases' || tabPathBase.startsWith('/helpdesk/cases/');
        if (isHelpdeskCasesPath) {
          const id = getIconId(tab.icon);
          if (id !== 'cases' && id !== 'ticket') {
            tab.icon = getIconComponent('cases');
          }
        }
        
        // Migrate only legacy shared /dashboard tabs.
        // Keep app-scoped routes like /dashboard/helpdesk untouched.
        if (tab.path === '/dashboard' || (tab.id === 'dashboard' && (!tab.path || tab.path === '/'))) {
          logTabsDebug('🔄 Migrating legacy dashboard tab to scoped sales dashboard route');
          tab.id = generateTabId(); // Generate new ID since it's not the home tab
          tab.path = '/dashboard/sales';
          tab.title = 'Sales Dashboard';
          tab.icon = getIconComponent('home');
          tab.closable = true; // Dashboard tabs are closable
        }
      });
      
      // Update activeTabId if it was 'dashboard' - find the migrated tab
      if (activeTabId.value === 'dashboard') {
        const migratedTab = tabs.value.find(tab => tab.path === '/dashboard/sales');
        if (migratedTab) {
          activeTabId.value = migratedTab.id;
        } else {
          // If migration didn't happen, clear it
          activeTabId.value = null;
        }
      }
      
      // Don't create home tab here - let setupRouteWatcher decide based on current route
      // This prevents creating unnecessary home tabs when on dashboard routes
      if (tabs.value.length === 0) {
        logTabsDebug('🔄 [loadTabsFromStorage] No tabs found, will be created by setupRouteWatcher based on route');
      } else {
        logTabsDebug('✅ [loadTabsFromStorage] Loaded', tabs.value.length, 'tabs from storage');
      }

      // Persist migrated shape once so legacy cleanup is one-time.
      if (hasLegacySchema || Number(parsed.schemaVersion || 1) < TABS_SCHEMA_VERSION) {
        saveTabsToStorage();
      }
    } else {
      // No stored tabs - don't create home tab here, let setupRouteWatcher decide
      logTabsDebug('🔄 [loadTabsFromStorage] No stored tabs, will be created by setupRouteWatcher based on route');
    }
  } catch (e) {
    console.error('❌ [loadTabsFromStorage] Error loading tabs:', e);
    // Don't create home tab on error either - let setupRouteWatcher handle it
    logTabsDebug('🔄 [loadTabsFromStorage] Error occurred, will create tab based on route in setupRouteWatcher');
  }
};

// Convert icon component to identifier
const getIconId = (iconComponent) => {
  for (const [id, component] of Object.entries(iconMap)) {
    if (component === iconComponent) {
      return id;
    }
  }
  return 'document'; // fallback
};

/** Apply a record display name to a tab (persisted as recordTitle + title). */
function applyRecordTabTitle(tab, name) {
  const trimmed = String(name || '').trim();
  if (!tab || !trimmed) return;
  tab.recordTitle = trimmed;
  tab.title = trimmed;
  tab.params = { ...(tab.params || {}), name: trimmed };
  if (isRecordDetailTabPath(tab.path)) {
    const moduleRoute = String(tab.path).split('?')[0].split('/').filter(Boolean)[0];
    tab.titleKey = 'navigation.tabRecordNamed';
    tab.titleParams = {
      ...(tab.titleParams || {}),
      moduleRoute,
      name: trimmed
    };
  }
}

function serializeTabForStorage(tab) {
  const recordName = getPersistedRecordTabName(tab);
  const serialized = {
    id: tab.id,
    path: tab.path,
    closable: tab.closable,
    params: tab.params,
    icon: typeof tab.icon === 'string' ? tab.icon : getIconId(tab.icon)
  };
  if (recordName) {
    serialized.recordTitle = recordName;
    serialized.title = recordName;
    if (isRecordDetailTabPath(tab.path)) {
      serialized.titleKey = 'navigation.tabRecordNamed';
      const moduleRoute = String(tab.path).split('?')[0].split('/').filter(Boolean)[0];
      serialized.titleParams = {
        ...(tab.titleParams || {}),
        moduleRoute,
        name: recordName
      };
    }
  } else if (tab.titleKey) {
    serialized.titleKey = tab.titleKey;
    serialized.titleParams = tab.titleParams;
    if (tab.title) serialized.title = tab.title;
  } else if (tab.title) {
    serialized.title = tab.title;
  }
  return serialized;
}

// Save tabs to localStorage
const saveTabsToStorage = () => {
  try {
    if (!storageConfigured || !storageKey) {
      throw new Error('[Tabs] saveTabsToStorage called before storage was configured.');
    }
    const tabsToSave = tabs.value.map(serializeTabForStorage);

    localStorage.setItem(storageKey, JSON.stringify({
      schemaVersion: TABS_SCHEMA_VERSION,
      tabs: tabsToSave,
      activeTabId: activeTabId.value
    }));
  } catch (e) {
    console.error('Error saving tabs:', e);
  }
};

// Watch for changes and save
watch([tabs, activeTabId], () => {
  saveTabsToStorage();
}, { deep: true });

// Create default home tab (platform home)
const createDefaultTab = () => {
  // Prevent concurrent calls
  if (isCreatingHomeTab) {
    console.log('🔒 [createDefaultTab] Already creating home tab, skipping concurrent call');
    return;
  }
  
  // Check if home tab already exists to avoid duplicates
  // Check both by ID and by path to catch all cases
  // Use a more thorough check to prevent any duplicates
  const existingHomeTabById = tabs.value.find(tab => tab.id === 'home');
  const existingHomeTabByPath = tabs.value.find(tab => tab.path === '/platform/home' || tab.path?.startsWith('/platform/home'));
  const existingHomeTab = existingHomeTabById || existingHomeTabByPath;
  
  if (existingHomeTab) {
    console.log('🔄 [createDefaultTab] Home tab already exists (id:', existingHomeTab.id, 'path:', existingHomeTab.path, '), updating it (not creating duplicate). Current tabs:', tabs.value.length);
    existingHomeTab.id = 'home';
    existingHomeTab.path = '/platform/home';
    existingHomeTab.title = 'Home';
    existingHomeTab.icon = getIconComponent('home');
    existingHomeTab.closable = false;
    // Don't force set activeTabId here - let the caller decide
    // activeTabId.value = 'home';
    // Force reactive update by reassigning the array
    tabs.value = [...tabs.value];
    return;
  }
  
  // Additional safeguard: Count existing home tabs to detect duplicates
  const homeTabCount = tabs.value.filter(tab => tab.id === 'home' || tab.path === '/platform/home').length;
  if (homeTabCount > 0) {
    console.warn('⚠️ [createDefaultTab] Found', homeTabCount, 'existing home tab(s) but check above failed. Not creating duplicate.');
    return;
  }
  
  // Set flag to prevent concurrent calls
  isCreatingHomeTab = true;
  
  const homeTab = {
    id: 'home',
    titleKey: 'navigation.home',
    title: 'Home',
    path: '/platform/home',
    icon: getIconComponent('home'), // Convert to component immediately
    closable: false // Home tab cannot be closed
  };
  
  // Add to tabs array (don't replace, in case other tabs exist)
  if (tabs.value.length === 0) {
    tabs.value = [homeTab];
  } else {
    // Insert at beginning if tabs exist
    tabs.value.unshift(homeTab);
    // Force reactive update by reassigning the array
    tabs.value = [...tabs.value];
  }
  activeTabId.value = 'home';
  
  console.log('✅ [createDefaultTab] Home tab created:', homeTab, 'Total tabs:', tabs.value.length);
  
  // Immediately save to localStorage to ensure it persists
  if (storageConfigured && storageKey) {
    try {
      saveTabsToStorage();
      console.log('✅ [createDefaultTab] Tab saved to localStorage');
    } catch (e) {
      console.error('❌ [createDefaultTab] Error saving to localStorage:', e);
    }
  } else {
    console.warn('⚠️ [createDefaultTab] Storage not configured, cannot save tab');
  }
  
  // Reset flag after creation
  isCreatingHomeTab = false;
  
  // Force Vue to recognize the change immediately
  // This ensures TabBar component sees the new tab right away
  nextTick(() => {
    console.log('✅ [createDefaultTab] After nextTick, tabs count:', tabs.value.length);
  });
};

// Generate unique tab ID
const generateTabId = () => {
  return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Get icon for route (query/hash ignored so /helpdesk/cases?foo matches cases, not generic helpdesk)
const getIconForPath = (path) => {
  const pathOnly = String(path || '').split('?')[0].split('#')[0];
  const icons = {
    '/platform/home': 'home',
    '/sales/dashboard': 'home',
    '/dashboard': 'home', // backward compat
    '/inbox': 'inbox',
    '/approvals': 'check',
    '/contacts': 'users',
    '/people': 'users',
    '/organizations': 'building',
    '/deals': 'briefcase',
    '/tasks': 'check',
    '/events': 'calendar',
    '/forms': 'document',
    '/responses': 'clipboard-list',
    '/findings': 'exclamation',
    '/audit': 'shield',
    '/calendar': 'calendar', // backward compat
    '/imports': 'download',
    '/items': 'folder',
    '/trash': 'trash',
    '/demo-requests': 'book',
    '/instances': 'computer',
    '/settings': 'cog',
    '/quotes': MODULE_ICON_IDS.quotes,
    '/sales-orders': MODULE_ICON_IDS.sales_orders,
    '/invoices': MODULE_ICON_IDS.invoices,
    '/payments': MODULE_ICON_IDS.payments
  };

  // Audit app route-specific mappings (must run before base-path fallback).
  if (pathOnly === '/audit/dashboard' || pathOnly.startsWith('/audit/dashboard')) return 'presentation-chart';
  if (pathOnly === '/audit/audits' || pathOnly.startsWith('/audit/audits')) return 'document-magnifying-glass';
  if (pathOnly === '/audit/findings' || pathOnly.startsWith('/audit/findings')) return 'exclamation-triangle';
  if (pathOnly === '/audit/responses' || pathOnly.startsWith('/audit/responses')) return 'clipboard-document-list';
  if (pathOnly === '/helpdesk/cases' || pathOnly.startsWith('/helpdesk/cases/')) return 'cases';
  if (pathOnly === '/helpdesk/dashboard' || pathOnly.startsWith('/helpdesk/')) return 'lifebuoy';
  if (pathOnly === '/dashboard/helpdesk' || pathOnly.startsWith('/dashboard/helpdesk')) return 'lifebuoy';
  if (pathOnly === '/dashboard/audit' || pathOnly.startsWith('/dashboard/audit')) return 'shield-check';
  if (pathOnly.startsWith('/dashboard/')) return 'home';
  
  // Check for exact match first
  if (icons[pathOnly]) return icons[pathOnly];
  
  // Check for base path
  const basePath = '/' + pathOnly.split('/')[1];
  return icons[basePath] || 'document';
};

// Get title for route
const getTitleForPath = (path, params = {}) => {
  const titles = {
    '/platform/home': 'Home',
    '/sales/dashboard': 'Sales Dashboard',
    '/dashboard': 'Dashboard', // backward compat
    '/contacts': 'Contacts',
    '/people': 'People',
    '/organizations': 'Organizations',
    '/deals': 'Deals',
    '/quotes': 'Quotes',
    '/sales-orders': 'Sales Orders',
    '/invoices': 'Invoices',
    '/tasks': 'Tasks',
    '/events': 'Events',
    '/forms': 'Forms',
    '/calendar': 'Events', // backward compat
    '/imports': 'Imports',
    '/items': 'Items',
    '/helpdesk/cases': 'Cases',
    '/helpdesk/cases/': 'Cases',
    '/trash': 'Trash',
    '/demo-requests': 'Demo Requests',
    '/instances': 'Instances',
    '/settings': 'Settings',
    '/appointments/pages': 'Booking Pages',
    '/appointments/configure': 'Personal booking page',
    // Control Plane routes
    '/control': 'Control Plane',
    '/control/demo-requests': 'Demo Requests',
    '/control/instances': 'Instances',
    '/settings/automation/automation-rules': 'Automation Rules',
    '/settings/automation/processes': 'Processes',
    '/settings/automation/flows': 'Business Flows',
    '/control/inbound-parser': 'Inbound Parser',
    '/control/automation-rules': 'Automation Rules',
    '/control/processes': 'Processes',
    '/control/flows': 'Business Flows',
    // Audit app routes
    '/audit/dashboard': 'Audit Dashboard',
    '/audit/audits': 'My Audits'
  };
  
  // Check for exact path match FIRST (before any other logic)
  if (titles[path]) {
    return titles[path];
  }
  
  // Check for base path
  const basePath = '/' + path.split('/')[1];
  const segments = path.split('/');
  
  // Special case: Sales dashboard route
  if (path === '/sales/dashboard' || path.startsWith('/sales/dashboard')) {
    return 'Sales Dashboard';
  }
  
  // Special case: Control Plane routes (handle detail pages)
  if (path.startsWith('/control/')) {
    return titles[`/control/${segments[2]}`] || 'Control Plane';
  }

  // Settings → Automation routes (handle flow detail pages)
  if (path.startsWith('/settings/automation/')) {
    if (segments[3] === 'flows' && segments[4]) {
      if (segments[5] === 'health') {
        return 'Flow Health';
      } else if (segments[5] === 'edit') {
        return 'Edit Business Flow';
      } else if (segments[4] === 'create') {
        return 'Create Business Flow';
      }
      return 'Business Flow';
    }
    return titles[`/settings/automation/${segments[3]}`] || 'Automation';
  }
  
  // Special case: Audit app routes (should not use tabs system)
  if (path.startsWith('/audit/')) {
    // Return specific titles for audit routes
    if (path === '/audit/dashboard' || path.startsWith('/audit/dashboard')) {
      return 'Audit Dashboard';
    } else if (path === '/audit/audits' || path.startsWith('/audit/audits')) {
      if (segments.length > 3) {
        // Detail page: /audit/audits/:eventId
        return 'Audit Detail';
      }
      return 'My Audits';
    }
    return 'Audit';
  }

  // Appointment booking pages
  if (path.startsWith('/appointments/')) {
    if (path === '/appointments/pages' || path.startsWith('/appointments/pages')) {
      return 'Booking Pages';
    }
    if (path.startsWith('/appointments/team/configure')) {
      const id = segments[3];
      if (!id) return 'New team page';
      return 'Team booking page';
    }
    if (path.startsWith('/appointments/configure/user/')) {
      return 'Booking page';
    }
    if (path === '/appointments/configure' || path.startsWith('/appointments/configure')) {
      return 'Personal booking page';
    }
    return 'Booking Pages';
  }

  // Special case: Helpdesk cases routes
  if (path.startsWith('/helpdesk/cases')) {
    if (segments[3] === 'new' || segments.length <= 3) {
      return 'Cases';
    }
    return 'Case Detail';
  }
  
  // Special case: App-scoped dashboard routes
  if (segments[1] === 'dashboard') {
    const appKey = String(segments[2] || '').toUpperCase();
    if (appKey) {
      const normalized = appKey.charAt(0) + appKey.slice(1).toLowerCase();
      return `${normalized} Dashboard`;
    }
    return 'Dashboard';
  }
  
  // Special case: Form Response detail view
  // Route shape: /forms/:formId/responses/:responseId
  if (segments[1] === 'forms' && segments[3] === 'responses' && segments[4]) {
    return `(${segments[4]}) Details`;
  }

  // If it's a detail page (has ID), customize title
  // But skip if it's an audit route or control route (handled above)
  if (path.split('/').length > 2 && !path.startsWith('/audit/') && !path.startsWith('/control/') && !path.startsWith('/settings/automation/') && segments[1] !== 'dashboard') {
    const module = segments[1];
    const t = i18n.global.t.bind(i18n.global);
    const te = i18n.global.te.bind(i18n.global);
    const moduleName = resolveModuleDisplayName(module, t, te);

    if (params.name) {
      return t('navigation.tabRecordNamed', { module: moduleName, name: params.name });
    }

    return t('navigation.tabRecordDetail', { module: moduleName });
  }
  
  return titles[basePath] || titles[path] || 'Page';
};

export function useTabs() {
  // Initialize router/route immediately in setup context
  let router = null;
  let route = null;
  
  // Try to get router immediately when useTabs is called (in setup context)
  try {
    const instance = getCurrentInstance();
    if (instance) {
      router = useRouter();
      route = useRoute();
    }
  } catch (e) {
    // Not in setup context, will try lazily
    console.warn('[useTabs] Not in setup context, router will be lazy-loaded:', e.message);
  }
  
  const getRouter = () => {
    if (!router) {
      try {
        const instance = getCurrentInstance();
        if (instance) {
          router = useRouter();
        } else {
          // No injection context (e.g. useTabs() after await in a watcher) — use app singleton
          router = appRouter;
        }
      } catch (e) {
        console.error('[useTabs] Error getting router:', e);
        if (!router) {
          router = appRouter;
        }
      }
    }
    return router;
  };
  
  // Navigate using router (push to create history entries for browser back/forward)
  const navigateToPath = (path) => {
    const currentRouter = getRouter();
    if (currentRouter) {
      // Use push to create history entries so browser back/forward works correctly
      // Each tab navigation creates a history entry, allowing browser back to navigate between tabs
      return currentRouter.push(path).catch((err) => {
        // Ignore duplicate navigation errors (same route)
        if (err.name !== 'NavigationDuplicated') {
          console.log('⚠️ Navigation error (ignored):', err.message);
        }
      });
    } else {
      // Router should always be available in setup context
      // If not, log error but don't use window.location (causes reload)
      console.error('⚠️ Router not available in navigateToPath, cannot navigate to:', path);
      return Promise.resolve();
    }
  };
  
  const getRoute = () => {
    if (!route) {
      try {
        route = useRoute();
      } catch (e) {
        // Not in setup context, return null
        return null;
      }
    }
    return route;
  };

  // Find tab by ID
  const findTabById = (id) => {
    return tabs.value.find(tab => tab.id === id);
  };

  // Heuristic: path looks like a record detail (e.g. /deals/123, /people/456) so new tab should open adjacent.
  // Used when insertAdjacent is not explicitly set — so new modules get correct behavior by default.
  const looksLikeRecordPath = (path) => isRecordDetailTabPath(path);

  // Find tab by path (exact match or path without query params)
  const findTabByPath = (path) => {
    // First try exact match
    const exactMatch = tabs.value.find(tab => tab.path === path);
    if (exactMatch) return exactMatch;
    
    // If path has query params, try matching without them
    const pathWithoutQuery = path.split('?')[0];
    return tabs.value.find(tab => {
      const tabPathWithoutQuery = tab.path.split('?')[0];
      return tabPathWithoutQuery === pathWithoutQuery;
    });
  };

  // Sync active tab with current route (for browser navigation ONLY)
  const syncTabWithRoute = (path) => {
    logTabsDebug('🔄 syncTabWithRoute called with path:', path);
    
    // Skip on mobile
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobile) {
      return;
    }
    
    // Skip if path is login, landing, or audit app (no tabs)
    // Audit app has its own layout and doesn't use the CRM tabs system
    // Settings now uses internal tabs
    if (path === '/login' || path === '/' || path.startsWith('/audit/') || isStandalonePublicRoute(path)) {
      logTabsDebug('⏭️ Skipping sync for path:', path);
      return;
    }
    
    // Double-check programmatic navigation flag (safety check)
    if (isProgrammaticNavigation) {
      logTabsDebug('🔒 syncTabWithRoute: Programmatic navigation detected, skipping');
      return;
    }
    
    // Find existing tab for this path (with or without query params)
    const existingTab = findTabByPath(path);
    const pathWithoutQuery = String(path || '').split('?')[0];
    const isCreateRoute = /\/new\/?$/.test(pathWithoutQuery);
    const parentListPath = isCreateRoute ? pathWithoutQuery.replace(/\/new\/?$/, '') : null;

    // Create routes should reuse their parent list tab (drawer opens in same tab).
    if (!existingTab && parentListPath) {
      const parentTab = findTabByPath(parentListPath);
      if (parentTab) {
        if (activeTabId.value !== parentTab.id) {
          activeTabId.value = parentTab.id;
        }
        const parentTitle = getTitleForPath(parentListPath, parentTab.params || {});
        if (parentTitle && parentTab.title !== parentTitle) {
          parentTab.title = parentTitle;
        }
        return;
      }
    }
    
    if (existingTab) {
      // Tab exists, switch to it ONLY if we're not already on it
      if (activeTabId.value !== existingTab.id) {
        logTabsDebug('🔄 Syncing tab for browser navigation:', existingTab.title, 'from', activeTabId.value, 'to', existingTab.id);
        activeTabId.value = existingTab.id;
      } else {
        logTabsDebug('✅ Already on correct tab, no sync needed');
      }

      const newTitle = getTitleForPath(path, existingTab.params || {});
      if (newTitle && existingTab.title !== newTitle && !shouldPreserveRecordTabTitle(existingTab, path)) {
        existingTab.title = newTitle;
      }
    } else {
      // Tab doesn't exist, create one
      // This handles cases where user navigates via browser back/forward to a route
      // that doesn't have a tab yet (e.g., direct URL entry, bookmark, etc.)
      logTabsDebug('✨ Creating tab for browser navigation:', path);
      // Home tab should not be closable
      const isHome = path === '/platform/home';
      
      // CRITICAL: Check if home tab already exists before creating a new one
      // This prevents duplicate home tabs when syncTabWithRoute is called
      if (isHome) {
        const existingHomeTab = tabs.value.find(tab => tab.id === 'home' || tab.path === '/platform/home');
        if (existingHomeTab) {
          console.log('🔄 [syncTabWithRoute] Home tab already exists, switching to it instead of creating duplicate');
          activeTabId.value = existingHomeTab.id;
          // Update path if it differs (e.g., query params)
          if (existingHomeTab.path !== path) {
            existingHomeTab.path = path;
          }
          return;
        }
      }
      
      const newTab = {
        id: isHome ? 'home' : generateTabId(),
        title: getTitleForPath(path),
        path: path,
        icon: getIconComponent(getIconForPath(path)),
        closable: !isHome,
        params: {}
      };
      tabs.value.push(newTab);
      activeTabId.value = newTab.id;
    }
  };

  // Initialize tabs (can be called from router guard - no route access)
  const initTabs = () => {
    // Don't initialize tabs on mobile
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobile) {
      console.log('📱 Mobile detected, skipping tab initialization');
      return;
    }
    if (!storageConfigured || !storageKey) {
      console.error('[Tabs] initTabs called before storage was configured. Tabs will not initialize.');
      return;
    }
    
    console.log('🔄 [initTabs] Starting tab initialization...');
    loadTabsFromStorage();
    
    // Don't create home tab here - let setupRouteWatcher decide based on current route
    // This prevents creating unnecessary home tabs when on dashboard routes
    // setupRouteWatcher will create the appropriate tab (home or dashboard) based on the route
    if (tabs.value.length === 0) {
      console.log('🔄 [initTabs] No tabs found after load, setupRouteWatcher will create appropriate tab based on route');
    } else {
      // Check if home tab exists, but don't force-create it if we have other tabs
      // setupRouteWatcher will handle creating it if needed when navigating to platform home
      const homeTab = tabs.value.find(tab => tab.id === 'home' || tab.path === '/platform/home');
      if (homeTab) {
        // Ensure home tab is properly configured
        if (homeTab.path !== '/platform/home' || homeTab.id !== 'home') {
          console.log('🔄 [initTabs] Migrating existing tab to home tab');
          homeTab.id = 'home';
          homeTab.path = '/platform/home';
          homeTab.title = 'Home';
          homeTab.icon = getIconComponent('home');
          homeTab.closable = false;
          // Force reactive update
          tabs.value = [...tabs.value];
          // Save immediately
          if (storageConfigured && storageKey) {
            saveTabsToStorage();
          }
        }
        // Only set home as active if no tab is currently active
        if (!activeTabId.value) {
          activeTabId.value = 'home';
        }
        console.log('✅ [initTabs] Home tab exists and configured, tabs count:', tabs.value.length);
      } else {
        // Home tab doesn't exist, but we have other tabs
        // Don't force-create it here - setupRouteWatcher will create it only if needed
        console.log('✅ [initTabs] Tabs exist but no home tab - will be created by setupRouteWatcher if needed');
      }
    }
    
    // Mark as initialized
    tabsInitialized = true;

    if (typeof window !== 'undefined' && !window.__arivuTabsBeforeUnloadHook) {
      window.__arivuTabsBeforeUnloadHook = true;
      window.addEventListener('beforeunload', () => saveTabsToStorage());
      window.addEventListener('pagehide', () => saveTabsToStorage());
    }

    // Log final state for debugging
    console.log('✅ [initTabs] Tab initialization complete:', {
      tabsCount: tabs.value.length,
      tabs: tabs.value.map(t => ({ id: t.id, title: t.title, path: t.path })),
      activeTabId: activeTabId.value,
      tabsInitialized: true
    });
    
    // Note: Route syncing is handled by setupRouteWatcher() in App.vue
  };

  // Setup route watcher (route parameter is optional - we'll use internal route if available)
  const setupRouteWatcher = (routeParam) => {
    // Use the route from useRoute() if available, otherwise use the parameter
    // The internal route from useRoute() is guaranteed to be reactive
    const routeToWatch = route || routeParam;
    
    if (!routeToWatch) {
      console.warn('⚠️ setupRouteWatcher: No route available');
      return;
    }
    
    console.log('🔧 setupRouteWatcher called');
    console.log('🔧 Using route:', routeToWatch.path, routeToWatch.fullPath);
    console.log('🔧 Route is reactive?', route !== null);
    
    // Skip audit routes - they have their own layout and don't use tabs
    // Settings now uses internal tabs
    if (routeToWatch.path.startsWith('/audit/')) {
      console.log('⏭️ Audit route detected, skipping tab watcher setup');
      return;
    }
    
    console.log('✅ Setting up route watcher for path:', routeToWatch.path);
    
    // Don't force-create home tab here - only create it when actually needed
    // (when navigating to platform home or when tabs are empty)
    
    // Sync active tab with current route on initialization  
    const currentPath = routeToWatch.path;
    
    // Track if we restored a tab from storage
    let tabWasRestored = false;
    
    // First, check if we have an active tab from storage - restore it
    // Skip restoration when landing on a public booking URL (e.g. link opened in new tab)
    if (activeTabId.value && !isStandalonePublicRoute(currentPath)) {
      const activeTab = tabs.value.find(tab => tab.id === activeTabId.value);
      if (activeTab) {
        // If user loaded directly on Settings (e.g. bookmark), create Settings tab and stay
        if (currentPath.startsWith('/settings')) {
          console.log('🔄 [setupRouteWatcher] Loading on Settings, creating tab');
          syncTabWithRoute(currentPath);
          tabWasRestored = true;
        } else {
          // Settings tabs are now supported - restore like any other tab
          console.log('🔄 [setupRouteWatcher] Restoring active tab from storage:', activeTab.id, activeTab.path);
          tabWasRestored = true;
          
          // Navigate to the active tab's path if we're not already there
          if (currentPath !== activeTab.path) {
            const currentRouter = getRouter();
            if (currentRouter) {
              isProgrammaticNavigation = true;
              lastProgrammaticPath = activeTab.path;
              currentRouter.replace(activeTab.path).then(() => {
                setTimeout(() => {
                  isProgrammaticNavigation = false;
                  lastProgrammaticPath = null;
                }, 100);
              }).catch(() => {
                setTimeout(() => {
                  isProgrammaticNavigation = false;
                  lastProgrammaticPath = null;
                }, 100);
              });
            }
          }
        }
      } else {
        // Active tab ID exists but tab not found - clear it
        console.warn('⚠️ [setupRouteWatcher] Active tab ID not found in tabs, clearing:', activeTabId.value);
        activeTabId.value = null;
      }
    }
    
    // Only auto-navigate to platform home from root.
    // Keep deep-link routes (for example /tasks/:id) on refresh so record pages don't get replaced.
    // Skip this if we restored a tab from storage.
    if (!tabWasRestored && currentPath === '/') {
      console.log('🔄 [setupRouteWatcher] Navigating to platform home from', currentPath);
      // Navigate to platform home to show it by default (without page refresh)
      const currentRouter = getRouter();
      if (currentRouter) {
        // Ensure home tab exists BEFORE navigation (so it's visible immediately)
        const homeTab = tabs.value.find(tab => tab.id === 'home' || tab.path === '/platform/home');
        if (!homeTab) {
          console.log('🔄 [setupRouteWatcher] Creating home tab before navigation');
          createDefaultTab();
        } else {
          // Only set active if no tab is currently active
          if (!activeTabId.value) {
            activeTabId.value = 'home';
          }
        }
        
        isProgrammaticNavigation = true;
        currentRouter.replace('/platform/home').then(() => {
          // Double-check home tab exists after navigation
          if (!tabs.value.find(tab => tab.id === 'home')) {
            console.log('🔄 [setupRouteWatcher] Home tab missing after navigation, creating it');
            createDefaultTab();
          }
          // Only set active if no tab is currently active
          if (!activeTabId.value) {
            activeTabId.value = 'home';
          }
          setTimeout(() => {
            isProgrammaticNavigation = false;
          }, 100);
        }).catch(() => {
          setTimeout(() => {
            isProgrammaticNavigation = false;
          }, 100);
        });
      }
    } else if (currentPath === '/platform/home') {
      // Already on platform home, ensure home tab exists
      const homeTab = tabs.value.find(tab => tab.id === 'home' || tab.path === '/platform/home');
      if (!homeTab) {
        console.log('🔄 [setupRouteWatcher] On platform home but no home tab, creating it');
        createDefaultTab();
        // Only set active if no other tab is active or if we just created it
        if (!activeTabId.value) {
          activeTabId.value = 'home';
        }
      } else {
        // Only set active to home if no tab is currently active
        // Don't force it if user has another tab open
        if (!activeTabId.value) {
          activeTabId.value = 'home';
        }
      }
    } else if (isStandalonePublicRoute(currentPath)) {
      logTabsDebug('⏭️ [setupRouteWatcher] Standalone public route, keeping URL:', currentPath);
    } else {
      // On a different route (e.g., dashboard route)
      // If tabs are empty, create a tab for the current route
      if (tabs.value.length === 0) {
        console.log('🔄 [setupRouteWatcher] Tabs are empty, creating tab for current route:', routeToWatch.path);
        const wasProgrammatic = isProgrammaticNavigation;
        isProgrammaticNavigation = false;
        syncTabWithRoute(routeToWatch.path);
        isProgrammaticNavigation = wasProgrammatic;
      } else {
        // Tabs exist - check if active tab matches current route
        const activeTab = tabs.value.find(tab => tab.id === activeTabId.value);
        if (activeTab && activeTab.path !== routeToWatch.path) {
          console.log('🔄 Initial sync: active tab path', activeTab.path, 'does not match route', routeToWatch.path);
          // Check if a tab exists for the current route
          const routeTab = findTabByPath(routeToWatch.path);
          if (routeTab) {
            // Switch to existing tab for this route
            activeTabId.value = routeTab.id;
          } else {
            // Create a new tab for the current route
            const wasProgrammatic = isProgrammaticNavigation;
            isProgrammaticNavigation = false;
            syncTabWithRoute(routeToWatch.path);
            isProgrammaticNavigation = wasProgrammatic;
          }
        } else if (!activeTab) {
          console.log('🔄 Initial sync: no active tab found, syncing to route', routeToWatch.path);
          const wasProgrammatic = isProgrammaticNavigation;
          isProgrammaticNavigation = false;
          syncTabWithRoute(routeToWatch.path);
          isProgrammaticNavigation = wasProgrammatic;
        } else {
          console.log('✅ Initial sync: active tab matches route, no sync needed');
        }
      }
    }
    
    // Watch for route changes (browser navigation)
    // Prefer useRoute() (component injection); after await (e.g. post-login) there is no instance — use router.currentRoute
    const getWatchedRoute = () => {
      if (route != null) {
        return route;
      }
      const r = getRouter();
      return r ? r.currentRoute.value : null;
    };

    if (!getWatchedRoute()) {
      console.error('❌ Cannot set up route watcher: no current route and no router');
      return;
    }

    const firstRoute = getWatchedRoute();
    console.log('👀 Setting up route watcher, current route:', firstRoute.path, firstRoute.fullPath);
    console.log('👀 Route from useRoute()?', route != null, firstRoute);
    
    // Watch BOTH path and fullPath to catch all changes including redirects
    const stopWatcher = watch(
      () => {
        const wr = getWatchedRoute();
        if (wr) {
          return [wr.path, wr.fullPath];
        }
        const r = getRouter();
        if (!r) {
          return ['', ''];
        }
        const v = r.currentRoute.value;
        return [v.path, v.fullPath];
      },
      ([newPathValue, newFullPathValue], [oldPathValue, oldFullPathValue]) => {
        const currentRoute = getWatchedRoute();
        if (!currentRoute) {
          return;
        }
        const newPath = currentRoute.path; // Path without query
        const oldPath = oldPathValue ? oldPathValue.split('?')[0] : '';
        const newFullPath = currentRoute.fullPath;
        const oldFullPath = oldFullPathValue || '';
        const isCreateRoute = /\/new\/?$/.test(newPath);
        const parentListPath = isCreateRoute ? newPath.replace(/\/new\/?$/, '') : null;
        
        // Log EVERY route change to debug
        console.log('👀👀👀 Route watcher FIRED:', {
          oldPath,
          newPath,
          newFullPath,
          oldFullPath,
          isProgrammaticNavigation,
          isBrowserNavigation,
          activeTabId: activeTabId.value,
          routePath: currentRoute.path,
          routeFullPath: currentRoute.fullPath
        });
        
        // Skip if paths are the same
        if (newPath === oldPath) {
        console.log('⏭️ Route watcher: paths are the same, skipping');
        return;
      }
      
      // If this is browser navigation (popstate), handle it even if isProgrammaticNavigation is true
      // The popstate handler sets isBrowserNavigation, so check that first
      if (isBrowserNavigation) {
        console.log('🌐 Route watcher: Browser navigation detected via isBrowserNavigation flag');
        // Don't skip - continue to handle browser navigation below
      }
      
      // Ensure home tab exists when navigating to platform home
      if (newPath === '/platform/home') {
        console.log('🏠 Route watcher: Navigating to platform home');
        const homeTab = tabs.value.find(tab => tab.id === 'home' || tab.path === '/platform/home');
        if (!homeTab) {
          console.log('🔄 [Route watcher] On platform home but no home tab, creating it');
          createDefaultTab();
        } else {
          // Ensure home tab is active
          if (activeTabId.value !== 'home') {
            console.log('🔄 [Route watcher] Switching to home tab');
            activeTabId.value = 'home';
            console.log('✅ [Route watcher] Home tab is now active');
          } else {
            console.log('🔒 [Route watcher] Home tab already active');
          }
        }
        return; // Don't continue processing
      }
      
      // Skip routes that don't use tabs (login, landing, audit app)
      // These routes should be handled by the router, not by tab syncing
      // Audit app has its own layout and doesn't use the CRM tabs system
      // Settings now uses internal tabs
      if (newPath === '/login' || newPath === '/' || newPath.startsWith('/audit/') || isStandalonePublicRoute(newPath)) {
        console.log('⏭️ Route watcher: skipping tab sync for non-tab route:', newPath);
        return;
      }
      
      console.log('🔍 Route watcher triggered:', {
        oldPath,
        newPath,
        newFullPath,
        isProgrammaticNavigation,
        activeTabId: activeTabId.value,
        lastProgrammaticPath
      });
      
      // Check if this route change matches a programmatic navigation we just did
      // BUT skip this check if it's browser navigation (popstate handler set the flag)
      if (isProgrammaticNavigation && !isBrowserNavigation) {
        console.log('🔒 Programmatic navigation flag is set (not browser nav), skipping route sync');
        return;
      }
      
      // If it's browser navigation, override the programmatic flag
      if (isBrowserNavigation) {
        console.log('🌐 Route watcher: Browser navigation detected, overriding programmatic flag');
        // Don't skip - continue to handle browser navigation
      }
      
      // Check if this matches the last programmatic path (with or without query)
      // BUT skip this check if it's browser navigation
      if (lastProgrammaticPath && !isBrowserNavigation) {
        const lastPathWithoutQuery = lastProgrammaticPath.split('?')[0];
        const newPathWithoutQuery = newPath.split('?')[0];
        if (lastPathWithoutQuery === newPathWithoutQuery || newFullPath === lastProgrammaticPath) {
          console.log('🔒 Programmatic navigation path matches, skipping route sync');
          lastProgrammaticPath = null; // Reset after use
          return;
        }
      }

      // Keep create routes in their parent list tab so drawer flows stay in-tab.
      if (parentListPath) {
        const parentTab = findTabByPath(parentListPath);
        if (parentTab) {
          if (activeTabId.value !== parentTab.id) {
            activeTabId.value = parentTab.id;
          }
          const parentTitle = getTitleForPath(parentListPath, parentTab.params || {});
          if (parentTitle && parentTab.title !== parentTitle) {
            parentTab.title = parentTitle;
          }
          return;
        }
      }
      
      // Check if active tab already matches this route (with or without query params)
      const currentActiveTab = tabs.value.find(tab => tab.id === activeTabId.value);
      if (currentActiveTab) {
        const currentPathWithoutQuery = currentActiveTab.path.split('?')[0];
        const newPathWithoutQuery = newPath.split('?')[0];
        if (currentPathWithoutQuery === newPathWithoutQuery) {
          // Module list tab should always show the module name
          const isListRoute = newPathWithoutQuery === '/tasks' || newPathWithoutQuery === '/deals' || newPathWithoutQuery === '/events' ||
            newPathWithoutQuery === '/people' || newPathWithoutQuery === '/organizations' || newPathWithoutQuery === '/forms' ||
            newPathWithoutQuery === '/items' || newPathWithoutQuery === '/imports' || newPathWithoutQuery === '/trash' ||
            newPathWithoutQuery === '/helpdesk/cases' ||
            newPathWithoutQuery === '/platform/home' || newPathWithoutQuery === '/sales/dashboard' || newPathWithoutQuery.startsWith('/control/') || newPathWithoutQuery.startsWith('/settings/automation/');
          if (isListRoute) {
            const moduleTitle = getTitleForPath(newPathWithoutQuery, currentActiveTab.params || {});
            if (moduleTitle && currentActiveTab.title !== moduleTitle) {
              currentActiveTab.title = moduleTitle;
            }
          }
          console.log('✅ Active tab already matches route, skipping sync');
          return;
        }
      }
      
      // Check if a tab already exists for this route (to prevent duplicates)
      // Check both with and without query params
      const existingTabForRoute = findTabByPath(newFullPath) || findTabByPath(newPath);
      if (existingTabForRoute) {
        // Check if popstate handler already switched to this tab
        // Only skip if the active tab already matches (popstate handled it)
        if (isBrowserNavigation && activeTabId.value === existingTabForRoute.id) {
          console.log('🔒 Browser navigation already handled by popstate, tab already switched');
          // Reset flag after checking
          setTimeout(() => {
            isBrowserNavigation = false;
          }, 50);
          return;
        }
        
        console.log('🌐 Route watcher: Tab exists for route, switching to it:', existingTabForRoute.id, existingTabForRoute.title);
        console.log('🌐 Current activeTabId:', activeTabId.value);
        console.log('🌐 Target tab ID:', existingTabForRoute.id);
        console.log('🌐 isBrowserNavigation:', isBrowserNavigation);
        
        // CRITICAL: Switch to tab synchronously BEFORE components process route change
        // This ensures activeTabId is set before any component watchers fire
        // FORCE the switch even if localStorage might have a different value
        if (activeTabId.value !== existingTabForRoute.id) {
          // Set activeTabId synchronously without navigation (route already changed via browser back)
          // This will trigger the watcher to save to localStorage, which is fine
          activeTabId.value = existingTabForRoute.id;
          console.log('✅ Route watcher switched to tab:', existingTabForRoute.id);
          console.log('✅ New activeTabId value:', activeTabId.value);
          
          // Force save to localStorage immediately to prevent any race conditions
          saveTabsToStorage();
        } else {
          console.log('🔒 Tab already active, no switch needed');
        }
        
        // Reset browser navigation flag since we handled it
        if (isBrowserNavigation) {
          setTimeout(() => {
            isBrowserNavigation = false;
          }, 50);
        }
        
        // Update tab path if it differs (e.g., query params changed)
        if (existingTabForRoute.path !== newPath && existingTabForRoute.path !== newFullPath) {
          const pathWithoutQuery = existingTabForRoute.path.split('?')[0];
          const newPathWithoutQuery = newPath.split('?')[0];
          if (pathWithoutQuery === newPathWithoutQuery) {
            existingTabForRoute.path = newFullPath;
            console.log('🔄 Updated tab path to match route:', newFullPath);
          }
        }
        // Restore title for list/module routes when switching to this tab (e.g. back to /tasks so tab shows "Tasks" not record name)
        const newPathBase = newPath.split('?')[0];
        const isListRoute = newPathBase === '/tasks' || newPathBase === '/deals' || newPathBase === '/events' ||
          newPathBase === '/people' || newPathBase === '/organizations' || newPathBase === '/forms' ||
          newPathBase === '/items' || newPathBase === '/imports' || newPathBase === '/trash' ||
          newPathBase === '/helpdesk/cases' ||
          newPathBase === '/platform/home' || newPathBase === '/sales/dashboard' || newPathBase.startsWith('/control/') || newPathBase.startsWith('/settings/automation/');
        if (isListRoute) {
          const titleForPath = getTitleForPath(newPathBase, existingTabForRoute.params || {});
          if (titleForPath) existingTabForRoute.title = titleForPath;
        }
        return;
      }
      
      // This must be browser navigation (back/forward button)
      console.log('🌐 Browser navigation detected - syncing tabs:', oldPath, '→', newPath);
      syncTabWithRoute(newPath);
    }, { flush: 'sync' }); // Use sync flush to ensure tab switch happens before components process route change
    
    // Intercept browser back/forward navigation BEFORE Vue Router processes it
    // This ensures tab switching happens before components mount
    const handlePopState = (event) => {
      // Get the target path from the location
      const targetPath = window.location.pathname + window.location.search;
      const targetPathWithoutQuery = window.location.pathname;
      
      console.log('🔙 Popstate event fired:', {
        targetPath,
        targetPathWithoutQuery,
        isProgrammaticNavigation,
        lastProgrammaticPath,
        currentRoute: getWatchedRoute()?.path
      });
      
      // Skip if this matches a programmatic navigation
      if (isProgrammaticNavigation || lastProgrammaticPath === targetPath || lastProgrammaticPath === targetPathWithoutQuery) {
        console.log('🔙 Skipping - programmatic navigation');
        return;
      }
      
      // Skip non-tab routes (but log it)
      // Settings now uses internal tabs
      if (targetPathWithoutQuery === '/login' || targetPathWithoutQuery === '/' ||
          targetPathWithoutQuery.startsWith('/audit/') || isStandalonePublicRoute(targetPathWithoutQuery)) {
        console.log('🔙 Skipping - non-tab route:', targetPathWithoutQuery);
        return;
      }
      
      console.log('🔙 Popstate detected, switching tab BEFORE route change:', targetPath);
      console.log('🔙 Current tabs:', tabs.value.map(t => ({ id: t.id, path: t.path, title: t.title })));
      console.log('🔙 Current activeTabId:', activeTabId.value);
      
      // Mark as browser navigation (use module-level variable)
      isBrowserNavigation = true;
      
      // Find tab for the target path
      const targetTab = findTabByPath(targetPath) || findTabByPath(targetPathWithoutQuery);
      console.log('🔙 Target tab found:', targetTab ? { id: targetTab.id, path: targetTab.path, title: targetTab.title } : 'NOT FOUND');
      
      if (targetTab) {
        // Switch to tab IMMEDIATELY before Vue Router processes the route change
        if (activeTabId.value !== targetTab.id) {
          console.log('🔙 Switching from tab:', activeTabId.value, 'to tab:', targetTab.id);
          activeTabId.value = targetTab.id;
          console.log('✅ Tab switched BEFORE route change:', targetTab.id, targetTab.title);
          console.log('✅ New activeTabId:', activeTabId.value);
        } else {
          console.log('🔙 Tab already active, no switch needed');
        }
        // Update tab path if needed
        if (targetTab.path !== targetPath && targetTab.path !== targetPathWithoutQuery) {
          const tabPathWithoutQuery = targetTab.path.split('?')[0];
          if (tabPathWithoutQuery === targetPathWithoutQuery) {
            targetTab.path = targetPath;
            console.log('🔄 Updated tab path to match route:', targetPath);
          }
        }
      } else {
        console.warn('⚠️ No tab found for path:', targetPath, '- route watcher will handle it');
      }
      
      // Reset flag after a short delay to allow route watcher to skip
      setTimeout(() => {
        isBrowserNavigation = false;
      }, 200);
    };
    
    // Add popstate listener with capture phase to run before Vue Router
    window.addEventListener('popstate', handlePopState, true);
    console.log('✅ Popstate listener registered with capture phase');
    
    // ALSO use router.afterEach as a fallback to catch route changes
    // This ensures we catch browser navigation even if the watcher doesn't fire
    // Wait a bit to ensure router is fully initialized
    let routerAfterEachUnregister = null;
    
    const routerDebug = () => import.meta.env.DEV;
    const registerRouterHook = () => {
      const currentRouter = getRouter();
      if (routerDebug()) {
        console.log('🔍 Router available for afterEach?', !!currentRouter);
        console.log('🔍 Router object:', currentRouter);
      }
      
      if (currentRouter && !routerAfterEachUnregister) {
        if (routerDebug()) console.log('🔍 Registering router.afterEach hook...');
        routerAfterEachUnregister = currentRouter.afterEach((to, from) => {
        if (routerDebug()) {
          console.log('🔄🔄🔄 Router afterEach FIRED:', {
            to: to.path,
            from: from.path,
            toFullPath: to.fullPath,
            fromFullPath: from.fullPath,
            isProgrammaticNavigation,
            activeTabId: activeTabId.value
          });
        }
        
        // Only handle if this is browser navigation (not programmatic)
        if (isProgrammaticNavigation) {
          if (routerDebug()) console.log('🔒 Router afterEach: Skipping - programmatic navigation');
          return;
        }
        
        const toPath = to.path;
        const fromPath = from.path;
        
        // Skip if paths are the same
        if (toPath === fromPath) {
          if (routerDebug()) console.log('⏭️ Router afterEach: Paths are the same, skipping');
          return;
        }
        
        if (routerDebug()) console.log('🔄 Router afterEach: Browser navigation detected:', fromPath, '→', toPath);
        
        // Find tab for the new route
        const targetTab = findTabByPath(to.fullPath) || findTabByPath(toPath);
        if (routerDebug()) console.log('🔄 Router afterEach: Target tab found?', !!targetTab, targetTab ? { id: targetTab.id, path: targetTab.path } : null);
        
        if (targetTab && activeTabId.value !== targetTab.id) {
          if (routerDebug()) console.log('🔄 Router afterEach: Switching to tab:', targetTab.id, 'from:', activeTabId.value);
          activeTabId.value = targetTab.id;
          saveTabsToStorage(); // Force save to override localStorage
          if (routerDebug()) console.log('✅ Router afterEach: Tab switched to:', targetTab.id, 'new activeTabId:', activeTabId.value);
        } else if (targetTab) {
          if (routerDebug()) console.log('🔒 Router afterEach: Tab already active');
        } else {
          if (routerDebug()) console.log('⚠️ Router afterEach: No tab found for route:', toPath);
        }
      });
        if (routerDebug()) console.log('✅ Router afterEach hook registered, unregister function:', typeof routerAfterEachUnregister === 'function');
      } else if (!currentRouter) {
        if (routerDebug()) console.warn('⚠️ Router not available yet, will retry...');
        // Retry after a short delay
        setTimeout(registerRouterHook, 100);
      }
    };
    
    // Try to register immediately
    registerRouterHook();
    
    // Also try after a delay in case router initializes later
    setTimeout(registerRouterHook, 500);
    
    console.log('✅ Route watcher setup complete. Watching route:', getWatchedRoute()?.path);
    console.log('✅ Watcher stop function created:', typeof stopWatcher === 'function');
    
    // Return cleanup function
    return () => {
      stopWatcher(); // Stop the route watcher
      if (routerAfterEachUnregister) {
        routerAfterEachUnregister(); // Unregister router hook
      }
      window.removeEventListener('popstate', handlePopState, true);
      console.log('🧹 Popstate listener and route watcher removed');
    };
  };

  // Get active tab
  const activeTab = computed(() => {
    return tabs.value.find(tab => tab.id === activeTabId.value);
  });

  // Create or focus tab
  const openTab = (path, options = {}) => {
    const isBackground = options.background || false;
    console.log('🔵 openTab called:', path, 'background:', isBackground);
    
    // On mobile (< md breakpoint), just navigate without creating tabs
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobile) {
      console.log('📱 Mobile detected, navigating without tab creation');
      isProgrammaticNavigation = true;
      navigateToPath(path).then(() => {
        setTimeout(() => {
          isProgrammaticNavigation = false;
        }, 50);
      });
      return null;
    }

    const pathOnly = String(path || '').split('?')[0].split('#')[0];
    const isHelpdeskCasesTab =
      pathOnly === '/helpdesk/cases' || pathOnly.startsWith('/helpdesk/cases/');
    
    // Check if tab already exists
    const existingTab = findTabByPath(path);
    
    if (existingTab) {
      console.log('📍 Tab already exists:', existingTab.id);

      if (options.title && isRecordDetailTabPath(path)) {
        applyRecordTabTitle(existingTab, options.title);
      } else {
        const newTitle = options.title || getTitleForPath(path, options.params);
        if (newTitle && existingTab.title !== newTitle && !shouldPreserveRecordTabTitle(existingTab, path)) {
          existingTab.title = newTitle;
        }
      }

      if (isHelpdeskCasesTab) {
        existingTab.icon = getIconComponent('cases');
      }
      
      // If not background mode, focus the tab
      if (!isBackground) {
        activeTabId.value = existingTab.id;
        // Mark as programmatic navigation to prevent route watcher from syncing
        isProgrammaticNavigation = true;
        lastProgrammaticPath = path;
        // Always navigate to ensure the route is loaded
        navigateToPath(path).then(() => {
          setTimeout(() => {
            isProgrammaticNavigation = false;
            lastProgrammaticPath = null;
          }, 300); // Increased timeout to prevent route watcher from creating duplicate tabs
        }).catch(() => {
          setTimeout(() => {
            isProgrammaticNavigation = false;
            lastProgrammaticPath = null;
          }, 300);
        });
      } else {
        console.log('🔕 Background mode: tab exists but not switching to it');
      }
      return existingTab;
    }
    
    const tabIconId =
      options.icon && !isHelpdeskCasesTab
        ? String(options.icon).toLowerCase()
        : getIconForPath(pathOnly);

    // Create new tab
    const titleMeta = options.titleKey
      ? { titleKey: options.titleKey, titleParams: options.titleParams || {} }
      : options.title
        ? { title: options.title }
        : getTabTitleMetaForPath(path, options.params || {});

    const newTab = {
      id: options.id || generateTabId(),
      ...titleMeta,
      title: options.title || (titleMeta.titleKey ? undefined : getTitleForPath(path, options.params)),
      path: path,
      icon: getIconComponent(tabIconId),
      closable: options.closable !== false, // Default to closable
      params: options.params || {}
    };

    if (options.title && isRecordDetailTabPath(pathOnly)) {
      applyRecordTabTitle(newTab, options.title);
    } else if (options.params?.name && isRecordDetailTabPath(pathOnly)) {
      applyRecordTabTitle(newTab, options.params.name);
    }

    console.log('✨ Creating new tab:', newTab.id, newTab.title);
    // Record opens: next to current tab. Section/sidebar: at end. Explicit option wins; else infer from path for new modules.
    const insertAdjacent = options.insertAdjacent === true
      || (options.insertAdjacent === undefined && looksLikeRecordPath(path));
    if (insertAdjacent) {
      const currentIndex = tabs.value.findIndex(tab => tab.id === activeTabId.value);
      if (currentIndex >= 0) {
        tabs.value.splice(currentIndex + 1, 0, newTab);
      } else {
        tabs.value.push(newTab);
      }
    } else {
      tabs.value.push(newTab);
    }
    
    // Only switch to tab and navigate if NOT background mode
    if (!isBackground) {
      activeTabId.value = newTab.id;
      // Mark as programmatic navigation BEFORE navigating to prevent route watcher from syncing
      isProgrammaticNavigation = true;
      lastProgrammaticPath = path;
      
      // Always navigate to show the new tab content
      navigateToPath(path).then(() => {
        setTimeout(() => {
          isProgrammaticNavigation = false;
          lastProgrammaticPath = null;
        }, 500); // Increased timeout to prevent route watcher from creating duplicate tabs
      }).catch(() => {
        setTimeout(() => {
          isProgrammaticNavigation = false;
          lastProgrammaticPath = null;
        }, 500);
      });
      console.log('✅ openTab complete (foreground), activeTabId:', activeTabId.value);
    } else {
      console.log('✅ openTab complete (background), tab created but not active');
    }
    
    return newTab;
  };

  // Close tab
  const closeTab = async (tabId) => {
    const index = tabs.value.findIndex(tab => tab.id === tabId);
    
    if (index === -1) return;
    
    const tab = tabs.value[index];
    
    // Don't close non-closable tabs
    if (!tab.closable) return;
    
    // Check for beforeClose callback (can be async)
    console.log('🔵 closeTab: Checking beforeClose for tab:', tab.id, 'has callback:', !!tab.beforeClose);
    if (tab.beforeClose && typeof tab.beforeClose === 'function') {
      console.log('🔵 closeTab: Calling beforeClose for tab:', tab.id);
      try {
        const shouldClose = await tab.beforeClose();
        console.log('🔵 closeTab: beforeClose returned:', shouldClose);
        if (shouldClose === false) {
          console.log('🔵 closeTab: beforeClose returned false, not closing');
          return; // Don't close if beforeClose returns false
        }
      } catch (error) {
        console.error('🔵 closeTab: Error in beforeClose:', error);
        // Continue with close even if beforeClose errors
      }
    } else {
      console.log('🔵 closeTab: No beforeClose callback for tab:', tab.id);
    }
    
    // Remove tab
    tabs.value.splice(index, 1);
    
    // If closing active tab, switch to another tab
    if (tabId === activeTabId.value) {
      if (tabs.value.length > 0) {
        // Switch to previous tab, or next tab, or first tab
        const newActiveTab = tabs.value[Math.max(0, index - 1)];
        activeTabId.value = newActiveTab.id;
        // Restore module title when switching back to a list tab (e.g. close record → list tab shows "Tasks" not record name)
        const pathBase = (newActiveTab.path || '').split('?')[0];
        const isListPath = pathBase === '/tasks' || pathBase === '/deals' || pathBase === '/events' ||
          pathBase === '/people' || pathBase === '/organizations' || pathBase === '/forms' ||
          pathBase === '/items' || pathBase === '/imports' || pathBase === '/trash' ||
          pathBase === '/helpdesk/cases' ||
          pathBase === '/platform/home' || pathBase === '/sales/dashboard' || pathBase.startsWith('/control/') || pathBase.startsWith('/settings/automation/');
        if (isListPath) {
          const listTitle = getTitleForPath(pathBase, newActiveTab.params || {});
          if (listTitle) newActiveTab.title = listTitle;
        }
        // Mark as programmatic navigation
        isProgrammaticNavigation = true;
        lastProgrammaticPath = newActiveTab.path;
        // Always navigate to the new tab
        navigateToPath(newActiveTab.path).then(() => {
          setTimeout(() => {
            isProgrammaticNavigation = false;
            lastProgrammaticPath = null;
          }, 100);
        }).catch(() => {
          setTimeout(() => {
            isProgrammaticNavigation = false;
            lastProgrammaticPath = null;
          }, 100);
        });
      }
    }
  };

  // Close all tabs except one
  const closeOtherTabs = (keepTabId) => {
    tabs.value = tabs.value.filter(tab => 
      tab.id === keepTabId || !tab.closable
    );
    
    if (activeTabId.value !== keepTabId) {
      const keepTab = findTabById(keepTabId);
      if (keepTab) {
        activeTabId.value = keepTabId;
        // Mark as programmatic navigation
        isProgrammaticNavigation = true;
        lastProgrammaticPath = keepTab.path;
        // Always navigate to the kept tab
        navigateToPath(keepTab.path).then(() => {
          setTimeout(() => {
            isProgrammaticNavigation = false;
            lastProgrammaticPath = null;
          }, 100);
        }).catch(() => {
          setTimeout(() => {
            isProgrammaticNavigation = false;
            lastProgrammaticPath = null;
          }, 100);
        });
      }
    }
  };

  // Close all closable tabs
  const closeAllTabs = () => {
    tabs.value = tabs.value.filter(tab => !tab.closable);
    
    // Switch to first non-closable tab (should be home)
    if (tabs.value.length > 0) {
      const firstTab = tabs.value[0];
      activeTabId.value = firstTab.id;
      // Mark as programmatic navigation
      isProgrammaticNavigation = true;
      lastProgrammaticPath = firstTab.path;
      // Always navigate to the first tab
      navigateToPath(firstTab.path).then(() => {
        setTimeout(() => {
          isProgrammaticNavigation = false;
          lastProgrammaticPath = null;
        }, 100);
      }).catch(() => {
        setTimeout(() => {
          isProgrammaticNavigation = false;
          lastProgrammaticPath = null;
        }, 100);
      });
    }
  };

  // Switch to tab
  const switchToTab = (tabId) => {
    console.log('🔄 switchToTab called:', tabId);
    const tab = findTabById(tabId);
    if (tab) {
      helpdeskTabAlertController.clearTabAlert(tab);
      console.log('📍 Switching to tab:', tab.title, 'path:', tab.path);
      
      // Mark as programmatic navigation FIRST, before any navigation
      isProgrammaticNavigation = true;
      lastProgrammaticPath = tab.path; // Track this path
      
      // Update active tab ID
      activeTabId.value = tabId;
      
      // Always navigate to ensure the route is loaded
      navigateToPath(tab.path).then(() => {
        console.log('✅ Navigation complete to:', tab.path);
        // Reset flag after navigation completes
        setTimeout(() => {
          isProgrammaticNavigation = false;
          lastProgrammaticPath = null;
        }, 100);
      }).catch((err) => {
        console.log('⚠️ Navigation error (ignored):', err.message);
        // Reset flag even on error
        setTimeout(() => {
          isProgrammaticNavigation = false;
          lastProgrammaticPath = null;
        }, 100);
      });
      console.log('✅ switchToTab complete, activeTabId:', activeTabId.value);
    } else {
      console.error('❌ Tab not found:', tabId);
    }
  };

  // Update tab title
  const updateTabTitle = (tabId, newTitle) => {
    const tab = findTabById(tabId);
    if (!tab || newTitle == null) return;
    applyRecordTabTitle(tab, newTitle);
    const trimmed = getPersistedRecordTabName(tab);
    if (tab.alertBaseTitle && trimmed) {
      tab.alertBaseTitle = trimmed;
    }
    saveTabsToStorage();
  };

  /**
   * Replace the current tab's path and title in place, then navigate.
   * Use for prev/next record navigation so the same tab is reused instead of opening a new one.
   * @param {string} path - Full path (including query if needed), e.g. '/deals/123' or '/deals/123?navCtx=...'
   * @param {{ title?: string, params?: object }} options - Optional title and params for getTitleForPath
   */
  const replaceActiveTab = (path, options = {}) => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobile) {
      isProgrammaticNavigation = true;
      navigateToPath(path).then(() => {
        setTimeout(() => { isProgrammaticNavigation = false; }, 50);
      });
      return;
    }
    const currentActiveTab = tabs.value.find(tab => tab.id === activeTabId.value);
    if (!currentActiveTab) {
      isProgrammaticNavigation = true;
      lastProgrammaticPath = path;
      navigateToPath(path).then(() => {
        setTimeout(() => {
          isProgrammaticNavigation = false;
          lastProgrammaticPath = null;
        }, 300);
      });
      return;
    }
    currentActiveTab.path = path;
    if (options.title && isRecordDetailTabPath(path)) {
      applyRecordTabTitle(currentActiveTab, options.title);
    } else {
      const newTitle = options.title || getTitleForPath(path.split('?')[0], options.params || {});
      if (!shouldPreserveRecordTabTitle(currentActiveTab, path)) {
        currentActiveTab.title = newTitle;
      }
    }
    if (options.params) {
      currentActiveTab.params = { ...currentActiveTab.params, ...options.params };
    }
    isProgrammaticNavigation = true;
    lastProgrammaticPath = path;
    navigateToPath(path).then(() => {
      setTimeout(() => {
        isProgrammaticNavigation = false;
        lastProgrammaticPath = null;
      }, 300);
    }).catch(() => {
      setTimeout(() => {
        isProgrammaticNavigation = false;
        lastProgrammaticPath = null;
      }, 300);
    });
  };

  // Reorder tabs
  const reorderTabs = (fromIndex, toIndex) => {
    const movedTab = tabs.value.splice(fromIndex, 1)[0];
    tabs.value.splice(toIndex, 0, movedTab);
  };

  // Note: handleNavigation removed as it caused circular loops with router.beforeEach
  // Tab creation is now handled explicitly by click handlers only

  return {
    // State - Return refs directly for better reactivity in templates
    tabs,
    activeTabId,
    activeTab,
    
    // Methods
    initTabs,
    setupRouteWatcher,
    openTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    switchToTab,
    updateTabTitle,
    replaceActiveTab,
    reorderTabs,
    findTabById,
    findTabByPath,
    markHelpdeskTabAlertForCase,
    markHelpdeskTabAlertForNewCase,
    tabShowsHelpdeskAlert,
    clearHelpdeskTabAlert: helpdeskTabAlertController.clearTabAlertById,
    clearHelpdeskTabAlertForCase: helpdeskTabAlertController.clearTabAlertForCase
  };
}

