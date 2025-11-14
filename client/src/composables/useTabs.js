import { ref, computed, watch, getCurrentInstance } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { 
  HomeIcon,
  UsersIcon,
  BuildingOfficeIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  CalendarIcon,
  ArrowDownTrayIcon,
  FolderIcon,
  BookOpenIcon,
  ComputerDesktopIcon,
  DocumentTextIcon
} from '@heroicons/vue/24/outline';

// Tab state management
const tabs = ref([]);
const activeTabId = ref(null);

// Flag to track programmatic navigation (to avoid circular loops)
let isProgrammaticNavigation = false;
let lastProgrammaticPath = null;

// Icon mapping for serialization/deserialization
const iconMap = {
  'home': HomeIcon,
  'users': UsersIcon,
  'building': BuildingOfficeIcon,
  'briefcase': BriefcaseIcon,
  'check': CheckCircleIcon,
  'calendar': CalendarIcon,
  'download': ArrowDownTrayIcon,
  'folder': FolderIcon,
  'book': BookOpenIcon,
  'computer': ComputerDesktopIcon,
  'document': DocumentTextIcon
};

// Map emoji icons to icon identifiers
const migrateEmojiToIconId = (emojiIcon) => {
  const emojiToIconIdMap = {
    '🏠': 'home',
    '👥': 'users',
    '👤': 'users', // Contact detail icon
    '🏢': 'building',
    '💼': 'briefcase',
    '✅': 'check',
    '📅': 'calendar',
    '⬇️': 'download',
    '📁': 'folder',
    '📚': 'book',
    '🖥️': 'computer',
    '📄': 'document'
  };
  
  return emojiToIconIdMap[emojiIcon] || 'document';
};

// Convert icon identifier to component
const getIconComponent = (iconId) => {
  return iconMap[iconId] || DocumentTextIcon;
};

// Load tabs from localStorage on initialization
const loadTabsFromStorage = () => {
  try {
    const stored = localStorage.getItem('litedesk-tabs');
    if (stored) {
      const parsed = JSON.parse(stored);
      tabs.value = parsed.tabs || [];
      activeTabId.value = parsed.activeTabId || null;
      
      // Convert icon identifiers back to components
      tabs.value.forEach(tab => {
        if (typeof tab.icon === 'string') {
          // Check if it's an emoji (for migration)
          if (tab.icon.match(/[\u{1F300}-\u{1F9FF}]/u)) {
            console.log('🔄 Migrating emoji icon to icon ID:', tab.icon, 'for tab:', tab.title);
            tab.icon = migrateEmojiToIconId(tab.icon);
          }
          // Convert icon ID to component
          tab.icon = getIconComponent(tab.icon);
        }
      });
      
      // If no tabs, create dashboard tab
      if (tabs.value.length === 0) {
        createDefaultTab();
      }
    } else {
      createDefaultTab();
    }
  } catch (e) {
    console.error('Error loading tabs:', e);
    createDefaultTab();
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

// Save tabs to localStorage
const saveTabsToStorage = () => {
  try {
    // Convert icon components to identifiers for serialization
    const tabsToSave = tabs.value.map(tab => ({
      ...tab,
      icon: typeof tab.icon === 'function' ? getIconId(tab.icon) : tab.icon
    }));
    
    localStorage.setItem('litedesk-tabs', JSON.stringify({
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

// Create default dashboard tab
const createDefaultTab = () => {
  const dashboardTab = {
    id: 'dashboard',
    title: 'Dashboard',
    path: '/dashboard',
    icon: getIconComponent('home'), // Convert to component immediately
    closable: false // Dashboard tab cannot be closed
  };
  tabs.value = [dashboardTab];
  activeTabId.value = 'dashboard';
};

// Generate unique tab ID
const generateTabId = () => {
  return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Get icon for route
const getIconForPath = (path) => {
  const icons = {
    '/dashboard': 'home',
    '/contacts': 'users',
    '/people': 'users',
    '/organizations': 'building',
    '/deals': 'briefcase',
    '/tasks': 'check',
    '/calendar': 'calendar',
    '/events': 'calendar',
    '/imports': 'download',
    '/items': 'folder',
    '/demo-requests': 'book',
    '/instances': 'computer'
  };
  
  // Check for base path
  const basePath = '/' + path.split('/')[1];
  return icons[basePath] || icons[path] || 'document';
};

// Get title for route
const getTitleForPath = (path, params = {}) => {
  const titles = {
    '/dashboard': 'Dashboard',
    '/contacts': 'Contacts',
    '/organizations': 'Organizations',
    '/deals': 'Deals',
    '/tasks': 'Tasks',
    '/calendar': 'Calendar',
    '/imports': 'Imports',
    '/items': 'Projects',
    '/demo-requests': 'Demo Requests',
    '/instances': 'Instances'
  };
  
  // Check for base path
  const basePath = '/' + path.split('/')[1];
  
  // If it's a detail page (has ID), customize title
  if (path.split('/').length > 2) {
    const segments = path.split('/');
    const module = segments[1];
    const id = segments[2];
    
    // Capitalize module name
    const moduleName = module.charAt(0).toUpperCase() + module.slice(1);
    
    // If we have a name in params, use it
    if (params.name) {
      return `${moduleName}: ${params.name}`;
    }
    
    return `${moduleName} Detail`;
  }
  
  return titles[basePath] || titles[path] || 'Page';
};

export function useTabs() {
  // Lazy router/route access - only when in setup context
  let router = null;
  let route = null;
  
  const getRouter = () => {
    if (!router) {
      try {
        // Check if we're in a setup context by trying to get current instance
        const instance = getCurrentInstance();
        if (instance) {
          router = useRouter();
        } else {
          // Not in setup context, try to get router from app context
          // This happens when called from event handlers
          return null;
        }
      } catch (e) {
        // Not in setup context, return null
        return null;
      }
    }
    return router;
  };
  
  // Navigate using router or fallback to window.location
  const navigateToPath = (path) => {
    const currentRouter = getRouter();
    if (currentRouter) {
      return currentRouter.push(path).catch((err) => {
        console.log('⚠️ Navigation error (ignored):', err.message);
      });
    } else {
      // Fallback: use window.location when router is not available
      console.log('⚠️ Router not available, using window.location for:', path);
      window.location.href = path;
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

  // Find tab by path
  const findTabByPath = (path) => {
    return tabs.value.find(tab => tab.path === path);
  };

  // Sync active tab with current route (for browser navigation ONLY)
  const syncTabWithRoute = (path) => {
    console.log('🔄 syncTabWithRoute called with path:', path);
    
    // Skip on mobile
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobile) {
      return;
    }
    
    // Skip if path is login, landing, or settings (no tabs)
    if (path === '/login' || path === '/' || path.startsWith('/settings')) {
      console.log('⏭️ Skipping sync for path:', path);
      return;
    }
    
    // Find existing tab for this path
    const existingTab = findTabByPath(path);
    
    if (existingTab) {
      // Tab exists, switch to it ONLY if we're not already on it
      if (activeTabId.value !== existingTab.id) {
        console.log('🔄 Syncing tab for browser navigation:', existingTab.title, 'from', activeTabId.value, 'to', existingTab.id);
        activeTabId.value = existingTab.id;
      } else {
        console.log('✅ Already on correct tab, no sync needed');
      }
    } else {
      // Tab doesn't exist, create one
      // This handles cases where user navigates via browser back/forward to a route
      // that doesn't have a tab yet (e.g., direct URL entry, bookmark, etc.)
      console.log('✨ Creating tab for browser navigation:', path);
      const newTab = {
        id: generateTabId(),
        title: getTitleForPath(path),
        path: path,
        icon: getIconComponent(getIconForPath(path)),
        closable: true,
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
    loadTabsFromStorage();
    // Note: Route syncing is handled by setupRouteWatcher() in App.vue
  };

  // Setup route watcher (route must be passed from setup context)
  const setupRouteWatcher = (route) => {
    if (!route) {
      console.warn('⚠️ setupRouteWatcher called without route parameter');
      return;
    }
    
    // Sync active tab with current route on initialization (only if tabs are loaded)
    // Check if active tab matches current route - if not, sync
    // But only if we have tabs loaded (not on first load)
    if (tabs.value.length > 0) {
      const activeTab = tabs.value.find(tab => tab.id === activeTabId.value);
      if (activeTab && activeTab.path !== route.path) {
        console.log('🔄 Initial sync: active tab path', activeTab.path, 'does not match route', route.path);
        syncTabWithRoute(route.path);
      } else if (!activeTab) {
        console.log('🔄 Initial sync: no active tab found, syncing to route', route.path);
        syncTabWithRoute(route.path);
      } else {
        console.log('✅ Initial sync: active tab matches route, no sync needed');
      }
    } else {
      console.log('⏭️ Initial sync: no tabs loaded yet, skipping');
    }
    
    // Watch for route changes (browser navigation)
    // Only sync tabs when route changes from browser back/forward buttons
    watch(() => route.path, (newPath, oldPath) => {
      // Skip if paths are the same
      if (newPath === oldPath) {
        return;
      }
      
      // Skip routes that don't use tabs (login, landing, settings)
      // These routes should be handled by the router, not by tab syncing
      if (newPath === '/login' || newPath === '/' || newPath.startsWith('/settings')) {
        console.log('⏭️ Route watcher: skipping tab sync for non-tab route:', newPath);
        return;
      }
      
      console.log('🔍 Route watcher triggered:', {
        oldPath,
        newPath,
        isProgrammaticNavigation,
        activeTabId: activeTabId.value,
        lastProgrammaticPath
      });
      
      // Check if this route change matches a programmatic navigation we just did
      if (isProgrammaticNavigation || newPath === lastProgrammaticPath) {
        console.log('🔒 Programmatic navigation detected, skipping route sync');
        lastProgrammaticPath = null; // Reset after use
        return;
      }
      
      // Check if active tab already matches this route
      const currentActiveTab = tabs.value.find(tab => tab.id === activeTabId.value);
      if (currentActiveTab && currentActiveTab.path === newPath) {
        console.log('✅ Active tab already matches route, skipping sync');
        return;
      }
      
      // This must be browser navigation (back/forward button)
      console.log('🌐 Browser navigation detected - syncing tabs:', oldPath, '→', newPath);
      syncTabWithRoute(newPath);
    });
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
    
    // Check if tab already exists
    const existingTab = findTabByPath(path);
    
    if (existingTab) {
      console.log('📍 Tab already exists:', existingTab.id);
      
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
          }, 100);
        }).catch(() => {
          setTimeout(() => {
            isProgrammaticNavigation = false;
            lastProgrammaticPath = null;
          }, 100);
        });
      } else {
        console.log('🔕 Background mode: tab exists but not switching to it');
      }
      return existingTab;
    }
    
    // Create new tab
    const newTab = {
      id: options.id || generateTabId(),
      title: options.title || getTitleForPath(path, options.params),
      path: path,
      icon: options.icon ? getIconComponent(options.icon) : getIconComponent(getIconForPath(path)),
      closable: options.closable !== false, // Default to closable
      params: options.params || {}
    };
    
    console.log('✨ Creating new tab:', newTab.id, newTab.title);
    tabs.value.push(newTab);
    
    // Only switch to tab and navigate if NOT background mode
    if (!isBackground) {
      activeTabId.value = newTab.id;
      // Mark as programmatic navigation to prevent route watcher from syncing
      isProgrammaticNavigation = true;
      lastProgrammaticPath = path;
      // Always navigate to show the new tab content
      navigateToPath(path).then(() => {
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
      console.log('✅ openTab complete (foreground), activeTabId:', activeTabId.value);
    } else {
      console.log('✅ openTab complete (background), tab created but not active');
    }
    
    return newTab;
  };

  // Close tab
  const closeTab = (tabId) => {
    const index = tabs.value.findIndex(tab => tab.id === tabId);
    
    if (index === -1) return;
    
    const tab = tabs.value[index];
    
    // Don't close non-closable tabs
    if (!tab.closable) return;
    
    // Remove tab
    tabs.value.splice(index, 1);
    
    // If closing active tab, switch to another tab
    if (tabId === activeTabId.value) {
      if (tabs.value.length > 0) {
        // Switch to previous tab, or next tab, or first tab
        const newActiveTab = tabs.value[Math.max(0, index - 1)];
        activeTabId.value = newActiveTab.id;
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
    
    // Switch to first non-closable tab (should be dashboard)
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
    if (tab) {
      tab.title = newTitle;
    }
  };

  // Reorder tabs
  const reorderTabs = (fromIndex, toIndex) => {
    const movedTab = tabs.value.splice(fromIndex, 1)[0];
    tabs.value.splice(toIndex, 0, movedTab);
  };

  // Note: handleNavigation removed as it caused circular loops with router.beforeEach
  // Tab creation is now handled explicitly by click handlers only

  return {
    // State
    tabs: computed(() => tabs.value),
    activeTabId: computed(() => activeTabId.value),
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
    reorderTabs,
    findTabById,
    findTabByPath
  };
}

