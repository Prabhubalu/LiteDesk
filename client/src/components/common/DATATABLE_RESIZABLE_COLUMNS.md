# DataTable - Resizable Columns Feature

## Overview
The DataTable component now supports column resizing, allowing users to adjust column widths by dragging the column borders.

## Features

✅ **Drag to Resize** - Click and drag the right edge of any column header  
✅ **Minimum Width** - Columns have a minimum width of 100px  
✅ **Persistent Storage** - Column widths are saved to localStorage  
✅ **Per-Table Configuration** - Each table can have its own saved widths  
✅ **Per-Column Control** - Individual columns can opt-out of resizing  
✅ **Visual Feedback** - Resize handle appears on hover  

## Usage

### Basic Usage

Enable resizable columns by adding the `:resizable="true"` prop:

```vue
<DataTable
  :data="myData"
  :columns="myColumns"
  :resizable="true"
/>
```

### With Custom Table ID

Use a unique `tableId` to persist different widths for different tables:

```vue
<DataTable
  :data="contacts"
  :columns="contactColumns"
  :resizable="true"
  table-id="contacts-table"
/>
```

### Disable Width Persistence

If you don't want to save widths to localStorage:

```vue
<DataTable
  :data="myData"
  :columns="myColumns"
  :resizable="true"
  :persist-widths="false"
/>
```

### Disable Resizing for Specific Columns

Add `resizable: false` to individual column definitions:

```javascript
const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'actions', label: 'Actions', resizable: false } // Not resizable
];
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `resizable` | Boolean | `false` | Enable/disable column resizing |
| `persistWidths` | Boolean | `true` | Save column widths to localStorage |
| `tableId` | String | `'datatable'` | Unique identifier for storing widths |

## Column Configuration

Columns can have these resize-related properties:

```javascript
{
  key: 'columnKey',
  label: 'Column Label',
  width: '200px',           // Initial width (optional)
  minWidth: '150px',        // Minimum width (optional)
  maxWidth: '500px',        // Maximum width (optional)
  resizable: false          // Disable resizing for this column (optional)
}
```

## How It Works

1. **Hover** over the right edge of a column header
2. A **blue resize handle** appears
3. **Click and drag** left or right to resize
4. **Release** to set the new width
5. Width is **automatically saved** to localStorage

## Clearing Saved Widths

To clear saved column widths, open your browser's developer console and run:

```javascript
// Clear specific table
localStorage.removeItem('datatable-YOUR_TABLE_ID-widths');

// Clear all DataTable widths
Object.keys(localStorage)
  .filter(key => key.startsWith('datatable-') && key.endsWith('-widths'))
  .forEach(key => localStorage.removeItem(key));
```

## Example: Full Implementation

```vue
<template>
  <DataTable
    :data="contacts"
    :columns="columns"
    :loading="loading"
    :resizable="true"
    table-id="contacts-main-table"
    :persist-widths="true"
    :selectable="true"
    :paginated="true"
    @row-click="handleRowClick"
  >
    <!-- Custom cells -->
  </DataTable>
</template>

<script setup>
import { ref } from 'vue';
import DataTable from '@/components/common/DataTable.vue';

const contacts = ref([]);
const loading = ref(false);

const columns = [
  { 
    key: 'name', 
    label: 'Name', 
    sortable: true,
    width: '250px',      // Initial width
    minWidth: '150px'    // Minimum width
  },
  { 
    key: 'email', 
    label: 'Email', 
    sortable: true,
    width: '300px'
  },
  { 
    key: 'phone', 
    label: 'Phone', 
    sortable: true,
    width: '180px'
  },
  { 
    key: 'company', 
    label: 'Company', 
    sortable: true 
  },
  { 
    key: 'actions', 
    label: 'Actions', 
    resizable: false    // Actions column not resizable
  }
];

const handleRowClick = (row) => {
  console.log('Row clicked:', row);
};
</script>
```

## Visual Indicators

- **Normal state**: Column header has no visible resize handle
- **Hover state**: Blue resize handle appears on right edge
- **Dragging**: Cursor changes to `col-resize` and selection is disabled
- **After resize**: Width is applied immediately and saved

## Browser Compatibility

Works in all modern browsers that support:
- CSS `cursor: col-resize`
- localStorage API
- Mouse events (mousedown, mousemove, mouseup)

## Performance Considerations

- Widths are saved to localStorage on mouse up (not during drag)
- Only resizable columns show resize handles
- Cleanup happens on component unmount
- No watchers on width changes (event-driven)

## Troubleshooting

### Columns not resizing?
- Check if `:resizable="true"` is set
- Verify the column doesn't have `resizable: false`
- Check browser console for errors

### Widths not persisting?
- Ensure `:persist-widths="true"` (default)
- Check if `tableId` is unique
- Verify localStorage is not disabled
- Check browser's localStorage quota

### Resize handle not visible?
- Ensure column header has enough height
- Check if other styles are overriding
- Verify dark mode styles are working

---

**Added:** October 24, 2025  
**Component:** DataTable.vue  
**Feature:** Resizable Columns

