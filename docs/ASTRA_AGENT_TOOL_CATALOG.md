# Astra AI Workforce — Agent & Tool Catalog + Execution Plan

> **Product = Arivu** (CRM). **Platform = Astra** (AI coworker layer).  
> **North star = AI Workforce** — router + named specialists + handoffs + reviewer + confirm-gated tools.  
> **OOTB mandate = complete App×Module catalog** — users never create Agents or Tools.  
> **Parent SoT:** [`ASTRA_V2_ARCHITECTURE.md`](./ASTRA_V2_ARCHITECTURE.md)  
> **Product surface:** `Architecture_Document.md` (apps, modules, APIs)  
> **Status:** Phase A–C runtime shipped (router, seats, playbooks, OOTB catalog, coverage CI).  
> Deepen tool→API bindings next; do not invent parallel AI frameworks.

---

## 1. Why this exists

**We are building an AI workforce for Arivu.** Every phase must advance that, not polish a single monolithic reply path.

### OOTB completeness mandate (non-negotiable)

| Rule | Meaning |
| --- | --- |
| **Zero DIY agents/tools** | Users must **never** need to create an Agent or Tool for any enabled App/Module. Astra ships the full catalog. |
| **Every App has seats** | Every `APP_KEYS` entry (and every installable addon surface users work in) has ≥1 named specialist seat. |
| **Every Module has tools** | Every registry / product module has read tools; mutable modules also have confirm-gated write tools. |
| **Entitlement-aware** | Seats/tools appear only when the tenant has the app/addon — but the **platform catalog is complete** out of the box. |
| **No agent builder product** | Custom agent/tool builder is **out of scope**. Gaps are filled by shipping missing built-ins, not by asking users to author them. |
| **New module merge gate** | Shipping a new App/Module without Astra seats+tools+golden phrases is a **merge blocker**. |

### Definition of done (AI Workforce)

A user can say something like *“Qualify this lead, research the company, draft a quote, create follow-ups, and have it reviewed before I confirm”* and Astra:

1. **Routes** to the right specialist(s) (never invents open deals)  
2. **Runs a multi-agent plan** with named seats (Sales → Research → Proposal → Workflow → Reviewer)  
3. **Shares focus/scratchpad** across agents (deal/org/person/case + prior findings)  
4. **Surfaces confirm proposals** for every write/send  
5. **Shows which agent did what** in the turn (workforce transparency)  
6. Can work across **any enabled App/Module** using only built-in seats/tools (no custom authoring)

Anything that only improves single-agent chat without router/specialists/handoff is **off strategy**.  
Anything that ships an App/Module without Astra coverage violates the OOTB mandate.

### Baseline today (not workforce)

- 1 orchestrator + 3 agent **profiles** that are mostly catalog-only  
- 12 tools (mostly CRM **read** + email/calendar stubs)  
- Unknown phrases → `crm_search` → open deals  
- `workflow.run` = linear tool steps, **not** multi-agent handoff  

### Competitive bar

Router + specialist agents + confirm-gated writes + optional review (HubSpot Breeze / Agentforce / Dynamics Sales agents).

---

## 2. Target architecture (workforce runtime)

```
User message / playbook request
    → Workforce Router (intent + confidence + plan type)
         ├─ single-seat  → Specialist Agent (allow-listed tools)
         ├─ clarify      → Clarifier (1 question; never invent CRM list)
         └─ playbook     → Multi-agent plan (ordered seats + shared scratchpad)
    → each seat: Agent → Tools (read | write+confirm)
    → Reviewer seat (required on high-risk writes / playbook end)
    → Grounded answer + UI blocks + proposals + agent attribution
```

**Workforce contracts (ship early — do not defer to “Phase C only”):**

| Contract | Meaning | First appears |
| --- | --- | --- |
| **Seat** | Named agent with job + tool allow-list | A (profiles become real seats) |
| **Router** | Picks seat or playbook; confidence + clarify | A |
| **Focus** | Last deal/org/person/case for all seats | A |
| **Scratchpad** | Turn/plan shared findings between seats | B (stub in A if needed) |
| **Handoff** | Seat A → Seat B with context packet | B design / C full |
| **Playbook** | Ordered multi-seat plan (e.g. Qualify→Enrich→Propose→Task→Review) | B thin / C full |
| **Reviewer** | Critiques write payloads before human confirm | C (API reserved in B) |

**Non-negotiables (keep from v2):**

- Tenant isolation (`organizationId`, `deletedAt: null`)
- Grounded facts from tools only
- Writes require `confirm_action`
- Reuse `ai/` providers, credits, audit, PII
- Extend `onboardingService` only for onboarding; Astra stays in `server/services/astra`

**Canonical playbook (end-state demo):**

| Step | Seat (agent) | Tools |
| --- | --- | --- |
| Qualify lead | `sales-qualification` | people/org get, score, email.draft |
| Enrich company | `research` | org get, relationships.context |
| Draft quote | `proposal` | quotes.draft, deal context |
| Create follow-ups | `workflow` | tasks.create, activity.log, events.create |
| Review before confirm | `reviewer` | critique_write → human confirm UI |

---

## 3. Current state (baseline)

### Agents (registered today)

| Key | Title | Autonomy | Used? |
| --- | --- | --- | --- |
| `clarifier` | Clarifier | assist | Yes — unknown intent |
| `coworker` | Astra | assist | Yes — default / writes |
| `crm-analyst` | Pipeline Analyst | assist | Yes — `request.agent` |
| `inbox-assistant` | Inbox Assistant | confirm | Yes |
| `sales-qualification` / `research` / `pipeline-closer` / `outreach` / `meeting-prep` | Sales seats | confirm/assist | Yes — router + playbook |
| `case-triage` / `knowledge` / `customer-health` | Helpdesk seats | confirm/assist | Yes |
| `proposal` | Proposal | confirm | Yes — quote_draft |
| `workflow` / `reviewer` | Workforce glue | confirm/assist | Yes — playbook + critique |

### Tools (registered today)

| Tool | Risk | Maturity |
| --- | --- | --- |
| `search.crm` + entity reads | read | Partial modules |
| `crm.record.get` / `relationships.context` | read | Phase B |
| `crm.tasks.create` / `notes` / `activity.log` | write | Confirm |
| `crm.deals.create` / `.update` / `people.create` / `organizations.create` / `cases.create` | write | Confirm |
| `quotes.draft` | write | Confirm stub |
| `email.*` / `calendar.createEvent` | read/write | Confirm |
| `playbook.run` / `reviewer.critique_write` / `workflow.run` | read | Phase B thin |

### Intents wired today

`playbook` · `workflow` · `email_draft` · `task_create` · `calendar_create` · `activity_log` · `case_create` · `deal_update` · `quote_draft` · `research` · `meeting_prep` · `chitchat` · `knowledge` · `crm_search` · `clarify`  

**Router:** LLM-primary (`classifyIntentPrecise`) with heuristic prior + action-vs-search safety guard. Each intent maps to an exact tool via `INTENT_TOOL_ROUTE`. Unknown/low-confidence → `clarify` (never silent open deals).

### Known miss phrases (fix in Phase A)

| User says | Today | Need |
| --- | --- | --- |
| book / schedule a meeting | `calendar_create` ✅ | Soften → real Event persist via API |
| create a task / remind me | `task_create` ✅ | Soften → Task controller on confirm |
| update deal stage / mark won | → list | deal update write (Phase B) |
| log a call / add a note | `activity_log` ✅ | Wire to activity API on confirm |
| open a ticket / create a case | → list only | case create (Phase B) |
| unknown gibberish | `clarify` ✅ | — |

---

## 4. Target agent catalog (complete OOTB — users never author these)

> Every seat below is **built-in**. Naming is stable; router + entitlement gates visibility.

### Tier 0 — Workforce control plane

| Agent key | Job | Autonomy |
| --- | --- | --- |
| `router` | Classify intent + confidence; pick seat or playbook | system |
| `clarifier` | One clarifying question; never invent CRM lists | assist |
| `coworker` | Cross-app grounded Q&A, status briefs, coaching | assist |
| `workflow` | Multi-step / multi-seat playbooks | confirm |
| `reviewer` | Critique write payloads before human confirm | assist |

### Tier 1 — SALES (+ shared CRM entities)

| Agent key | Modules owned | Autonomy |
| --- | --- | --- |
| `sales-qualification` | people (leads), organizations | confirm |
| `research` | people, organizations, relationships | assist |
| `pipeline-closer` | deals | confirm |
| `outreach` | people, deals + email/inbox | confirm |
| `meeting-prep` | deals, people, events, appointments | confirm |
| `catalog` | items, variants, categories, price books | assist |
| `scheduler` | events, appointments, scheduling | confirm |

### Tier 2 — Commercial (SALES money path)

| Agent key | Modules owned | Autonomy |
| --- | --- | --- |
| `proposal` | quotes (+ lines/sections/approvals/docs) | confirm |
| `order-ops` | sales_orders (+ lines/fulfillment) | confirm |
| `billing` | invoices (+ lines/docs) | confirm |
| `collections` | payments, refunds, payment_links, statements | confirm |

### Tier 3 — HELPDESK

| Agent key | Modules owned | Autonomy |
| --- | --- | --- |
| `case-triage` | cases | confirm |
| `knowledge` | articles, documents (KB) | assist |
| `customer-health` | cases + organizations + deals signals | assist |
| `sla-coach` | SLA policies/instances | assist |

### Tier 4 — MARKETING

| Agent key | Modules owned | Autonomy |
| --- | --- | --- |
| `campaign` | campaigns, recipients, subscriptions, suppressions | confirm |
| `audience` | audiences, segments | assist |
| `content` | blog, assets, content studio | assist |
| `webform` | webforms, webform submissions | assist |

### Tier 5 — INVENTORY

| Agent key | Modules owned | Autonomy |
| --- | --- | --- |
| `inventory` | stock ledger, locations, lots/serials | assist |
| `fulfillment` | reservations, transfers, adjustments, counts, SO fulfillment | confirm |

### Tier 6 — AUDIT

| Agent key | Modules owned | Autonomy |
| --- | --- | --- |
| `audit-planner` | audits, assignments | confirm |
| `audit-field` | events (audit), forms, responses | assist |
| `audit-review` | timelines, scores, next actions | assist |

### Tier 7 — PROJECTS / LMS (OOTB seats required)

| Agent key | Modules owned | Autonomy |
| --- | --- | --- |
| `projects` | projects (+ task linkage) | confirm |
| `lms` | LMS modules as product exposes them | assist |

### Tier 8 — PORTAL / CONTROL_PLANE (built-in, entitlement-gated)

| Agent key | Modules owned | Autonomy |
| --- | --- | --- |
| `portal` | portal KB / content surfaces | assist |
| `control-plane` | demo_requests, instances (platform ops) | confirm |

### Tier 9 — Platform shared + addons + ops

| Agent key | Modules / surfaces | Autonomy |
| --- | --- | --- |
| `documents` | documents, folders, OCR/semantic search | assist |
| `forms` | forms, responses (non-audit) | assist |
| `inbox` | inbox threads, mailboxes, communications | confirm |
| `mailroom` | mailroom classify → case/deal attach | confirm |
| `live-chat` | live_chat_sessions, suggest reply | assist |
| `analyst` | analytics, reports, targets | assist |
| `automation` | automation, execution, approvals | assist |
| `data-quality` | imports, CSV, dedup guidance | confirm |
| `notes-files` | notes, files/attachments | confirm |
| `settings-guide` | settings / config-registry / sharing (guided; no silent ACL writes) | assist |
| `trash` | trash list / restore proposals | confirm |
| `notifications` | notification prefs / digest explain | assist |

---

## 5. Target tool catalog (complete OOTB)

> Pattern per module: `{module}.search|list|get` (read) + `{module}.create|update|…` (write, confirm).  
> Sub-collections nest under parent tools — users still never author tools.

### A. Workforce orchestration

| Tool | Risk | Phase |
| --- | --- | --- |
| `intent.classify` / `intent.clarify` | read | A |
| `conversation.focus.get` / `.set` | read | A |
| `scratchpad.get` / `.set` | read | B |
| `agent.handoff` | read | C |
| `playbook.run` / `workflow.run` | read | B–C |
| `reviewer.critique_write` | read | C |

### B. Universal record layer (every module)

| Tool | Risk | Phase |
| --- | --- | --- |
| `search.crm` / `search.global` | read | A–B — **all** registry modules ready |
| `crm.record.get` / `.search` | read | A |
| `relationships.context` / `.link` | read/write | B |
| `activity.timeline.get` | read | B |
| `notes.create` / `files.attach` | write | A–B |
| `trash.list` / `.restore` | read/write | C |

### C. SALES core

| Tool | Risk | Phase |
| --- | --- | --- |
| `people.*` / `organizations.*` (incl. convert-lead) | write | B |
| `deals.*` (create/update/stage) | write | A–B |
| `tasks.*` / `events.*` / `appointments.*` | write | A–B |
| `items.*` / `catalog.*` | read/write | C |
| `activity.log` | write | A |

### D. Commercial

| Tool | Risk | Phase |
| --- | --- | --- |
| `quotes.get|list|draft|revise|send|convert` | read/write | B |
| `sales_orders.get|list|create|update|fulfill` | read/write | B–C |
| `invoices.get|list|create|send` | read/write | B–C |
| `payments.*` / `refunds.*` / `payment_links.create` / `statements.get` | read/write | C |

### E. HELPDESK

| Tool | Risk | Phase |
| --- | --- | --- |
| `cases.*` (create/update/assign/comment) | write | B |
| `articles.*` / `knowledge.search` | read/write | B |
| `sla.status` / `sla.explain` | read | C |
| `response_templates.apply` | read | B |

### F. MARKETING

| Tool | Risk | Phase |
| --- | --- | --- |
| `campaigns.*` | read/write | C |
| `audiences.*` / `segments.*` | read/write | C |
| `assets.*` / `blog.*` / `content.*` | read/write | C |
| `webforms.*` / `webform_submissions.*` | read | C |
| `subscriptions.*` / `suppressions.*` | read/write | C |

### G. INVENTORY

| Tool | Risk | Phase |
| --- | --- | --- |
| `inventory.stock.get` / `locations.*` / `lots.*` / `serials.*` | read | C |
| `reservations.*` / `transfers.*` / `adjustments.*` / `counts.*` | write | C |
| `fulfillment.from_sales_order` | write | C |

### H. AUDIT

| Tool | Risk | Phase |
| --- | --- | --- |
| `audits.*` / `audit_assignments.*` | read/write | C |
| `forms.*` / `responses.*` (audit path) | read/write | C |
| `audit.timeline.get` | read | C |

### I. PROJECTS / LMS / PORTAL / CONTROL_PLANE

| Tool | Risk | Phase |
| --- | --- | --- |
| `projects.*` | read/write | C |
| `lms.*` | read | C |
| `portal.content.*` | read | C |
| `control_plane.demo_requests.*` / `instances.*` | read/write | C |

### J. Communications + addons

| Tool | Risk | Phase |
| --- | --- | --- |
| `email.draft` / `email.send` | read/write | A |
| `inbox.threads.search` / `.get` / `inbox.reply.draft` | read | B |
| `mailroom.classify` / `.route` | read/write | C |
| `liveChat.suggestReply` / `liveChat.session.get` | read | C |

### K. Documents / analytics / automation / platform

| Tool | Risk | Phase |
| --- | --- | --- |
| `documents.search` / `.summarize` / `.get` | read | C |
| `analytics.query` / `targets.get` / `reports.run` | read | C |
| `automation.list` / `approvals.status` / `.decide` | read/write | C |
| `imports.*` / `csv.*` | read/write | C |
| `settings.explain` / `config_registry.get` | read | C |
| `notifications.explain` / `digest.explain` | read | C |

---

## 5b. Complete App × Module OOTB matrix

> **Ship** = required built-in before that phase exits. Sub-collections inherit parent agent; still need nested tools.  
> Sources: `appKeys.js`, registry seeds, Architecture commercial/inventory/audit surfaces.

| App / surface | Module / capability | Primary agent(s) | Min tools | Phase |
| --- | --- | --- | --- | --- |
| PLATFORM | people | sales-qualification, research, outreach | people.* | A–B |
| PLATFORM | organizations | research, customer-health | organizations.* | A–B |
| PLATFORM | tasks | workflow, coworker | tasks.* | A |
| PLATFORM | events | scheduler, audit-field | events.* | A–C |
| PLATFORM | forms / responses | forms, audit-field | forms.*, responses.* | C |
| PLATFORM | documents | documents, knowledge | documents.* | C |
| PLATFORM | templates / content studio | content | templates.*, content.* | C |
| PLATFORM | imports | data-quality | imports.* | C |
| PLATFORM | notes / files / activity | notes-files, coworker | notes.*, files.*, activity.* | A–B |
| PLATFORM | relationships | research | relationships.* | B |
| PLATFORM | search / trash / notifications | coworker, trash, notifications | search.*, trash.*, notifications.* | A–C |
| PLATFORM | analytics / targets / reports | analyst | analytics.*, targets.*, reports.* | C |
| PLATFORM | automation / approvals / execution | automation | automation.*, approvals.* | C |
| PLATFORM | settings / config-registry / sharing / groups / business-hours | settings-guide | settings.explain, config_registry.get | C |
| PLATFORM | appointments / scheduling | scheduler | appointments.*, scheduling.* | A–B |
| PLATFORM | inbox / mailboxes / communications | inbox, outreach | inbox.*, email.* | B |
| PLATFORM | mailroom | mailroom | mailroom.* | C |
| PLATFORM | webforms / submissions | webform | webforms.* | C |
| SALES | deals | pipeline-closer, sales-qualification | deals.* | A–B |
| SALES | quotes (+ lines/sections/approvals/docs) | proposal | quotes.* | B |
| SALES | sales_orders (+ lines/fulfillment) | order-ops | sales_orders.* | B–C |
| SALES | invoices (+ lines/docs) | billing | invoices.* | B–C |
| SALES | payments / refunds / payment_links / statements | collections | payments.*, refunds.*, payment_links.* | C |
| SALES | items / catalog / variants / price books | catalog | items.*, catalog.* | C |
| HELPDESK | cases | case-triage | cases.* | B |
| HELPDESK | articles | knowledge | articles.*, knowledge.search | B |
| HELPDESK | SLA | sla-coach | sla.* | C |
| HELPDESK | response templates | case-triage | response_templates.* | B |
| MARKETING | campaigns | campaign | campaigns.* | C |
| MARKETING | audiences / segments | audience | audiences.*, segments.* | C |
| MARKETING | assets / blog | content | assets.*, blog.* | C |
| MARKETING | subscriptions / suppressions | campaign | subscriptions.*, suppressions.* | C |
| INVENTORY | stock / locations / lots / serials | inventory | inventory.* | C |
| INVENTORY | reservations / transfers / adjustments / counts | fulfillment | reservations.*, transfers.*, … | C |
| AUDIT | audits / assignments | audit-planner | audits.*, audit_assignments.* | C |
| AUDIT | field execution (events/forms/responses) | audit-field | events.*, forms.*, responses.* | C |
| AUDIT | timeline / review | audit-review | audit.timeline.* | C |
| PROJECTS | projects | projects | projects.* | C |
| LMS | LMS modules (as shipped) | lms | lms.* | C |
| PORTAL | portal content / KB | portal | portal.content.* | C |
| CONTROL_PLANE | demo_requests / instances | control-plane | control_plane.* | C |
| Addon live_chat | sessions | live-chat | liveChat.* | C |
| Addon articles/blog | (helpdesk/marketing overlap) | knowledge, content | covered above | B–C |
| Addon email_credits / AMDS | delivery | outreach, campaign | email.send (credit-aware) | A–C |

**Exit rule:** A phase cannot close if any row marked for that phase is missing agent registration, tool registration, entitlement gate, and ≥1 golden phrase.

**Merge gate:** New App/Module PR must update this matrix + register seats/tools before merge.

---

## 6. Execution plan (workforce-first phases)

> **All three phases are AI Workforce delivery.** A = runtime skeleton, B = staffed seats, C = collaboration + playbooks.  
> Do **not** treat A as “chatbot bugfix only.”

### Phase A — Workforce runtime (router + real seats)

**Goal:** Astra can **pick a seat**, share **focus**, and never misroute. Tools seats need for common asks exist with confirms.

| # | Work item | Workforce contract | Acceptance |
| --- | --- | --- | --- |
| A1 | Intent registry + `intent.classify` (confidence) | Router | Unknown → clarifier seat, not deals |
| A2 | Golden intent CI (email, calendar, task, status, orgs, quotes, playbook phrases) | Router | PR fails on misroute |
| A3 | `conversation.focus` get/set | Focus | Follow-ups use last deal/org/person |
| A4 | Orchestrator **must** select seat (`request.agent` + router); tool allow-list enforced | Seat | Profiles are real agents, not labels |
| A5 | Intents: `calendar_create`, `task_create`, `activity_log` | Seat routing | Phrases → correct seat/tools |
| A6 | Tools: `crm.tasks.create`, `crm.notes.create`, `crm.activity.log` | Seat tools | Confirm proposals in `/astra` |
| A7 | Harden `email.draft` / `email.send` + recipient from focus | Outreach seat ready | Draft shows To when known |
| A8 | Real `crm.events.create` (or appointments) | Scheduler seat ready | “Book a meeting” ≠ deals list |
| A9 | Telemetry: intent, **agentKey**, entity, tool, confidence, conversationId | Operability | Can measure seat miss rate |
| A10 | Response metadata: `agentKey` (+ optional `planId` null) on every turn | Transparency | UI can show “who answered” |

**Exit criteria:** Router + seat attribution live; golden suite green; common asks correct.  
**Not done yet:** multi-seat playbooks (that is B→C).

---

### Phase B — Staff the workforce (specialist seats)

**Goal:** Named specialists users would hire as teammates; **thin playbook** (2–3 seats sequential) using shared focus + scratchpad stub.

| # | Work item | Workforce contract | Acceptance |
| --- | --- | --- | --- |
| B1 | Seats: `sales-qualification`, `research`, `pipeline-closer`, `outreach`, `meeting-prep` | Seat catalog | Router dispatches by intent |
| B2 | Tools: `crm.record.get`, `relationships.context`, `search.global` | Seat tools | Rich status/about answers |
| B3 | Tools: `crm.deals.create/update`, people/org writes | Confirm writes | Mutations via proposals |
| B4 | Seats: `case-triage`, `knowledge`, `customer-health` | Helpdesk seats | Helpdesk phrases work |
| B5 | Inbox tools + seat | Inbox seat | Thread search / reply draft |
| B6 | Seats: `proposal`, `commercial` + quote tools | Commercial seats | “Draft a quote for this deal” |
| B7 | Appointments tools | Scheduler seat | Staff booking via Astra |
| B8 | Scratchpad stub + **thin playbook** “Qualify → Research → Outreach draft” | Playbook v0 | One user message runs 2–3 seats in order |
| B9 | Reserve `reviewer` seat + `critique_write` tool shape (may no-op critique) | Reviewer API | Contract exists for C |

**Exit criteria:** Demo: single-turn thin playbook (qualify → research → email draft) with seat attribution + confirms.  
**Not done yet:** full Reviewer + arbitrary playbooks + app breadth.

---

### Phase C — Collaborate (handoffs + reviewer + playbooks)

**Goal:** Full **AI workforce**: handoffs, Reviewer before high-risk writes, named playbooks, remaining apps.

| # | Work item | Workforce contract | Acceptance |
| --- | --- | --- | --- |
| C1 | `agent.handoff` + durable scratchpad across seats | Handoff | Sales → Research → Proposal chain |
| C2 | `reviewer` critiques write payloads before confirm UI | Reviewer | Manager critique visible |
| C3 | Playbook registry: Qualify→Enrich→Propose→Task→Review→Execute | Playbook | User can invoke by name/phrase |
| C4 | Evolve `workflow.run` → multi-agent plan executor | Playbook engine | Not just linear tool steps |
| C5 | **Matrix green:** every §5b row for Phase C registered (Marketing, Inventory, Audit, Projects, LMS, Portal, Control Plane, docs, analytics, automation…) | OOTB completeness | No App/Module without seat+tools |
| C6 | Live chat + mailroom seats | Addon seats | Addon surfaces |
| C7 | Observability: seat miss rate, playbook completion, confirms, cost | Operability | Operable platform |
| C8 | Coverage CI: fail if registry module missing from Astra tool catalog | OOTB mandate | Users never need DIY agents/tools |

**Exit criteria:** Canonical playbook end-to-end + **§5b matrix 100% shipped** for all apps/modules; human confirms only on writes; seat attribution each step.

---

## 7. Implementation rules (every PR)

1. Ask: **Does this advance a workforce contract** (Router / Seat / Focus / Scratchpad / Handoff / Playbook / Reviewer)? If no, reject scope creep.  
2. Ask: **Does every touched App/Module stay covered in §5b?** Missing seat/tool = blocker.  
3. **Detector → handler → golden phrases** in the same PR as any new intent/agent/tool.  
4. **Never** default unknown to `crm_search`. Use clarifier seat.  
5. **One job per seat**; small tool allow-list; turns must emit `agentKey`.  
6. **Writes** only via `confirm_action` + audit.  
7. Prefer **reuse** of existing controllers/services behind tools.  
8. **Never** solve gaps with a user-facing agent/tool builder — ship built-ins.  
9. Update §5b + baseline when shipping; update `ASTRA_V2_ARCHITECTURE.md` when runtime contracts change.  
10. Tests: `astraV2.test.js` + golden set + playbook smoke + **module coverage CI** (B/C).

---

## 8. Suggested first execution sprint (Phase A — workforce runtime)

Order:

1. **A1 + A2** — Router + golden CI  
2. **A4 + A10** — Real seats + `agentKey` on responses (workforce transparency)  
3. **A3** — Focus (shared across seats)  
4. **A5 + A6** — Task create seat tools  
5. **A5 + A8** — Calendar/scheduler tools  
6. **A7** — Email from focus  
7. **A9** — Telemetry including `agentKey`  

Demo gate → then Phase B (staff seats + thin playbook). Do **not** stop at “chatbot feels nicer.”

---

## 9. Out of scope (for now)

- Parallel AI stack outside `server/services/astra`
- Autonomously sending email/money without confirm / without Reviewer on high-risk playbooks
- Treating Astra as a single LLM chat with more prompts (anti-goal)
- Onboarding wizards / tours (maintenance mode — see `.cursorrules`)
- **Custom Agent / Tool builder UI** — users must never need this; gaps = ship built-ins
- Asking tenants to “configure their own AI agents” as a substitute for OOTB coverage

---

## 10. References

- Competitive patterns: HubSpot Breeze Agents, Salesforce Agentforce templates, Dynamics Sales Qualification / Close / Research agents  
- Internal: `Architecture_Document.md`, `docs/ASTRA_V2_ARCHITECTURE.md`, `server/services/astra/tools/moduleCatalog.js`, gap canvas `astra-gap-analysis`
