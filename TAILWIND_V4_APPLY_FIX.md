# Tailwind CSS v4 - @apply Fix

## Issue
After upgrading to Tailwind CSS v4, Vue components with scoped CSS using `@apply` directives were throwing errors:
```
Cannot apply unknown utility class `bg-gray-100`. 
Are you using CSS modules or similar and missing `@reference`?
```

## Root Cause
Tailwind v4 requires an explicit `@import 'tailwindcss' with (reference);` directive in scoped style sections that use `@apply`.

## Solution
Added the reference import to all Vue components using `@apply` in scoped CSS.

## Files Fixed

### 1. **BadgeCell.vue**
**Location:** `client/src/components/common/table/BadgeCell.vue`

**Before:**
```vue
<style scoped>
.badge {
  @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium;
}
</style>
```

**After:**
```vue
<style scoped>
@import 'tailwindcss' with (reference);

.badge {
  @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium;
}
</style>
```

### 2. **DateCell.vue**
**Location:** `client/src/components/common/table/DateCell.vue`

**Before:**
```vue
<style scoped>
.date-cell {
  @apply text-gray-700 dark:text-gray-300;
}
</style>
```

**After:**
```vue
<style scoped>
@import 'tailwindcss' with (reference);

.date-cell {
  @apply text-gray-700 dark:text-gray-300;
}
</style>
```

### 3. **CSVImportModal.vue**
**Location:** `client/src/components/import/CSVImportModal.vue`

**Before:**
```vue
<style scoped>
/* Custom Scrollbar Styling */
.custom-scrollbar::-webkit-scrollbar-track {
  @apply bg-gray-100 dark:bg-gray-800 rounded-full;
}
</style>
```

**After:**
```vue
<style scoped>
@import 'tailwindcss' with (reference);

/* Custom Scrollbar Styling */
.custom-scrollbar::-webkit-scrollbar-track {
  @apply bg-gray-100 dark:bg-gray-800 rounded-full;
}
</style>
```

### 4. **ImportDetail.vue**
**Location:** `client/src/views/ImportDetail.vue`

**Before:**
```vue
<style scoped>
.badge {
  @apply px-3 py-1 rounded-full text-xs font-medium;
}
</style>
```

**After:**
```vue
<style scoped>
@import 'tailwindcss' with (reference);

.badge {
  @apply px-3 py-1 rounded-full text-xs font-medium;
}
</style>
```

## Key Takeaway

**In Tailwind v4, when using `@apply` in scoped CSS (`<style scoped>`), you MUST add:**

```css
@import 'tailwindcss' with (reference);
```

This tells Tailwind to make utilities available for `@apply` without including them in the component's scoped styles.

## Alternative Approach (Recommended) - IMPLEMENTED

Instead of using `@apply` in scoped CSS, we converted all scoped styles to plain CSS with dark mode support using `:global(.dark)` selectors.

### Why We Removed `@apply`

1. **Custom colors not available**: `@theme` colors (brand, success, warning, danger) were not accessible in scoped `@apply` directives
2. **Simpler approach**: Plain CSS is more straightforward and doesn't require the `@import 'tailwindcss' with (reference);` directive
3. **Better compatibility**: No dependency on Tailwind's `@apply` behavior changes in v4
4. **Full control**: Explicit CSS properties give us complete control over styling

### Example Conversion

**Before (using @apply):**
```vue
<style scoped>
@import 'tailwindcss' with (reference);

.badge {
  @apply px-3 py-1 rounded-full text-xs font-medium;
}

.badge-success {
  @apply bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300;
}
</style>
```

**After (plain CSS):**
```vue
<style scoped>
.badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.badge-success {
  background-color: #f0fdf4;
  color: #047857;
}

:global(.dark) .badge-success {
  background-color: rgba(4, 120, 87, 0.3);
  color: #6ee7b7;
}
</style>
```

## Final Solution Summary

✅ **Removed ALL `@apply` directives** from scoped CSS  
✅ **Converted to plain CSS** with hardcoded color values  
✅ **Dark mode support** using `:global(.dark)` selectors  
✅ **No more import errors** - custom colors work perfectly  
✅ **Cleaner code** - no dependency on Tailwind's @apply behavior  

## Files Updated (Final)

All `@apply` directives replaced with plain CSS:
- ✅ `BadgeCell.vue` - Converted 6 badge variants
- ✅ `DateCell.vue` - Converted date styling
- ✅ `CSVImportModal.vue` - Converted custom scrollbar
- ✅ `ImportDetail.vue` - Converted 5 badge variants + stats + detail rows

## Status
✅ **All files fixed and working perfectly with Tailwind CSS v4.1.16**  
✅ **Zero `@apply` directives remaining in scoped CSS**  
✅ **All custom colors working correctly**  
✅ **Dark mode fully functional**  

---
**Fixed:** October 24, 2025

