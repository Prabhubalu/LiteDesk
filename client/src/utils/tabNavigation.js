import { useTabs } from '@/composables/useTabs';

/**
 * Utility function to open a record in a new tab
 * Use this in your components to open records in tabs instead of navigating directly
 * 
 * @param {string} path - The route path to navigate to
 * @param {Object} options - Tab options
 * @param {string} options.title - Tab title (required)
 * @param {string} options.icon - Tab icon emoji (optional, defaults based on path)
 * @param {Object} options.params - Additional parameters (optional)
 * 
 * @example
 * // Open a contact detail
 * openRecordInTab(`/contacts/${contact._id}`, {
 *   title: contact.name,
 *   icon: '👤',
 *   params: { name: contact.name }
 * });
 * 
 * @example
 * // Open an organization
 * openRecordInTab(`/organizations/${org._id}`, {
 *   title: org.name,
 *   icon: '🏢',
 *   params: { name: org.name }
 * });
 */
export function openRecordInTab(path, options = {}) {
  const { openTab } = useTabs();
  return openTab(path, options);
}

/**
 * Helper to create a click handler for opening records in tabs
 * Use this in @click handlers or template v-on directives
 * 
 * @param {string} path - The route path
 * @param {Object} options - Tab options
 * @returns {Function} Click handler function
 * 
 * @example
 * <tr @click="createTabHandler(`/contacts/${contact._id}`, { title: contact.name })">
 */
export function createTabHandler(path, options = {}) {
  return (event) => {
    // Prevent default if it's a link
    if (event && event.preventDefault) {
      event.preventDefault();
    }
    
    openRecordInTab(path, options);
  };
}

/**
 * Vue directive for opening tabs on click
 * Use this as a directive in your templates
 * 
 * @example
 * <div v-tab-link="{ path: `/contacts/${contact._id}`, title: contact.name }">
 *   {{ contact.name }}
 * </div>
 */
export const vTabLink = {
  mounted(el, binding) {
    const { path, title, icon, params } = binding.value;
    
    el.style.cursor = 'pointer';
    
    el.addEventListener('click', (event) => {
      event.preventDefault();
      openRecordInTab(path, { title, icon, params });
    });
  }
};

/**
 * Get the appropriate icon for a module/path
 * 
 * @param {string} path - Route path
 * @returns {string} Emoji icon
 */
export function getModuleIcon(path) {
  const icons = {
    'contacts': '👥',
    'organizations': '🏢',
    'deals': '💼',
    'tasks': '✅',
    'calendar': '📅',
    'imports': '⬇️',
    'items': '📁',
    'demo-requests': '📚',
    'instances': '🖥️'
  };
  
  const module = path.split('/')[1];
  return icons[module] || '📄';
}

