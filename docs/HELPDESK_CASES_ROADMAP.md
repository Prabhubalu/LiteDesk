# Helpdesk Cases Module — Roadmap & Gap Analysis

Source PRD: `enterprise_helpdesk_cases_module.md` (Enterprise Helpdesk – Cases Module PRD v1.0)

This document maps the PRD requirements to what exists in Arivu today, identifies gaps, and lays out a phased roadmap to deliver a PRD-aligned Helpdesk **Cases** module with minimal ambiguity.

**Start here:** Phases **0**, **1A**, and **1B** are complete. **Email ingestion policies** (threading, dedup, case link, routing) live in **Settings → Automation → Mailroom** (Mailroom M0–M3.1). **Next:** [Phase 1C remainder](#phase-1c--email-hardening--productivity-2-3-weeks) (templates/macros) and [Phase 1D — Portals](#phase-1d--customer--partner-portals-3-4-weeks).

**See also:** `docs/MAILROOM_ROADMAP.md` for Mailroom delivery status (M0–M4 ✅; M5 🟡; M6–M7 remaining).

**Last updated:** 2026-05-28

---

## Progress tracker

| Phase | Status | Notes |
|-------|--------|--------|
| **0** — Alignment & baseline | ✅ Done | `test:helpdesk` + `smoke:helpdesk` passed (2026-05-27); Ticket→Case org check fixed; Closed edit lock on API |
| **1A** — Agent workspace UX | ✅ Done | `CaseRecordPage`, list quick-preview, system views, bulk actions, timeline + reply UX (pinned + resizable) |
| **1B** — Lifecycle + data model | ✅ Done | `reopenReason` required; `CaseResolutionDialog`; closed lock in API + UI; `reopenCount` on model |
| **1C** — Email hardening | 🟡 Partial | Mailroom pipeline + case timeline + **canned responses/macros** (tenant settings + case composer). Remaining: production pilot verification |
| **1D** — Portals | 🟡 Partial | Portal UI + APIs; Mailroom reply; requester scoping; partner/customer channels + rules shipped; smoke test pending |
| **1E** — Field service & warranty | ❌ Not started | |
| **1F** — Reporting, roles, audit exports | 🟡 Partial | Analytics + `GET /api/helpdesk/cases/analytics/audit-export`; role presets / CSAT / full enterprise audit TBD |
| **1G** — Process Designer | ❌ Not started | |

### Completed deliverables (summary)

| Area | What shipped |
|------|----------------|
| **Verification** | Phase 0 checklist complete; `npm run test:helpdesk` (13 tests); `npm run smoke:helpdesk` (7 API checks) |
| **Case record** | `CaseRecordPage.vue` + `CaseRecordMainWorkspace.vue` — Conversation / Activity / Notes / Tasks tabs; `CaseTimelineFeed`; email compose; related records; details + contact panels |
| **List & preview** | `Cases.vue` + `moduleListRegistry` views; `QuickPreviewDrawer` embed layout (task-style header, scrollable timeline, no reply when closed) |
| **Lifecycle UX** | `RecordClosedBanner`; reopen modal with required reason; `CaseResolutionDialog` for resolve/close; status/priority controls in `CaseRecordHeader` |
| **Reply UX** | `CaseResizableReplyComposer` + `useVerticalPaneResize` — drag-to-resize, height persisted per tab |
| **Bulk & views** | Bulk assign owner, update status, update priority; views: All, My, Unassigned, Open, Team, SLA at risk, Recently updated, Resolved, Closed |
| **API / model** | Closed `PATCH` lock; `POST …/reopen` with `reopenReason`; audit export endpoint; list query filters for SLA/views |

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

## Current state in Arivu (what exists today)

Arivu already contains a dedicated Helpdesk app (`HELPDESK`) with `moduleKey = cases`. Legacy naming still uses “ticket(s)” in a few places, but the canonical object is **Case**.

### Backend (already implemented)

- **Case model**: `server/models/Case.js`
  - Core fields: `caseId`, `title`, `description`, `caseType`, `priority`, `status`, `contactId`, `organizationRefId`, `caseOwnerId`, `channel`
  - Lifecycle: `resolutionSummary`, `reopenReason`, `reopenCount`
  - SLA state: `currentSlaCycle`, `slaCycles[]`
  - Timeline: embedded `activities[]`
  - Assignment control: `assignmentControl`
  - Tenant isolation + soft delete
- **Lifecycle contract**: `server/constants/caseLifecycle.js` (statuses + allowed transitions)
- **API surface**: `server/routes/caseRoutes.js` mounted at `/api/helpdesk/cases`
  - CRUD, status update, reopen (requires `reopenReason`), add activity, channel ingestion, analytics + **audit export** (`GET …/analytics/audit-export`)
  - List filters: `slaBreached`, `updatedWithinDays`, owner/status/priority (via `caseListQuery`)
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
  - **List**: `client/src/views/helpdesk/Cases.vue` — `ModuleList` + List/Kanban; system views (All, My, Unassigned, Open, **Team**, **SLA at risk**, **Recently updated**, Resolved, Closed); bulk assign/status/priority
  - **Create**: still `GenericModule.vue`
  - **Detail**: `client/src/pages/cases/CaseRecordPage.vue` — dedicated workspace + list quick-preview embed
  - **Case UI components**: `CaseRecordMainWorkspace`, `CaseRecordHeader`, `CaseTimelineFeed`, `CaseReplyComposer`, `CaseResizableReplyComposer`, `CaseResolutionDialog`, `CaseDetailsPanel`, `CaseTasksTab`, `RecordClosedBanner`, etc.
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
- 🟡 Queue-like **system views** (Unassigned, Team, SLA at risk) — not full queue objects / VIP / escalation queues
- 🟡 Advanced routing (skills/geo/product/load) not fully represented

### Communication & timeline

- 🟡 Email: Mailroom-enabled path uses policy-driven create/append/reopen (`casesAdapter`); legacy `helpdeskChannelIngestionService` when Mailroom off. **Settings → Automation → Mailroom** for routing + processing policies. Remaining 1C: **production email pilot** (macros/canned responses ✅)
- ✅ Live Chat and chat-to-case conversion (embed widget → chat session/messages → auto-case on first inbound; realtime handling inside the Case record)
- ✅ **Agent realtime alerts** (2026-05): HELPDESK SSE, bell/toast/sound on `CASE_CREATED` / inbound email / live chat; Gmail-style **internal tab** title stack + highlight + icon animation on background case tabs — see [HELPDESK_NOTIFICATION_SIMULATION.md](./HELPDESK_NOTIFICATION_SIMULATION.md)
- ❌ Customer portal + partner portal case flows
- 🟡 Unified timeline in `CaseTimelineFeed` on record + preview; polish and full comms threading still ongoing
- [x] Canned responses/macros for cases (tenant-configurable; `GET /api/helpdesk/cases/canned-responses`)

### Collaboration, attachments, audit

- 🟡 Activities on case + **`GET /api/helpdesk/cases/analytics/audit-export`** (timeline, SLA cycles, assignment events); immutable enterprise-wide audit productization TBD
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

### Phase 0 — Alignment & baseline hardening (1 week) ✅

**Status:** Complete (2026-05-27).

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
4. ~~Proceed to **Phase 1A** once smoke + QA sign-off are done.~~ → **1A complete**

---

### Phase 1A — Agent workspace UX (2–4 weeks) ✅

**Status:** Complete (2026-05-27).

**Goal**: deliver a helpdesk-grade agent experience without changing the core backend contract.

- [x] Dedicated `CaseRecordPage` with SLA badge, timeline tabs, quick status/priority, assignee, email, tasks/related, details/contact/knowledge side panes
- [x] List quick-preview (`embed` mode): task-style header, scrollable timeline, reply pinned at bottom, **resizable** composer
- [x] System views: My, Unassigned, Open, Team, SLA at risk, Recently updated, Resolved, Closed
- [x] Bulk actions: assign owner, update status, update priority
- [ ] Filters: full PRD matrix (team/channel/date range/SLA state combos) — partial via list filters + views

**Exit criteria**: support agents can manage cases end-to-end efficiently inside a purpose-built page. **Met.**

---

### Phase 1B — Lifecycle + data model completeness (2–3 weeks, overlaps 1A) ✅

**Status:** Complete for MVP lifecycle scope (2026-05-27). Optional PRD fields deferred.

**Goal**: align the Case model with PRD system fields and rules.

- [x] Canonical `description` on model; `caseNotes` for internal content
- [x] `reopenReason` required on `POST …/reopen`; `reopenCount` incremented
- [x] `resolutionSummary` + resolve/close via `CaseResolutionDialog` (replaces ad-hoc prompts)
- [x] Closed edit lock on API + UI (no reply/status/priority when closed; `RecordClosedBanner` + reopen flow)
- [x] `reopenReason` in module fields / Details tab
- [ ] `breachStatus`, `lastCustomerReplyAt`, `lastAgentReplyAt` as first-class fields
- [ ] Optional: `severity`, `impact`, `tags`, `rootCause`; Field Service case type
- [ ] Max-reopen escalation policy

**Exit criteria**: PRD lifecycle rules are enforced by API; reopen policy is auditable. **Met for MVP** (max-reopen policy TBD).

---

### Phase 1C — Email hardening & productivity (2–3 weeks)

**Status:** 🟡 Partial — Mailroom M0–M3.1 delivered policy UI and email pipeline; Helpdesk agent productivity items remain.

**Goal**: make email-to-case reliable and fast at enterprise volume.

**Done via Mailroom** (`docs/MAILROOM_ROADMAP.md`):

- [x] Threading rules configuration (message-id / references / subject order in Settings → Processing)
- [x] Duplicate handling configuration (dedup policy UI)
- [x] Ingest routing (which addresses/channels enter case flow)
- [x] Case link policy (create / append / reopen)
- [x] Channel rules migration from Helpdesk Execution Settings

**Still Phase 1C (Cases / agent UX):**

- [x] Case email templates + canned responses/macros (Settings → Helpdesk execution; bolt menu in case composers)
- [x] Case record timeline reads from Mailroom conversation messages (`caseTimelineAdapter.js`)
- [ ] Verify inbound → case append produces correct timeline/audit events end-to-end in production pilot

**Exit criteria**: inbound replies consistently attach to open cases; agents can reply quickly with templates.

---

### Phase 1D — Customer & partner portals (3–4 weeks)

**Status:** 🟡 Partial — portal case APIs + Mailroom reply path + customer portal UI (`/portal/cases`); partner/customer routing + restrictions shipped (smoke test pending).

**Goal**: enable customers/partners to create and interact with cases securely.

- Portal APIs (shipped):
  - `GET /portal/cases` — list own cases (requester email / contact match)
  - `POST /portal/cases` — create (`Customer Portal` channel; optional Mailroom ingest)
  - `GET /portal/cases/:id` — detail + customer-visible timeline
  - `POST /portal/cases/:id/reply` — reply via Mailroom when enabled
  - `POST /portal/mailroom/attachments` + download (see `docs/MAILROOM_API.md`)
- Strict visibility:
  - Internal activities filtered on portal responses
  - Tenant isolation + requester scoping (`portalCaseAccessService.js`)
- Partner/customer audience rules (shipped):
  - Partner vs customer audience detection (appAccess roleKey → People type → email domain)
  - Partner default restrictions: no case creation, attachment limits + MIME allowlist
- Remaining portal polish:
  - Portal E2E smoke test (create + reply + attachments)

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
| 7 | **Reopen reason** | **Required** on reopen endpoint before Phase 1 MVP sign-off | 1B ✅ |

---

## What’s next (recommended order)

1. **Phase 1C (remainder)** — canned responses/macros; pilot Mailroom-enabled email on staging tenants.
2. **Mailroom M5 + Phase 1D** — portal/API ingest through Mailroom; customer/partner case APIs.
3. **Phase 1F (remainder)** — role presets for Helpdesk, CSAT on close (if in scope), UI for audit export.
4. **Phase 1E / 1G** — field service, warranty, Process Designer (per MVP table).
5. **Mailroom M6–M7** — chat connector, SPF/DKIM, metrics, `smoke:mailroom`.

---

## Decisions to lock before implementation (to remove ambiguity)

Superseded by [MVP scope decisions](#mvp-scope-decisions-locked) for Phase 1. Revisit if PRD or compliance requirements change.

---

## Phase 1 MVP — Proposed Definition of Done

- [x] Agent workspace ships with a dedicated Case record page + timeline
- [x] SLA visible on record header (`CaseSlaBadge`) and drives backend monitor/notifications
- [ ] Email → case → reply loop is reliable with threading/duplicate policies — 🟡 policies in Mailroom; production pilot + templates/macros remain (**Phase 1C**)
- [x] Reopen requires reason and creates a new SLA cycle; reopen count is tracked
- [ ] Customer portal supports create + track + reply + attachments with strict isolation (**Phase 1D**)
- [x] Assignment rules operational; “Unassigned” and “SLA at risk” list views
- [x] Analytics dashboards (`HelpdeskAnalyticsDashboard` + API)
- [x] `npm run test:helpdesk` and `npm run smoke:helpdesk` pass
- [ ] Full `docs/HELPDESK_QA_ROLLOUT_CHECKLIST.md` functional QA sign-off (manual)

