# Arivu Platform — Tester Onboarding Brief

**Audience:** QA / manual testers joining the Arivu team  
**Purpose:** Understand what Arivu is, what problems it solves, which apps and features exist, and how to start structured testing  
**Last updated:** 2026-09-01  
**Source of truth:** `Architecture_Document.md`, `docs/PLATFORM_STATE_2026.md`

---

## 1. What is Arivu?

**Arivu** is an enterprise SaaS platform for **sales, service, operations, and compliance** — not a single CRM app. It follows a **Platform Core + Multi-App** pattern: one shared infrastructure (auth, permissions, records, notifications, analytics) with multiple distinct applications that tenants can enable per user.

Each customer organization gets:

- **Tenant isolation** — data scoped by `organizationId`; optional dedicated database per tenant
- **App entitlements** — org enables apps; users get `allowedApps` per role
- **Role-based access** — Roles, Profiles, sharing rules, and field-level privileges
- **Registry-driven UI** — modules, sidebar, and routes come from server config (`GET /api/ui/*`)

**Tech stack (for context):**

| Layer | Stack |
|-------|-------|
| Web | Vue 3, Vite, TypeScript, Pinia, Tailwind |
| API | Node.js, Express 5, Mongoose (MongoDB) |
| Mobile | Capacitor app in `mobile/` (read-first, native UX) |
| Jobs | Bull + Redis (email, imports, campaigns, analytics, SLA) |
| Real-time | SSE (notifications, inbox, data changes) — not WebSockets |

---

## 2. What Problems Does Arivu Solve?

| Problem | How Arivu addresses it |
|---------|------------------------|
| **Scattered customer data** | Unified **People** record with app-specific participations (Lead/Contact in Sales, requester in Helpdesk, etc.) |
| **Sales pipeline chaos** | **Deals** with stages, pipelines, multi-contact/account links, tasks, and meetings |
| **Quote-to-cash friction** | End-to-end **Catalog → Quote → Sales Order → Invoice → Payment** on one platform |
| **Support ticket silos** | **Helpdesk** cases with SLA, assignment rules, Mailroom email ingestion, portal surfaces |
| **Compliance / field audits** | **Audit** app — visits, findings, forms, assignments, portal for auditees |
| **Customer self-service** | **Portal** — quote acceptance, case visibility, invoice pay |
| **Marketing at scale** | **Marketing** app — campaigns, audiences, segments, assets, subscription prefs |
| **Stock & fulfillment** | **Inventory** app — ledger, locations, reservations, PO/receipt/delivery flows |
| **Reporting gaps** | **Analytics** platform — dashboards, widgets, schedules, embed tokens |
| **Operational email** | **Inbox / Mailroom** — threaded email, inbound parsing into cases |
| **AI-assisted work** | **Astra v2** — AI agents, tools, document search; **Astra Studio** for canvas workflows |
| **Multi-customer SaaS ops** | **Control Plane** — demo requests, instance provisioning, health, metrics |

---

## 3. Where to Test

### Environments

| Environment | Typical URL | Use |
|-------------|-------------|-----|
| **Local dev** | `http://localhost:5173` (client) + `http://localhost:3000` (API) | Developer setup — see `docs/QUICK_START.md` |
| **UAT / Internal beta** | `https://dev.arivusystems.com` | Safe teammate testing — **not production** |
| **Production** | `https://app.arivusystems.com` | Live customers — avoid destructive tests |

**UAT setup:** See `docs/UAT_DEV_ENVIRONMENT.md`. Seed data:

```bash
cd server
npm run seed:internal-beta
```

Default tenant slug: `arivu-internal-beta`. Login with the owner email printed by the seed script.

**Structured test flows:** Follow `docs/INTERNAL_BETA_TEST_FLOWS.md` (sections A–J) instead of ad-hoc clicking.

---

## 4. Platform Concepts (Test With These in Mind)

### 4.1 Applications vs Addons

**Applications** (`appKey`) — top-level product areas with their own navigation and permissions:

| App Key | Name | Primary purpose |
|---------|------|-----------------|
| `SALES` | Sales (formerly CRM) | Pipeline, people, deals, commercial docs, catalog |
| `HELPDESK` | Helpdesk | Cases, SLA, service desk |
| `AUDIT` | Audit | Field audits, forms, findings |
| `PORTAL` | Portal | Customer/partner self-service |
| `MARKETING` | Marketing | Email campaigns, audiences |
| `INVENTORY` | Inventory | Stock ledger, fulfillment, procurement docs |
| `PROJECTS` | Projects | Project management (platform slot) |
| `LMS` | LMS | Learning management (platform slot) |
| `CONTROL_PLANE` | Control Plane | Platform admin — instances, demo, infra |

**Addons** — installable tenant capabilities (not separate apps):

| Addon | Purpose |
|-------|---------|
| `live_chat` | Website chat widget, queues, bots |
| `articles` | Help center / KB content |
| `blog` | Marketing blog (headless public content) |
| `email_credits` | Outbound email metering (AMDS) |
| `announcements` | In-product announcements |
| `ai` | Full AI suite (Assist, Commercial, Service, Knowledge) |
| `tally` | TallyPrime connector |
| `stockroom` | Multi-warehouse (requires Inventory) |
| `cpq` | Configure-price-quote (requires Inventory) |
| `telephony` | Voice, softphone, recordings |

### 4.2 Access control (always verify)

1. **Org** must have app in `enabledApps` (status ACTIVE)
2. **User** must have app in `allowedApps`
3. **Role/Profile** grants module actions (`view`, `create`, `edit`, `delete`, …) with scope (`all` / `team` / `own` / `none`)
4. **Sharing rules** can widen or narrow record visibility beyond ownership

**Expected behavior:** Restricted users see hidden UI or explicit deny — not silent 500 errors.

### 4.3 Record model

- **People** replaces legacy Contacts — leads/contacts live in `participations.SALES`
- **Organizations** are dual-purpose: tenant workspace (`isTenant: true`) vs Sales **account** (company, `isTenant: false`)
- **Registry modules** use shared record pages: activity, comments, neighbors, relationships
- **Trash** — soft delete via Trash for people, orgs, deals, tasks, events, items; restore from Trash module

### 4.4 UI modes

| Mode | What to test |
|------|--------------|
| **Settings** | Pipelines, fields, automation, business hours, gateways |
| **Work surfaces** | Pipeline boards, case desk, commercial document workspaces |
| **Inbox** | Email threads, reply, assignment |
| **Platform Home** | Cross-app landing, onboarding nudges |
| **Internal tabs** | Browser-like tabs for multi-record work |

---

## 5. Applications — Feature Specification

### 5.1 SALES (Sales / CRM)

**Maturity:** Core platform — production-ready for CRM + commercial stack.

#### CRM core

| Module | Features to test |
|--------|------------------|
| **People** | Create lead/contact, attach/detach app participation, convert lead→contact, profile, tags, custom fields, activity, trash/restore |
| **Organizations (Accounts)** | Company records, types/tiers/status, link to people and deals |
| **Deals** | Pipeline stages, amount (manual/auto from lines), Won/Lost status, multi-people/multi-org links, DealLines, stage moves, related tasks |
| **Tasks** | Open/complete, priority, due dates, related record links |
| **Events / Meetings** | Scheduling, status (planned/completed), location, calendar views |
| **Appointments** | Staff booking + public book/manage tokens |

#### Catalog (Settings → Catalog)

| Area | Features |
|------|----------|
| Items & variants | Sellable unit = **ItemVariant**; lifecycle_state (Active only sellable) |
| Categories | Tree, attribute templates |
| Price books | Effective dating, `catalogPriceResolver` |
| Bundles | Fixed/rollup pricing, expand preview |
| Media | Item gallery, barcodes |

**Not shipped:** warehouse stock on catalog items (Inventory owns stock).

#### Commercial quote-to-cash

Flow:

```
Deal (+ DealLines) → Quote → Sales Order → Invoice → Payment
```

| Document | Key features | Status |
|----------|--------------|--------|
| **Quotes** | Lines, sections, revisions, approvals (Process Designer), PDF/email, public link, portal accept/reject/signature | MVP complete (Q0–Q9) |
| **Sales Orders** | Quote conversion (lands Confirmed), fulfillment events, split/merge, sections | Complete (SO0–SO4) |
| **Invoices** | SO conversion, Post/Void, credit notes, PDF/email, multi-SO wizard, payment rollups | Complete (INV0–INV4) |
| **Payments** | Allocations, refunds, customer credits, statements (CSV/PDF) | Complete (PAY0–PAY2) |
| **Payment gateways** | Stripe, Razorpay, manual bank transfer, webhooks | Complete (PAY3.0–PAY3.2) |
| **Portal Pay** | Customer pays open invoice via portal | Complete (PAY3.1) |
| **Payment links** | Agent-generated pay links | Complete |

**Public (no login):** `/api/public/quotes`, `/api/public/pay`

**Known gaps (not bugs if missing):**

- PAY3.3 gateway settlement reconciliation — not started
- GL / journal posting — not shipped
- Tax engine — snapshots only, no compliance engine
- Quote enterprise section rollups — architecture approved, not fully persisted
- SO does **not** deduct inventory (fulfillment is audit-only until Inventory hooks)

#### Other Sales modules

| Module | Features |
|--------|----------|
| **Documents** | Folders, versions, OCR, semantic search, inline comments, signatures |
| **Forms** | Audit/survey forms (distinct from marketing webforms) |
| **Webforms** | Lead capture, public submit |
| **Inbox / Communications** | Email threads, mailboxes, reply |
| **Analytics** | Reports, dashboards, widgets, schedules (prefer over legacy Reports) |
| **Targets** | Goals / KPIs |
| **Automation** | Rules, Process Designer, approvals inbox |
| **Import/Export** | CSV import with field mapping templates |
| **Search** | Global search |
| **Trash** | Soft-deleted records — list, restore, purge |

---

### 5.2 HELPDESK

**Maturity:** MVP+ — cases, SLA, Mailroom, partial portal.

| Area | Features to test |
|------|------------------|
| **Cases** | Create, lifecycle (New → Assigned → In Progress → On Hold → Resolved → Closed), reopen, priority, case type, channel |
| **SLA** | Policy engine, cycles, warning/breach notifications |
| **Assignment** | Rules, scheduled assignment, owner override |
| **Mailroom** | Inbound email → case, duplicate policy, activity append |
| **Response templates** | Canned responses |
| **Articles** | Helpdesk KB routes (with `articles` addon) |
| **Analytics** | Summary, trends, owners, distribution KPIs |
| **Notifications** | CASE_ASSIGNED, CASE_ESCALATED, SLA warning/breach; realtime tab alerts |

**Test scripts:**

```bash
cd server
npm run test:helpdesk
npm run smoke:helpdesk   # requires HELPDESK_AUTH_TOKEN
```

**Checklist:** `docs/HELPDESK_QA_ROLLOUT_CHECKLIST.md`  
**Notification simulation:** `docs/HELPDESK_NOTIFICATION_SIMULATION.md`

**Known gaps:** Full portal smoke pending; some legacy "ticket" naming; CSAT/field service phases on roadmap.

---

### 5.3 AUDIT

**Maturity:** App-owned — production for audit workflows.

| Area | Features to test |
|------|------------------|
| **Audit events / visits** | Schedule, in-progress, completed, related org context |
| **Findings** | Capture, severity, remediation |
| **Forms** | QBR/survey-style definitions, sections, questions |
| **Assignments** | Auditor assignment, timelines |
| **Execution** | Proxies to Sales event/form engines via `/api/audit/execute` |
| **Portal** | Auditee surfaces (where enabled) |

**UAT seed includes:** Internal Q2 controls audit (open) + data handling spot check (closed).

---

### 5.4 PORTAL

**Maturity:** Growing.

| Surface | Features |
|---------|----------|
| **Quotes** | Accept/reject, signature, messages (Q9) |
| **Cases** | Customer case visibility (where configured) |
| **Invoices** | View and pay open invoices (Stripe/Razorpay/bank transfer) |
| **Audits** | Auditee participation |

Test as **portal user** with limited `allowedApps` — should not access Sales/Helpdesk agent UI.

---

### 5.5 MARKETING

**Maturity:** Campaign platform shipped; scale features on roadmap.

| Module | Features |
|--------|----------|
| **Campaigns** | Create, schedule, send queue |
| **Audiences / Segments** | Dynamic audience rules |
| **Assets** | Marketing asset library |
| **Subscriptions** | Opt-in/opt-out preferences, suppressions |
| **Blog** | Headless public content (with `blog` addon) |
| **Dashboard / Reports** | Campaign analytics |

Background: `campaignSendQueueService` — verify sends respect suppressions and credits.

---

### 5.6 INVENTORY

**Maturity:** Ledger module exists; integration with SO fulfillment evolving (see Platform State).

| Area | Features |
|--------|----------|
| **Locations / Stockrooms** | Multi-location with `stockroom` addon |
| **Ledger** | Entries, transactions, reservations, transfers |
| **Adjustments / Counts** | Stock corrections, cycle counts |
| **Lots / Serials** | Batch and serial tracking |
| **Commercial docs** | PO, receipt notes, purchase returns, delivery notes, delivery returns, sales returns |
| **Taxes** | Shared tax config (Settings → Inventory → Taxes) — used by Sales + Inventory docs |
| **Fulfillment** | Ties to Sales Order fulfillment events |

**Critical test note:** SO fulfillment records qty events but historically did **not** auto-deduct stock — verify current behavior against release notes.

---

### 5.7 PROJECTS & LMS

Platform app keys exist (`PROJECTS`, `LMS`). Treat as **enablement-dependent** — verify what modules appear in your tenant's sidebar before filing gaps.

---

### 5.8 CONTROL PLANE

**Audience:** Platform admins only — not typical tenant testers.

| Area | Purpose |
|------|---------|
| Demo requests | Lead capture → instance conversion |
| Instance management | Provision, monitor, health |
| Metrics | Aggregated usage |
| AMDS / inbound parser | Email infrastructure |
| Addon pricing | Admin catalog |

---

## 6. Cross-Platform Capabilities

### 6.1 Analytics

- Dashboards, widgets, folders, favorites
- Scheduled reports, snapshots, alerts
- Embed tokens for external surfaces
- Permission matrix: `docs/ANALYTICS_PERMISSION_MATRIX.md`

### 6.2 Content Studio

- Templates, themes, assets, fonts, snippets
- Articles collections, render jobs
- Headless public API: `/api/public/content`

### 6.3 Live Chat (addon)

- Chat sessions, queues, bots, sequences
- Embed widget: `/embed/chat`
- Agent presence, assignment
- Brand color from tenant widget settings

### 6.4 Astra AI

| Component | Route / flag | Test focus |
|-----------|--------------|------------|
| **Astra v2** | `/api/ai/v2`, `ASTRA_V2` | Agents, tools, governance, credits |
| **Astra Studio** | `/api/astra/studio`, `ASTRA_STUDIO` | Living canvas workflows |
| **Document search** | Documents module | OCR + in-app semantic search |
| **Mobile Ask** | Floating pill in mobile app | Full-screen AI chat |

Legacy `/api/ai` is deprecated — prefer v2 surfaces.

### 6.5 Notifications

- In-app bell (SSE stream)
- Email, SMS, web push (per rules and prefs)
- Digests
- Domain events drive `notificationEngine`

### 6.6 Onboarding

- Platform Home, first-time empty states
- Module visit tracking, PostHog funnels
- **Maintenance mode** — no new onboarding wizards without product evidence

### 6.7 Integrations

| Integration | Use |
|-------------|-----|
| Stripe / Razorpay | Online payments |
| AWS SES / AMDS | Outbound email |
| Gmail | Mailbox connect |
| Tally (`tally` addon) | Accounting sync |
| Google geocode | Address lookup |

---

## 7. Mobile App (`mobile/`)

Separate Capacitor app — **not** the responsive web shell.

| Surface | Test |
|---------|------|
| Home hub | Metrics, recents, collapsible sections |
| Inbox | Thread list, read, reply |
| Tasks | Open tasks, complete |
| Apps sheet | Permission-aware module launcher |
| Modules | People, Orgs, Deals, Events, Cases, Forms, Items, Responses — list + detail |
| Astra Ask | Full-screen AI chat |

**Parity note:** Full CRM/commercial editing is on **web**. Mobile is read-first with quick actions.

Local run: `cd mobile && npm run dev` → `http://localhost:5174`

---

## 8. Structured Testing Approach

### 8.1 Priority smoke (UAT seed)

Run flows **A–J** in `docs/INTERNAL_BETA_TEST_FLOWS.md`:

| Flow | Coverage |
|------|----------|
| A | CRM: accounts → people → deals → pipeline → tasks |
| B | Calendar / meetings |
| C | Audit app |
| D | Helpdesk cases |
| E | Sample form (QBR) |
| F | Automation (if configured) |
| G | Dashboards / reports |
| H | Notifications |
| I | Permissions / roles |
| J | Sentry + PostHog observability |

### 8.2 Commercial path (high value)

1. Create **ItemVariant** in catalog (Active lifecycle)
2. Create **Deal** with lines or manual amount
3. Generate **Quote** → send PDF / public link
4. Portal **accept** quote (if portal user available)
5. Convert to **Sales Order** → record fulfillment
6. Convert to **Invoice** → **Post**
7. Record **Payment** (agent) or **Portal Pay** / **Payment link** (Stripe/Razorpay test mode)
8. Verify **amount due** rollup: `grandTotal - amountPaid - writeOff - credits`
9. Issue **Credit note** / **Refund** where permitted

### 8.3 Helpdesk path

1. Create case → assign → progress lifecycle → resolve → close
2. Reopen → verify new SLA cycle
3. Inbound email → case activity (Mailroom)
4. SLA warning/breach notifications
5. Analytics endpoints return plausible KPIs

### 8.4 Permission matrix

For each app you test, repeat critical flows as:

- **Owner/Admin** — full access
- **Limited role** — read-only where expected; write/delete denied explicitly

### 8.5 Bug report template

Include:

- Environment (local / dev / prod)
- User role and `allowedApps`
- Steps to reproduce
- Expected vs actual
- Browser / device
- Screenshots + network errors + console errors
- Sentry event ID if available

---

## 9. Known Limitations (Product Gaps, Not Defects)

Verify against current release before filing — this list reflects platform state as of mid-2026:

| Area | Gap |
|------|-----|
| Finance | No GL, revenue recognition, or bank ledger |
| Tax | Snapshots only — no compliance tax engine |
| Payments | PAY3.3 settlement reconciliation not shipped |
| Inventory ↔ SO | Reservation/deduction may be partial — check release |
| Quotes | Enterprise section rollups not fully persisted |
| Invoice | Credit note void unsupported; Partially Posted enum unused |
| Helpdesk | Full portal smoke, CSAT, field service on roadmap |
| Projects / LMS | Module depth varies by tenant config |

---

## 10. Reference Documents

| Topic | Document |
|-------|----------|
| Architecture (pinned) | `Architecture_Document.md` |
| Platform maturity snapshot | `docs/PLATFORM_STATE_2026.md` |
| UAT environment | `docs/UAT_DEV_ENVIRONMENT.md` |
| Structured test flows | `docs/INTERNAL_BETA_TEST_FLOWS.md` |
| Helpdesk QA | `docs/HELPDESK_QA_ROLLOUT_CHECKLIST.md` |
| Permissions | `docs/PERMISSION_ENFORCEMENT.md`, `docs/PERMISSION_COMPONENTS_GUIDE.md` |
| Payments ops | `docs/PAYMENT_GATEWAY_OPERATIONS.md` |
| Analytics permissions | `docs/ANALYTICS_PERMISSION_MATRIX.md` |
| Developer setup | `docs/DEVELOPER_SETUP.md`, `docs/QUICK_START.md` |
| Mobile | `mobile/README.md` |
| i18n QA | `client/docs/I18N_QA_CHECKLIST.md` |

---

## 11. Quick Glossary

| Term | Meaning |
|------|---------|
| **Tenant** | Customer organization (`isTenant: true`) |
| **Account** | Sales company record (`Organization` with `isTenant: false`) |
| **People** | Contacts/leads (replaces Contact) |
| **SALES** | Sales app (legacy name: CRM) |
| **AppKey** | Application identifier for entitlements |
| **Addon** | Optional capability package on top of apps |
| **Registry module** | Config-driven list/record module from `ModuleDefinition` |
| **Participation** | App-specific fields on a People record |
| **Control Plane** | Platform operator tools — not tenant CRM |

---

**Next step for new testers:** Get UAT credentials → run `seed:internal-beta` (if fresh tenant) → complete flows A–D in one session → expand to commercial and Helpdesk paths in week one.
