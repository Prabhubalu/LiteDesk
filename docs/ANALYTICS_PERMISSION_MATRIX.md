# Analytics Platform — Permission Matrix (A0)

**Status:** A0 — Authoritative for A1 implementation  
**Enforcement:** `server/middleware/permissionMiddleware.js` + `runtimePermissionResolver.js`  
**Constants:** `server/permissions/analyticsPermissions.js`

---

## 1. Module keys

| Module key | Catalog scope | Description |
|------------|---------------|-------------|
| `analytics_reports` | platform | Report CRUD, execute, export, publish, schedule |
| `analytics_widgets` | platform | Widget CRUD, publish |
| `analytics_dashboards` | platform | Dashboard CRUD, publish, view |
| `analytics_admin` | platform | Certify assets, org analytics settings, execution metrics |

**Transitional alias:** Legacy `reports` module in `rolePermissionCatalogService.js` maps to `analytics_reports` for CRUD until catalog migration (A1).

---

## 2. Actions per module

### `analytics_reports`

| Action | API operations | Legacy `reports` equivalent |
|--------|----------------|----------------------------|
| `read` | GET list, GET by id, GET executions | `read` |
| `create` | POST report | `create` |
| `update` | PUT report (draft) | `update` |
| `delete` | DELETE / archive | `delete` |
| `publish` | POST publish | *(none — new)* |
| `execute` | POST execute, POST preview | `read` |
| `export` | POST export | `export` |
| `schedule` | Schedule CRUD on owned reports | *(none — new)* |
| `share` | Update visibility / sharedWith | *(implicit via update)* |

### `analytics_widgets`

| Action | API operations |
|--------|----------------|
| `read` | GET list, GET by id, render |
| `create` | POST widget |
| `update` | PUT widget |
| `delete` | DELETE widget |
| `publish` | POST publish |
| `share` | Update visibility |

### `analytics_dashboards`

| Action | API operations |
|--------|----------------|
| `read` | GET list, GET by id, view mode, POST execute |
| `create` | POST dashboard |
| `update` | PUT dashboard, designer save |
| `delete` | DELETE dashboard |
| `publish` | POST publish |
| `share` | Update visibility |
| `export` | Dashboard PDF/PNG export *(A6)* |

### `analytics_admin`

| Action | API operations |
|--------|----------------|
| `certify` | Set certified flag on reports/widgets/dashboards |
| `manageSettings` | Org analytics defaults (cache TTL, export limits) |
| `viewMetrics` | All-tenant execution metrics (admin only) |

---

## 3. Persona defaults

Aligned with existing LiteDesk role patterns (`canViewAllData`, platform-admin modules).

### Tenant Admin / Owner

| Module | read | create | update | delete | publish | execute | export | schedule | share | certify |
|--------|:----:|:------:|:------:|:------:|:-------:|:-------:|:------:|:--------:|:-----:|:-------:|
| analytics_reports | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| analytics_widgets | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | ✅ |
| analytics_dashboards | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅* | — | ✅ | ✅ |
| analytics_admin | ✅ | — | — | — | — | — | — | — | — | ✅ |

*export = dashboard PDF/PNG (A6)

### Sales / Helpdesk Manager

| Module | read | create | update | delete | publish | execute | export | schedule | share |
|--------|:----:|:------:|:------:|:------:|:-------:|:-------:|:------:|:--------:|:-----:|
| analytics_reports | ✅ | ✅ | ✅ | own | ✅ | ✅ | ✅ | ✅ | team |
| analytics_widgets | ✅ | ✅ | ✅ | own | ✅ | — | — | — | team |
| analytics_dashboards | ✅ | ✅ | ✅ | own | ✅ | ✅ | ✅ | — | team |

### Sales Rep / Helpdesk Agent

| Module | read | create | update | delete | publish | execute | export | schedule | share |
|--------|:----:|:------:|:------:|:------:|:-------:|:-------:|:------:|:--------:|:-----:|
| analytics_reports | ✅ shared | ✅ | own draft | own | — | ✅ | ✅ shared | — | — |
| analytics_widgets | ✅ shared | — | — | — | — | — | — | — | — |
| analytics_dashboards | ✅ shared | — | — | — | — | ✅ | — | — | — |

### Read-only / Viewer role

| Module | read | execute | export |
|--------|:----:|:-------:|:------:|
| analytics_reports | ✅ shared | ✅ | ✅ if shared permits |
| analytics_widgets | ✅ | — | — |
| analytics_dashboards | ✅ | ✅ | — |

---

## 4. Asset-level ACL

In addition to module permissions, each asset has:

| Field | Effect |
|-------|--------|
| `ownerId` | Full control (within module permissions) |
| `visibility` | `private` \| `team` \| `role` \| `organization` |
| `sharedWith` | Explicit grants `{ type, id, permissions }` |
| `permissions` | Per-asset overrides (view, edit, clone, export, share) |

**Evaluation order:**

1. Tenant privileged user → allow (existing `isTenantPrivilegedUser`)
2. Owner → allow edit/delete
3. Module RBAC deny → **403**
4. Asset `visibility` + `sharedWith`
5. Data-level module permission on `primaryModule` at execute time

---

## 5. Data-level permissions (execute time)

Report execution **always** re-checks:

```javascript
// Pseudocode — A1 analyticsEngine
const canReadModule = resolveRuntimePermission(user, appKey, primaryModule, 'read');
if (!canReadModule) throw ForbiddenError;

if (!viewAllForModule(primaryModule, role)) {
  pipeline.push({ $match: { assignedTo: user._id } }); // or ownership field per module
}
```

Module ownership field resolved from module registry (e.g. `deals.assignedTo`, `cases.assigneeId`).

---

## 6. Feature entitlement

| Flag | Location | Effect |
|------|----------|--------|
| `analytics` | `Organization.subscription.features[]` or plan tier | Gates all `/api/analytics/*` |
| Legacy `reports` | `checkFeatureAccess('reports')` on old routes | Deprecated; same entitlement initially |

---

## 7. Catalog migration plan (A1)

Add to `rolePermissionCatalogService.js` PLATFORM entries:

```javascript
{ key: 'analytics_reports', moduleKey: 'analytics_reports', kind: 'reports', scope: 'platform', order: 200 },
{ key: 'analytics_widgets', moduleKey: 'analytics_widgets', kind: 'crud', scope: 'platform', order: 201 },
{ key: 'analytics_dashboards', moduleKey: 'analytics_dashboards', kind: 'crud', scope: 'platform', order: 202 },
```

Seed default roles: Admin=all, Manager=reports+widgets+dashboards CRUD, Rep=read+execute+own create, Viewer=read.

**Backward compat:** `resolveAnalyticsPermission(module, action)` in `analyticsPermissions.js` falls back to legacy `reports` envelope when new keys absent on role.

---

## 8. Middleware usage (A1)

```javascript
const { checkAnalyticsPermission } = require('../middleware/analyticsPermissionMiddleware');

router.get('/', checkAnalyticsPermission('analytics_reports', 'read'), listReports);
router.post('/:id/publish', checkAnalyticsPermission('analytics_reports', 'publish'), publishReport);
router.post('/:id/execute', checkAnalyticsPermission('analytics_reports', 'execute'), executeReport);
```

---

*Permission matrix v1 — A0 — 2026-07-03*
