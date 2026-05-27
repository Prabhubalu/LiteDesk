# Helpdesk Cases Module — Roadmap & Gap Analysis

Source PRD: `enterprise_helpdesk_cases_module.md` (Enterprise Helpdesk – Cases Module PRD v1.0)

This document maps the PRD requirements to what exists in LiteDesk today, identifies gaps, and lays out a phased roadmap to deliver a PRD-aligned Helpdesk **Cases** module with minimal ambiguity.

**Start here:** Work phases in order (0 → 1A → 1B …). Update the [Progress tracker](#progress-tracker) as each exit criterion is met.

---

## Progress tracker

| Phase | Status | Notes |
|-------|--------|--------|
| **0** — Alignment & baseline | ✅ Done | `test:helpdesk` + `smoke:helpdesk` passed; Ticket→Case org check fixed; Closed edit lock enforced on API |
| **1A** — Agent workspace UX | ✅ Done | Case record page UX, list preview, extra views (Team / SLA at risk / Recently updated), bulk assign/status/priority, improved header + closed banner + resizable reply |
| **1B** — Lifecycle + data model | ✅ Done | `description`, `reopenCount`, `reopenReason` required on reopen and surfaced in Details; closed cases locked with reopen-only path in UI |
| **1C** — Email hardening | ❌ Not started | |
| **1D** — Portals | ❌ Not started | |
| **1E** — Field service & warranty | ❌ Not started | |
| **1F** — Reporting, roles, audit exports | 🟡 Partial | Analytics backend exists; audit export missing |
| **1G** — Process Designer | ❌ Not started | |

### Phase 0 checklist

- [x] `npm run test:helpdesk` (from `server/`)
- [x] `npm run smoke:helpdesk` (requires `HELPDESK_AUTH_TOKEN` + running API)
- [x] Fix stale `Ticket` reference → `Case` in `organizationV2Controller.js`
- [x] Enforce **Closed** case edit lock on `PATCH /api/helpdesk/cases/:id`
- [x] Lock MVP scope decisions (see [MVP scope decisions](#mvp-scope-decisions-locked))

---

## Goals (from PRD)

- **Everything revolves around the Case**: all communication, SLA, escalation, activities, and resolution are attached to a Case.
- **SLA-driven execution**: first-response + resolution SLAs, business hours, pause/resume, breach automation.
- **Omnichannel**: email, portal, chat (mandatory), phone (logged), API integrations; WhatsApp/social future-ready.
- **Enterprise-grade auditability**: non-destructive, user-attributed, timestamped event trail.
- **Automation-first**: configurable rules and workflows (PRD: “through Process Designer”).

---

## Current state in LiteDesk (what exists today)

LiteDesk already contains a dedicated Helpdesk app (`HELPDESK`) with `moduleKey = cases`. Legacy naming still uses “ticket(s)” in a few places, but the canonical object is **Case**.

### Backend (already implemented)

- **Case model**: `server/models/Case.js`
  - Core fields: `caseId`, `title`, `caseType`, `priority`, `status`, `contactId`, `organizationRefId`, `caseOwnerId`, `channel`
  - SLA state: `currentSlaCycle`, `slaCycles[]`
  - Timeline: embedded `activities[]`
  - Assignment control: `assignmentControl`
  - Tenant isolation + soft delete
- **Lifecycle contract**: `server/constants/caseLifecycle.js` (statuses + allowed transitions)
- **API surface**: `server/routes/caseRoutes.js` mounted at `/api/helpdesk/cases`
  - CRUD, status update, reopen, add activity, channel ingestion, analytics endpoints
- **SLA services**: `server/services/helpdeskSlaService.js`, `helpdeskBusinessHoursService.js`, `helpdeskSlaMonitorService.js`
- **Assignment rules engine**: `server/services/assignmentRulesEngine.js` + execution + scheduling
- **Channel ingestion (email)**: `server/services/helpdeskChannelIngestionService.js` + inbound dispatcher integration
- **Helpdesk execution settings**: `server/controllers/helpdeskSettingsController.js` (SLA targets, business hours, escalation rules, channel rules, notification toggles)
- **Reporting & analytics**: `server/utils/caseAnalytics.js` + endpoints under `/api/helpdesk/cases/analytics/*`
- **QA scripts/checklists**:
  - `docs/HELPDESK_PR_CHANGELOG.md` (Steps 7–12 summary)
  - `docs/HELPDESK_QA_ROLLOUT_CHECKLIST.md`

### Frontend (already implemented)

- **Routes**: `/helpdesk/cases`, `/helpdesk/cases/new`, `/helpdesk/cases/:id`
  - **List**: `client/src/views/helpdesk/Cases.vue` — `ModuleList` + List/Kanban toggle, system views (All, My Cases, Unassigned, Open, Resolved, Closed)
  - **Create**: still `GenericModule.vue`
  - **Detail**: `client/src/pages/cases/CaseRecordPage.vue` — omnichannel workspace (not Deal-style layout)
- **Helpdesk settings UI**:
  - `client/src/components/settings/HelpdeskExecutionSettings.vue`
  - `client/src/components/settings/HelpdeskSlaScheduleSection.vue`
  - `client/src/components/settings/HelpdeskAnalyticsDashboard.vue`
  - `client/src/components/settings/AssignmentRulesSettings.vue`
- **Case field metadata**: `client/src/platform/fields/caseFieldModel.ts`

---

## PRD requirement coverage (high-level)

Legend: ✅ Done · 🟡 Partial · ❌ Missing

### Core Case operations

- ✅ Case creation, assignment, status lifecycle (New → Closed)
- ✅ Reopen creates a new SLA cycle (preserves history)
- ✅ “Closed is locked from editing” — enforced on case `PATCH` and reflected in record UI (no reply composer / status edits when closed; reopen-only)
- ✅ Canonical `description` on model + API; `caseNotes` retained for internal notes
- ✅ Mandatory “reopen reason” enforced on reopen endpoint; `reopenCount` tracked (max-reopen escalation policy still TBD)

### SLA management

- ✅ First response + resolution targets exist per cycle
- ✅ Pause on “On Hold”, resume on active statuses
- 🟡 Business hours: supported via settings (confirm holidays/multiple calendars needs)
- 🟡 Escalation thresholds: monitor exists; verify all PRD tiers (50/80/100/120%) are productized

### Assignment & routing

- ✅ Assignment rules engine + scheduler + assignment locking/overrides
- ❌ First-class “queues” experience (unassigned/team/VIP/escalation queues as UI objects/views)
- 🟡 Advanced routing (skills/geo/product/load) not fully represented

### Communication & timeline

- 🟡 Email: inbound create/append exists; threading/duplicate policies need UX hardening
- ❌ Live Chat and chat-to-case conversion
- ❌ Customer portal + partner portal case flows
- 🟡 Unified timeline exists via activities + communications, but UI is not helpdesk-grade yet
- ❌ Canned responses/macros/templates for cases (beyond basic compose)

### Collaboration, attachments, audit

- 🟡 Activities captured on the case; case-level audit export endpoint implemented (broader “enterprise immutable audit exports” still not fully productized)
- ❌ Case-level attachments need platform-level upload support (module declares support but not end-to-end)
- ❌ Watchers/followers, team mentions, case-specific collaboration features

### Field service & warranty

- ❌ Field visit records attached to cases
- 🟡 Warranty Claim case type exists; warranty validation/entitlement checks are missing

### Automation engine (Process Designer)

- ❌ PRD expects “all automation through Process Designer”; Cases currently use `caseExecutionService` + assignment/notification engines.

---

## Known technical debt / cleanup items

- ~~**Stale `Ticket` reference**~~ — fixed in Phase 0 (`organizationV2Controller` uses `Case` + `organizationRefId`).
- Mixed naming (“ticket(s)” vs “cases”) persists in some catalogs and docs; **cases** is canonical.

---

## Roadmap (phased)

The phases below are designed to reduce ambiguity and maximize reuse of existing backend work.

### Phase 0 — Alignment & baseline hardening (1 week)

**Goal**: lock MVP scope and ensure the existing Helpdesk foundation is stable.

- Confirm which PRD “mandatory” items are *Phase 1* vs *Phase 2* (especially Live Chat and Process Designer).
- Run Helpdesk verification:
  - `npm run test:helpdesk`
  - `npm run smoke:helpdesk`
  - Use `docs/HELPDESK_QA_ROLLOUT_CHECKLIST.md`
- Fix the stale `Ticket` reference in org detach/dependency logic.
- Confirm “Closed editing lock” policy and enforce it consistently.

**Exit criteria**: tests + smoke pass; no obvious P0 legacy references; MVP scope decisions written down.

**Phase 0 actions (this sprint)**

1. Run verification (see checklist above).
2. ~~Fix org detach `Ticket` → `Case` count.~~
3. ~~API: reject `PATCH` updates when `status === 'Closed'`.~~
4. Proceed to **Phase 1A** once smoke + QA sign-off are done.

---

### Phase 1A — Agent workspace UX (2–4 weeks)

**Goal**: deliver a helpdesk-grade agent experience without changing the core backend contract.

- Dedicated `CaseRecordPage` (pattern similar to `DealRecordPage.vue`) with:
  - SLA indicator + paused/breach state
  - Timeline that includes: internal notes, communications, status changes, assignments, SLA events
  - Quick actions: status transitions, assign/reassign, priority, case type
- Cases list enhancements:
  - Views: “My Cases”, “Unassigned”, “Team”, “SLA at risk”, “Recently updated”
  - Filters per PRD: status/priority/owner/team/channel/type/date range/SLA state
  - Bulk actions (assign/status/priority)

**Exit criteria**: support agents can manage cases end-to-end efficiently inside a purpose-built page.

---

### Phase 1B — Lifecycle + data model completeness (2–3 weeks, overlaps 1A)

**Goal**: align the Case model with PRD system fields and rules.

- Add/standardize:
  - Canonical `description` field (or explicitly define `caseNotes` as “description” with consistent UX)
  - `reopenReason` (required) and `reopenCount`
  - `breachStatus`, `lastCustomerReplyAt`, `lastAgentReplyAt`
  - Optional PRD fields: `severity`, `impact`, `tags`, `rootCause` (as core fields or managed custom fields)
- Enforce “Closed is locked from editing” (only allow reopen + final audit actions).
- Add “Field Service” to allowed `CASE_TYPES` if it’s in Phase 1 scope.

**Exit criteria**: PRD lifecycle rules are enforced by API; reopen policy is auditable.

---

### Phase 1C — Email hardening & productivity (2–3 weeks)

**Goal**: make email-to-case reliable and fast at enterprise volume.

- Threading rules configuration (message-id/references/thread-id)
- Duplicate handling configuration (merge/child/flag/ignore)
- Case email templates + canned responses/macros
- Ensure inbound → case append produces correct timeline/audit events

**Exit criteria**: inbound replies consistently attach to open cases; agents can reply quickly with templates.

---

### Phase 1D — Customer & partner portals (3–4 weeks)

**Goal**: enable customers/partners to create and interact with cases securely.

- Portal APIs:
  - Create case, list own cases, view detail, reply, upload attachments
- Strict visibility:
  - No internal notes
  - Tenant isolation + requester/org scoping
- Partner restrictions:
  - limited editing; controlled evidence uploads; field updates if enabled

**Exit criteria**: customers/partners can self-serve cases without exposure to internal data.

---

### Phase 1E — Field service & warranty (2–3 weeks)

**Goal**: support on-site execution and warranty workflows as first-class case children.

- Field visit child records: schedule, technician, status, notes, images; appear on case timeline
- Warranty entitlement checks when `relatedItemIds` present:
  - serial/AMC validation, in/out warranty behavior, billing notifications

**Exit criteria**: warranty and site visits are trackable and auditable under the case.

---

### Phase 1F — Reporting, roles, audit exports (2–3 weeks)

**Goal**: align reporting and roles to PRD and operational needs.

- Role presets (Agent/Lead/Manager/Admin) mapped to permissions
- KPI parity: open/closed, SLA compliance, avg response/resolution, reopen rate, escalation rate
- CSAT trigger on resolution/closure (if Phase 1 scope)
- Audit export (case timeline + assignment logs + SLA events)

**Exit criteria**: managers can run operations off dashboards; audits are exportable.

---

### Phase 1G — Process Designer integration (post-Phase 1 or parallel if required)

**Goal**: PRD-aligned automation through Process Designer.

- Bridge Case domain events to Process Designer triggers
- Provide actions: assign, notify, status, SLA pause/resume, escalate
- Gradual migration from `caseExecutionService` to flows (dual-run optional)

**Exit criteria**: core automation is configurable without redeploying code.

---

## MVP scope decisions (locked)

Decisions below unblock Phase 1 implementation. Change only via explicit product review.

| # | Topic | Decision | Phase |
|---|--------|----------|--------|
| 1 | **Live Chat** | **Phase 2** — ship email + agent workspace first; chat-to-case conversion later | 2 |
| 2 | **Process Designer** | **Phase 1G / post-MVP** — keep `caseExecutionService` + assignment/SLA engines for Phase 1 | 1G |
| 3 | **Field service & warranty** | **Phase 1E** — after agent workspace + portals unless escalated | 1E |
| 4 | **Description** | **`description`** = customer-facing body; **`caseNotes`** = internal notes | 1B ✅ model |
| 5 | **Closed case edits** | **Locked for all roles** on API; only `reopen` + read/delete (trash) paths; no manager override in Phase 1 | 0 ✅ API |
| 6 | **Portal identity** | Reuse existing portal auth; scoped to requester/org on case APIs (Phase 1D) | 1D |
| 7 | **Reopen reason** | **Required** on reopen endpoint before Phase 1 MVP sign-off | 1B |

---

## Decisions to lock before implementation (to remove ambiguity)

Superseded by [MVP scope decisions](#mvp-scope-decisions-locked) for Phase 1. Revisit if PRD or compliance requirements change.

---

## Phase 1 MVP — Proposed Definition of Done

- Agent workspace ships with a dedicated Case record page + timeline
- SLA is visible, accurate, and drives notifications/escalations
- Email → case → reply loop is reliable with threading/duplicate policies
- Reopen requires reason and creates a new SLA cycle; reopen count is tracked
- Customer portal supports create + track + reply + attachments with strict isolation
- Assignment rules are operational with “Unassigned” and “SLA at risk” views
- Analytics dashboards reflect the agreed KPI set
- `npm run test:helpdesk` and `npm run smoke:helpdesk` pass; QA checklist signed off

