# Analytics Platform — UX Wireframes (A0)

**Status:** A0 text wireframes — design handoff for A2/A4  
**Stack:** Vue 3 · Tailwind 4 · Headless UI · GridStack · ECharts  
**i18n namespace:** `analytics.*`

---

## 1. Information architecture

```text
Sidebar: Analytics (platform root — not under Sales)
├── Home                    /analytics
├── Reports                 /analytics/reports
│   ├── My Reports
│   ├── Shared
│   ├── Scheduled
│   ├── Drafts
│   └── Archived
├── Dashboards              /analytics/dashboards
│   ├── Personal · Team · Executive · App
├── Widgets                 /analytics/widgets
│   ├── Library · Templates · Favorites
├── Schedules               /analytics/schedules        (A6)
├── Settings                /settings/analytics         (org defaults)
└── Recycle Bin             /analytics/trash            (A5)
```

---

## 2. Analytics Home (`/analytics`)

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Analytics                                                    [+ Report] [+ Dashboard] │
├──────────────────────────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   KPI strip (org metrics) │
│ │ Reports │ │Widgets  │ │Dashbrds │ │ Runs    │   e.g. executions this week │
│ │   12    │ │   8     │ │   3     │ │  156    │                             │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘                             │
├──────────────────────────────────────────────────────────────────────────┤
│ [Search analytics assets…________________________]                          │
├───────────────────────────────┬──────────────────────────────────────────┤
│ Recent                        │ Favorites                                 │
│ • Pipeline by Stage  2h ago   │ ★ Executive Summary                       │
│ • Cases SLA Weekly   1d ago   │ ★ My Pipeline                             │
│ • Open Deals KPI     3d ago   │ ★ Team Helpdesk                           │
├───────────────────────────────┴──────────────────────────────────────────┤
│ Quick start templates                                                       │
│ [Sales Pipeline] [Helpdesk SLA] [Quote Funnel] [Blank Report]              │
└──────────────────────────────────────────────────────────────────────────┘
```

**Empty state (`FIRST_TIME`):** Illustration + "Create your first report" CTA + template cards.

**States:** `NO_ACCESS` → contact admin · `NOT_CONFIGURED` → enable analytics feature

---

## 3. Report list (`/analytics/reports`)

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Reports                                          [+ New Report] [Import] │
├──────────────────────────────────────────────────────────────────────────┤
│ [My] [Shared] [Scheduled] [Drafts] [Archived]                            │
│ [Search…] [Type ▼] [Module ▼] [Category ▼] [Folder ▼]     [Grid|List]   │
├──────────────────────────────────────────────────────────────────────────┤
│ ☐ Name              Type      Module   Status     Owner    Updated       │
│ ☐ Pipeline by Stage Summary   deals    Published  Jane D   2h ago    ⋮   │
│ ☐ Open Deals        Tabular   deals    Draft      Me       1d ago    ⋮   │
│ ☐ Case SLA          KPI       cases    Published  Admin    3d ago    ⋮   │
├──────────────────────────────────────────────────────────────────────────┤
│ ◀ 1 2 3 ▶                                              Showing 1–25 of 48  │
└──────────────────────────────────────────────────────────────────────────┘
```

**Row actions (⋮):** Run · Edit · Duplicate · Share · Schedule · Export · Archive

---

## 4. Report summary (`/analytics/reports/:id`)

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ ← Reports    Pipeline by Stage          [Run] [Edit] [Share] [Schedule] ⋮│
│ Summary · deals · Published v2 · Certified ✓                              │
├──────────────────────────────────────────────────────────────────────────┤
│ Description: Weekly pipeline breakdown by stage                             │
├───────────────────────────────┬──────────────────────────────────────────┤
│ Metadata                      │ Usage                                     │
│ Owner: Jane                   │ Widgets: 3                                │
│ Created: Jan 2                │ Dashboards: 2                             │
│ Last run: 2h ago (87ms)       │ Executions: 156                           │
│ Tags: sales, pipeline         │                                           │
├───────────────────────────────┴──────────────────────────────────────────┤
│ Preview (read-only table/chart from last execution)                        │
│ ┌────────────────────────────────────────────────────────────────────┐  │
│ │ Stage      │ Count │ Amount                                        │  │
│ │ Proposal   │ 12    │ $125,000                                      │  │
│ │ Negotiation│ 8     │ $89,000                                         │  │
│ └────────────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────────┤
│ [Widgets using this report] [Execution history] [Schedules] [Lineage]      │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Report Builder (`/analytics/reports/:id/edit`)

Three-panel builder — progressive disclosure.

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ ← Back    Pipeline by Stage (Draft)          [Save draft] [Preview] [Publish]│
├──────────────┬───────────────────────────────────────┬───────────────────┤
│ ① DATA       │ ② CONFIGURE                           │ ③ PREVIEW         │
│              │                                       │                   │
│ Primary      │ Fields selected:                      │ ┌───────────────┐ │
│ [deals    ▼] │ ☑ stage  ☑ amount  ☑ assignedTo      │ │ Live preview  │ │
│              │                                       │ │ (debounced)   │ │
│ + Add join   │ Filters:                              │ │               │ │
│ (A1.1)       │ [stage = Proposal OR Negotiation]     │ │  table/chart  │ │
│              │ [+ Add filter]                        │ │               │ │
│ Relationships│                                       │ └───────────────┘ │
│ (explorer)   │ Group by: [stage ▼]                   │ Rows: 42 · 87ms   │
│              │ Aggregations: SUM(amount), COUNT(*)   │                   │
│              │ Sort: amount DESC                     │                   │
│              │                                       │                   │
│ Field picker │ Report type: [Summary ▼]              │                   │
│ (searchable) │                                       │                   │
└──────────────┴───────────────────────────────────────┴───────────────────┘
```

**Keyboard:** `Cmd+S` save · `Cmd+Enter` preview · `Esc` back  
**Mobile:** Stack panels vertically; preview collapsible accordion

**Builder steps (wizard alternative for FIRST_TIME):**

1. Choose module → 2. Pick fields → 3. Add filters → 4. Group/aggregate → 5. Preview → 6. Publish

---

## 6. Widget Library (`/analytics/widgets`)

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Widgets                                      [+ New Widget] [Templates ▼]│
├──────────────────────────────────────────────────────────────────────────┤
│ [Library] [Templates] [Favorites]                                          │
├──────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│ │ ▂▃▅ Pipeline│ │  KPI  $1.2M │ │ ◔ Stage mix │ │ ▂ Trend     │         │
│ │ Bar chart   │ │ Open pipeline│ │ Pie chart   │ │ Line chart  │         │
│ │ deals       │ │              │ │             │ │             │         │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘         │
└──────────────────────────────────────────────────────────────────────────┘
```

**Widget builder modal:**

1. Select report → 2. Map columns (dimension / metric) → 3. Chart type → 4. Thresholds → 5. Preview → Save

---

## 7. Dashboard list (`/analytics/dashboards`)

Same list pattern as Reports with category tabs: Personal | Team | Executive | App.

---

## 8. Dashboard Designer (`/analytics/dashboards/:id/edit`)

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ ← Dashboards   Executive Summary (Draft)     [Save] [Preview] [Publish]   │
│ Variables: [Date range: This month ▼] [Owner: All ▼]                      │
├──────────────────────────────────────────────────────────────────────────┤
│ Widget palette (drag)          │ GridStack canvas (12 columns)           │
│ ┌──────────┐                   │ ┌──────────────────┬──────────────────┐ │
│ │ Pipeline │                   │ │ Pipeline by Stage│ KPI: Open Deals  │ │
│ │ bar      │                   │ │ (6×4)            │ (3×2)            │ │
│ └──────────┘                   │ ├──────────────────┴──────────────────┤ │
│ ┌──────────┐                   │ │ Cases by Priority (6×4)              │ │
│ │ KPI card │                   │ └──────────────────────────────────────┘ │
│ └──────────┘                   │ [+ Add widget from library]              │
│ Search widgets…                │                                          │
└────────────────────────────────┴──────────────────────────────────────────┘
```

**View mode:** Hide palette; variables bar sticky; widgets read-only; drill-down on click.

**Responsive:** Tablet = 6 cols · Mobile = single column stack (layoutMode: responsive)

---

## 9. Component inventory (reuse)

| UI need | Existing pattern |
|---------|------------------|
| List views | `GenericModule.vue` / module list toolbar |
| Empty states | Platform empty-state component + `FIRST_TIME` classification |
| Filters | `filterQueryAstCompiler` + filter panel composables |
| Modals | Headless UI Dialog |
| Permissions | `runtimePermissionResolver` + hide actions server-side |
| Tabs | App shell tab pattern |
| Grid layout | `SummaryView.vue` GridStack init |

---

## 10. Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Keyboard nav | List roving tabindex; builder panel focus trap |
| Chart a11y | ECharts `aria` + data table fallback for screen readers |
| Color | Threshold colors meet WCAG AA; not color-only (icons + labels) |
| Loading | Skeleton loaders on preview/widgets; `aria-busy` |

---

## 11. PostHog funnel (instrumentation spec)

| Step | Event |
|------|-------|
| Land on Analytics Home | `analytics_home_viewed` |
| Create report | `analytics_report_create_started` → `_created` |
| Publish report | `analytics_report_published` |
| First execution | `analytics_report_executed` |
| Add widget to dashboard | `analytics_dashboard_widget_added` |
| Publish dashboard | `analytics_dashboard_published` |

---

*UX wireframes v1 — A0 — 2026-07-03*
