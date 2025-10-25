# DataTable Component Usage Guide

A powerful, reusable table component for displaying data across the application.

## Features

✅ **Sorting** - Click column headers to sort  
✅ **Search** - Built-in search functionality  
✅ **Pagination** - Client-side or server-side  
✅ **Selection** - Checkbox selection with select all  
✅ **Custom Cells** - Slots for custom rendering  
✅ **Actions** - Built-in edit/delete actions  
✅ **Loading States** - Spinner and empty states  
✅ **Dark Mode** - Full dark mode support  
✅ **Responsive** - Mobile-friendly design  

---

## Basic Usage

### Simple Table

```vue
<template>
  <DataTable
    :data="contacts"
    :columns="columns"
    :loading="loading"
  />
</template>

<script setup>
import { ref } from 'vue';
import DataTable from '@/components/common/DataTable.vue';

const contacts = ref([
  { id: 1, name: 'John Doe', email: 'john@example.com', status: 'active' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'inactive' }
]);

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'status', label: 'Status' }
];

const loading = ref(false);
</script>
```

---

## Column Configuration

### Basic Column

```javascript
{
  key: 'name',           // Property key from data object
  label: 'Full Name',    // Display label
  sortable: true,        // Enable sorting (default: true)
  headerClass: 'w-1/4',  // Custom header CSS class
  cellClass: 'font-bold' // Custom cell CSS class
}
```

### Formatted Column

```javascript
{
  key: 'amount',
  label: 'Amount',
  format: (value, row) => `$${value.toLocaleString()}`
}
```

### Nested Properties

```javascript
{
  key: 'user.profile.name',  // Access nested properties with dot notation
  label: 'User Name'
}
```

### Custom Component

```javascript
import BadgeCell from '@/components/common/table/BadgeCell.vue';

{
  key: 'status',
  label: 'Status',
  component: BadgeCell  // Use custom component
}
```

---

## Advanced Features

### 1. Search

```vue
<DataTable
  :data="data"
  :columns="columns"
  :searchable="true"
  search-placeholder="Search contacts..."
  @search="handleSearch"
/>

<script setup>
const handleSearch = (query) => {
  console.log('Search query:', query);
  // Perform server-side search if needed
};
</script>
```

### 2. Pagination

```vue
<DataTable
  :data="data"
  :columns="columns"
  :paginated="true"
  :per-page="20"
  :total-records="totalRecords"
  @page-change="handlePageChange"
/>

<script setup>
const handlePageChange = (page) => {
  console.log('Page changed to:', page);
  // Fetch new page data
};
</script>
```

### 3. Row Selection

```vue
<DataTable
  :data="data"
  :columns="columns"
  :selectable="true"
  @select="handleSelect"
/>

<script setup>
const handleSelect = (selectedRows) => {
  console.log('Selected rows:', selectedRows);
};
</script>
```

### 4. Sorting

```vue
<DataTable
  :data="data"
  :columns="columns"
  :sortable="true"
  @sort="handleSort"
/>

<script setup>
const handleSort = ({ key, order }) => {
  console.log(`Sort by ${key} in ${order} order`);
  // Perform server-side sorting if needed
};
</script>
```

### 5. Custom Actions

```vue
<DataTable
  :data="data"
  :columns="columns"
  :has-actions="true"
  @edit="handleEdit"
  @delete="handleDelete"
>
  <template #actions="{ row }">
    <button @click="viewDetails(row)">View</button>
    <button @click="duplicate(row)">Duplicate</button>
  </template>
</DataTable>
```

### 6. Custom Cell Rendering

```vue
<DataTable
  :data="data"
  :columns="columns"
>
  <!-- Custom rendering for specific column -->
  <template #cell-status="{ value, row }">
    <span :class="getStatusClass(value)">
      {{ value }}
    </span>
  </template>
  
  <!-- Custom rendering for email with link -->
  <template #cell-email="{ value }">
    <a :href="`mailto:${value}`" class="text-blue-600">
      {{ value }}
    </a>
  </template>
</DataTable>
```

### 7. Custom Empty State

```vue
<DataTable
  :data="data"
  :columns="columns"
  empty-title="No contacts yet"
  empty-message="Start by adding your first contact"
>
  <template #empty>
    <div class="custom-empty-state">
      <img src="/empty-contacts.svg" />
      <h3>No Contacts</h3>
      <button @click="openCreateModal">Add Contact</button>
    </div>
  </template>
</DataTable>
```

### 8. Action Buttons (Toolbar)

```vue
<DataTable
  :data="data"
  :columns="columns"
>
  <template #actions>
    <button @click="exportData" class="btn-secondary">
      Export
    </button>
    <button @click="openImportModal" class="btn-secondary">
      Import
    </button>
    <button @click="createNew" class="btn-primary">
      Create New
    </button>
  </template>
</DataTable>
```

---

## Helper Components

### BadgeCell

Display status badges with color variants:

```vue
<script setup>
import BadgeCell from '@/components/common/table/BadgeCell.vue';

const columns = [
  {
    key: 'status',
    label: 'Status',
    component: BadgeCell,
    // Map values to variants
    variantMap: {
      'active': 'success',
      'inactive': 'danger',
      'pending': 'warning'
    }
  }
];
</script>
```

### DateCell

Format dates with multiple options:

```vue
<script setup>
import DateCell from '@/components/common/table/DateCell.vue';

const columns = [
  {
    key: 'createdAt',
    label: 'Created',
    component: DateCell,
    format: 'relative'  // 'short', 'long', 'relative'
  }
];
</script>
```

---

## Complete Example: Contacts Table

```vue
<template>
  <div class="contacts-page">
    <h1>Contacts</h1>
    
    <DataTable
      :data="contacts"
      :columns="columns"
      :loading="loading"
      :searchable="true"
      :paginated="true"
      :per-page="20"
      :total-records="totalContacts"
      :selectable="true"
      search-placeholder="Search contacts..."
      empty-title="No contacts found"
      empty-message="Add your first contact to get started"
      @row-click="viewContact"
      @edit="editContact"
      @delete="deleteContact"
      @search="handleSearch"
      @page-change="handlePageChange"
      @select="handleSelect"
      @sort="handleSort"
    >
      <!-- Toolbar Actions -->
      <template #actions>
        <button @click="showImportModal = true" class="btn-secondary">
          Import
        </button>
        <button @click="exportContacts" class="btn-secondary">
          Export
        </button>
        <button @click="createContact" class="btn-primary">
          New Contact
        </button>
      </template>
      
      <!-- Custom Status Cell -->
      <template #cell-status="{ value }">
        <BadgeCell 
          :value="value" 
          :variant-map="{
            'active': 'success',
            'inactive': 'danger',
            'pending': 'warning'
          }"
        />
      </template>
      
      <!-- Custom Email Cell -->
      <template #cell-email="{ value }">
        <a :href="`mailto:${value}`" class="text-brand-600 hover:underline">
          {{ value }}
        </a>
      </template>
      
      <!-- Custom Created Date Cell -->
      <template #cell-createdAt="{ value }">
        <DateCell :value="value" format="relative" />
      </template>
    </DataTable>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import DataTable from '@/components/common/DataTable.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import DateCell from '@/components/common/table/DateCell.vue';
import apiClient from '@/utils/apiClient';

const contacts = ref([]);
const loading = ref(false);
const totalContacts = ref(0);

const columns = [
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Created', sortable: true }
];

const fetchContacts = async (params = {}) => {
  loading.value = true;
  try {
    const response = await apiClient.get('/contacts', { params });
    contacts.value = response.data;
    totalContacts.value = response.pagination.total;
  } catch (error) {
    console.error('Error fetching contacts:', error);
  } finally {
    loading.value = false;
  }
};

const viewContact = (contact) => {
  console.log('View contact:', contact);
};

const editContact = (contact) => {
  console.log('Edit contact:', contact);
};

const deleteContact = async (contact) => {
  if (confirm('Are you sure?')) {
    await apiClient.delete(`/contacts/${contact._id}`);
    fetchContacts();
  }
};

const handleSearch = (query) => {
  fetchContacts({ search: query });
};

const handlePageChange = (page) => {
  fetchContacts({ page });
};

const handleSelect = (selectedRows) => {
  console.log('Selected:', selectedRows);
};

const handleSort = ({ key, order }) => {
  fetchContacts({ sortBy: key, sortOrder: order });
};

onMounted(() => {
  fetchContacts();
});
</script>
```

---

## Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | Array | `[]` | Array of data objects to display |
| `columns` | Array | Required | Column configuration array |
| `rowKey` | String/Function | `'id'` | Unique key for each row |
| `searchable` | Boolean | `false` | Enable search functionality |
| `sortable` | Boolean | `true` | Enable column sorting |
| `paginated` | Boolean | `true` | Enable pagination |
| `selectable` | Boolean | `false` | Enable row selection |
| `perPage` | Number | `10` | Records per page |
| `totalRecords` | Number | `0` | Total record count (for server-side pagination) |
| `hasActions` | Boolean | `true` | Show actions column |
| `hideEdit` | Boolean | `false` | Hide edit button |
| `hideDelete` | Boolean | `false` | Hide delete button |
| `loading` | Boolean | `false` | Show loading state |
| `searchPlaceholder` | String | `'Search...'` | Search input placeholder |
| `emptyTitle` | String | `'No data found'` | Empty state title |
| `emptyMessage` | String | `'Get started...'` | Empty state message |
| `loadingText` | String | `'Loading...'` | Loading state text |
| `rowClass` | String/Function | `''` | Custom row CSS class |
| `showControls` | Boolean | `true` | Show search and actions bar |

---

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `row-click` | `row` | Fired when a row is clicked |
| `edit` | `row` | Fired when edit button is clicked |
| `delete` | `row` | Fired when delete button is clicked |
| `select` | `selectedRows[]` | Fired when selection changes |
| `sort` | `{ key, order }` | Fired when column is sorted |
| `search` | `query` | Fired when search input changes |
| `page-change` | `page` | Fired when page changes |

---

## Slots

| Slot | Scope | Description |
|------|-------|-------------|
| `actions` | - | Toolbar actions (buttons) |
| `empty` | - | Custom empty state |
| `cell-{key}` | `{ row, value }` | Custom cell rendering |
| `actions` | `{ row }` | Custom action buttons |

---

## Migration Examples

### From Old Contacts Table

**Before:**
```vue
<table class="min-w-full divide-y divide-gray-200">
  <thead>
    <tr>
      <th>Name</th>
      <th>Email</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    <tr v-for="contact in contacts" :key="contact._id">
      <td>{{ contact.first_name }} {{ contact.last_name }}</td>
      <td>{{ contact.email }}</td>
      <td>
        <button @click="editContact(contact)">Edit</button>
        <button @click="deleteContact(contact)">Delete</button>
      </td>
    </tr>
  </tbody>
</table>
```

**After:**
```vue
<DataTable
  :data="contacts"
  :columns="[
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'email', label: 'Email' }
  ]"
  @edit="editContact"
  @delete="deleteContact"
/>
```

---

## Best Practices

1. **Use Slots Sparingly**: Only use custom cell slots when formatting functions aren't enough
2. **Server-Side Operations**: For large datasets, handle search, sort, and pagination on the server
3. **Memoize Columns**: Define columns outside the component to prevent re-renders
4. **Loading States**: Always show loading state during async operations
5. **Accessibility**: The table includes proper ARIA attributes and keyboard navigation

---

## Tips & Tricks

### Dynamic Columns
```javascript
const columns = computed(() => {
  const base = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' }
  ];
  
  if (user.isAdmin) {
    base.push({ key: 'revenue', label: 'Revenue' });
  }
  
  return base;
});
```

### Conditional Row Styling
```vue
<DataTable
  :row-class="(row) => row.status === 'urgent' ? 'bg-red-50' : ''"
/>
```

### Bulk Actions with Selection
```vue
<template>
  <div>
    <div v-if="selectedRows.length > 0" class="bulk-actions">
      <span>{{ selectedRows.length }} selected</span>
      <button @click="bulkDelete">Delete All</button>
      <button @click="bulkExport">Export Selected</button>
    </div>
    
    <DataTable
      :selectable="true"
      @select="selectedRows = $event"
    />
  </div>
</template>
```

---

## Troubleshooting

**Q: Sorting not working?**  
A: Make sure to handle the `@sort` event if using server-side sorting

**Q: Search is slow?**  
A: Implement server-side search using the `@search` event

**Q: Pagination shows wrong count?**  
A: Pass the correct `:total-records` prop from your API response

**Q: Custom component not rendering?**  
A: Ensure the component is imported and accepts `value` and `row` props

---

This reusable DataTable component will save you hours of development time and ensure consistency across your application! 🚀

