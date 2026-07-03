# Widget Entity — Field Level Requirements

## Overview

A **Widget** is a reusable visual component that renders data from a **Report**. Widgets define **how** data is displayed (chart type, formatting, thresholds, interactions). They never store query results — execution always flows through the Report → Analytics Engine.

**Related:** [`Analytics Fields.md`](./Analytics%20Fields.md) (Report) · [`Analytics Dashboard Fields.md`](./Analytics%20Dashboard%20Fields.md) (Dashboard)

---

# Basic Information

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| id | UUID | ✅ | System-generated unique identifier |
| organizationId | UUID | ✅ | Tenant scope (LiteDesk: ObjectId) |
| name | String | ✅ | Widget display name |
| apiName | String | ✅ | Unique internal API identifier per org |
| description | Text | | Widget description |
| type | Enum | ✅ | See § Supported Widget Types |
| category | Enum | | Sales, Support, Inventory, Finance, Custom |
| folderId | UUID | | Folder in Asset Library |
| status | Enum | ✅ | Draft, Published, Archived |
| version | Integer | ✅ | Version number |
| tags | Array\<String\> | | Search tags |
| templateKey | String | | System template identifier (e.g. `pipeline-by-stage`) |
| icon | String | | Optional icon |
| color | String | | Accent color |

---

# Report Binding

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| reportId | UUID | ✅ | Source report reference |
| reportVersion | Integer | | Pin to version; null = latest published |
| reportApiName | String | | Denormalized for search/display |
| columnMapping | JSON | ✅ | Maps report columns → visualization roles |
| filterOverrides | JSON | | Optional widget-level filter overrides (subset of report filters) |
| sortOverrides | JSON | | Optional sort override |

### columnMapping shape (conceptual)

```json
{
  "dimension": "stage",
  "series": [{ "field": "amount", "aggregation": "sum", "label": "Pipeline Value" }],
  "metric": "count",
  "breakdown": "assignedTo"
}
```

---

# Visualization (ECharts)

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| chartType | Enum | ✅ | table, kpi, bar, line, area, pie, donut, funnel, gauge, heatmap, scatter, combo |
| orientation | Enum | | horizontal, vertical (bar) |
| stacked | Boolean | | Stack series |
| smooth | Boolean | | Smooth line curves |
| showLegend | Boolean | | Display legend |
| legendPosition | Enum | | top, bottom, left, right |
| showDataLabels | Boolean | | Values on chart |
| colorPalette | Array\<String\> | | Override theme colors |
| echartsOptions | JSON | | Server-sanitized ECharts option overrides |
| emptyStateMessage | String | | Custom empty copy |

---

# KPI Configuration

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| kpiValueField | String | | Metric field for single KPI |
| kpiLabel | String | | Display label |
| kpiPrefix | String | | e.g. `$` |
| kpiSuffix | String | | e.g. `%` |
| kpiComparisonField | String | | Prior period comparison metric |
| kpiComparisonLabel | String | | e.g. vs last month |
| showTrendArrow | Boolean | | Up/down indicator |

---

# Formatting

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| numberFormat | JSON | | Decimal places, locale, notation |
| dateFormat | String | | Display date pattern |
| currencyCode | String | | ISO currency for monetary fields |
| nullDisplay | String | | Placeholder for null values |
| conditionalFormatting | JSON | | Rules by value range |

---

# Thresholds

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| thresholds | JSON | | Color bands for KPI/gauge |
| alertThreshold | JSON | | Optional link to Alert entity (A7) |

### thresholds shape (conceptual)

```json
[
  { "min": 0, "max": 59, "color": "red", "label": "Critical" },
  { "min": 60, "max": 79, "color": "amber", "label": "Warning" },
  { "min": 80, "max": null, "color": "green", "label": "Good" }
]
```

---

# Interactions

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| drillDownEnabled | Boolean | | Enable click drill-down |
| drillDownTarget | Enum | | report, dashboard, record |
| drillDownConfig | JSON | | Target report/dashboard id, filter propagation |
| crossFilterEnabled | Boolean | | Filter other dashboard widgets on click |
| crossFilterFields | JSON | | Fields to broadcast |
| tooltipTemplate | String | | Custom tooltip pattern |

---

# Table Configuration

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| tableColumns | JSON | | Visible columns, widths, alignment |
| tablePagination | Boolean | | Paginate in widget |
| tablePageSize | Integer | | Rows per page |
| tableShowTotals | Boolean | | Footer totals row |
| tableRowHeight | Enum | | compact, default, comfortable |

---

# Size & Layout Hints

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| defaultWidth | Integer | | GridStack default width (columns) |
| defaultHeight | Integer | | GridStack default height (rows) |
| minWidth | Integer | | Minimum resize width |
| minHeight | Integer | | Minimum resize height |
| refreshInterval | Integer | | Auto-refresh seconds (0 = manual only) |

---

# Sharing & Permissions

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| ownerId | UUID | ✅ | Widget owner |
| visibility | Enum | ✅ | Private, Team, Role, Organization |
| sharedWith | JSON | | Users, teams, roles |
| permissions | JSON | | View, Edit, Clone, Share |

---

# Dependencies

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| dashboardCount | Integer | | Dashboards referencing this widget |
| certified | Boolean | | Admin-certified widget |
| certifiedBy | UUID | | Certifying user |
| certifiedAt | DateTime | | Certification timestamp |

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

- A widget **must** reference exactly one Report (`reportId`).
- Widgets **never** store execution results; they call the engine via the bound report.
- Widget `columnMapping` must only reference fields available on the bound report version.
- A widget cannot be deleted while `dashboardCount > 0`.
- Publishing a widget validates that the bound report is **Published** (or pinned version exists).
- `echartsOptions` is merged with platform defaults; server strips unsafe callbacks and script.
- Widget-level `filterOverrides` cannot broaden data beyond the user's module permissions.
- Lifecycle: **Draft → Published → Archived**.

---

# Supported Widget Types

| Widget Type | chartType | Typical Report Type |
|-------------|-----------|---------------------|
| Data Table | table | Tabular, Summary |
| KPI Card | kpi | KPI |
| Bar Chart | bar | Summary, Tabular |
| Line Chart | line | Trend, Summary |
| Area Chart | area | Trend |
| Pie Chart | pie | Summary |
| Donut Chart | donut | Summary |
| Funnel Chart | funnel | Summary |
| Gauge | gauge | KPI |
| Heatmap | heatmap | Matrix |
| Scatter Plot | scatter | Tabular |
| Combo Chart | combo | Summary, Trend |

All chart types render via **Apache ECharts**.

---

# Entity Relationships

```text
Report (1) ──→ (N) Widget
Widget (N) ──→ (N) Dashboard  (via dashboard layout placements)
Widget ──→ Alert (optional threshold, A7)
```

---

## Design Principles

- Widgets define **visualization**; Reports define **data**.
- One widget definition can appear on multiple dashboards (reuse by reference).
- Dashboard stores layout + placement; widget stores visualization config.
- Prefer `columnMapping` over duplicating report field lists.
- Theme-aware ECharts defaults live in `client/src/platform/analytics/echarts/`.
