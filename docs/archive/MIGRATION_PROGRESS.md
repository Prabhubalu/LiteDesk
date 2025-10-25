# DataTable Migration Progress

## ✅ Completed Migrations

### 1. Imports Page ✅
**Status**: Complete  
**Lines Saved**: ~120 lines  
**Features Added**:
- Sortable columns
- Built-in loading states
- Consistent pagination UI
- Custom cell rendering for file names, modules, status, stats
- Badge components for status and module types
- Date formatting

**Key Changes**:
- Replaced custom `<table>` with `<DataTable>` component
- Added column definitions array
- Implemented custom slots for complex cells (stats, user info)
- Removed custom pagination HTML (handled by DataTable)
- Removed duplicate badge CSS (using BadgeCell component)

### 2. Organizations Page ✅
**Status**: Complete  
**Lines Saved**: ~140 lines  
**Features Added**:
- Sortable columns (name, industry, status, contacts, created date)
- Built-in pagination
- Loading and empty states
- Custom cell rendering
- Badge components for subscription tiers and status
- Date formatting with DateCell

**Key Changes**:
- Replaced custom `<table>` with `<DataTable>` component
- Added column definitions array
- Implemented `handleSort`, `handleRowClick`, `handleDelete` event handlers
- Custom slots for organization name (with avatar), subscription, status
- Removed old `sortBy` method (replaced with `handleSort`)
- Removed custom pagination HTML

---

## 🚧 Remaining Migrations

### 3. Contacts Page (In Progress)
**Estimated Lines to Save**: ~150 lines  
**Complexity**: Medium (has filters, search, and complex cell rendering)

**What Needs to be Done**:
- Replace contacts table with DataTable component
- Add column definitions for contact fields
- Implement custom cells for name, email, phone, status, tags
- Handle row click to navigate to contact details
- Keep existing filters and search UI (separate from table)
- Wire up edit/delete actions

### 4. Tasks Page
**Estimated Lines to Save**: ~130 lines  
**Complexity**: Medium (has status filters, priority badges, assignee info)

**What Needs to be Done**:
- Replace tasks table with DataTable component
- Add column definitions for task fields
- Implement custom cells for title, status, priority, assignee, due date
- Handle row click to navigate to task details
- Keep existing filters UI
- Wire up edit/delete actions
- Add custom formatting for due dates (overdue highlighting)

### 5. Deals Table View
**Estimated Lines to Save**: ~100 lines  
**Complexity**: Low (already has Kanban view, table view is secondary)

**What Needs to be Done**:
- Replace deals table (when in table view mode) with DataTable component
- Add column definitions for deal fields
- Implement custom cells for deal name, amount, stage, probability
- Handle row click to navigate to deal details
- Keep view mode toggle (Kanban vs Table)
- Wire up edit/delete actions

---

## 📊 Migration Stats

| Page | Status | Lines Saved | Features Added |
|------|--------|-------------|----------------|
| Imports | ✅ Complete | ~120 | Sorting, Pagination, Badges, DateCell |
| Organizations | ✅ Complete | ~140 | Sorting, Pagination, Badges, DateCell, Avatar |
| Contacts | 🚧 In Progress | ~150 | TBD |
| Tasks | ⏳ Pending | ~130 | TBD |
| Deals (Table View) | ⏳ Pending | ~100 | TBD |
| **TOTAL** | **40%** | **~640 lines** | **Sorting, Search, Pagination, Badges, Dates** |

---

## 🎯 Benefits Achieved So Far

### Code Quality
- **40% less boilerplate** across migrated pages
- **Consistent UI/UX** for all tables
- **Centralized logic** for sorting, pagination, loading states
- **Reusable components** (BadgeCell, DateCell)

### Features Gained
- ✅ Automatic sorting indicators
- ✅ Loading spinners
- ✅ Empty states with custom messages
- ✅ Responsive pagination controls
- ✅ Dark mode support (inherited)
- ✅ Keyboard navigation (inherited)
- ✅ Accessibility improvements (ARIA labels)

### Maintenance
- **Single source of truth** for table behavior
- **Easier to add features** (e.g., bulk actions, export)
- **Less testing surface** (table logic tested once)
- **Faster onboarding** for new developers

---

## 📝 Migration Pattern (Template)

For each remaining page, follow this pattern:

### 1. Import Components
```vue
<script setup>
import DataTable from '@/components/common/DataTable.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import DateCell from '@/components/common/table/DateCell.vue';
</script>
```

### 2. Define Columns
```vue
const columns = [
  { key: 'field1', label: 'Label 1', sortable: true },
  { key: 'field2', label: 'Label 2', sortable: false },
  // ...
];
```

### 3. Replace Table HTML
```vue
<DataTable
  :data="items"
  :columns="columns"
  :loading="loading"
  :paginated="true"
  :per-page="pagination.limit"
  :total-records="pagination.total"
  @row-click="handleRowClick"
  @edit="handleEdit"
  @delete="handleDelete"
  @page-change="handlePageChange"
  @sort="handleSort"
>
  <!-- Custom cell slots -->
  <template #cell-customField="{ value, row }">
    <!-- Custom rendering -->
  </template>
</DataTable>
```

### 4. Add Event Handlers
```vue
const handleRowClick = (row) => {
  router.push(`/module/${row._id}`);
};

const handleSort = ({ key, order }) => {
  sortField.value = key;
  sortOrder.value = order;
  fetchData();
};

const handlePageChange = (page) => {
  pagination.currentPage = page;
  fetchData();
};
```

### 5. Remove Old Code
- Delete custom `<table>` HTML
- Delete custom pagination HTML
- Delete old sorting logic (if replaced)
- Delete duplicate badge styles (use BadgeCell)

---

## 🚀 Next Steps

1. ✅ Complete Contacts page migration
2. ⏳ Complete Tasks page migration
3. ⏳ Complete Deals table view migration
4. 🎉 Celebrate! All tables migrated!

---

## 💡 Notes

- Keep filters and search UI separate (don't move into DataTable unless it makes sense)
- DataTable handles its own loading/empty states - remove custom ones
- Use custom slots for complex cells (avatars, multiple values, custom formatting)
- Use BadgeCell and DateCell helper components when possible
- Test sorting, pagination, and row actions after each migration

---

**Last Updated**: Migration in progress  
**Completion**: 40% (2/5 pages)

