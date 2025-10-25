# Permission-Aware Reusable Components Guide 🔒

## 📋 Overview

Instead of adding `v-if="authStore.can(...)"` checks everywhere, we've created **reusable components with built-in permission logic**. Update once, use everywhere!

---

## 🎯 Components Created

### 1. **PermissionButton.vue** - Generic Permission-Aware Button
### 2. **ModuleActions.vue** - Standard Action Buttons (Create, Import, Export)
### 3. **RowActions.vue** - Standard Row Actions (View, Edit, Delete)
### 4. **useBulkActions.js** - Composable for Bulk Actions with Permissions

---

## 📦 Component Details

### **1. PermissionButton** - Generic Button with Permission Check

**Location**: `/client/src/components/common/PermissionButton.vue`

**Purpose**: A generic button that only renders if the user has the required permission.

#### **Props:**
```javascript
{
  module: String (required),      // e.g., 'contacts', 'deals'
  action: String (required),      // e.g., 'create', 'edit', 'delete'
  variant: String,                // 'primary', 'secondary', 'danger', 'success', 'icon'
  icon: String,                   // 'plus', 'edit', 'delete', 'view', 'import', 'export'
  iconClass: String,              // Custom icon class
  disabled: Boolean,              // Disable button
  type: String,                   // button type
  title: String                   // Tooltip
}
```

#### **Usage:**
```vue
<PermissionButton
  module="contacts"
  action="create"
  variant="primary"
  icon="plus"
  @click="handleCreate"
>
  Create Contact
</PermissionButton>
```

#### **Features:**
- ✅ Auto-hides if user lacks permission
- ✅ Built-in icons for common actions
- ✅ Multiple style variants
- ✅ Slot support for custom content

---

### **2. ModuleActions** - Standard Action Buttons

**Location**: `/client/src/components/common/ModuleActions.vue`

**Purpose**: Renders Create, Import, Export buttons with automatic permission checking.

#### **Props:**
```javascript
{
  module: String (required),      // e.g., 'contacts', 'deals'
  createLabel: String,            // Button label (default: 'New')
  showImport: Boolean,            // Show import button (default: true)
  showExport: Boolean             // Show export button (default: true)
}
```

#### **Events:**
- `@create` - Emitted when Create button is clicked
- `@import` - Emitted when Import button is clicked
- `@export` - Emitted when Export button is clicked

#### **Usage:**
```vue
<template>
  <div class="page-header">
    <div>
      <h1>Contacts</h1>
    </div>
    
    <!-- All three buttons with automatic permission checks! -->
    <ModuleActions 
      module="contacts"
      create-label="New Contact"
      @create="openCreateModal"
      @import="showImportModal = true"
      @export="exportData"
    />
  </div>
</template>
```

#### **What It Does:**
- ✅ **Import Button**: Only shows if user has `create` permission
- ✅ **Export Button**: Only shows if user has `exportData` permission
- ✅ **Create Button**: Only shows if user has `create` permission

#### **Example - Contacts Page:**

**Before** (45 lines of code):
```vue
<div class="flex gap-4">
  <button 
    v-if="authStore.can('contacts', 'create')"
    @click="showImportModal = true" 
    class="btn-secondary flex items-center gap-2"
  >
    <svg>...</svg>
    Import
  </button>
  <button 
    v-if="authStore.can('contacts', 'exportData')"
    @click="exportContacts" 
    class="btn-secondary flex items-center gap-2"
  >
    <svg>...</svg>
    Export
  </button>
  <button 
    v-if="authStore.can('contacts', 'create')"
    @click="openCreateModal" 
    class="btn-primary flex items-center gap-2"
  >
    <svg>...</svg>
    New Contact
  </button>
</div>
```

**After** (6 lines of code):
```vue
<ModuleActions 
  module="contacts"
  create-label="New Contact"
  @create="openCreateModal"
  @import="showImportModal = true"
  @export="exportContacts"
/>
```

**Savings**: **39 lines removed** ✨

---

### **3. RowActions** - Standard Row Actions

**Location**: `/client/src/components/common/RowActions.vue`

**Purpose**: Renders View, Edit, Delete buttons for table rows with automatic permission checking.

#### **Props:**
```javascript
{
  row: Object (required),         // The data row object
  module: String (required)       // e.g., 'contacts', 'deals'
}
```

#### **Events:**
- `@view` - Emitted when View button is clicked
- `@edit` - Emitted when Edit button is clicked (only if user has `edit` permission)
- `@delete` - Emitted when Delete button is clicked (only if user has `delete` permission)

#### **Slots:**
- Default slot - Add custom action buttons after standard actions

#### **Usage:**
```vue
<template #actions="{ row }">
  <RowActions 
    :row="row"
    module="contacts"
    @view="viewContact(row._id)"
    @edit="editContact(row)"
    @delete="deleteContact(row._id)"
  />
</template>
```

#### **With Custom Actions:**
```vue
<template #actions="{ row }">
  <RowActions 
    :row="row"
    module="deals"
    @view="viewDeal(row._id)"
    @edit="editDeal(row)"
    @delete="deleteDeal(row._id)"
  >
    <!-- Custom action button -->
    <button 
      v-if="authStore.can('deals', 'clone')"
      @click.stop="cloneDeal(row)"
      class="p-2 text-purple-600"
      title="Clone"
    >
      <svg>...</svg>
    </button>
  </RowActions>
</template>
```

#### **What It Does:**
- ✅ **View Button**: Always visible (read permission required to see the list)
- ✅ **Edit Button**: Only shows if user has `edit` permission
- ✅ **Delete Button**: Only shows if user has `delete` permission
- ✅ **Custom Actions**: Slot for additional buttons

#### **Example - Contacts Table:**

**Before** (30 lines):
```vue
<template #actions="{ row }">
  <button @click.stop="viewContact(row._id)">
    <svg>...</svg>
  </button>
  <button 
    v-if="authStore.can('contacts', 'edit')"
    @click.stop="editContact(row)"
  >
    <svg>...</svg>
  </button>
  <button 
    v-if="authStore.can('contacts', 'delete')"
    @click.stop="deleteContact(row._id)"
  >
    <svg>...</svg>
  </button>
</template>
```

**After** (7 lines):
```vue
<template #actions="{ row }">
  <RowActions 
    :row="row"
    module="contacts"
    @view="viewContact(row._id)"
    @edit="editContact(row)"
    @delete="deleteContact(row._id)"
  />
</template>
```

**Savings**: **23 lines removed** ✨

---

### **4. useBulkActions** - Composable for Mass Actions

**Location**: `/client/src/composables/useBulkActions.js`

**Purpose**: Returns a filtered list of bulk actions based on user permissions.

#### **Parameters:**
```javascript
useBulkActions(module: String)  // e.g., 'contacts', 'deals'
```

#### **Returns:**
```javascript
{
  bulkActions: ComputedRef<Array>  // Filtered actions based on permissions
}
```

#### **Usage:**
```vue
<script setup>
import { useBulkActions } from '@/composables/useBulkActions';

// Get filtered bulk actions
const { bulkActions: massActions } = useBulkActions('contacts');
</script>

<template>
  <DataTable
    :data="contacts"
    :columns="columns"
    :mass-actions="massActions"
    @bulk-action="handleBulkAction"
  />
</template>
```

#### **What It Does:**
- ✅ **Delete Action**: Only included if user has `delete` permission
- ✅ **Export Action**: Only included if user has `exportData` permission
- ✅ **Auto-updates**: Reactive - updates when permissions change

#### **Example - Bulk Actions:**

**Before** (15 lines):
```vue
const massActions = computed(() => {
  const actions = [];
  
  if (authStore.can('contacts', 'delete')) {
    actions.push({ label: 'Delete', icon: 'trash', action: 'delete', variant: 'danger' });
  }
  
  if (authStore.can('contacts', 'exportData')) {
    actions.push({ label: 'Export', icon: 'export', action: 'export', variant: 'secondary' });
  }
  
  return actions;
});
```

**After** (1 line):
```vue
const { bulkActions: massActions } = useBulkActions('contacts');
```

**Savings**: **14 lines removed** ✨

---

## 🚀 How to Apply to All Modules

### **Step 1: Update Imports**

```vue
<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useBulkActions } from '@/composables/useBulkActions';
import ModuleActions from '@/components/common/ModuleActions.vue';
import RowActions from '@/components/common/RowActions.vue';
// ... other imports
</script>
```

---

### **Step 2: Replace Header Actions**

**Replace this:**
```vue
<div class="flex gap-4">
  <button v-if="..." @click="...">Import</button>
  <button v-if="..." @click="...">Export</button>
  <button v-if="..." @click="...">New</button>
</div>
```

**With this:**
```vue
<ModuleActions 
  module="deals"
  create-label="New Deal"
  @create="openCreateModal"
  @import="showImportModal = true"
  @export="exportData"
/>
```

---

### **Step 3: Replace Row Actions**

**Replace this:**
```vue
<template #actions="{ row }">
  <button @click="view">View</button>
  <button v-if="..." @click="edit">Edit</button>
  <button v-if="..." @click="delete">Delete</button>
</template>
```

**With this:**
```vue
<template #actions="{ row }">
  <RowActions 
    :row="row"
    module="deals"
    @view="viewDeal(row._id)"
    @edit="editDeal(row)"
    @delete="deleteDeal(row._id)"
  />
</template>
```

---

### **Step 4: Replace Bulk Actions**

**Replace this:**
```vue
const massActions = computed(() => {
  const actions = [];
  if (authStore.can(...)) { actions.push(...); }
  return actions;
});
```

**With this:**
```vue
const { bulkActions: massActions } = useBulkActions('deals');
```

---

## 📊 Code Reduction Examples

### **Contacts.vue - Before & After**

| Section | Before | After | Saved |
|---------|--------|-------|-------|
| Header Actions | 45 lines | 6 lines | **39 lines** |
| Row Actions | 30 lines | 7 lines | **23 lines** |
| Bulk Actions | 15 lines | 1 line | **14 lines** |
| **TOTAL** | **90 lines** | **14 lines** | **76 lines (84% reduction)** |

---

## 🔄 Migration Checklist for All Modules

### **Contacts** ✅ (Already Updated)
- [x] Header actions → `ModuleActions`
- [x] Row actions → `RowActions`
- [x] Bulk actions → `useBulkActions`

### **Organizations** ⏳ (To Update)
- [ ] Header actions → `ModuleActions`
- [ ] Row actions → `RowActions`
- [ ] Bulk actions → `useBulkActions`

### **Deals** ⏳ (To Update)
- [ ] Header actions → `ModuleActions`
- [ ] Row actions → `RowActions`
- [ ] Bulk actions → `useBulkActions`

### **Tasks** ⏳ (To Update)
- [ ] Header actions → `ModuleActions`
- [ ] Row actions → `RowActions`
- [ ] Bulk actions → `useBulkActions`

### **Events/Calendar** ⏳ (To Update)
- [ ] Header actions → `ModuleActions`
- [ ] Row actions → `RowActions`
- [ ] Bulk actions → `useBulkActions`

### **Imports** ⏳ (To Update)
- [ ] Row actions → `RowActions`
- [ ] Bulk actions → `useBulkActions`

---

## 🎨 Custom Variants

### **Custom Button Variant**

```vue
<PermissionButton
  module="contacts"
  action="create"
  variant="success"
  @click="handleAction"
>
  Custom Action
</PermissionButton>
```

### **Icon-Only Button**

```vue
<PermissionButton
  module="contacts"
  action="edit"
  variant="icon"
  icon="edit"
  title="Edit Contact"
  @click="editContact"
/>
```

### **Custom Icon with Slot**

```vue
<PermissionButton
  module="contacts"
  action="export"
  variant="secondary"
  @click="exportData"
>
  <template #icon>
    <CustomIcon name="download" />
  </template>
  Export All
</PermissionButton>
```

---

## 🔒 Permission Mapping Reference

| Frontend Action | Backend Permission | Check |
|----------------|-------------------|-------|
| **View/Read** | `view` | `authStore.can(module, 'view')` |
| **Create** | `create` | `authStore.can(module, 'create')` |
| **Edit/Update** | `edit` | `authStore.can(module, 'edit')` |
| **Delete** | `delete` | `authStore.can(module, 'delete')` |
| **Import** | `create` | `authStore.can(module, 'create')` |
| **Export** | `exportData` | `authStore.can(module, 'exportData')` |

---

## 🧪 Testing Guide

### **Test 1: Create Permission**

1. **Remove `create` permission from "User" role**
2. **Log in as User**
3. ✅ **"New Contact" button should be hidden**
4. ✅ **"Import" button should be hidden**
5. ✅ **"Export" button should still be visible** (if exportData is granted)

---

### **Test 2: Edit Permission**

1. **Remove `edit` permission from "User" role**
2. **Log in as User**
3. **Go to Contacts**
4. ✅ **"Edit" button in rows should be hidden**
5. ✅ **"View" button should still be visible**

---

### **Test 3: Delete Permission**

1. **Remove `delete` permission from "User" role**
2. **Log in as User**
3. **Go to Contacts**
4. ✅ **"Delete" button in rows should be hidden**
5. ✅ **"Delete" option in bulk actions should be hidden**

---

### **Test 4: Export Permission**

1. **Remove `exportData` permission from "User" role**
2. **Log in as User**
3. ✅ **"Export" button in header should be hidden**
4. ✅ **"Export" option in bulk actions should be hidden**

---

## 📝 Benefits Summary

### **Before (Manual Permission Checks Everywhere):**
```
❌ 90 lines of repetitive code per module
❌ Copy-paste errors
❌ Inconsistent styling
❌ Hard to update all at once
❌ Permission logic scattered everywhere
❌ Difficult to maintain
```

### **After (Reusable Components):**
```
✅ 14 lines per module (84% reduction)
✅ Single source of truth
✅ Consistent UI/UX
✅ Update once, apply everywhere
✅ Centralized permission logic
✅ Easy to maintain
✅ Easy to test
✅ Easy to extend
```

---

## 🎯 Next Steps

1. **Update Organizations.vue** with reusable components
2. **Update Deals.vue** with reusable components
3. **Update Tasks.vue** with reusable components
4. **Update Calendar.vue** with reusable components
5. **Update Imports.vue** with reusable components

**Estimated Time**: 5-10 minutes per module  
**Total Code Reduction**: ~400+ lines across all modules 🎉

---

## 💡 Pro Tips

### **Tip 1: Always Use Module Name**
```vue
<!-- ✅ Good -->
<ModuleActions module="contacts" ... />
<ModuleActions module="deals" ... />

<!-- ❌ Bad - Don't hardcode or use wrong module -->
<ModuleActions module="contacts" ... />  <!-- On Deals page -->
```

---

### **Tip 2: Don't Mix Old and New Patterns**
```vue
<!-- ❌ Bad - Mixing patterns -->
<ModuleActions ... />  <!-- New -->
<button v-if="authStore.can(...)">Edit</button>  <!-- Old -->

<!-- ✅ Good - Consistent usage -->
<ModuleActions ... />
<RowActions ... />
```

---

### **Tip 3: Use Custom Slots When Needed**
```vue
<!-- Add custom actions after standard ones -->
<RowActions ...>
  <button>Custom Action</button>
</RowActions>
```

---

## 🔄 Migration Example - Full Module

### **Organizations.vue Migration:**

```vue
<template>
  <div class="page-container">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1>Organizations</h1>
      </div>
      
      <!-- ✅ Replace this entire section -->
      <ModuleActions 
        module="organizations"
        create-label="New Organization"
        :show-import="false"
        @create="openCreateModal"
        @export="exportOrganizations"
      />
    </div>

    <!-- Table -->
    <DataTable
      :data="organizations"
      :columns="columns"
      :mass-actions="massActions"
    >
      <!-- ✅ Replace row actions -->
      <template #actions="{ row }">
        <RowActions 
          :row="row"
          module="organizations"
          @view="viewOrganization(row._id)"
          @edit="editOrganization(row)"
          @delete="deleteOrganization(row._id)"
        />
      </template>
    </DataTable>
  </div>
</template>

<script setup>
import { useBulkActions } from '@/composables/useBulkActions';
import ModuleActions from '@/components/common/ModuleActions.vue';
import RowActions from '@/components/common/RowActions.vue';

// ✅ Replace bulk actions code with this
const { bulkActions: massActions } = useBulkActions('organizations');
</script>
```

---

## 🎉 Summary

**You're absolutely right!** Centralizing permission checks in reusable components is the way to go. Now:

1. ✅ **Update once, apply everywhere**
2. ✅ **84% less code per module**
3. ✅ **Consistent UI/UX**
4. ✅ **Easy to maintain**
5. ✅ **No more scattered permission checks**

**Contacts module updated as example. Ready to migrate the rest!** 🚀

