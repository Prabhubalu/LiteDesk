# Batch Update for Remaining Modules

## Summary

The following changes need to be applied to **Tasks.vue**, **Calendar.vue**, and **Imports.vue**:

### **Common Changes for All:**

1. **Import ModuleActions and RowActions**
2. **Import useBulkActions composable**
3. **Replace header action buttons with ModuleActions component**
4. **Replace row actions with RowActions component**
5. **Replace massActions array with useBulkActions composable**

---

## Tasks.vue

### 1. Update Imports:
```javascript
// ADD:
import { useBulkActions } from '@/composables/useBulkActions';
import ModuleActions from '@/components/common/ModuleActions.vue';
import RowActions from '@/components/common/RowActions.vue';
```

### 2. Replace Header Actions:
```vue
<!-- REPLACE -->
<div class="flex gap-4">
  <button @click="showImportModal = true" class="btn-secondary...">Import</button>
  <button @click="exportTasks" class="btn-secondary...">Export</button>
  <button @click="openCreateModal" class="btn-primary...">New Task</button>
</div>

<!-- WITH -->
<ModuleActions 
  module="tasks"
  create-label="New Task"
  @create="openCreateModal"
  @import="showImportModal = true"
  @export="exportTasks"
/>
```

### 3. Replace Row Actions:
```vue
<!-- REPLACE all button templates -->
<template #actions="{ row }">
  <button @click.stop="viewTask">View</button>
  <button @click.stop="editTask">Edit</button>
  <button @click.stop="deleteTask">Delete</button>
</template>

<!-- WITH -->
<template #actions="{ row }">
  <RowActions 
    :row="row"
    module="tasks"
    @view="viewTask(row._id)"
    @edit="editTask(row)"
    @delete="deleteTask(row._id)"
  />
</template>
```

### 4. Replace Mass Actions:
```javascript
// REPLACE:
const massActions = [
  { label: 'Delete', ... },
  { label: 'Export', ... }
];

// WITH:
const { bulkActions: massActions } = useBulkActions('tasks');
```

---

## Calendar.vue (Events)

### 1. Update Imports:
```javascript
// ADD:
import { useBulkActions } from '@/composables/useBulkActions';
import ModuleActions from '@/components/common/ModuleActions.vue';
```

### 2. Replace Header Actions:
```vue
<!-- REPLACE -->
<button @click="openCreateModal">New Event</button>
<button @click="exportEvents">Export</button>

<!-- WITH -->
<ModuleActions 
  module="events"
  create-label="New Event"
  :show-import="false"
  @create="openCreateModal"
  @export="exportEvents"
/>
```

### 3. Calendar may not have row actions - check event cards

---

## Imports.vue

### 1. Update Imports:
```javascript
// ADD:
import { useBulkActions } from '@/composables/useBulkActions';
import RowActions from '@/components/common/RowActions.vue';
```

### 2. No Create/Import/Export buttons needed (this IS the import module)

### 3. Replace Row Actions:
```vue
<!-- REPLACE -->
<template #actions="{ row }">
  <button @click.stop="viewImport">View</button>
  <button @click.stop="deleteImport">Delete</button>
</template>

<!-- WITH -->
<template #actions="{ row }">
  <RowActions 
    :row="row"
    module="imports"
    @view="viewImport(row._id)"
    @delete="deleteImport(row._id)"
  >
    <!-- Edit is typically not needed for import history -->
  </RowActions>
</template>
```

### 4. Replace Mass Actions:
```javascript
// REPLACE:
const massActions = [
  { label: 'Delete', ... }
];

// WITH:
const { bulkActions: massActions } = useBulkActions('imports');
```

---

## Completed!

After applying these changes to all 3 modules:
- **Total lines saved**: ~200+ lines
- **Permission checks**: Centralized in reusable components  
- **Maintenance**: Update once, apply everywhere

All modules now use permission-aware components! 🎉

