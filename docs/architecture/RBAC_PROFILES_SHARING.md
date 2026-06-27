# RBAC, Profiles, Sharing Rules & Users — Architecture Spec

> **Status:** Planned (not implemented)  
> **Scope:** Tenant-scoped identity, authorization, and record visibility  
> **Pattern:** Vtiger-aligned separation — Profiles (actions) · Roles (hierarchy + packaging) · Sharing Rules (visibility) · Users (identity + role assignment)

---

## 1. Goals

1. **Single admin surface for access:** Role carries user type, app entitlements, module permissions, field permissions, and record-assignment rules.
2. **User simplicity:** Invite/edit user = pick **one Role** (+ identity fields). No per-app permission pickers on user forms.
3. **Vtiger parity:** Profiles (reusable permission templates), role hierarchy (Reports To), sharing defaults + advanced custom rules.
4. **Multi-app native:** All constructs keyed by `(organizationId, appKey, moduleKey)` where applicable.
5. **Backward compatible:** Existing `User.permissions`, `User.appAccess`, `Role.permissions` remain runtime projections during migration.

---

## 2. Conceptual model

```
┌─────────────────────────────────────────────────────────────────┐
│                        ADMIN CONFIGURES                          │
├──────────────┬──────────────────┬───────────────────────────────┤
│   Profile    │      Role        │      Sharing Rules            │
│  (what you   │  (where you sit, │  (whose records you see)      │
│   CAN do)    │   app seats)     │                               │
│              │                  │                               │
│ Module CRUD  │ parentRole/level │ Default mode per module       │
│ Field R/W/H  │ userType         │ Advanced exceptions           │
│ Tool perms   │ appEntitlements  │ Role/Group source → target    │
│              │ profileId        │                               │
│              │ recordAssignment │                               │
└──────────────┴──────────────────┴───────────────────────────────┘
                              │
                              ▼
                    User.roleId (single assignment)
                              │
                              ▼
              materializeRuntimePermissionsOnUser()  +  sharingResolver
                              │
                              ▼
                   API enforcement + UI field capability
```

### Separation of concerns

| Layer | Controls | Does NOT control |
|-------|----------|------------------|
| **Profile** | Module actions (view/create/edit/delete/export…), field invisible/read/write, tool privileges | Hierarchy, app seats, record visibility |
| **Role** | Hierarchy, userType, app entitlements, profile link, record assignment targets | Direct list filtering (delegated to sharing) |
| **Sharing default** | Org-wide visibility mode per module | CRUD grants |
| **Sharing custom rule** | Exception: records owned by source → visible to target | Module-level CRUD |
| **User** | Identity, status, `roleId`, `isOwner` break-glass | Inline permissions (derived only) |

---

## 3. Data models

### 3.1 Profile (`profiles`)

Reusable permission template. Multiple roles may reference one profile.

```javascript
{
  organizationId: ObjectId,          // required, tenant FK
  name: String,                    // unique per org
  description: String,
  isSystemProfile: Boolean,        // seeded templates; name locked

  appPermissions: Map,             // { appKey: { moduleKey: { action: boolean, scope? } } }
  fieldPermissions: Map,           // { `${appKey}.${moduleKey}.${fieldKey}`: 'hidden'|'read'|'write' }

  copiedFromProfileId: ObjectId,   // lineage for audit
  version: Number,                 // bump on breaking permission shape changes

  createdBy, updatedBy, timestamps
}
```

**System profiles (seeded):** see §8.

### 3.2 Role (`roles`) — extensions

Existing fields retained. New fields:

```javascript
{
  // --- existing ---
  organizationId, name, description, isSystemRole,
  parentRole, level, color, icon, userCount,
  appPermissions, permissions,                    // legacy; prefer profile
  canViewAllData, canManageTeam, canExportData,

  // --- new ---
  userType: 'INTERNAL' | 'EXTERNAL' | 'SYSTEM',    // default INTERNAL

  privilegeMode: 'inline' | 'profile',             // Vtiger toggle
  profileId: ObjectId | null,                      // when privilegeMode=profile

  appEntitlements: [{
    appKey: String,                                // SALES, HELPDESK, …
    enabled: Boolean,
    seatConsuming: Boolean,                        // billing / seat enforcement
    appRoleKey: String                             // ADMIN, AGENT, AUDITOR… per appRegistry
  }],

  recordAssignment: {
    users: 'all'
         | 'same_role_or_hierarchy'
         | 'subordinates_only',
    groups: 'all'
         | 'member_groups'
         | 'selected'
         | 'none',
    selectedGroupIds: [ObjectId]
  },

  fieldPermissions: Map                            // used when privilegeMode=inline
}
```

**Effective permissions resolution:**

1. If `privilegeMode === 'profile'` and `profileId` → load Profile permissions.
2. Merge Role `appPermissions` overrides (optional per-app delta flag in v2).
3. Project to `User.permissions` envelope via `rolePermissionProjection`.
4. Apply `canViewAllData` / privileged system role bypass.

### 3.3 Module sharing default (`moduleSharingDefaults`)

```javascript
{
  organizationId: ObjectId,
  appKey: String,
  moduleKey: String,               // people, deals, cases, …
  mode: 'public_read'
      | 'public_read_write'
      | 'public_read_write_delete'
      | 'private'
      | 'record_level',
  updatedBy, timestamps
}
// unique index: (organizationId, appKey, moduleKey)
```

### 3.4 Module sharing rule (`moduleSharingRules`)

Advanced exceptions (Vtiger “Add Custom Rule”).

```javascript
{
  organizationId: ObjectId,
  appKey: String,
  moduleKey: String,
  priority: Number,                // lower = first
  enabled: Boolean,
  name: String,

  source: {
    type: 'role' | 'role_subtree' | 'group' | 'user',
    roleId?, groupId?, userId?
  },
  target: {
    type: 'role' | 'role_subtree' | 'group' | 'user' | 'all_internal',
    roleId?, groupId?, userId?
  },
  privilege: 'read' | 'read_write'   // sharing grant only; delete still from Profile

  createdBy, updatedBy, timestamps
}
```

### 3.5 User (`users`) — simplified contract

**Admin-editable:**

```javascript
{
  organizationId, email, firstName, lastName, phoneNumber, avatar,
  roleId: ObjectId,               // REQUIRED for invited internal users
  userType: derived from Role,     // read-only in UI unless break-glass override flag
  status, invite fields, onboarding,
  isOwner,                         // founder break-glass; not assignable via normal roles
  businessHourSetId
}
```

**Derived at login / role change (never admin-edited directly):**

```javascript
{
  permissions,                     // legacy envelope projection
  appAccess[], allowedApps[],       // from Role.appEntitlements
  role,                            // legacy shim mapped from Role.name
  _permissionRuntime, _orgPermissionContext
}
```

**Deprecation timeline:**

| Field | Phase out |
|-------|-----------|
| `User.appAccess` as input | P1 — derive from Role |
| `User.allowedApps` as input | P1 — derive from Role |
| `User.permissions` as source of truth | Already deprecated; projection only |
| `User.role` enum | P2 — shim until callers removed |
| `Role.permissions.scope team\|own` | P4 — replaced by sharing rules |

---

## 4. Sharing semantics

### 4.1 Default modes

| Mode | List visibility | Edit/delete of others' records |
|------|-----------------|--------------------------------|
| `public_read` | All org records | Blocked unless Profile grants + not owner |
| `public_read_write` | All org records | Edit if Profile grants edit |
| `public_read_write_delete` | All org records | Delete if Profile grants delete |
| `private` | Own + subordinate role owners | Per Profile CRUD on visible set |
| `record_level` | Owner (+ co-owners v2) only | Per Profile on owned records |

**Private + hierarchy (Vtiger info box):** User U with role R sees record X if `owner(X).role` is **same as or descendant of** R in the role tree (`parentRole` chain, `level` increasing downward).

### 4.2 Custom rules

Union additional visibility:

> Records matching **source** are also visible to **target** users with rule **privilege**.

Custom rules **add** to default mode; they do not remove base visibility.

### 4.3 Record owner field map

| Module | Owner field | Notes |
|--------|-------------|-------|
| `deals` | `ownerId` | Already used in `dealController` |
| `people` | `assignedTo` | Primary sales ownership |
| `cases` | `assigneeId` | Helpdesk |
| `tasks` | `assignedTo` | |
| `events` | `assignedTo` or `createdBy` | TBD per event type |
| `quotes` | `ownerId` or `createdBy` | Default `record_level` |
| Generic registry modules | `assignedTo` → `createdBy` fallback | |

### 4.4 Bypass

No sharing filter when:

- `user.isOwner === true`
- `isTenantPrivilegedUser(user)` (owner/admin legacy)
- `role.canViewAllData === true`
- Platform admin operations (control plane)

### 4.5 Resolver API

```javascript
// server/services/sharingResolver.js

async function buildSharingContext(user, { appKey, moduleKey, organization })
async function buildRecordVisibilityFilter(user, { appKey, moduleKey })  // Mongo $or clauses
async function canViewRecord(user, record, { appKey, moduleKey })
async function canEditRecordViaSharing(user, record, { appKey, moduleKey })  // read_write grant
```

Replace binary `filterByOwnership` middleware with `applySharingFilter(module)` setting `req.sharingFilter`.

---

## 5. Field permissions

### 5.1 Tri-state per field

| State | UI | API write |
|-------|-----|-----------|
| `hidden` | Field not rendered | Rejected |
| `read` | Visible, disabled | Rejected |
| `write` | Editable | Allowed if module edit + field governance allows |

Stored on Profile or Role (`fieldPermissions` map).

### 5.2 Precedence (highest wins for restrictiveness)

1. Platform field governance (`docs/field-governance.md`) — system fields, owner types
2. Profile/Role field permission
3. Module-level edit permission
4. Field owner rules (`fieldAccessControl.js`)

**Rule:** Role field permission can only **tighten** UX, never bypass platform invariants.

### 5.3 UI

Role/Profile editor: expandable module row → field matrix (Vtiger Field and Tool Privileges). Field list from `GET /roles/modules` field catalog extension or config-registry projection.

---

## 6. Record assignment rules

On Role (`recordAssignment`). Enforced on assign/reassign APIs:

| `users` value | Can assign to |
|---------------|---------------|
| `all` | Any active user in org |
| `same_role_or_hierarchy` | Same role or subordinate roles |
| `subordinates_only` | Strictly subordinate roles only |

| `groups` value | Can assign to group |
|----------------|---------------------|
| `all` | Any group |
| `member_groups` | Groups user belongs to |
| `selected` | `selectedGroupIds` only |
| `none` | Group assignment disabled |

---

## 7. API surface

### Profiles

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/profiles` | `settings.manageRoles` |
| GET | `/api/profiles/:id` | `settings.manageRoles` |
| POST | `/api/profiles` | `settings.manageRoles` |
| PUT | `/api/profiles/:id` | `settings.manageRoles` |
| DELETE | `/api/profiles/:id` | `settings.manageRoles` |
| POST | `/api/profiles/:id/clone` | `settings.manageRoles` |

### Roles (extend existing `/api/roles`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/roles/hierarchy` | Tree (exists via static) |
| PATCH | `/api/roles/:id/move` | Reparent + recalc levels |
| POST | `/api/roles/seed` | App-aware default seed (replaces flat initialize) |
| POST | `/api/roles/sync-from-org` | Add entitlements when org enables new app |

### Sharing

| Method | Path |
|--------|------|
| GET | `/api/sharing/defaults?appKey=SALES` |
| PUT | `/api/sharing/defaults/:appKey/:moduleKey` |
| GET | `/api/sharing/rules?appKey=&moduleKey=` |
| POST | `/api/sharing/rules` |
| PUT | `/api/sharing/rules/:id` |
| DELETE | `/api/sharing/rules/:id` |

### Users (simplify)

| Change | Detail |
|--------|--------|
| POST `/api/users/invite` | Body: `{ email, firstName, lastName, roleId }` only |
| PUT `/api/users/:id` | `roleId` change triggers re-materialization |
| Remove | Client appAccess picker (derived) |

---

## 8. Default roles & profiles (app-aware)

### 8.0 Architectural decision (world-class model)

**Locked decision.** Hierarchy is org structure; Profiles are capabilities; Sharing is visibility. Never conflate the three.

#### System roles — exactly two (non-deletable)

| Role | Purpose |
|------|---------|
| **Owner** | Founder break-glass (`User.isOwner`). Full bypass. Not assignable except at org creation. |
| **Administrator** | Tenant admin. `platform_full` profile. Child of Owner. Manages users, roles, profiles, sharing. |

No seeded generic Manager / User / Viewer **roles**. Those are legacy names, not product defaults.

#### SALES-first starter template (default for new orgs)

New tenants register with **SALES enabled** (`authController` sets `enabledApps: [{ appKey: 'SALES' }]`). Seed a **shallow, sales-native** hierarchy under Administrator (renameable after seed):

```
Owner (system)
 └── Administrator (system)
      └── Sales Manager      ← team lead
           └── Sales Executive   ← AE / SDR / IC rep
```

- Template flag: `isTemplateSeed: true` — UI prompts: *"Customize your role hierarchy"*
- **Only two template roles** below Administrator for SMB simplicity. Larger orgs add Director / VP manually (Vtiger model).
- **Read-only access is a Profile**, not a hierarchy level. Assign `read_only` profile to any role (e.g. finance viewer on Sales Executive).
- **Do not seed a "Viewer" role** or duplicate generic "Manager"/"User" alongside Sales Manager/Executive.

#### App enablement — profiles first, roles second

When `organization.enabledApps` gains an app:

1. **Seed app Profiles** if missing (e.g. `helpdesk_agent`, `audit_auditor`).
2. **Merge profile onto existing roles** via `Role.profileIds[]` or primary + extensions — e.g. merge `helpdesk_agent` onto Sales Executive without adding hierarchy levels.
3. **Optional function roles** — sibling branches under Administrator, not children of Sales Executive:

```
Administrator
 ├── Sales Manager → Sales Executive   (default template)
 └── Support Agent                     (optional HELPDESK branch)
```

| App | Profiles seeded | Optional branch roles |
|-----|-----------------|----------------------|
| SALES | `sales_full`, `sales_standard`, `sales_manager`, `read_only` | **Sales Manager + Sales Executive** (default template roles) |
| HELPDESK | `helpdesk_admin`, `helpdesk_agent` | Support Agent (under Helpdesk branch) |
| AUDIT | `audit_manager`, `audit_auditor` | Auditor (INTERNAL or EXTERNAL subtree) |
| PORTAL | `portal_customer`, `portal_viewer` | **Separate external tree** — not under Administrator |
| PROJECTS | `projects_member`, `projects_manager` | Project Manager (optional branch) |
| INVENTORY | `inventory_operator`, `inventory_manager` | — |
| LMS | TBD | TBD |

#### Two isolation roots (sharing safety)

| Tree | Root | userType | Private sharing |
|------|------|----------|-----------------|
| **Internal** | Administrator | INTERNAL | Applies across internal roles |
| **External** | Portal Customer (example) | EXTERNAL | Isolated — never sees internal Private cascade |

#### User assignment rule

**One role per internal user.** Invite = pick role. Role carries: `userType`, `appEntitlements[]`, `profileId`(s), `parentRole`.

**External users (exception):** `userType: EXTERNAL` users may hold **multiple external roles** via `User.externalRoleAssignments[]`. Session uses JWT claim `activeExternalRoleId`; permissions hydrated in memory on each request — **external users do not persist `roleId`**. See [`EXTERNAL_USER_PORTAL_FRAMEWORK.md`](./EXTERNAL_USER_PORTAL_FRAMEWORK.md) §4.

#### Legacy compatibility

Existing seeded Owner / Admin / Manager / User / Viewer **migrate** to:

| Legacy | Maps to |
|--------|---------|
| Owner | Owner (unchanged) |
| Admin | Administrator (rename) |
| Manager | **Sales Manager** (rename + `sales_manager` profile) |
| User | **Sales Executive** (rename + `sales_standard` profile) |
| Viewer | **Dissolved** → Sales Executive + `read_only` profile |

---

### 8.1 Design principles

1. **Minimal system roles** — Owner + Administrator only; everything else is tenant-owned.
2. **SALES-first template, not doctrine** — seed Sales Manager → Sales Executive for new orgs; customer renames or extends (Director, VP, etc.) per Vtiger model.
3. **Profiles hold all capability matrices** — including read-only; no "Viewer" role tier.
4. **App enablement adds profiles + optional branches** — not a deeper sales ladder per app.
5. **External apps use a separate hierarchy root** — PORTAL never hangs under Sales Executive.

### 8.2 System profiles (seed on org creation)

| Profile key | Name | Purpose |
|-------------|------|---------|
| `platform_full` | Platform Full Access | All modules all apps — Owner/Admin |
| `sales_full` | Sales Full | SALES modules CRUD all scope |
| `sales_manager` | Sales Manager | SALES CRUD minus delete on key entities; reports export |
| `sales_standard` | Sales Standard | SALES own-level CRUD (Sales Executive default) |
| `read_only` | Read Only | Cross-module read; no create/edit/delete (assign to any role) |
| `helpdesk_admin` | Helpdesk Admin | Cases + related full |
| `helpdesk_agent` | Helpdesk Agent | Cases read/write; limited settings |
| `audit_auditor` | Audit Auditor | Audit execution modules |
| `audit_manager` | Audit Manager | Audit + scheduling + reports |
| `portal_customer` | Portal Customer | Portal self-service |
| `portal_viewer` | Portal Viewer | Portal read only |
| `projects_member` | Projects Member | Projects/tasks (when app live) |
| `inventory_operator` | Inventory Operator | Inventory read/write |

Profiles are **created once per org**. Roles reference them; enabling a new app **adds profiles if missing**, not duplicate roles.

### 8.3 Default role hierarchy (seed template)

Synthetic UI root = **Organization name** (not a Role document).

**System (always):**

| Role | Level | parentRole | isSystemRole | Profile | App entitlements |
|------|-------|------------|--------------|---------|------------------|
| Owner | 0 | null | true | `platform_full` | All enabled · ADMIN · owner non-seat |
| Administrator | 1 | Owner | true | `platform_full` | All enabled · ADMIN |

**SALES template (renameable, `isTemplateSeed: true`) — seeded when SALES is enabled (default for new orgs):**

| Role | Level | parentRole | Default profile | Default app entitlements |
|------|-------|------------|-----------------|--------------------------|
| Sales Manager | 2 | Administrator | `sales_manager` | SALES · MANAGER (+ merged manager profiles when other apps enable) |
| Sales Executive | 3 | Sales Manager | `sales_standard` | SALES · USER (+ merged `helpdesk_agent` etc. when other apps enable) |

**Typical assignment:** founder on Owner/Administrator; first hire → Sales Executive; team lead → Sales Manager.

**Profile merge:** `roleSeedService.mergeAppProfiles(role, enabledApps)` adds app profile modules onto the role's effective permissions when apps activate — without new hierarchy levels.

### 8.4 App-enabled branches (optional, on app activation)

| App | Branch root (parent) | Child roles | userType |
|-----|----------------------|-------------|----------|
| HELPDESK | Helpdesk (→ Administrator) | Support Agent | INTERNAL |
| AUDIT | Audit (→ Sales Manager or Administrator) | Auditor | INTERNAL / EXTERNAL |
| PORTAL | Portal Customer (null — **external root**) | Portal User | EXTERNAL |
| PROJECTS | Projects (→ Sales Manager or Administrator) | Project Lead | INTERNAL |
| INVENTORY | Inventory (→ Sales Manager or Administrator) | Stock Operator | INTERNAL |

Branches exist for **org clarity and sharing**. Prefer **profile merge** onto Sales Executive / Sales Manager first; add branches only when the team is large enough to need separate reporting lines.

**HELPDESK default (simple):** merge `helpdesk_agent` onto Sales Executive; merge `helpdesk_admin` onto Sales Manager — no new roles required.

### 8.5 Default sharing modes (seed per enabled module)

| Module category | Default mode | Rationale |
|-----------------|--------------|-----------|
| CRM core (people, deals, organizations) | `private` | Vtiger default; hierarchy matters |
| Tasks, events | `private` | |
| Cases | `private` | |
| Items, catalog | `public_read` | Shared catalog |
| Reports | `public_read` | |
| Quotes, approvals | `record_level` | Sensitive |
| Forms (submitted) | `record_level` | |
| Portal-facing modules | `record_level` | Customer isolation |
| Settings, users | `record_level` | Admin only |

Advanced rules: **none** at seed time.

### 8.6 Mapping from current defaults

Today `Role.createDefaultRoles()` seeds Owner/Admin/Manager/User/Viewer with legacy `permissions` only (SALES-centric, no `appPermissions`, no HELPDESK/AUDIT/PORTAL).

**Migration:**

1. Create system profiles from existing `buildFullPrivilegedRolePermissions()` matrices.
2. Backfill `profileId` + `appEntitlements` on existing roles.
3. Derive `User.appAccess` from user's `roleId` once — stop writing user-level copies.
4. `POST /api/roles/initialize` → `POST /api/roles/seed` with `{ apps: org.enabledApps }`.

---

## 9. UI specification

### 9.1 Settings → User Management

| Page | Content |
|------|---------|
| **Users** | List; invite with Role picker only; show derived apps as read-only chips |
| **Roles** | Hierarchy tree default view; + create; drag reparent; click → drawer |
| **Profiles** | List; create/edit; module + field matrix; clone |
| **Sharing Rules** | App tabs; default mode grid; expandable advanced rules + modal |
| **Groups** | Existing; used by sharing rules + assignment |

### 9.2 Role drawer tabs

1. **Overview** — name, reports-to, userType, privilege mode, copy from profile/role
2. **Apps & seats** — entitlements toggles per enabled app
3. **Module privileges** — matrix (from profile or inline)
4. **Field privileges** — expandable per module
5. **Assignment** — record assignment radios
6. **Capabilities** — canViewAllData, canExportData, canManageTeam

### 9.3 Invite user drawer (simplified)

```
First name, Last name, Email
Role *  (dropdown — shows hierarchy breadcrumb)
[Read-only preview: Apps, User type, Profile name]
Send invite
```

---

## 10. Runtime request flow

```
HTTP Request
  → protect (JWT → req.user)
  → resolveAppContext (req.appKey)
  → requireAppEntitlement (derived from Role.appEntitlements ∩ org.enabledApps)
  → organizationIsolation
  → checkPermission (Profile/Role → resolveRuntimePermission)
  → applySharingFilter (sharingResolver → req.sharingFilter)
  → controller query merges req.sharingFilter
  → field write validation (fieldPermissions + fieldAccessControl)
```

---

## 11. Implementation phases

> **Detailed engineering plan:** [`RBAC_IMPLEMENTATION_PLAN.md`](./RBAC_IMPLEMENTATION_PLAN.md) — PR sequence, file touchpoints, tests, rollout.  
> **Regression gates:** same doc §7.1 — run Gate A on every PR; Gate B/C before pilot.

| Phase | Deliverable | Exit criteria |
|-------|-------------|---------------|
| **P0** | This spec + feature flags `RBAC_V2`, `SHARING_V1` | Approved |
| **P1** | Profile model + seed service; Role `profileId`, `userType`, `appEntitlements`; derive User appAccess; simplify invite | New users: role-only picker |
| **P2** | Profiles settings UI; Role privilege mode; copy-from | Admin edits profile → all linked roles update |
| **P3** | Field permissions on Profile; client + API enforcement | Hidden fields absent; read-only blocked on PATCH |
| **P4** | Sharing defaults model + UI + resolver on deals/people/cases | Private mode uses hierarchy |
| **P5** | Custom sharing rules + modal UI | Vtiger-style exceptions work |
| **P6** | Hierarchy drag/drop; record assignment enforcement; co-owners | Full Vtiger parity |
| **P7** | Remove legacy fields; migration script for all tenants | No user-level appAccess writes |

---

## 12. Migration & compatibility

### 12.1 Feature flags

- `RBAC_V2=false` — current behavior
- `RBAC_V2=true` — role-as-package, profile resolution
- `SHARING_V1=false` — current `filterByOwnership`
- `SHARING_V1=true` — sharing resolver

### 12.2 Owner / founder

- `User.isOwner` remains break-glass; not replaced by Role.
- First org user gets Owner role + `isOwner: true`.
- Owner bypasses sharing and permission checks (existing behavior).

### 12.3 Audit

Log to activity/audit: role change, profile change, sharing rule change, user role assignment.

---

## 13. Open decisions

| # | Decision | Recommendation |
|---|----------|----------------|
| 1 | One profile vs merged multi-app profile on Role | **One primary profile + app extension profiles merged at materialize** |
| 2 | Multiple roles per user | **No** — stay single `roleId` (Vtiger model) |
| 3 | LMS in appRegistry | Add when LMS ships; until then skip seed |
| 4 | VIEWER appRoleKey for read-only | Profile drives read-only; keep `appRoleKey: USER` for seat billing |
| 5 | Custom role permission overrides on top of profile | **Phase 2+** optional delta map; not v1 |

---

## 14. Related documents

- `Architecture_Document.md` — §3 User/Role, §5 Permissions
- `docs/field-governance.md` — field owner invariants
- `server/constants/appRegistry.js` — app role keys
- `server/services/runtimePermissionResolver.js` — permission materialization
- `server/services/rolePermissionCatalogService.js` — module matrix catalog

---

## Appendix A — appRegistry reference

| App | Valid appRoleKeys | userTypesAllowed | defaultRole |
|-----|-------------------|------------------|-------------|
| SALES | ADMIN, MANAGER, USER | INTERNAL | USER |
| HELPDESK | ADMIN, MANAGER, USER, AGENT | INTERNAL | AGENT |
| PROJECTS | ADMIN, MANAGER, USER | INTERNAL | USER |
| AUDIT | AUDITOR | INTERNAL, EXTERNAL | AUDITOR |
| PORTAL | CUSTOMER, VIEWER | EXTERNAL | CUSTOMER |
| INVENTORY | ADMIN, MANAGER, USER | INTERNAL | USER |
| LMS | TBD | TBD | TBD |

Role `appEntitlements[].appRoleKey` must validate against this registry.

---

## Appendix B — Example: Sales rep user

```
User: jane@company.com
  roleId → "Sales Executive" (level 3, parent Sales Manager)

Role "Sales Executive":
  userType: INTERNAL
  profileId → sales_standard (+ helpdesk_agent merged if HELPDESK enabled)
  appEntitlements: [
    { appKey: SALES, enabled: true, seatConsuming: true, appRoleKey: USER },
    { appKey: HELPDESK, enabled: true, seatConsuming: true, appRoleKey: AGENT }
  ]

Sharing defaults:
  deals → private
  cases → private

Effective access:
  - Can create/edit deals (profile)
  - Sees own deals; Sales Manager (ancestor role) sees Jane's deals via Private mode
  - Read-only finance user = Sales Executive + read_only profile, not a separate "Viewer" role
```

