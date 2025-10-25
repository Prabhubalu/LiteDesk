# Module Visibility Fix - Organizations & Events 🔧

## 🐛 Problem

**Issue**: Organizations and Calendar/Events modules were not appearing in navigation even when permissions were granted in the role.

**Root Cause**: Multiple mismatches between permission checks:
1. **Navigation** was checking wrong permissions
2. **Router** was checking wrong permissions
3. **Backend** was not mapping Events permissions

---

## ✅ Solution Summary

### **Fixed 3 Critical Issues:**

1. ✅ **Navigation Permission Checks** (`Nav.vue`)
2. ✅ **Router Permission Guards** (`router/index.js`)
3. ✅ **Backend Permission Mapping** (`authController.js`, `userController.js`)

---

## 📋 Detailed Fixes

### **Issue 1: Organizations Navigation Check**

#### **Before:**
```javascript
// Nav.vue - Line 22
if (authStore.can('contacts', 'view') && (authStore.isOwner || authStore.userRole === 'admin')) {
  nav.push({ name: 'Organizations', href: '/organizations' });
}
```

**Problems:**
- ❌ Checking `contacts.view` instead of `organizations.view`
- ❌ Restricting to only Owner/Admin roles
- ❌ Even if role had organizations permission, it wouldn't show

#### **After:**
```javascript
// Nav.vue - Line 22
if (authStore.can('organizations', 'view')) {
  nav.push({ name: 'Organizations', href: '/organizations' });
}
```

**Result:**
- ✅ Checks correct `organizations.view` permission
- ✅ No role restriction - works for any role with permission
- ✅ Module appears when permission is granted

---

### **Issue 2: Organizations Router Guards**

#### **Before:**
```javascript
// router/index.js
{
  path: '/organizations',
  name: 'organizations',
  component: () => import('@/views/Organizations.vue'),
  meta: { requiresAuth: true, requiresPermission: { module: 'contacts', action: 'view' } }
},
{
  path: '/organizations/:id',
  name: 'organization-detail',
  component: () => import('@/views/OrganizationDetail.vue'),
  meta: { requiresAuth: true, requiresPermission: { module: 'contacts', action: 'view' } }
}
```

**Problem:**
- ❌ Route guards checking `contacts.view` instead of `organizations.view`
- ❌ User could see nav item but get blocked when clicking

#### **After:**
```javascript
// router/index.js
{
  path: '/organizations',
  name: 'organizations',
  component: () => import('@/views/Organizations.vue'),
  meta: { requiresAuth: true, requiresPermission: { module: 'organizations', action: 'view' } }
},
{
  path: '/organizations/:id',
  name: 'organization-detail',
  component: () => import('@/views/OrganizationDetail.vue'),
  meta: { requiresAuth: true, requiresPermission: { module: 'organizations', action: 'view' } }
}
```

**Result:**
- ✅ Route guards check correct permission
- ✅ Navigation and access control now match

---

### **Issue 3: Calendar/Events Navigation Check**

#### **Before:**
```javascript
// Nav.vue - Line 37
if (authStore.can('tasks', 'view')) {
  nav.push({ name: 'Calendar', href: '/calendar' });
}
```

**Problem:**
- ❌ Checking `tasks.view` instead of `events.view`
- ❌ Calendar visibility tied to Tasks permission

#### **After:**
```javascript
// Nav.vue - Line 37
if (authStore.can('events', 'view')) {
  nav.push({ name: 'Calendar', href: '/calendar' });
}
```

**Result:**
- ✅ Checks correct `events.view` permission
- ✅ Calendar independent from Tasks

---

### **Issue 4: Calendar/Events Router Guards**

#### **Before:**
```javascript
// router/index.js
{
  path: '/calendar',
  name: 'calendar',
  component: () => import('@/views/Calendar.vue'),
  meta: { requiresAuth: true, requiresPermission: { module: 'tasks', action: 'view' } }
},
{
  path: '/events/:id',
  name: 'event-detail',
  component: () => import('@/views/EventDetail.vue'),
  meta: { requiresAuth: true, requiresPermission: { module: 'tasks', action: 'view' } }
}
```

**Problem:**
- ❌ Route guards checking `tasks.view` instead of `events.view`

#### **After:**
```javascript
// router/index.js
{
  path: '/calendar',
  name: 'calendar',
  component: () => import('@/views/Calendar.vue'),
  meta: { requiresAuth: true, requiresPermission: { module: 'events', action: 'view' } }
},
{
  path: '/events/:id',
  name: 'event-detail',
  component: () => import('@/views/EventDetail.vue'),
  meta: { requiresAuth: true, requiresPermission: { module: 'events', action: 'view' } }
}
```

**Result:**
- ✅ Route guards check correct permission

---

### **Issue 5: Events Permission Mapping Missing**

#### **Before:**
```javascript
// authController.js & userController.js
user.permissions = {
  contacts: { ... },
  organizations: { ... },
  deals: { ... },
  tasks: { ... },
  imports: { ... },  // ← No events here!
  settings: { ... }
};
```

**Problem:**
- ❌ Events permissions not being mapped from Role to User
- ❌ Even if role had events.read, user.permissions.events didn't exist
- ❌ `authStore.can('events', 'view')` always returned false

#### **After:**
```javascript
// authController.js & userController.js
user.permissions = {
  contacts: { ... },
  organizations: { ... },
  deals: { ... },
  tasks: { ... },
  events: {                                                    // ← Added!
    view: user.roleId.permissions.events?.read || false,
    create: user.roleId.permissions.events?.create || false,
    edit: user.roleId.permissions.events?.update || false,
    delete: user.roleId.permissions.events?.delete || false,
    viewAll: user.roleId.permissions.events?.viewAll || false
  },
  imports: { ... },
  settings: { ... }
};
```

**Result:**
- ✅ Events permissions now correctly mapped
- ✅ `authStore.can('events', 'view')` works correctly
- ✅ Calendar shows when events permission is granted

---

## 📊 Permission Flow

### **Complete Permission Check Flow:**

```
1. Admin creates/edits Role in UI
   ↓
2. Role permissions saved to database
   {
     organizations: { read: true, create: true, ... },
     events: { read: true, create: true, ... }
   }
   ↓
3. User logs in or refreshes
   ↓
4. Backend fetches user.roleId.permissions
   ↓
5. Backend maps Role permissions → User permissions
   {
     organizations: { view: true, create: true, ... },  // read → view
     events: { view: true, create: true, ... }           // read → view
   }
   ↓
6. Frontend stores in authStore.user.permissions
   ↓
7. Nav.vue checks authStore.can('organizations', 'view')
   ↓
8. Returns true → Organizations appears in navigation ✅
   ↓
9. User clicks Organizations
   ↓
10. Router guard checks permissions
    ↓
11. Grants access ✅
```

---

## 🧪 Testing Guide

### **Test 1: Organizations Visibility**

1. **Go to Settings → Roles & Permissions**
2. **Edit "Manager" role**
3. **Organizations module:**
   - ✅ Check "Read"
4. **Save role**
5. **Log in as a Manager user**
6. ✅ **Organizations should appear in navigation**
7. **Click Organizations**
8. ✅ **Should load successfully (not blocked by route guard)**

---

### **Test 2: Organizations Access Control**

1. **Edit "User" role**
2. **Organizations module:**
   - ❌ Uncheck "Read"
3. **Save role**
4. **Log in as a User**
5. ✅ **Organizations should NOT appear in navigation**
6. **Try to manually navigate to `/organizations`**
7. ✅ **Should redirect to dashboard with "insufficient permissions" alert**

---

### **Test 3: Calendar/Events Visibility**

1. **Edit "Manager" role**
2. **Events module:**
   - ✅ Check "Read"
3. **Tasks module:**
   - ❌ Uncheck "Read"
4. **Save role**
5. **Log in as a Manager user**
6. ✅ **Calendar should appear in navigation**
7. ✅ **Tasks should NOT appear in navigation**
8. **This proves Calendar is independent from Tasks** ✓

---

### **Test 4: Events Access Control**

1. **Edit "Viewer" role**
2. **Events module:**
   - ❌ Uncheck all permissions
3. **Save role**
4. **Log in as a Viewer**
5. ✅ **Calendar should NOT appear in navigation**
6. **Try to manually navigate to `/calendar`**
7. ✅ **Should redirect to dashboard with "insufficient permissions" alert**

---

### **Test 5: Independent Module Permissions**

**Scenario**: Manager should see Organizations but not Deals

1. **Edit "Manager" role:**
   - Organizations: Read ✅
   - Deals: (all unchecked) ❌
   
2. **Log in as Manager**

3. **Check navigation:**
   - ✅ Organizations appears
   - ❌ Deals does NOT appear

4. **Result**: Modules are correctly independent ✓

---

## 📝 Files Modified

| File | Changes |
|------|---------|
| `/client/src/components/Nav.vue` | Fixed Organizations check: `contacts.view` → `organizations.view`<br>Fixed Calendar check: `tasks.view` → `events.view`<br>Removed role restrictions |
| `/client/src/router/index.js` | Fixed Organizations route guards<br>Fixed Calendar/Events route guards |
| `/server/controllers/authController.js` | Added `events` permission mapping in login flow |
| `/server/controllers/userController.js` | Added `events` permission mapping in profile fetch |

---

## 🔍 Debug Commands

### **Check User Permissions:**
```javascript
// In browser console (F12)
const user = JSON.parse(localStorage.getItem('user'));
console.table({
  'Organizations View': user.permissions.organizations?.view,
  'Organizations Create': user.permissions.organizations?.create,
  'Events View': user.permissions.events?.view,
  'Events Create': user.permissions.events?.create
});
```

### **Check Role Permissions (MongoDB):**
```javascript
db.roles.findOne({ name: "Manager" }, { permissions: 1 })

// Should show:
{
  permissions: {
    organizations: { read: true, create: true, ... },
    events: { read: true, create: true, ... }
  }
}
```

### **Check User's Role:**
```javascript
db.users.findOne({ email: "manager@test.com" }, { roleId: 1, permissions: 1 })

// Should show:
{
  roleId: ObjectId("..."),
  permissions: {
    organizations: { view: true, create: true, ... },
    events: { view: true, create: true, ... }
  }
}
```

---

## ✅ Verification Checklist

After these fixes, verify:

- [ ] Organizations nav check uses `organizations.view`
- [ ] Organizations route guards use `organizations.view`
- [ ] Calendar nav check uses `events.view`
- [ ] Calendar route guards use `events.view`
- [ ] Backend maps `events` permissions
- [ ] Organizations appears when permission granted
- [ ] Organizations hidden when permission denied
- [ ] Calendar appears when permission granted
- [ ] Calendar hidden when permission denied
- [ ] Route access matches navigation visibility
- [ ] No role-based restrictions (only permission-based)

---

## 🎯 Current Module Permission Mapping

| Module | Nav Check | Route Guard | Backend Mapping |
|--------|-----------|-------------|-----------------|
| **Dashboard** | Always visible | `requiresAuth` only | N/A |
| **Contacts** | `contacts.view` ✅ | `contacts.view` ✅ | ✅ |
| **Organizations** | `organizations.view` ✅ | `organizations.view` ✅ | ✅ |
| **Deals** | `deals.view` ✅ | `deals.view` ✅ | ✅ |
| **Tasks** | `tasks.view` ✅ | `tasks.view` ✅ | ✅ |
| **Calendar** | `events.view` ✅ | `events.view` ✅ | ✅ |
| **Imports** | `imports.view` ✅ | `imports.view` ✅ | ✅ |

**All modules now correctly aligned!** ✅

---

## 🚀 Next Steps

1. **Clear browser cache** (F12 → Application → Clear site data)
2. **Log out**
3. **Log back in**
4. **Check console for:**
   ```
   🔄 Syncing permissions from role: Manager
   ✅ Permissions synced from role
   ```
5. **Verify navigation** shows correct modules
6. **Test route access** matches navigation

---

## 🎉 Result

### **Before:**
```
❌ Organizations permission granted → Module not visible
❌ Navigation checking wrong permission
❌ Router checking wrong permission
❌ Events permissions not mapped
❌ Calendar tied to Tasks permission
```

### **After:**
```
✅ Organizations permission granted → Module visible
✅ Navigation checking correct permission
✅ Router checking correct permission
✅ Events permissions properly mapped
✅ Calendar independent with events permission
✅ All modules work as expected
```

---

**Organizations and Calendar now correctly respect their own permissions!** 🎊

Modules appear/disappear based on their specific role permissions, with no hardcoded role restrictions!

