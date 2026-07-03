# Dashboard Entity — Field Level Requirements

## Overview

A **Dashboard** is a workspace composed of **Widgets** arranged in a responsive grid. Dashboards define **layout**, **global variables**, and **navigation context** — never report query logic.

**Related:** [`Analytics Fields.md`](./Analytics%20Fields.md) (Report) · [`Analytics Widget Fields.md`](./Analytics%20Widget%20Fields.md) (Widget)

---

# Basic Information

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| id | UUID | ✅ | System-generated unique identifier |
| organizationId | UUID | ✅ | Tenant scope (LiteDesk: ObjectId) |
| name | String | ✅ | Dashboard display name |
| apiName | String | ✅ | Unique internal API identifier per org |
| description | Text | | Dashboard description |
| category | Enum | ✅ | Personal, Team, Executive, App |
| appKey | String | | Required when category = App (SALES, HELPDESK, …) |
| folderId | UUID | | Folder in Asset Library |
| status | Enum | ✅ | Draft, Published, Archived |
| version | Integer | ✅ | Version number |
| tags | Array\<String\> | | Search tags |
| templateKey | String | | Starter template id |
| icon | String | | Optional icon |
| color | String | | Accent / header color |
| isDefault | Boolean | | Default dashboard for category/app |

---

# Layout (GridStack)

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| layout | JSON | ✅ | GridStack item array |
| layoutMode | Enum | | fixed, responsive |
| columnCount | Integer | | Grid columns (default 12) |
| rowHeight | Integer | | Grid row height px |
| margin | Integer | | Widget gutter px |
| backgroundColor | String | | Dashboard canvas background |

### layout item shape (conceptual)

```json
{
  "widgetId": "…",
  "instanceId": "…",
  "x": 0,
  "y": 0,
  "w": 6,
  "h": 4,
  "minW": 2,
  "minH": 2,
  "locked": false
}
```

- `widgetId` — reference to published Widget definition
- `instanceId` — unique per dashboard placement (supports same widget twice with different overrides)

---

# Widget Placements

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| placements | JSON | ✅ | Extended placement config per instance |
| titleOverrides | JSON | | Per-instance widget title |
| filterOverrides | JSON | | Per-instance filter overrides |
| hideWidgets | Array\<String\> | | Instance ids hidden in view mode |

---

# Dashboard Variables

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| variables | JSON | | Global filters applied to all widgets |
| defaultDateRange | JSON | | Default relative date (This Month, YTD, …) |
| allowViewerDateChange | Boolean | | Viewers can change date range |
| variablePromptOnLoad | Boolean | | Prompt for runtime variables on open |

### variables shape (conceptual)

```json
[
  {
    "key": "dateRange",
    "type": "dateRange",
    "label": "Period",
    "default": "this_month",
    "bindTo": "report.relativeDateFilters"
  },
  {
    "key": "owner",
    "type": "user",
    "label": "Owner",
    "default": "current_user",
    "bindTo": "report.dynamicFilters"
  }
]
```

---

# Drill-Down & Navigation

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| drillDownEnabled | Boolean | | Enable cross-widget drill-down |
| linkedDashboardId | UUID | | Optional linked detail dashboard |
| recordDetailEnabled | Boolean | | Open source record on click |
| breadcrumbConfig | JSON | | Navigation breadcrumb labels |

---

# Refresh & Performance

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| autoRefresh | Boolean | | Enable periodic refresh |
| refreshInterval | Integer | | Seconds between refresh |
| loadStrategy | Enum | | parallel, sequential |
| cacheSharedResults | Boolean | | Share report cache across widgets on same dashboard |

---

# Sharing & Permissions

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| ownerId | UUID | ✅ | Dashboard owner |
| visibility | Enum | ✅ | Private, Team, Role, Organization |
| sharedWith | JSON | | Users, teams, roles |
| permissions | JSON | | View, Edit, Clone, Share, Export |
| viewerRoleIds | Array | | Roles with view-only access |

---

# Dependencies & Usage

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| widgetCount | Integer | | Denormalized placement count |
| viewCount | Integer | | Total views |
| lastViewedAt | DateTime | | Last viewed |
| certified | Boolean | | Executive / certified dashboard |
| certifiedBy | UUID | | Certifying user |
| certifiedAt | DateTime | | Certification timestamp |

---

# Export & Presentation

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| exportEnabled | Boolean | | Allow PDF/PNG export of dashboard |
| exportFormats | Array | | pdf, png |
| printLayout | JSON | | Print-specific layout overrides |
| headerConfig | JSON | | Title, logo, subtitle in view/export |
| fullScreenEnabled | Boolean | | Allow fullscreen/TV mode |

---

# Audit Fields

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| createdBy | UUID | ✅ | Creator |
| createdAt | DateTime | ✅ | Created |
| updatedBy | UUID | | Last editor |
| updatedAt | DateTime | | Last updated |
| publishedAt | DateTime | | Published |
| archivedAt | DateTime | | Archived |

---

# Business Rules

- Dashboards **never** embed report definitions — only Widget references in `layout`.
- All widgets on a published dashboard must reference **Published** widgets (or pinned versions).
- Dashboard variables propagate to widget report execution via the Analytics Engine.
- Deleting a dashboard does **not** delete referenced widgets.
- Deleting a widget is blocked while any dashboard `layout` references it.
- **App** dashboards (`category: App`) require `appKey` and respect app entitlements.
- Only one `isDefault: true` per `(organizationId, category, appKey)` tuple.
- Lifecycle: **Draft → Published → Archived**.
- View mode is read-only; edit mode requires `analytics.dashboards.edit`.

---

# Dashboard Categories

| Category | Description | Typical audience |
|----------|-------------|------------------|
| Personal | User-owned workspace | Individual contributor |
| Team | Shared within a team/group | Team lead, group members |
| Executive | Org-wide summary | Leadership |
| App | Embedded in app home (SALES, HELPDESK) | App users |

---

# Entity Relationships

```text
Dashboard
├── layout[] → Widget (by widgetId)
├── variables → Report execution context (via engine)
└── Schedule / Alert (optional, A6/A7)

Report → Widget → Dashboard (indirect)
```

---

## Design Principles

- Dashboard = **layout + variables + permissions** only.
- Reuse widgets across dashboards; duplicate via new `instanceId` when overrides differ.
- GridStack is the layout engine (`client` — proven in `SummaryView.vue`).
- App dashboards integrate via Platform Home / app shell — not buried in SALES settings.
- Responsive breakpoints: desktop (12 col), tablet (6 col), mobile (single column stack).
