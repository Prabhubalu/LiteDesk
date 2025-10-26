# Internal Tabs Navigation System

## Overview
LiteDesk now features an internal tabs system that allows users to navigate between modules and records without refreshing the browser or opening new windows. This provides a modern, multi-tasking experience similar to browser tabs or VS Code's editor tabs.

## Features Implemented

### ✅ 1. Tab Creation from Sidebar
- Clicking any module in the sidebar creates a new tab
- Existing tabs are focused instead of creating duplicates
- Each tab displays the module's icon and name

### ✅ 2. Tab Creation from Records/Links
- Clicking on records or internal links within views creates new tabs
- Utility functions provided for easy integration in components

### ✅ 3. Tab Persistence
- Tab state is automatically saved to localStorage
- Tabs and their order persist across page refreshes
- Active tab is remembered

### ✅ 4. Tab Management
- **Close Individual Tabs**: Click the X button on any closable tab
- **Right-Click Context Menu**:
  - Close tab
  - Close other tabs
  - Close tabs to the right
  - Close all tabs
- **Dashboard Tab**: Always present and cannot be closed

### ✅ 5. Drag and Drop Reordering
- Click and drag tabs to rearrange their order
- Visual feedback during drag operation
- Smooth animations and transitions

### ✅ 6. Default Dashboard Tab
- Dashboard tab is created by default on first load
- Cannot be closed (always available)
- Serves as the home base for navigation

## Technical Implementation

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                      App.vue                        │
│  - Manages sidebar state                           │
│  - Initializes tabs system                         │
│  - Sets up router navigation guard                 │
└─────────────────┬───────────────────────────────────┘
                  │
         ┌────────┴────────┐
         │                 │
    ┌────▼────┐      ┌────▼────────┐
    │ Nav.vue │      │ TabBar.vue  │
    │         │      │             │
    │ Opens   │      │ Displays,   │
    │ tabs    │      │ manages,    │
    │ on      │      │ reorders    │
    │ click   │      │ tabs        │
    └─────────┘      └─────────────┘
         │                 │
         └────────┬────────┘
                  │
         ┌────────▼────────────────┐
         │  useTabs.js             │
         │  (Composable)           │
         │                         │
         │  - Tab state management │
         │  - localStorage sync    │
         │  - Tab operations       │
         └─────────────────────────┘
```

### Key Files Created

1. **`/client/src/composables/useTabs.js`**
   - Core tab management logic
   - State management (tabs array, active tab)
   - localStorage persistence
   - Tab operations (open, close, reorder, etc.)

2. **`/client/src/components/TabBar.vue`**
   - Visual tab bar component
   - Drag and drop functionality
   - Context menu for tab actions
   - Pure Tailwind CSS styling

3. **`/client/src/utils/tabNavigation.js`**
   - Helper utilities for opening tabs from components
   - Vue directive for tab links
   - Icon mapping for modules

### Files Modified

1. **`/client/src/App.vue`**
   - Integrated TabBar component
   - Initialized tabs system on mount
   - Set up router navigation guard
   - Updated layout structure

2. **`/client/src/components/Nav.vue`**
   - Changed from `router-link` to `<a>` tags with click handlers
   - Integrated with tabs system via `handleNavClick`
   - Prevents default navigation, opens tabs instead

## Usage Guide

### For End Users

#### Opening Tabs
1. Click any module in the left sidebar to open it in a new tab
2. If a tab for that module already exists, it will be focused
3. Click on any record or link within a view to open it in a new tab

#### Managing Tabs
1. **Close a tab**: Click the X button on the tab
2. **Switch between tabs**: Click on any tab to make it active
3. **Reorder tabs**: Click and drag a tab to a new position
4. **Context menu** (right-click on a tab):
   - Close
   - Close Others
   - Close Tabs to the Right
   - Close All Tabs

#### Tab Persistence
- Your open tabs are automatically saved
- When you refresh the page, your tabs will be restored
- The active tab you were viewing will be reopened

### For Developers

#### Opening Tabs from Components

**Method 1: Using the utility function**
```javascript
import { openRecordInTab } from '@/utils/tabNavigation';

// In your component
const viewContact = (contact) => {
  openRecordInTab(`/contacts/${contact._id}`, {
    title: contact.name,
    icon: '👤',
    params: { name: contact.name }
  });
};
```

**Method 2: Using the composable directly**
```javascript
import { useTabs } from '@/composables/useTabs';

const { openTab } = useTabs();

const viewOrganization = (org) => {
  openTab(`/organizations/${org._id}`, {
    title: org.name,
    icon: '🏢'
  });
};
```

**Method 3: Using in templates**
```vue
<template>
  <div
    v-for="contact in contacts"
    :key="contact._id"
    @click="openContactTab(contact)"
    class="cursor-pointer hover:bg-gray-50"
  >
    {{ contact.name }}
  </div>
</template>

<script setup>
import { openRecordInTab } from '@/utils/tabNavigation';

const openContactTab = (contact) => {
  openRecordInTab(`/contacts/${contact._id}`, {
    title: contact.name,
    icon: '👤'
  });
};
</script>
```

**Method 4: Using the tab-link directive**
```vue
<template>
  <div
    v-tab-link="{ 
      path: `/contacts/${contact._id}`, 
      title: contact.name,
      icon: '👤'
    }"
  >
    {{ contact.name }}
  </div>
</template>

<script setup>
import { vTabLink } from '@/utils/tabNavigation';
</script>
```

#### Updating Existing DataTables and Views

To integrate tabs with existing DataTable components:

```vue
<script setup>
import { openRecordInTab } from '@/utils/tabNavigation';

const handleRowClick = (row) => {
  // Prevent navigation, open in tab instead
  openRecordInTab(`/contacts/${row._id}`, {
    title: row.name || `Contact ${row._id}`,
    icon: '👤',
    params: { name: row.name }
  });
};
</script>

<template>
  <DataTable
    :data="contacts"
    @row-click="handleRowClick"
  />
</template>
```

#### Tab Icons

Default icons are provided for each module:
- 🏠 Dashboard
- 👥 Contacts
- 🏢 Organizations
- 💼 Deals
- ✅ Tasks
- 📅 Calendar
- ⬇️ Imports
- 📁 Projects (Items)
- 📚 Demo Requests
- 🖥️ Instances
- 📄 Default (for other pages)

You can override these by passing a custom icon when opening a tab.

## Styling (Pure Tailwind CSS)

All styling is done with Tailwind CSS classes, no scoped CSS:

### Tab Bar Styles
- Background: `bg-white dark:bg-gray-800`
- Border: `border-b border-gray-200 dark:border-gray-700`
- Height: `h-12`
- Scrollable: `overflow-x-auto`

### Individual Tab Styles
- Active tab: `bg-gray-50 dark:bg-gray-900 border-b-2 border-b-blue-500`
- Inactive tab: `bg-white dark:bg-gray-800`
- Hover: `hover:bg-gray-50 dark:hover:bg-gray-700`
- Drag indicator: `border-l-2 border-l-blue-500`

### Animations
- Transitions: `transition-colors duration-150`
- Context menu: `transition-all duration-100 ease-out`
- Drag opacity: `opacity-50`

## Data Flow

```
User Click on Sidebar Item
         │
         ▼
  Nav.vue handleNavClick()
         │
         ▼
  useTabs.openTab(path, options)
         │
         ├─► Check if tab exists
         │   ├─► Yes: Focus existing tab
         │   └─► No: Create new tab
         │
         ▼
  Update tabs array
         │
         ▼
  Save to localStorage
         │
         ▼
  Router.push(path)
         │
         ▼
  TabBar.vue displays updated tabs
         │
         ▼
  RouterView renders content
```

## localStorage Schema

```javascript
{
  "litedesk-tabs": {
    "tabs": [
      {
        "id": "dashboard",
        "title": "Dashboard",
        "path": "/dashboard",
        "icon": "🏠",
        "closable": false
      },
      {
        "id": "tab-1234567890-abc123",
        "title": "John Doe",
        "path": "/contacts/507f1f77bcf86cd799439011",
        "icon": "👤",
        "closable": true,
        "params": {
          "name": "John Doe"
        }
      }
    ],
    "activeTabId": "tab-1234567890-abc123"
  }
}
```

## Customization

### Adding Custom Icons
Edit `/client/src/composables/useTabs.js`:
```javascript
const getIconForPath = (path) => {
  const icons = {
    '/your-module': '🎯', // Add your custom icon
    // ...
  };
  // ...
};
```

### Changing Tab Behavior
Edit `/client/src/composables/useTabs.js` to customize:
- Tab creation logic
- Close behavior
- Reordering restrictions
- Persistence rules

### Styling the Tab Bar
Edit `/client/src/components/TabBar.vue` and modify Tailwind classes:
- Tab height: Change `h-12`
- Colors: Update `bg-*`, `text-*`, `border-*` classes
- Hover effects: Modify `hover:*` classes
- Active tab indicator: Adjust `border-b-2 border-b-blue-500`

## Best Practices

### 1. Always Use Tab Navigation
When navigating within the app, always use the tab system instead of direct router navigation:
```javascript
// ❌ Bad
router.push('/contacts/123');

// ✅ Good
openRecordInTab('/contacts/123', { title: 'Contact Name' });
```

### 2. Provide Meaningful Tab Titles
Always provide descriptive titles for better UX:
```javascript
// ❌ Bad
openRecordInTab(`/contacts/${id}`);

// ✅ Good
openRecordInTab(`/contacts/${id}`, {
  title: contact.name || 'Contact Detail',
  icon: '👤'
});
```

### 3. Handle Tab Updates
If data changes (e.g., name update), update the tab title:
```javascript
const { updateTabTitle, findTabByPath } = useTabs();

const updateContact = async (contactId, newName) => {
  await api.updateContact(contactId, { name: newName });
  
  // Update tab title
  const tab = findTabByPath(`/contacts/${contactId}`);
  if (tab) {
    updateTabTitle(tab.id, newName);
  }
};
```

### 4. Test Tab Persistence
Always test that:
- Tabs persist after refresh
- Active tab is restored
- Tab order is maintained

## Troubleshooting

### Tabs Not Persisting
1. Check browser console for localStorage errors
2. Ensure localStorage is not disabled
3. Check that `initTabs()` is called in `App.vue`

### Duplicate Tabs Being Created
1. Verify that `findTabByPath()` is working correctly
2. Ensure paths are normalized (no trailing slashes)
3. Check that tab comparison logic is correct

### Drag and Drop Not Working
1. Ensure `draggable="true"` is set on tab elements
2. Check that drag event handlers are properly bound
3. Verify that browser supports HTML5 drag and drop

### Router Navigation Issues
1. Check that router navigation guard is set up in `App.vue`
2. Ensure `handleNavigation()` is called correctly
3. Verify that routes are defined in router configuration

## Future Enhancements

Potential improvements for future versions:

1. **Tab Groups**: Organize tabs into collapsible groups
2. **Tab Pinning**: Pin important tabs to prevent closing
3. **Tab Search**: Quickly find and switch to tabs
4. **Recently Closed Tabs**: Reopen accidentally closed tabs
5. **Keyboard Shortcuts**: Navigate tabs with keyboard (Ctrl+Tab, etc.)
6. **Tab Limits**: Set maximum number of open tabs
7. **Tab Thumbnails**: Show preview of tab content on hover
8. **Split View**: View multiple tabs side by side

## Migration Guide

### Updating Existing Components

If you have existing components that use `router-link` or `router.push()`, here's how to migrate:

**Before:**
```vue
<template>
  <router-link :to="`/contacts/${contact._id}`">
    {{ contact.name }}
  </router-link>
</template>
```

**After:**
```vue
<template>
  <a 
    href="#" 
    @click.prevent="openContactTab(contact)"
    class="cursor-pointer hover:underline"
  >
    {{ contact.name }}
  </a>
</template>

<script setup>
import { openRecordInTab } from '@/utils/tabNavigation';

const openContactTab = (contact) => {
  openRecordInTab(`/contacts/${contact._id}`, {
    title: contact.name,
    icon: '👤'
  });
};
</script>
```

## Performance Considerations

- **Tab Limit**: Consider implementing a maximum tab limit to prevent memory issues
- **Lazy Loading**: Tabs automatically use Vue Router's lazy loading for views
- **localStorage Size**: Monitor localStorage size if storing large amounts of tab data
- **Memory Management**: Inactive tabs' components are kept alive by Vue Router's cache

## Conclusion

The Internal Tabs system provides a modern, efficient way to navigate within LiteDesk. It improves user experience by:
- Reducing page loads and refreshes
- Allowing easy multi-tasking between different records
- Maintaining context across navigation
- Persisting user's workspace across sessions

All implementation follows the requirement of using **pure Tailwind CSS** with **no scoped styles**, ensuring maintainability and consistency across the application.

