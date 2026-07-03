# Analytics Platform — API Contract (A0)

**Status:** A0 sketch — implementation in A1+  
**Base path:** `/api/analytics`  
**Auth:** JWT via `protect` · Tenant via `organizationIsolation`

---

## 1. Conventions

| Rule | Value |
|------|-------|
| Content-Type | `application/json` |
| IDs | MongoDB ObjectId strings |
| Pagination | `?page=1&limit=50` → `{ data, meta: { page, perPage, total, totalPages } }` |
| Errors | `{ success: false, message, code?, error? }` |
| Success | `{ success: true, data, meta? }` |
| Permission denied | `403` |
| Not found | `404` (no cross-tenant leakage) |

### Action → middleware mapping

| HTTP | Permission check |
|------|------------------|
| GET list/detail | `analytics_reports.read` |
| POST create | `analytics_reports.create` |
| PUT/PATCH update | `analytics_reports.update` |
| DELETE | `analytics_reports.delete` |
| POST publish | `analytics_reports.publish` |
| POST execute | `analytics_reports.execute` |
| POST export | `analytics_reports.export` |
| POST certify/uncertify | `analytics_admin.certify` |

*(Transitional: maps to legacy `reports` envelope — see permission matrix.)*

---

## 2. Reports

### `GET /api/analytics/reports`

List reports for current org.

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | enum | `draft`, `published`, `archived` |
| `type` | enum | Report type |
| `category` | enum | sales, support, … |
| `primaryModule` | string | Filter by module |
| `folderId` | ObjectId | Folder filter |
| `mine` | boolean | Owner = current user |
| `shared` | boolean | Shared with user |
| `search` | string | Name, apiName, tags |
| `page`, `limit` | number | Pagination |

**Response `data[]`:** `AnalyticsReport` summary (exclude heavy JSON blobs in list view).

---

### `POST /api/analytics/reports`

Create draft report.

**Body (required):**

```json
{
  "name": "Pipeline by Stage",
  "apiName": "pipeline_by_stage",
  "type": "summary",
  "primaryModule": "deals",
  "selectedFields": [],
  "visibility": "private"
}
```

**Response:** `201` + full report document.

---

### `GET /api/analytics/reports/:id`

Single report by id (org-scoped).

---

### `PUT /api/analytics/reports/:id`

Update draft fields. Published reports require new draft or version bump policy *(see architecture)*.

---

### `DELETE /api/analytics/reports/:id`

Soft-delete → `status: archived` if `widgetCount === 0`.  
`409` if referenced by widgets/schedules.

---

### `POST /api/analytics/reports/:id/publish`

Publish current draft. Increments `version`, sets `publishedAt`.

**Response:**

```json
{
  "success": true,
  "data": { "id": "…", "version": 2, "status": "published", "publishedAt": "…" }
}
```

---

### `POST /api/analytics/reports/:id/certify` · `POST …/uncertify` *(A7)*

Requires `analytics_admin.certify`. Only published reports can be certified. Certified reports restrict edit/delete/publish to owner or analytics admin.

---

### `POST /api/analytics/reports/:id/execute`

Run report against live data.

**Body (optional):**

```json
{
  "preview": false,
  "runtimeFilters": {},
  "page": 1,
  "pageSize": 50,
  "filterOverrides": {}
}
```

**Response (sync):**

```json
{
  "success": true,
  "data": {
    "columns": [
      { "key": "stage", "label": "Stage", "type": "string" },
      { "key": "amount_sum", "label": "Amount", "type": "number" }
    ],
    "rows": [
      { "stage": "Proposal", "amount_sum": 125000 }
    ],
    "meta": {
      "totalRows": 42,
      "truncated": false,
      "executionMs": 87,
      "reportId": "…",
      "reportVersion": 2
    }
  }
}
```

**Response (async):** `202` + `{ jobId, executionId, pollUrl }`.

---

### `POST /api/analytics/reports/:id/export`

Export last execution or run-and-export.

**Body:**

```json
{
  "format": "csv",
  "runtimeFilters": {}
}
```

**Response:** File stream or `{ downloadUrl }` for async.

---

### `POST /api/analytics/reports/preview`

Ad-hoc execute without saving (builder preview).

**Body:** Partial report definition + `rowLimit` (max 500).

---

## 3. Widgets *(A3)*

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/analytics/widgets` | `analytics_widgets.read` |
| POST | `/api/analytics/widgets` | `analytics_widgets.create` |
| GET | `/api/analytics/widgets/:id` | read |
| PUT | `/api/analytics/widgets/:id` | update |
| DELETE | `/api/analytics/widgets/:id` | delete |
| POST | `/api/analytics/widgets/:id/publish` | publish |
| POST | `/api/analytics/widgets/:id/execute` | read (delegates to bound report) |

---

## 4. Dashboards *(A4)*

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/analytics/dashboards` | `analytics_dashboards.read` |
| POST | `/api/analytics/dashboards` | create |
| GET | `/api/analytics/dashboards/:id` | read |
| PUT | `/api/analytics/dashboards/:id` | update |
| DELETE | `/api/analytics/dashboards/:id` | delete |
| POST | `/api/analytics/dashboards/:id/publish` | publish |
| POST | `/api/analytics/dashboards/:id/execute` | read — resolves all widgets |

**`POST …/execute` response:**

```json
{
  "success": true,
  "data": {
    "widgets": [
      { "instanceId": "…", "widgetId": "…", "result": { "columns": [], "rows": [] } }
    ],
    "meta": { "executionMs": 234 }
  }
}
```

---

## 5. Platform meta *(A5)*

### `GET /api/analytics/home`

Recent reports, dashboards, favorites, KPI strip.

### `GET /api/analytics/search?q=`

Global asset search across reports, widgets, dashboards.

### `GET /api/analytics/catalog`

Available modules, fields, relationships for builder.

**Response:**

```json
{
  "success": true,
  "data": {
    "modules": [
      {
        "moduleKey": "deals",
        "appKey": "SALES",
        "label": "Deals",
        "fields": [{ "key": "stage", "type": "picklist", "filterable": true }]
      }
    ],
    "relationships": []
  }
}
```

---

## 6. Executions *(A1)*

### `GET /api/analytics/executions`

Query execution history.

| Param | Description |
|-------|-------------|
| `reportId` | Filter by report |
| `status` | success, failed, running |
| `page`, `limit` | Pagination |

### `GET /api/analytics/executions/:id`

Poll async job result.

---

## 7. Schedules *(A6)*

| Method | Path |
|--------|------|
| GET | `/api/analytics/schedules` |
| POST | `/api/analytics/schedules` |
| GET | `/api/analytics/schedules/:id` |
| PUT | `/api/analytics/schedules/:id` |
| DELETE | `/api/analytics/schedules/:id` |
| POST | `/api/analytics/schedules/:id/run-now` |

---

## 8. Alerts *(A7)*

| Method | Path |
|--------|------|
| GET | `/api/analytics/alerts` |
| POST | `/api/analytics/alerts` |
| GET | `/api/analytics/alerts/:id` |
| PUT | `/api/analytics/alerts/:id` |
| DELETE | `/api/analytics/alerts/:id` |
| POST | `/api/analytics/alerts/:id/pause` |
| POST | `/api/analytics/alerts/:id/resume` |

Alerts evaluate on widget/dashboard execute. Threshold breach → in-app notification (+ optional email). 1h cooldown per alert.

---

## 9. External API v1 *(A8)*

Auth: `Authorization: Bearer ld_analytics_…` or header `X-Analytics-Api-Key`.

| Method | Path | Scope |
|--------|------|-------|
| GET | `/api/analytics/v1/reports` | `reports:read` |
| GET | `/api/analytics/v1/reports/:id` | `reports:read` |
| POST | `/api/analytics/v1/reports/:id/execute` | `reports:execute` |
| POST | `/api/analytics/v1/reports/:id/export` | `reports:export` |

Token management (JWT session): `GET/POST /api/analytics/api-tokens`, `POST /api/analytics/api-tokens/:id/revoke` — requires `analytics_admin.manageSettings`.

Process Designer action: `run_analytics_report` — executes published report as triggering user; optional CSV attached to deal/case record.

### Embed dashboards *(A8)*

Auth: query `?token=ld_embed_…` or `Authorization: Bearer ld_embed_…`.

| Method | Path |
|--------|------|
| GET | `/api/analytics/embed/dashboard` |
| POST | `/api/analytics/embed/dashboard/execute` |
| GET | `/api/analytics/dashboards/:id/embed-tokens` *(JWT)* |
| POST | `/api/analytics/dashboards/:id/embed-tokens` *(JWT)* |

Client embed route: `/analytics/embed/dashboard?token=…` (no auth shell).

Cross-app joins: qualified fields `people.email` on `cases` primary module; catalog lists `case_people`, `case_organizations`.

---

## 10. Legacy compatibility

| Legacy | Replacement | Sunset |
|--------|-------------|--------|
| `GET /api/reports` | `GET /api/analytics/reports` | A2 |
| `POST /api/reports/:id/run` | `POST /api/analytics/reports/:id/execute` | A2 |
| `POST /api/reports/:id/export` | `POST /api/analytics/reports/:id/export` | A2 |

Legacy routes return `Deprecation: true` header during transition.

---

## 11. Route mount table (`server.js`)

| Prefix | Router file | Phase |
|--------|-------------|-------|
| `/api/analytics/reports` | `routes/analyticsReportRoutes.js` | A1 |
| `/api/analytics/widgets` | `routes/analyticsWidgetRoutes.js` | A3 |
| `/api/analytics/dashboards` | `routes/analyticsDashboardRoutes.js` | A4 |
| `/api/analytics/schedules` | `routes/analyticsScheduleRoutes.js` | A6 |
| `/api/analytics/snapshots` | `routes/analyticsSnapshotRoutes.js` | A6 |
| `/api/analytics/alerts` | `routes/analyticsAlertRoutes.js` | A7 |
| `/api/analytics/api-tokens` | `routes/analyticsApiTokenRoutes.js` | A8 |
| `/api/analytics/v1` | `routes/analyticsV1Routes.js` | A8 |
| `/api/analytics/embed` | `routes/analyticsEmbedRoutes.js` | A8 |
| `/api/analytics` | `routes/analyticsMetaRoutes.js` | A5 |
| `/api/reports` | `routes/reportRoutes.js` *(deprecated)* | existing |

---

*API contract v1 — A0 — 2026-07-03*
