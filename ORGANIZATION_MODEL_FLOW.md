# Organization Model Flow - Complete Architecture Guide

## 📋 Overview

The application now uses a **single unified `Organization` model** that handles both:
1. **Tenant Organizations** (`isTenant: true`) - Your SaaS customers who pay for LiteDesk
2. **CRM Organizations** (`isTenant: false`) - Customer/Partner records that users manage in their CRM

---

## 🏗️ Architecture

### Unified Organization Model

```javascript
Organization {
  // ===== TENANT FIELDS (isTenant: true) =====
  subscription: { status, tier, trialEndDate, ... }
  limits: { maxUsers, maxContacts, ... }
  enabledModules: [...]
  settings: { dateFormat, timeZone, ... }
  slug: String (unique)
  
  // ===== CRM FIELDS (isTenant: false) =====
  types: ['Customer', 'Partner', 'Vendor', ...]
  createdBy: ObjectId → User
  assignedTo: ObjectId → User
  primaryContact: ObjectId → People
  customerStatus: 'Active' | 'Prospect' | ...
  activityLogs: [...]
  
  // ===== SHARED FIELDS =====
  name: String (required)
  industry: String
  isTenant: Boolean (default: false)
  legacyOrganizationId: ObjectId (for migration)
}
```

---

## 🔄 Data Flow

### 1. **Registration Flow** (Creates Tenant Organization)

```
User Registration
    ↓
Create Organization (isTenant: true)
    ↓
Set subscription, limits, enabledModules
    ↓
Create Admin User (linked to organizationId)
    ↓
Create Default Roles
    ↓
Initialize Module Definitions
```

**Files:**
- `server/controllers/authController.js` → `registerUser()`
- `server/models/Organization.js` → Creates with `isTenant: true` implicitly (has subscription)

**Key Points:**
- Tenant orgs have `subscription`, `limits`, `enabledModules`
- Used for multi-tenancy isolation
- Users belong to tenant org via `user.organizationId`

---

### 2. **CRM Organization Creation** (Creates CRM Record)

```
User Creates Organization in CRM
    ↓
POST /api/v2/organization
    ↓
organizationV2Controller.create()
    ↓
Create Organization (isTenant: false)
    ↓
Set createdBy = currentUser
    ↓
Set assignedTo = currentUser (default)
    ↓
Add initial activityLog
```

**Files:**
- `server/controllers/organizationV2Controller.js` → `create()`
- Route: `server/routes/organizationV2Routes.js`
- Frontend: `client/src/views/Organizations.vue`

**Key Points:**
- CRM orgs have `isTenant: false`
- No subscription/limits fields
- Has CRM fields: `types`, `assignedTo`, `createdBy`, `activityLogs`
- Created within a tenant org's workspace

---

### 3. **Query Flow** (List Organizations)

#### Admin View (All CRM Organizations)
```
GET /api/admin/organizations/all
    ↓
adminController.getAllOrganizations()
    ↓
Query: { isTenant: false }  // Only CRM orgs
    ↓
Populate: createdBy, assignedTo
    ↓
Return list of CRM organizations
```

#### User View (CRM Organizations in their tenant)
```
GET /api/v2/organization
    ↓
organizationV2Controller.list()
    ↓
Query: { isTenant: false }  // Only CRM orgs
    ↓
Populate: createdBy, assignedTo
    ↓
Return list
```

**Key Points:**
- Always filter by `isTenant: false` for CRM lists
- Always populate `createdBy` and `assignedTo` for display

---

### 4. **People/Contacts Flow** (Links to CRM Organizations)

```
Create Contact/People Record
    ↓
Set organization: ObjectId → Organization (CRM)
    ↓
Query People with organization populated
```

**Files:**
- `server/models/People.js` → `organization: { ref: 'Organization' }`
- `server/controllers/peopleController.js` → Populates organization

**Key Points:**
- People records link to CRM organizations (`isTenant: false`)
- NOT tenant organizations (those are for user management)

---

### 5. **Module Definitions Flow**

```
Tenant Organization Created
    ↓
updateOrganizationsModuleFields(organizationId)
    ↓
Query: Organization.find({ isTenant: true })
    ↓
Create ModuleDefinition for 'organizations' module
    ↓
Define fields: name, types, assignedTo, createdBy, ...
```

**Files:**
- `server/scripts/updateOrganizationsModuleFields.js`
- Only updates module definitions for tenant orgs

**Key Points:**
- Module definitions are tenant-scoped
- Define which CRM fields are available in that tenant

---

## 🔑 Key Distinctions

### Tenant Organization (`isTenant: true`)
- **Purpose**: Multi-tenancy - separates SaaS customers
- **Who creates**: System during registration
- **Fields**: `subscription`, `limits`, `enabledModules`, `settings`, `slug`
- **Users belong to**: Users have `organizationId` pointing here
- **Usage**: Controls billing, limits, feature access
- **Example**: "Acme Corp" is a LiteDesk customer

### CRM Organization (`isTenant: false`)
- **Purpose**: CRM record - a customer/partner the user manages
- **Who creates**: Users within their tenant workspace
- **Fields**: `types`, `assignedTo`, `createdBy`, `customerStatus`, `activityLogs`
- **Users belong to**: No - users create these, not belong to them
- **Usage**: CRM data - managing customers, partners, vendors
- **Example**: "XYZ Inc" is Acme Corp's customer

---

## 📊 Example Scenario

### Scenario: Acme Corp uses LiteDesk

1. **Registration**:
   ```
   Acme Corp registers → Creates Tenant Org (isTenant: true)
   - subscription: trial
   - limits: maxUsers: 3, maxContacts: 100
   - enabledModules: ['contacts', 'organizations']
   ```

2. **Acme Corp creates CRM organizations**:
   ```
   User creates "XYZ Inc" → Creates CRM Org (isTenant: false)
   - types: ['Customer']
   - assignedTo: currentUser
   - createdBy: currentUser
   ```

3. **Query flow**:
   ```
   GET /api/v2/organization
   → Finds all Organization where isTenant: false
   → Returns: XYZ Inc, ABC Corp, etc. (CRM orgs)
   → Does NOT return: Acme Corp (tenant org)
   ```

---

## 🔍 Query Patterns

### Getting Tenant Organization
```javascript
// User's own tenant org
const tenantOrg = await Organization.findById(req.user.organizationId);

// All tenant orgs (admin)
const tenants = await Organization.find({ isTenant: true });
```

### Getting CRM Organizations
```javascript
// All CRM orgs for a tenant
const crmOrgs = await Organization.find({ isTenant: false });

// CRM org by ID
const crmOrg = await Organization.findOne({ 
  _id: id, 
  isTenant: false 
});
```

### Populating Relationships
```javascript
// Always populate for display
.populate('createdBy', 'firstName lastName email avatar username')
.populate('assignedTo', 'firstName lastName email avatar username')
.populate('primaryContact', 'first_name last_name email')
```

---

## 🛡️ Security & Isolation

### Multi-Tenancy
- Users can only see CRM orgs in their tenant workspace
- Tenant orgs are isolated per SaaS customer
- Admin endpoints can see across all tenants

### Field Protection
- `createdBy` cannot be modified after creation (for CRM orgs)
- Tenant org subscription fields protected
- CRM fields only on CRM orgs

---

## 📝 Routes Summary

| Route | Purpose | Returns |
|-------|---------|---------|
| `/api/organization` | Tenant org management | Tenant org (subscription, settings) |
| `/api/v2/organization` | CRM org management | CRM orgs (isTenant: false) |
| `/api/admin/organizations/all` | Admin view | All CRM orgs across tenants |

---

## ✅ Best Practices

1. **Always filter by `isTenant`** when querying:
   - CRM lists: `{ isTenant: false }`
   - Tenant management: `{ isTenant: true }`

2. **Always populate relationships** for display:
   - `createdBy`, `assignedTo`, `primaryContact`

3. **Set `isTenant: false`** explicitly when creating CRM orgs

4. **Don't mix** tenant and CRM orgs in the same query

---

## 🎯 Summary

The unified model simplifies the architecture:
- ✅ One model instead of two
- ✅ Clear distinction via `isTenant` flag
- ✅ All CRM fields in one place
- ✅ No confusion between tenant vs CRM
- ✅ Backward compatible (via `legacyOrganizationId`)

**Flow**: Registration → Tenant Org → Users create CRM Orgs → Manage customer data

