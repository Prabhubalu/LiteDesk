# Report Entity - Field Level Requirements

## Overview

A **Report** is the foundational analytical asset in the Analytics module. It defines **what data to retrieve and how to process it**. Reports are reusable and serve as the data source for Widgets, Dashboards, Scheduled Reports, Alerts, and APIs. Visualization is defined on **Widgets**, not Reports.

**Related:** [`Analytics Widget Fields.md`](./Analytics%20Widget%20Fields.md) · [`Analytics Dashboard Fields.md`](./Analytics%20Dashboard%20Fields.md) · [`ANALYTICS_PLATFORM_ROADMAP.md`](./ANALYTICS_PLATFORM_ROADMAP.md)

---

# Basic Information

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| id | UUID | ✅ | System-generated unique identifier |
| organizationId | UUID | ✅ | Tenant scope (LiteDesk: ObjectId, required on all queries) |
| name | String | ✅ | Report name displayed to users |
| apiName | String | ✅ | Unique internal API identifier |
| description | Text | | Report description |
| type | Enum | ✅ | Tabular, Summary, Matrix, Pivot, Joined, Trend, KPI, Snapshot, Historical, Exception |
| category | Enum | | Sales, Support, Inventory, Finance, Custom |
| folderId | UUID | | Folder where report is stored |
| status | Enum | ✅ | Draft, Published, Archived |
| version | Integer | ✅ | Version number |
| tags | Array<String> | | Search tags |
| favorite | Boolean | | Mark as favorite |
| icon | String | | Optional icon |
| color | String | | Accent color |

---

# Data Source

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| primaryModule | String | ✅ | Primary module used in the report |
| relatedModules | Array | | Related modules used in joins |
| relationships | JSON | | Relationship definitions |
| joinType | Enum | | Inner, Left, Right |
| baseCollection | String | | Underlying collection/table |

---

# Selected Fields

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| selectedFields | JSON | ✅ | Fields included in the report |
| hiddenFields | JSON | | Hidden fields |
| calculatedFields | JSON | | Formula fields |
| customLabels | JSON | | Display labels |
| displayOrder | JSON | | Column ordering |

---

# Filters

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| filterTree | JSON | | Nested filter conditions |
| filterLogic | Enum | | AND / OR |
| dynamicFilters | JSON | | Current User, Team, Role |
| relativeDateFilters | JSON | | Today, This Month, YTD |
| runtimeFilters | Boolean | | Ask user for values before execution |

---

# Sorting

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| sorting | JSON | | Multi-column sorting |

---

# Grouping

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| rowGroups | JSON | | Row grouping |
| columnGroups | JSON | | Column grouping |
| groupOrder | Enum | | Ascending / Descending |

---

# Aggregation

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| aggregations | JSON | | SUM, AVG, COUNT, MIN, MAX |
| showGrandTotal | Boolean | | Display grand total |
| showSubTotals | Boolean | | Display subtotals |
| distinctCount | Boolean | | Count unique values |

---

# Formula Engine

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| formulas | JSON | | Formula definitions |
| variables | JSON | | Formula variables |
| executionOrder | JSON | | Formula dependency order |

---

# Time Intelligence

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| dateField | String | | Date field used for analysis |
| comparisonPeriod | Enum | | Previous Month, Quarter, Year |
| rollingWindow | Integer | | Rolling period |

---

# Output Settings

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| pagination | Boolean | | Enable pagination |
| pageSize | Integer | | Records per page |
| rowLimit | Integer | | Preview row limit |
| showRecordCount | Boolean | | Display record count |

---

# Performance

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| cacheEnabled | Boolean | | Enable caching |
| cacheDuration | Integer | | Cache duration in minutes |
| executionMode | Enum | | Sync / Async |
| queryTimeout | Integer | | Query timeout in seconds |

---

# Scheduling

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| schedulingEnabled | Boolean | | Enable scheduling |
| schedule | JSON | | Schedule configuration |
| deliveryChannels | JSON | | Email, Notification, Process |
| lastRunAt | DateTime | | Last execution |
| nextRunAt | DateTime | | Next execution |

---

# Export Settings

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| exportFormats | Array | | PDF, Excel, CSV, PNG |
| defaultExport | Enum | | Default export format |
| printSettings | JSON | | Print configuration |

---

# Sharing & Permissions

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| ownerId | UUID | ✅ | Report owner |
| visibility | Enum | ✅ | Private, Team, Role, Organization |
| sharedWith | JSON | | Shared users, teams, roles |
| permissions | JSON | | View, Edit, Clone, Export, Share |

---

# Dependencies

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| widgetCount | Integer | | Number of widgets using this report |
| dashboardCount | Integer | | Number of dashboards using this report |
| apiUsage | Integer | | API references |

---

# Audit Fields

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| createdBy | UUID | ✅ | User who created the report |
| createdAt | DateTime | ✅ | Creation timestamp |
| updatedBy | UUID | | Last modified by |
| updatedAt | DateTime | | Last modification timestamp |
| publishedAt | DateTime | | Published timestamp |
| archivedAt | DateTime | | Archived timestamp |

---

# Runtime Statistics

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| lastExecutedAt | DateTime | | Last execution time |
| executionCount | Integer | | Total executions |
| averageRuntime | Decimal | | Average execution duration |
| lastRuntime | Decimal | | Last execution duration |
| lastExecutionStatus | Enum | | Success, Failed, Running |
| lastError | Text | | Last execution error |
| lastRecordCount | Integer | | Records returned by last execution |

---

# Business Rules

- A report **must** have exactly one Primary Module.
- A report may reference multiple Related Modules.
- Reports are reusable and can be linked to multiple Widgets.
- Widgets never store data; they only reference Reports.
- A report cannot be deleted while it is referenced by a Widget or Dashboard.
- Reports support versioning through the lifecycle: **Draft → Published → Archived**.
- Long-running reports should execute asynchronously.
- Scheduled reports always execute the latest Published version.
- All report execution must respect module-level permissions and field-level security.

---

# Supported Report Types

| Report Type | Description |
|-------------|-------------|
| Tabular | Displays records in a flat table |
| Summary | Groups data with subtotals |
| Matrix | Groups by rows and columns |
| Pivot | Dynamic pivot analysis |
| Joined | Combines multiple datasets |
| Trend | Time-series analysis |
| Historical | Historical point-in-time reporting |
| Snapshot | Frozen historical data |
| KPI | Displays key performance indicators |
| Exception | Identifies anomalies or missing data |
| Cross Module | Combines related module data |
| Ad-hoc | Temporary user-generated reports |

---

# Entity Relationships

```text
Report
├── Data Source
├── Selected Fields
├── Filters
├── Sorting
├── Grouping
├── Aggregations
├── Formulas
├── Time Intelligence
├── Scheduling
├── Export Settings
├── Permissions
├── Runtime Statistics
└── Audit Information

Report
    │
    ├── Widget (1:N)
    │
    ├── Dashboard (Indirect via Widget)
    │
    ├── Scheduled Report
    │
    ├── Alert
    │
    └── API
```

## Design Principles

- Reports are the **single source of truth** for analytical data.
- Reports define **data**, while Widgets define **visualization**.
- Dashboard layouts should never duplicate report logic.
- Store flexible configurations (filters, grouping, formulas, etc.) as JSON to allow future extensibility without schema changes.
- All report execution should pass through a centralized Query Engine to ensure consistent security, caching, and performance.