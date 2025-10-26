import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';

// Tab state management
const tabs = ref([]);
const activeTabId = ref(null);

// Load tabs from localStorage on initialization
const loadTabsFromStorage = () => {
  try {
    const stored = localStorage.getItem('litedesk-tabs');
    if (stored) {
      const parsed = JSON.parse(stored);
      tabs.value = parsed.tabs || [];
      activeTabId.value = parsed.activeTabId || null;
      
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

// Save tabs to localStorage
const saveTabsToStorage = () => {
  try {
    localStorage.setItem('litedesk-tabs', JSON.stringify({
      tabs: tabs.value,
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
    icon: '🏠',
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
    '/dashboard': '🏠',
    '/contacts': '👥',
    '/organizations': '🏢',
    '/deals': '💼',
    '/tasks': '✅',
    '/calendar': '📅',
    '/events': '📅',
    '/imports': '⬇️',
    '/items': '📁',
    '/demo-requests': '📚',
    '/instances': '🖥️'
  };
  
  // Check for base path
  const basePath = '/' + path.split('/')[1];
  return icons[basePath] || icons[path] || '📄';
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
  const router = useRouter();

  // Initialize tabs
  const initTabs = () => {
    loadTabsFromStorage();
  };

  // Find tab by ID
  const findTabById = (id) => {
    return tabs.value.find(tab => tab.id === id);
  };

  // Find tab by path
  const findTabByPath = (path) => {
    return tabs.value.find(tab => tab.path === path);
  };

  // Get active tab
  const activeTab = computed(() => {
    return tabs.value.find(tab => tab.id === activeTabId.value);
  });

  // Create or focus tab
  const openTab = (path, options = {}) => {
    console.log('🔵 openTab called:', path, 'current route:', router.currentRoute.value.path);
    
    // Check if tab already exists
    const existingTab = findTabByPath(path);
    
    if (existingTab) {
      console.log('📍 Tab already exists, focusing:', existingTab.id);
      // Focus existing tab
      activeTabId.value = existingTab.id;
      // Always navigate to ensure the route is loaded
      router.push(path).catch((err) => {
        console.log('⚠️ Navigation error (ignored):', err.message);
      });
      return existingTab;
    }
    
    // Create new tab
    const newTab = {
      id: options.id || generateTabId(),
      title: options.title || getTitleForPath(path, options.params),
      path: path,
      icon: options.icon || getIconForPath(path),
      closable: options.closable !== false, // Default to closable
      params: options.params || {}
    };
    
    console.log('✨ Creating new tab:', newTab.id, newTab.title);
    tabs.value.push(newTab);
    activeTabId.value = newTab.id;
    
    // Always navigate to show the new tab content
    router.push(path).catch((err) => {
      console.log('⚠️ Navigation error (ignored):', err.message);
    });
    
    console.log('✅ openTab complete, activeTabId:', activeTabId.value);
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
        // Always navigate to the new tab
        router.push(newActiveTab.path).catch(() => {
          // Ignore navigation duplicated errors
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
        // Always navigate to the kept tab
        router.push(keepTab.path).catch(() => {
          // Ignore navigation duplicated errors
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
      // Always navigate to the first tab
      router.push(firstTab.path).catch(() => {
        // Ignore navigation duplicated errors
      });
    }
  };

  // Switch to tab
  const switchToTab = (tabId) => {
    console.log('🔄 switchToTab called:', tabId);
    const tab = findTabById(tabId);
    if (tab) {
      console.log('📍 Switching to tab:', tab.title, 'path:', tab.path);
      activeTabId.value = tabId;
      // Always navigate to ensure the route is loaded
      router.push(tab.path).catch((err) => {
        console.log('⚠️ Navigation error (ignored):', err.message);
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

