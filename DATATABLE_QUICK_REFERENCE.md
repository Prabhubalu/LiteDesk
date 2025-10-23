# DataTable Quick Reference

## 🚀 Basic Setup

```vue
<template>
  <DataTable
    :data="items"
    :columns="columns"
    :loading="loading"
    @edit="handleEdit"
    @delete="handleDelete"
  />
</template>

<script setup>
import DataTable from '@/components/common/DataTable.vue';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'status', label: 'Status' }
];
</script>
```

## 📋 Common Props

```vue
<DataTable
  :data="items"              <!-- Array of data -->
  :columns="columns"         <!-- Column definitions -->
  :loading="loading"         <!-- Show loading spinner -->
  :searchable="true"         <!-- Enable search -->
  :paginated="true"          <!-- Enable pagination -->
  :selectable="true"         <!-- Enable checkboxes -->
  :per-page="20"             <!-- Items per page -->
  :total-records="total"     <!-- Total count -->
  :has-actions="true"        <!-- Show actions column -->
  :hide-edit="false"         <!-- Hide edit button -->
  :hide-delete="false"       <!-- Hide delete button -->
/>
```

## 🎨 Custom Cells

```vue
<!-- Status Badge -->
<template #cell-status="{ value }">
  <BadgeCell :value="value" variant="success" />
</template>

<!-- Date -->
<template #cell-createdAt="{ value }">
  <DateCell :value="value" format="relative" />
</template>

<!-- Link -->
<template #cell-email="{ value }">
  <a :href="`mailto:${value}`">{{ value }}</a>
</template>

<!-- Complex -->
<template #cell-user="{ row }">
  <div class="flex items-center">
    <img :src="row.avatar" class="w-8 h-8 rounded-full" />
    <span>{{ row.name }}</span>
  </div>
</template>
```

## 🔧 Custom Actions

```vue
<!-- Toolbar Actions -->
<template #actions>
  <button @click="exportData">Export</button>
  <button @click="importData">Import</button>
  <button @click="createNew">Create</button>
</template>

<!-- Row Actions -->
<template #actions="{ row }">
  <button @click="view(row)">View</button>
  <button @click="duplicate(row)">Duplicate</button>
  <button @click="archive(row)">Archive</button>
</template>
```

## 📊 Column Types

```javascript
// Basic
{ key: 'name', label: 'Name' }

// With Formatting
{ 
  key: 'price', 
  label: 'Price',
  format: (value) => `$${value.toFixed(2)}`
}

// Nested Property
{ key: 'user.profile.name', label: 'User' }

// With Component
{ 
  key: 'status', 
  label: 'Status',
  component: BadgeCell
}

// Custom Class
{ 
  key: 'email', 
  label: 'Email',
  headerClass: 'w-1/4',
  cellClass: 'font-mono text-sm'
}

// Non-sortable
{ 
  key: 'actions', 
  label: 'Actions',
  sortable: false
}
```

## 🎯 Event Handlers

```vue
<DataTable
  @row-click="viewDetails"      <!-- Click row -->
  @edit="handleEdit"            <!-- Click edit -->
  @delete="handleDelete"        <!-- Click delete -->
  @select="handleSelect"        <!-- Selection change -->
  @sort="handleSort"            <!-- Sort change -->
  @search="handleSearch"        <!-- Search input -->
  @page-change="handlePage"     <!-- Page change -->
/>

<script setup>
const viewDetails = (row) => { /* ... */ };
const handleEdit = (row) => { /* ... */ };
const handleDelete = (row) => { /* ... */ };
const handleSelect = (rows) => { /* ... */ };
const handleSort = ({ key, order }) => { /* ... */ };
const handleSearch = (query) => { /* ... */ };
const handlePage = (page) => { /* ... */ };
</script>
```

## 🎨 Helper Components

### BadgeCell
```vue
<BadgeCell 
  :value="status" 
  :variant-map="{
    'active': 'success',
    'pending': 'warning',
    'inactive': 'danger'
  }"
/>
```

Variants: `default`, `primary`, `success`, `warning`, `danger`, `info`

### DateCell
```vue
<DateCell :value="date" format="relative" />
```

Formats: `short`, `long`, `relative`, `custom`

## 💡 Tips

### Dynamic Columns
```javascript
const columns = computed(() => {
  const cols = [/* base columns */];
  if (showAdvanced.value) {
    cols.push({ key: 'extra', label: 'Extra' });
  }
  return cols;
});
```

### Conditional Styling
```vue
<DataTable
  :row-class="row => row.urgent ? 'bg-red-50' : ''"
/>
```

### Server-Side Operations
```javascript
// Handle on server
const handleSort = ({ key, order }) => {
  fetchData({ sortBy: key, sortOrder: order });
};

const handleSearch = (query) => {
  fetchData({ search: query, page: 1 });
};

const handlePage = (page) => {
  fetchData({ page });
};
```

### Bulk Operations
```vue
<template>
  <div v-if="selected.length" class="bulk-bar">
    {{ selected.length }} selected
    <button @click="bulkDelete">Delete</button>
  </div>
  
  <DataTable
    :selectable="true"
    @select="selected = $event"
  />
</template>
```

## 📱 Responsive

The table is automatically responsive:
- Horizontal scroll on small screens
- Touch-friendly on mobile
- Optimized for tablets
- Full-featured on desktop

## 🌗 Dark Mode

Full dark mode support out of the box using Tailwind's dark mode classes.

## ♿ Accessibility

- Keyboard navigation
- Screen reader support
- Focus indicators
- ARIA attributes
- Semantic HTML

---

## 🔗 Full Documentation

See `DATA_TABLE_USAGE_GUIDE.md` for complete documentation and examples.

