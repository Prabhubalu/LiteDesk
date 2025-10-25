# DataTable Mass Actions Guide

## Overview
The DataTable component now supports row selection, multi-selection, and bulk actions with a beautiful floating action bar.

## Features
✅ **Row Selection** - Select individual rows via checkboxes  
✅ **Select All** - Bulk select all rows in current page via header checkbox  
✅ **Multi-Selection** - Select multiple rows simultaneously  
✅ **Floating Action Bar** - Appears at bottom when rows are selected  
✅ **Custom Bulk Actions** - Define your own bulk action buttons  
✅ **Selection Count** - Shows number of selected rows  
✅ **Clear Selection** - Quick button to deselect all  

## Basic Usage

### 1. Enable Selection

```vue
<DataTable
  :data="contacts"
  :columns="columns"
  :selectable="true"
  @select="handleSelection"
  @bulk-action="handleBulkAction"
/>
```

### 2. Handle Selection Events

```javascript
const handleSelection = (selectedRows) => {
  console.log('Selected rows:', selectedRows);
};

const handleBulkAction = ({ action, selectedRows }) => {
  console.log(`Bulk action: ${action}`, selectedRows);
  
  if (action === 'delete') {
    // Handle delete
  } else if (action === 'export') {
    // Handle export
  }
};
```

## Custom Mass Actions

### Define Custom Actions

```vue
<DataTable
  :data="contacts"
  :columns="columns"
  :selectable="true"
  :mass-actions="massActions"
  @bulk-action="handleBulkAction"
/>
```

```javascript
const massActions = [
  {
    label: 'Delete',
    icon: 'trash',
    action: 'bulk-delete',
    variant: 'danger'
  },
  {
    label: 'Export',
    icon: 'export',
    action: 'bulk-export',
    variant: 'success'
  },
  {
    label: 'Archive',
    icon: 'archive',
    action: 'bulk-archive',
    variant: 'warning'
  },
  {
    label: 'Assign Owner',
    icon: 'edit',
    action: 'bulk-assign'
  }
];
```

### Mass Action Properties

| Property | Type | Description | Required |
|----------|------|-------------|----------|
| `label` | String | Button text | ✅ |
| `action` | String | Action identifier (emitted in event) | ✅ |
| `icon` | String | Icon name (`trash`, `edit`, `export`, `archive`) | ❌ |
| `variant` | String | Color variant (`danger`, `success`, `warning`) | ❌ |

### Color Variants

- **`danger`** - Red background (for destructive actions like delete)
- **`success`** - Green background (for positive actions like export)
- **`warning`** - Yellow background (for caution actions like archive)
- **No variant** - Semi-transparent white background

## Complete Example

```vue
<template>
  <div>
    <DataTable
      :data="contacts"
      :columns="tableColumns"
      :selectable="true"
      :mass-actions="massActions"
      :show-controls="false"
      @select="handleSelection"
      @bulk-action="handleBulkAction"
      @row-click="viewContact"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import DataTable from '@/components/common/DataTable.vue';

const contacts = ref([
  { _id: '1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
  { _id: '2', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com' },
  // ... more contacts
]);

const tableColumns = [
  { key: 'firstName', label: 'First Name', sortable: true },
  { key: 'lastName', label: 'Last Name', sortable: true },
  { key: 'email', label: 'Email', sortable: true }
];

const massActions = [
  {
    label: 'Delete',
    icon: 'trash',
    action: 'bulk-delete',
    variant: 'danger'
  },
  {
    label: 'Export CSV',
    icon: 'export',
    action: 'bulk-export',
    variant: 'success'
  },
  {
    label: 'Add to List',
    icon: 'archive',
    action: 'bulk-add-to-list'
  }
];

const handleSelection = (selectedRows) => {
  console.log(`${selectedRows.length} rows selected`);
};

const handleBulkAction = async ({ action, selectedRows }) => {
  const ids = selectedRows.map(row => row._id);
  
  switch (action) {
    case 'bulk-delete':
      if (confirm(`Delete ${selectedRows.length} contacts?`)) {
        await deleteContacts(ids);
        // Refresh data
      }
      break;
      
    case 'bulk-export':
      exportToCSV(selectedRows);
      break;
      
    case 'bulk-add-to-list':
      // Show modal to select list
      showAddToListModal(selectedRows);
      break;
  }
};

const viewContact = (contact) => {
  // Navigate to contact detail
};
</script>
```

## Default Behavior

If no `mass-actions` are provided, a default "Delete Selected" button appears:

```vue
<DataTable
  :data="contacts"
  :columns="columns"
  :selectable="true"
  @bulk-action="handleBulkAction"
/>
```

This will show a red "Delete Selected" button when rows are selected.

## Events

### `@select`
Emitted when row selection changes.

**Payload:** `Array<Object>` - Array of selected row objects

### `@bulk-action`
Emitted when a bulk action button is clicked.

**Payload:** 
```javascript
{
  action: 'bulk-delete',      // Action identifier
  selectedRows: [...]          // Array of selected row objects
}
```

## UI Elements

### Floating Action Bar
- **Position:** Fixed at bottom center of screen
- **Visibility:** Only appears when rows are selected
- **Animation:** Smooth slide-up transition
- **Design:** Gradient background with shadow and border
- **Dark Mode:** Automatically adjusts colors

### Selection Count
- Shows: "X selected"
- Clickable X button to clear all selections
- White semi-transparent background badge

### Action Buttons
- Icon + Label format
- Hover effects (scale up)
- Color-coded by variant
- SVG icons for common actions

## Best Practices

1. **Confirm destructive actions**
   ```javascript
   if (action === 'bulk-delete') {
     if (confirm(`Delete ${selectedRows.length} items?`)) {
       // Proceed with deletion
     }
   }
   ```

2. **Show loading states**
   ```javascript
   const loading = ref(false);
   
   const handleBulkAction = async ({ action, selectedRows }) => {
     loading.value = true;
     try {
       await performAction(action, selectedRows);
     } finally {
       loading.value = false;
     }
   };
   ```

3. **Clear selection after action**
   ```javascript
   const dataTableRef = ref(null);
   
   const handleBulkAction = async ({ action, selectedRows }) => {
     await performAction(action, selectedRows);
     // Selection is maintained - clear it manually if needed
     selectedRows.value = [];
   };
   ```

4. **Provide feedback**
   ```javascript
   const handleBulkAction = async ({ action, selectedRows }) => {
     await performAction(action, selectedRows);
     toast.success(`Successfully processed ${selectedRows.length} items`);
   };
   ```

## Styling Customization

The floating action bar uses your theme's `brand` color. Customize in `tailwind.config.js`:

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          500: '#your-color',
          600: '#your-darker-color',
          // ...
        }
      }
    }
  }
}
```

## Accessibility

- ✅ Checkboxes have proper `aria-label` attributes
- ✅ Keyboard navigation supported
- ✅ Focus states visible
- ✅ Color contrast meets WCAG standards
- ✅ Screen reader friendly

## Migration from Old Implementation

If you had custom bulk actions UI in your pages, you can now remove it and use DataTable's built-in functionality:

**Before:**
```vue
<!-- Custom bulk actions bar -->
<div v-if="selectedContacts.length > 0">
  <button @click="deleteSelected">Delete</button>
</div>

<DataTable :selectable="true" @select="handleSelect" />
```

**After:**
```vue
<DataTable 
  :selectable="true"
  :mass-actions="[{ label: 'Delete', action: 'delete', variant: 'danger' }]"
  @bulk-action="handleBulkAction"
/>
```

## Summary

The DataTable mass actions feature provides:
- 🎯 **Easy setup** - Just add `:selectable="true"`
- 🎨 **Beautiful UI** - Floating action bar with animations
- ⚡ **Flexible** - Custom actions or use defaults
- 🌙 **Dark mode** - Automatic theme support
- 📱 **Responsive** - Works on all screen sizes

