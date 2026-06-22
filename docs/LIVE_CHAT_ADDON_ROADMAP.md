# Live Chat Addon — Implementation Roadmap

**Source spec:** `Live Chat Addon.pdf` — Canonical Specification v2.0  
**Product placement:** **Settings → Addons** (hub landing, same pattern as **Settings → Automation**)  
**Architecture alignment:** Platform Core + Assignment Engine + Process Designer + Notification Engine  
**Last updated:** 2026-06-22 (verified against codebase — LC5 runtime, LC6 CSAT/transfers, LC7 transcript export marked shipped)

---

## 1. Executive summary

Live Chat is an **optional, tenant-installable addon** that owns **conversations** (sessions, visitors, messages, transcripts, outcomes, queues). It must **not** require Helpdesk, must **not** duplicate transcripts into business records, and must integrate with installed applications **only via Process Designer** (create/link record references).

**Historical baseline (pre-LC0):** Live Chat was hard-bound to Helpdesk Cases — embed inbound auto-created cases, agent UI lived on the case record, and APIs sat under `/api/helpdesk/cases/:id/chat/*`.

**Current status (2026-06-22):** Addon platform shipped (AD0). Helpdesk decoupling complete (LC0). Agent workspace, queues, outcomes, PD recipes, session field depth, reporting, and transcript export are live. **Remaining:** generic PD Create/Link Record, PD bot flow recipes, Stripe addon billing, open-sessions column parity, smoke embed-feedback, manual E2E sign-off.

| Layer | Owns |
|--------|------|
| **Live Chat Addon** | Sessions, visitors, messages, transcripts, outcomes, queues, bots, widget, agent workspace |
| **Assignment Engine** | Queue routing execution (addon configures queues; engine executes) |
| **Process Designer** | Cross-app automation (Create Case, Create Lead, Notify User, etc.) |
| **Helpdesk / CRM / Projects** | Business records; **references only** from chat sessions |

---

## 2. Spec analysis (v2.0 → engineering contract)

### 2.1 Locked principles (from spec)

1. **Live Chat owns conversations** — lifecycle, participants, messages, attachments, history, outcomes.
2. **Business apps own business work** — SLAs, case status, deal stages stay in those apps.
3. **Transcripts never duplicated** — other apps store session reference, duration, outcome, agent; not message bodies.
4. **No Helpdesk assumption** — unattended chat resolves via Process Designer per installed apps, or outcome `Missed` + supervisor notify.
5. **Install / disable / archive / uninstall** are tenant-scoped lifecycle operations with dependency validation on uninstall.
6. **Licensing** is independent (org flat, per agent, concurrent agent, or usage-based).

### 2.2 Spec modules → product surfaces

| Spec module | Primary surface | Notes |
|-------------|-----------------|-------|
| Chat Sessions (open) | Live Chat → Sessions | Primary work object; lifecycle Waiting → Assigned → Active → Ended (+ optional Bot Handling) |
| Chat Sessions (closed) | Live Chat → Closed | Read-only list + detail (transcript, context); replaces legacy Visitors tab |
| Visitors | Session context + `LiveChatVisitor` | Profile on session detail; no standalone Visitors list in v2 nav |
| Messages & transcripts | Session detail | Authoritative store; export on archive/uninstall |
| Outcomes | Session close + settings | Resolved, Missed, Follow-up Required, Escalated, Abandoned, Spam, Informational (+ custom) |
| Queues | Live Chat → Queues | Routing delegated to Assignment Engine |
| Agent presence | Agent profile / session header | Online, Busy, Away, Offline |
| Bots | Live Chat → Bots | Process Designer–configured |
| Reports | Live Chat → Reports | Operational, agent, quality, business (refs only) |
| Settings | Addon hub + Live Chat Settings | Widget, capture fields, welcome message, outcomes, queues |
| Process Designer | Automation triggers/actions | Registered on install |

### 2.3 Process Designer contract (on install)

**Triggers:** Chat Started, Chat Assigned, Message Received, Chat Transferred, Chat Ended, Outcome Changed, Record Linked  

**Actions:** Send Message, Transfer Session, Assign Queue, Assign Agent, End Session, Create Record, Link Record, Notify User

These extend `server/constants/domainEvents.js` and the automation/process registry — not Helpdesk channel ingestion.

---

## 3. Separation doctrine (locked)

> **Helpdesk Cases and Live Chat Sessions are different products.** Decoupling must not leave transcript duplication or implicit case creation in the embed path.

| | **Helpdesk Cases** (existing) | **Live Chat Addon** (this roadmap) |
|---|--------------------------------|-------------------------------------|
| **Purpose** | Support execution, SLA, resolution | Real-time visitor messaging |
| **Admin entry** | Settings → Applications → Helpdesk | **Settings → Addons → Live Chat** |
| **Primary work object** | `Case` | **`LiveChatSession`** (evolved from `ChatSession`) |
| **Agent workspace** | Case record + timeline | **Live Chat → Sessions** (standalone) |
| **Public API** | Portal / mailroom case ingest | **`/embed/chat`**, **`/api/live-chat/*`** (addon-gated) |
| **Integration** | Mailroom → casesAdapter | **Process Designer** → Create/Link Case (reference only) |
| **Permissions** | `cases.*` | **`liveChat.*`** (Chat Admin / Supervisor / Agent) |
| **i18n namespace** | `cases.*` | **`liveChat.*`** |

### Hard rules for contributors

1. **No auto-case creation** in embed inbound handlers after LC0 migration.
2. **No chat message bodies** on Case activities or Mailroom messages when sourced from Live Chat (metadata + link ref only).
3. **Do not gate** Live Chat agent APIs on `requireHelpdeskApp` or `cases.*`.
4. **Do not add** Live Chat to `enabledApps` / `VALID_APPS`.
5. **Tenant isolation:** all addon state keyed by `organizationId`; entitlement checked on every agent + embed path.
6. **Reuse** Assignment Engine, Notification Engine, Process Designer as **consumers** — no parallel routing framework.

---

## 4. Baseline & migration status

> **Note:** §4.1–4.2 describe the **pre-migration baseline**. LC0–LC8 addressed most items; see §7 progress tracker and §7.1 remaining work.

### 4.1 What existed (reuse / evolve)

| Area | Location | Reuse strategy |
|------|----------|----------------|
| Embed widget | `client/public/embed/chat.js`, `widget.html` | Keep; re-point config + entitlement to addon |
| Public embed API | `server/routes/embedChatRoutes.js`, `embedChatController.js` | Remove Helpdesk ingest; emit Live Chat domain events |
| Session/message models | `server/models/ChatSession.js`, `ChatMessage.js` | Evolve schema → full session lifecycle spec |
| Typing / receipts | `chatTypingService`, `chatMessageReceiptService` | Keep on session APIs |
| SSE streaming | `embedChatController.streamMessages`, `caseChatController.streamCaseChatMessages` | Consolidate under live-chat routes |
| Org embed config | `Organization.embed.chat` | Move to **`TenantAddonConfiguration`** (addon settings) + keep publicKey |
| Mailroom chat ingest | `mailroomChatController.js` | Deprecate case-first path; optional Mailroom **reference** event only |
| Assignment rules engine | `assignmentRulesEngine` | Wire queue routing (LC2) |
| Notifications | `caseNotificationService`, HELPDESK SSE | New `liveChat.*` events + SSE channel |

### 4.2 What was removed or deprecated (LC0+)

| Area | Location | Status |
|------|----------|--------|
| Case-bound agent chat API | `server/routes/caseRoutes.js` (`/:id/chat/*`) | ✅ Deprecated (`deprecateCaseChatApiMiddleware`) |
| Case chat UI | `CaseLiveChatPanel.vue` | ✅ Replaced by linked session card + Live Chat workspace |
| Auto case on first message | `embedChatController.postMessage` | ✅ Removed (LC0) |
| Chat config in Mailroom | `MailroomSettings.vue` embed section | ✅ Moved to Addons → Live Chat → Settings |
| Case channel `Live Chat` as default path | `CASE_CHANNELS` | ✅ Channel enum kept for **linked** cases only |
| `ChatSession.caseRecordId` as required link | Model field | ✅ Replaced by **`linkedRecords[]`** |

---

## 5. Addon platform foundation (tenant-specific)

Required before Live Chat can ship as an installable addon. All records are **per-tenant** (`organizationId`).

### 5.1 Platform catalog (master DB)

**Model:** `AddonDefinition` (master-only, like `AppDefinition`)

```javascript
{
  addonKey: 'live_chat',           // lowercase unique
  name, description, icon, category: 'COMMUNICATION',
  requiredPlatform: ['PLATFORM_CORE'],  // always
  optionalApps: ['SALES', 'HELPDESK', 'PROJECTS', ...],  // for PD integrations only
  capabilities: { navigation, permissions, processDesigner, ... },
  marketplace: { comingSoon, beta, docsUrl },
  enabled: true
}
```

### 5.2 Tenant entitlement (master DB)

Extend **`OrganizationSubscription`** (preferred — billing already per-org):

```javascript
addons: [{
  addonKey: 'live_chat',
  status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED',
  planKey: 'BASIC' | 'PRO' | ...,
  trialEndsAt, startedAt, installedBy,
  archivedAt: null
}]
```

**Pricing:** `server/constants/addonPricingRegistry.js` — mirror `appPricingRegistry.js`.

**Bootstrap:** extend `subscriptionBootstrapService.ensureSubscriptionForApp` → `ensureSubscriptionForAddon`.

### 5.3 Tenant configuration (master DB)

**Model:** `TenantAddonConfiguration` (like `TenantAppConfiguration`)

```javascript
{
  organizationId,
  addonKey: 'live_chat',
  enabled: true,                    // operational on/off (disable vs uninstall)
  settings: { widget, queues, outcomes, bots, ... }
}
```

One document per `(organizationId, addonKey)`.

### 5.4 Entitlement middleware

- `requireAddonEntitlement('live_chat')` on agent routes and embed enablement.
- Embed resolver: reject session create if addon not `TRIAL`/`ACTIVE`.
- Internal orgs: same pattern as app entitlements (enterprise bypass optional).

### 5.5 Settings → Addons (hub UI)

**Pattern:** clone `AutomationSettings.vue` hub.

| Route | View |
|-------|------|
| `/settings?tab=addons` | **Addons hub** — cards: Marketplace catalog + installed addons |
| `/settings?tab=addons&addonView=live-chat` | Installed Live Chat sub-hub (Sessions config entry points) |
| `/settings?tab=addons&addonView=live-chat&liveChatView=settings` | Widget, outcomes, queues (admin) |

**Sidebar:** insert **Addons** tab **immediately below Applications** in `Settings.vue` + `SettingsLandingPage.vue`.

**Access:** `settingsTabAccess.ts` — `addons`: `settings.edit` (install/configure) + `settings.manageBilling` (plan view); owners/admins full access.

**i18n:** `settings.tabAddons`, `settings.addonsHubDesc`, `liveChat.*` namespace.

---

## 6. Target architecture

### 6.1 High-level flow

```text
Visitor website (embed widget)
        ↓
  /embed/chat (public, addon + instanceKey gate)
        ↓
  LiveChatSession + LiveChatMessage (tenant DB)
        ↓
  Domain events → Notification Engine + Process Designer
        ↓
  Optional: Assignment Engine (queue → agent)
        ↓
  Agent workspace: Live Chat → Sessions (liveChat.* permissions)
        ↓
  Optional PD actions: Create/Link Case, Lead, Task (reference only)
```

### 6.2 Data model evolution

| Current | Target |
|---------|--------|
| `ChatSession` | `LiveChatSession` — see **§6.2.1 Session field contract** (default vs advanced tiers) |
| `ChatMessage` | `LiveChatMessage` — add: `messageType` (visitor/agent/bot/system), attachments |
| (none) | `LiveChatVisitor` — visitor profile + session count + CRM links |
| (none) | `LiveChatQueue` — queue config; routing via Assignment Engine |
| (none) | `LiveChatSessionAssignmentEvent` — assignment history related list (LC8) |
| (none) | `LiveChatVisitorJourneyEvent` — page/action events for journey related list (LC8) |
| (none) | `LiveChatSessionNote` — internal notes related list (LC8) |
| (none) | `LiveChatSessionFeedback` — CSAT / resolution rating (LC8) |
| `Organization.embed.chat` | `TenantAddonConfiguration.settings.widget` |

#### 6.2.1 Session field contract (spec v2.0)

Fields are grouped into **default** (list + detail for most tenants) and **advanced** (operational, AI, compliance — tenant-configurable visibility).

| Group | Default fields | Status |
|-------|----------------|--------|
| **Core** | Session ID (`sessionKey`), Channel, Status (`lifecycleStatus`), Outcome | ✅ Shipped |
| **Core** | Subject, Priority, Tags, Summary, Internal Notes | ✅ Shipped (LC8a/d) |
| **Visitor** | Visitor Name, Email, Phone (embed + `LiveChatVisitor`) | ✅ Shipped |
| **Visitor** | Visitor lookup, Visitor Type, Linked Contact, Linked Organization | ✅ Shipped (LC8d — `visitorType`, `linkedContactId`, `linkedOrganizationId`; `linkedRecords` canonical) |
| **Agent & ownership** | Queue, Assigned Agent, Handled By (`endedByAgentId`) | ✅ Shipped (enriched in API) |
| **Agent & ownership** | Agents Involved, Assigned By, Transfer Count | ✅ Shipped (LC8b — system-maintained on assign/transfer) |
| **Timing** | Started At (`createdAt`), Ended At, Last Message At, Duration (computed) | ✅ Shipped |
| **Timing** | Assigned At, First Response At, Wait Time, First Response Time, Handle Time | ✅ Shipped (assignedAt/firstResponseAt persisted; wait/FRT/handle computed in reporting) |
| **Visitor journey** | Source URL (`pageUrl`) | ✅ Shipped |
| **Visitor journey** | Referrer URL, Entry Page, Browser, OS, Device Type, Country, Language | ✅ Shipped (LC8c — embed capture + journey events) |
| **Conversation intelligence** | Intent, Sentiment, AI Summary, AI Intent, AI Sentiment Score | ✅ Shipped (rule-based, feature-flagged via `LIVE_CHAT_SESSION_INTELLIGENCE`); LLM-backed AI deferred |
| **Bot** | Bot Involved, Bot Name (`botId`), Bot Escalated, Bot Resolution, Bot Message Count | ✅ Shipped (populated by `liveChatBotRuntimeService`) |
| **Quality & feedback** | CSAT Score, Feedback Comment, Rated By Visitor, Resolution Rating | ✅ Shipped (LC8a — embed `POST /embed/chat/sessions/:id/feedback`) |
| **Operational metrics** | Message Count | ✅ Shipped (enrichment aggregate) |
| **Operational metrics** | Visitor/Agent Message Count, Attachment Count, Agent Count | ✅ Shipped (LC8g — persisted on session close) |
| **Compliance** | Consent Given, Consent Timestamp, Archived, Archive Date, Exported | ✅ Shipped (LC8h — widget consent + archive/export APIs) |

**Default list/detail columns (product):** Session ID, Visitor Name, Channel, Status, Outcome, Queue, Assigned Agent, Handled By, Started At, Ended At, Duration, Summary, Tags, CSAT Score.

| Surface | Shipped default columns | Remaining |
|---------|-------------------------|-----------|
| Closed sessions list | Full 14-field default set (Session ID, Visitor, Channel, Status, Outcome, Queue, Agents, Started, Ended, Duration, Summary, Tags, CSAT, Messages) | — |
| Open sessions list | Visitor-centric queue sidebar (Mine / All tabs) | Align with default 14-column spec (deferred product decision) |
| Session context panel | Default + advanced sections (timing, journey, bot, intelligence, operational, compliance) | — |

**Related lists on session detail:**

| Related list | Status |
|--------------|--------|
| Messages (transcript) | ✅ `LiveChatSessionPanel` |
| Linked Records | ✅ context panel + API |
| Assignment History | ✅ `LiveChatSessionAssignmentEvent` + `GET /sessions/:id/assignment-events` |
| Visitor Journey (events) | ✅ `LiveChatVisitorJourneyEvent` — referrer, entry page, browser/OS/device, country, language |
| Notes | ✅ `LiveChatSessionNote` + `GET/POST /sessions/:id/notes` |
| Feedback | ✅ CSAT capture on embed close + `csatScore` / `feedbackComment` / `resolutionRating` on session |

**Linked records shape:**

```javascript
linkedRecords: [{
  moduleKey: 'cases' | 'people' | 'deals' | ...,
  recordId: ObjectId,
  linkType: 'created' | 'linked',
  linkedAt, linkedBy
}]
```

### 6.3 API surface (target)

| Prefix | Audience | Middleware |
|--------|----------|------------|
| `/embed/chat/*` | Public widget | instanceKey + addon active |
| `/api/live-chat/sessions/*` | Agents | protect + addon entitlement + `liveChat.*` |
| `/api/live-chat/visitors/*` | Agents | same |
| `/api/live-chat/queues/*` | Admins | `liveChat.admin` |
| `/api/settings/addons/*` | Settings | protect + settings.edit |

**Remove:** `/api/helpdesk/cases/:id/chat/*` after migration window.

### 6.4 Navigation (on install)

Register dynamic routes / sidebar entries when addon enabled for tenant:

```text
Live Chat
├─ Sessions      → /live-chat/sessions          (open / active workspace)
├─ Closed        → /live-chat/closed            (closed session list + detail — LC1/LC8)
├─ Queues        → /settings?tab=addons&…       (LC2 — admin in addon settings)
├─ Bots          → /settings?tab=addons&…       (LC5 — admin in addon settings)
├─ Reports       → /live-chat/reports           (LC6)
└─ Settings      → /settings?tab=addons&addonView=live-chat&liveChatView=settings
```

Legacy `/live-chat/visitors` redirects to `/live-chat/closed`.

App switcher: show **Live Chat** as addon app surface (not `enabledApps` entry).

### 6.5 Helpdesk integration (optional, post-decouple)

When Helpdesk **and** Live Chat addon installed, Process Designer recipes can:

- **Create Case** on trigger (e.g. unattended 10m) → store link on session
- **Link Existing Case** manually from session UI
- Case record shows **Chat session card** (session ref, outcome, duration) — **no transcript mirror**

Remove `handleChannelInteractionForHelpdesk` from chat inbound permanently.

---

## 7. Progress tracker

| Phase | Status | Target | Outcome |
|-------|--------|--------|---------|
| **AD0** — Addon platform + Settings hub | ✅ Done | 2–3 weeks | AddonDefinition, tenant entitlement, Addons settings hub, install/uninstall API, master pricing |
| **LC0** — Decouple from Helpdesk | ✅ Done | 1–2 weeks | Remove case auto-create; deprecate case chat routes; migrate embed config |
| **LC1** — Core sessions MVP | ✅ Done | 3–4 weeks | Sessions list + detail, agent reply, visitor model, widget gated on addon |
| **LC2** — Queues & assignment | ✅ Done | 2–3 weeks | Queues CRUD, Assignment Engine routing, presence, session claim |
| **LC3** — Outcomes & Process Designer | ✅ Done | 3–4 weeks | Outcomes, end session, PD triggers/recipes, missed-chat flows |
| **LC4** — App integration adapters | 🟡 Mostly done | 2 weeks | Case/Lead/Person create + link, session cards, uninstall guard; **remaining:** generic PD Create/Link Record action |
| **LC5** — Bots | 🟡 In progress | 3+ weeks | **Shipped:** bot model, admin CRUD, bot_handling runtime (greeting, KB/website matching, escalate), LC8e bot session fields; **remaining:** PD-configured bot flow recipes, LLM-backed AI |
| **LC6** — Reporting | ✅ Done | 2 weeks | Operational, agent metrics, outcome breakdown, business links, CSAT, transfers |
| **LC7** — Lifecycle & billing | 🟡 Mostly done | 2 weeks | Archive, trial expiry, subscription UI, uninstall guard, transcript export (single + bulk); **remaining:** Stripe addon billing |
| **LC8** — Session fields & detail depth | ✅ Done | 3–4 weeks | LC8a–i shipped — see §8 LC8 |

**Suggested sequencing:** AD0 → LC0 → LC1 (MVP) → LC3 (PD + outcomes) → LC2 → LC4 → **LC8** (session depth) → LC7 → LC6 → LC5

**Current focus:** **LC5** PD bot flow recipes + LC4 generic Create/Link Record action + LC7 Stripe addon billing + open-sessions list column parity + smoke embed-feedback coverage.

### 7.1 Remaining work (codebase-verified 2026-06-22)

| Item | Phase | Status |
|------|-------|--------|
| Generic PD Create Record / Link Record action (arbitrary module) | LC4 | ❌ Not started — only app-specific `live_chat_create_case`, `live_chat_link_case`, `live_chat_create_lead`, `live_chat_link_person` |
| PD-configured bot flow recipes (greeting, FAQ, escalate via Process Designer) | LC5 | ❌ Not started — runtime shipped; `LiveChatBot.processRecipeKey` placeholder only |
| LLM-backed AI bot replies | LC5 | ❌ Deferred (optional) — rule-based KB/website matching + LC8f session intelligence shipped |
| Stripe addon subscription billing webhooks | LC7 | ❌ Not started — trial/manual entitlement via `addonBootstrapService` |
| Open sessions list — 14-column parity with closed list | LC8a | ❌ Deferred — sidebar UX intentionally visitor-centric |
| Smoke: `POST /embed/chat/sessions/:id/feedback` | LC8 | ❌ Route exists; not exercised in `liveChatSmokeChecks.js` |
| Sales-only tenant E2E sign-off | LC1 | ❌ Manual |
| §13 MVP success criteria formal sign-off | LC1 | 🟡 Code complete; manual validation pending |

---

## 8. Phase detail

### AD0 — Addon platform + Settings hub

**Backend**

- [x] `AddonDefinition` model + seed `live_chat`
- [x] `OrganizationSubscription.addons[]` + `addonPricingRegistry.js`
- [x] `TenantAddonConfiguration` model
- [x] `addonBootstrapService` (trial on install)
- [x] `requireAddonEntitlement` middleware
- [x] Settings API:
  - `GET /api/settings/addons` — catalog + installed status per tenant
  - `GET /api/settings/addons/:addonKey`
  - `POST /api/settings/addons/:addonKey/install`
  - `POST /api/settings/addons/:addonKey/disable`
  - `POST /api/settings/addons/:addonKey/archive`
  - `POST /api/settings/addons/:addonKey/uninstall` (dependency check stub)

**Frontend**

- [x] `AddonsSettings.vue` — hub (overview grid like Automation; sub-views for Live Chat settings, queues, bots)
- [x] Marketplace catalog cards in Addons hub (Communication → Live Chat)
- [x] `LiveChatAddonSettings.vue` + `LiveChatQueuesSettings.vue` + `LiveChatBotsSettings.vue` — post-install sub-hubs
- [x] `Settings.vue` + `SettingsLandingPage.vue` — tab **Addons** below Applications
- [x] `settingsTabAccess.ts` — `addons` case
- [x] i18n: `settings.tabAddons`, `settings.addons*`, sync keys

**Migration**

- [x] Orgs with `embed.chat.enabled` → auto-install `live_chat` addon (`migrateLiveChatLc0.js`)

---

### LC0 — Decouple from Helpdesk

**Backend**

- [x] Remove `handleChannelInteractionForHelpdesk` from `embedChatController.postMessage`
- [x] Gate embed on addon entitlement (not only `embed.chat.enabled`)
- [x] Mark case chat routes deprecated; log usage (`deprecateCaseChatApiMiddleware`)
- [x] Move embed config read/write from `mailroomSettingsController` → addon settings API
- [x] Add domain events: `LIVE_CHAT_SESSION_STARTED`, `LIVE_CHAT_MESSAGE_RECEIVED` (initial set)

**Frontend**

- [x] Remove embed chat section from `MailroomSettings.vue`
- [x] Add widget config to Addons → Live Chat → Settings
- [x] Case record links to session workspace via linked session card (legacy `CaseLiveChatPanel` deprecated)

**Data**

- [x] Migration script: existing `ChatSession` rows → new schema fields; move `caseRecordId` → `linkedRecords[]` where present (`migrateLiveChatLc0.js`)

---

### LC1 — Core sessions MVP

**Backend**

- [x] Evolve models: session lifecycle, `sessionKey`, visitor FK
- [x] `LiveChatVisitor` model
- [x] Agent API: list/open sessions, send message, SSE stream, mark read, end session
- [x] Permissions: `liveChat.view`, `liveChat.reply`, `liveChat.admin`
- [x] Default roles on install: Chat Administrator, Chat Supervisor, Chat Agent (system role templates)
- [x] Notifications: agent alert on inbound message (`LIVE_CHAT_MESSAGE_RECEIVED`)

**Frontend**

- [x] `LiveChatSessionsList.vue` + `LiveChatSessionPanel.vue` + `LiveChatSessionContextPanel.vue`
- [x] Routes: `/live-chat/sessions`, `/live-chat/sessions/:id`
- [x] Closed sessions: `/live-chat/closed`, `/live-chat/closed/:sessionId` (list + read-only detail)
- [x] Workspace nav: Sessions | Closed | Reports (`LiveChatWorkspaceNav.vue`)
- [x] Sidebar registration when addon installed
- [x] Case/People linked session cards; legacy case chat deprecated
- [x] Session list enrichment (queue, agents, message count) — `liveChatSessionEnrichmentService.js`
- [ ] Default field column set on open sessions list (parity with closed list) — **deferred** (sidebar UX)
- [x] Summary, Tags, CSAT on closed list + session context panel — **LC8a**

**QA**

- [x] `npm run smoke:live-chat`
- [ ] Sales-only tenant E2E sign-off (manual)

---

### LC2 — Queues & assignment

- [x] `LiveChatQueue` model + CRUD
- [x] Integrate Assignment Engine for `waiting` → `assigned` transitions (`liveChatSessionAssignmentAdapter`)
- [x] Agent presence states (online/busy/away/offline)
- [x] Settings → Live Chat → Queues UI
- [x] Manual session claim (`POST /sessions/:id/claim`)

---

### LC3 — Outcomes & Process Designer

- [x] Standard outcomes enum + tenant custom outcomes
- [x] Session close flow with outcome selection
- [x] Register PD triggers and missed-chat recipes
- [x] Unattended flow recipes (Helpdesk case, CRM lead, missed + notify)
- [x] **No transcript** in PD action payloads — session ref only

---

### LC4 — Application integration adapters

- [ ] PD action: Create Record / Link Record (generic module API)
- [x] Helpdesk: Case adapter stores session ref + outcome metadata on case
- [x] CRM: Lead/Person create + link from session; auto-link by visitor email
- [x] Case + People record: read-only linked session card
- [x] Validate uninstall blocked when `linkedRecords` exist (spec §19)

---

### LC5 — Bots

- [x] Bot definition model + admin UI (Settings → Addons → Bots)
- [x] Bot CRUD API (`/api/live-chat/bots`, admin permission)
- [x] Bot Handling lifecycle state (runtime) — `liveChatBotRuntimeService.js`
- [ ] PD-configured bot flows (greeting, FAQ, escalate)
- [ ] AI responses (optional; feature-flagged — LLM-backed; rule-based intent/sentiment shipped in LC8f)

---

### LC6 — Reporting

- [x] Operational snapshot: active, waiting, queue load, online agents, closed in period
- [x] Agent metrics: sessions handled, avg first response, avg handle time
- [x] Quality: outcome breakdown (missed, escalated, abandoned)
- [x] Business metrics: cases/people created & linked counts from `linkedRecords`
- [x] API: `GET /api/live-chat/reports/overview`, `GET /api/live-chat/reports/agents`
- [x] UI: `/live-chat/reports`
- [x] CSAT — `summarizeCsat()` in `liveChatReportingService` (avg + distribution)
- [x] Transfer counts and utilization depth — `summarizeTransfers()` + per-agent transfer metrics

---

### LC7 — Lifecycle & billing

- [x] Disable / archive: widget off, sessions readable
- [x] Uninstall: block when sessions have linked business records
- [x] Uninstall: export transcript option — `exportSessionTranscript` + `exportOrganizationTranscripts`
- [x] Trial expiry job → SUSPENDED + widget disabled
- [x] Settings → Subscriptions: addon line items
- [ ] Stripe hooks for addon billing (when billing phase ready)

---

### LC8 — Session field model & detail workspace

**Goal:** Implement the v2.0 **Chat Session** field contract (§6.2.1) with a **lean default** surface and **advanced** fields for enterprise tenants.

**Principle:** Default list/detail shows 14 fields only; everything else is advanced (tenant setting or per-user column customize).

#### LC8a — Default tier (ship first)

**Schema (`ChatSession`)**

- [x] `subject` (text, optional)
- [x] `tags` (string[], optional)
- [x] `summary` (long text, optional — agent or auto on close)
- [x] `csatScore` (number 1–5, optional)
- [x] `feedbackComment` (long text, optional)
- [x] `resolutionRating` (enum: excellent/good/average/poor, optional)

**Backend**

- [x] Extend `mapSessionRow` + enrichment for new fields
- [x] PATCH session API for agents: `summary`, `tags`, `subject` (permission: `liveChat.reply`)
- [x] End session accepts optional `summary`, `tags`
- [x] Post-chat CSAT capture on embed close (widget → `POST /embed/chat/sessions/:id/feedback`)
- [x] Migration script: `migrateLiveChatLc8a.js` (schema defaults; no backfill)

**Frontend**

- [x] Closed sessions list: Summary, Tags, CSAT columns (default 14-field set)
- [ ] Open sessions list: default column parity with closed list (sidebar UX — deferred)
- [x] Context panel: Summary, Tags, CSAT in chat details section
- [x] End-session flow: optional summary + tags
- [x] i18n keys for new fields; `npm run i18n:sync-keys`

**QA**

- [x] Unit tests: `liveChatSessionFields.test.js`
- [x] Extend `npm run smoke:live-chat` for PATCH session summary
- [ ] Extend `npm run smoke:live-chat` for embed feedback POST

#### LC8b — Timing & ownership (advanced)

**Schema**

- [x] `assignedAt`, `firstResponseAt` (Date, indexed)
- [x] `assignedBy` (enum: queue_routing | bot | manual | supervisor)
- [x] `transferCount` (number, default 0)
- [x] `agentsInvolved` (ObjectId[] ref User, system-maintained)
- [x] Computed API fields: `waitTime`, `firstResponseTime`, `handleTime` (from timestamps; not stored)

**Backend**

- [x] Set `assignedAt` / `assignedBy` on queue route, claim, bot handoff, manual assign
- [x] Set `firstResponseAt` on first agent outbound message
- [x] Increment `transferCount` + append `agentsInvolved` on transfer
- [x] Emit assignment events for related list
- [x] `POST /api/live-chat/sessions/:id/transfer` — agent/supervisor transfer
- [x] `GET /api/live-chat/sessions/:id/assignment-events`
- [x] Migration script: `migrateLiveChatLc8b.js`

**Frontend**

- [x] Timing fields in advanced section of context panel
- [x] Assignment History related list (date, action, agent, performed by)

**QA**

- [x] Unit tests: `liveChatSessionTimingUtils.test.js`

#### LC8c — Visitor journey & device (advanced)

**Schema**

- [x] `referrerUrl`, `entryPage`, `browser`, `operatingSystem`, `deviceType` (desktop/mobile/tablet), `country`, `language`
- [x] `LiveChatVisitorJourneyEvent` model: `{ sessionId, page, action, timestamp }`

**Backend**

- [x] Embed widget: capture referrer, UA parse (browser/OS/device), geo (optional), language
- [x] Persist journey events on page navigation (widget heartbeat or explicit events)
- [x] API: `GET /sessions/:id/journey`
- [x] Embed API: `POST /embed/chat/sessions/:id/journey`
- [x] Migration script: `migrateLiveChatLc8c.js`

**Frontend**

- [x] Visitor Journey related list (replace single-line `pageUrl` stub)
- [x] Journey + device fields in advanced context section
- [x] `chat.js` posts parent page context to widget iframe

**QA**

- [x] Unit tests: `liveChatVisitorContext.test.js`

#### LC8d — Visitor identity & core extensions (advanced)

**Schema**

- [x] `visitorType` (enum: anonymous | known_visitor | customer | partner)
- [x] `priority` (picklist, optional)
- [x] `internalNotes` (long text, agent-only)
- [x] `linkedContactId`, `linkedOrganizationId` (optional denormalized lookups; keep `linkedRecords` canonical)
- [x] `LiveChatSessionNote` model for notes related list

**Backend**

- [x] PATCH session: `visitorType`, `priority`, `internalNotes`
- [x] `GET/POST /api/live-chat/sessions/:id/notes`
- [x] Sync denormalized links on record link
- [x] Default `visitorType` on embed session create
- [x] Migration script: `migrateLiveChatLc8d.js`

**Frontend**

- [x] Visitor type + priority on session header / context
- [x] Internal notes (agent-only, not visible to visitor)
- [x] Notes related list (`LiveChatSessionNote` — author, note, created time)

**QA**

- [x] Unit tests: `liveChatSessionIdentity.test.js`

#### LC8e — Bot session fields (advanced; ties to LC5)

**Schema**

- [x] `botInvolved` (bool), `botEscalated` (bool), `botResolution` (enum), `botMessageCount` (number)

**Backend**

- [x] Populate from bot runtime on start, escalate, message, and session end
- [x] Migration script: `migrateLiveChatLc8e.js`

**Frontend**

- [x] Bot fields in context panel chat details when bot involved

**QA**

- [x] Unit tests: `liveChatBotSession.test.js`

**Transfer UI (LC8b completion)**

- [x] Transfer button + agent picker dialog on open session panel
- [x] `canTransferLiveChatSession` client permission helper

#### LC8f — Conversation intelligence (advanced; ties to LC5 AI)

**Schema**

- [x] `intent`, `sentiment`, `aiSummary`, `aiIntent`, `aiSentimentScore`

**Backend**

- [x] Rule-based analysis on session close (feature-flagged via `LIVE_CHAT_SESSION_INTELLIGENCE` or `settings.sessionIntelligenceEnabled`)
- [x] Agent PATCH for `intent`, `sentiment`, `aiSummary`
- [x] Migration script: `migrateLiveChatLc8f.js`

**Frontend**

- [x] Intelligence section in session context panel when fields present

**QA**

- [x] Unit tests: `liveChatSessionIntelligence.test.js`

#### LC8g — Operational metrics (advanced)

**Schema or enrichment**

- [x] `visitorMessageCount`, `agentMessageCount`, `attachmentCount`, `agentCount`
- [x] Extend `liveChatSessionEnrichmentService` + persist on session close

**Backend**

- [x] `liveChatSessionOperationalService` aggregation + close snapshot via `liveChatSessionCloseService`
- [x] Migration script: `migrateLiveChatLc8g.js`

**Frontend**

- [x] Operational metrics in context panel chat details

**QA**

- [x] Unit tests: `liveChatSessionOperational.test.js`

#### LC8h — Compliance (advanced; ties to LC7)

**Schema**

- [x] `consentGiven`, `consentTimestamp`, `sessionArchived`, `archiveDate`, `exported`

**Backend**

- [x] Widget consent banner + checkbox → persist on session create (`consentGiven`)
- [x] Widget settings: `consentRequired`, `consentMessage`, `privacyPolicyUrl`, `termsUrl`
- [x] `POST /sessions/:id/archive` — admin archive/restore
- [x] `GET /sessions/:id/export` — admin transcript JSON download (marks `exported`)
- [x] `GET /sessions/export` — bulk org transcript export (LC7 uninstall support)
- [x] Archived sessions hidden from default list unless `includeArchived=true` (admin)
- [x] Migration script: `migrateLiveChatLc8h.js`

**Frontend**

- [x] Consent settings in Live Chat addon settings
- [x] Compliance section in session context panel (consent, archive, export actions)

**QA**

- [x] Unit tests: `liveChatSessionCompliance.test.js`

#### LC8i — Field visibility & customize

- [x] `TenantAddonConfiguration.settings.sessionFields.defaultColumns[]` — override default 14
- [x] `TenantAddonConfiguration.settings.sessionFields.advancedEnabled` (bool)
- [x] Column customize drawer on closed sessions list (user prefs in localStorage)
- [x] Server-side field metadata endpoint: `GET /live-chat/session-fields`
- [x] Admin settings: `GET/PUT /settings/addons/live_chat/session-fields`
- [x] Migration script: `migrateLiveChatLc8i.js`

**Frontend**

- [x] `LiveChatSessionColumnCustomizeDrawer` + `useLiveChatSessionColumns` composable
- [x] `LiveChatSessionListCell` for dynamic column rendering
- [x] Session field settings in Live Chat addon settings

**QA**

- [x] Unit tests: `liveChatSessionFieldRegistry.test.js`
- [x] Permission: internal notes and compliance admin fields gated for non-admin users
- [x] Extend `npm run smoke:live-chat` for enriched session GET (`assertEnrichedSessionFields`)
- [ ] Extend `npm run smoke:live-chat` for embed feedback POST

---

## 9. Migration & backward compatibility

| Cohort | Treatment |
|--------|-----------|
| Tenants with Helpdesk + chat enabled today | Auto-install `live_chat` addon; migrate sessions; **stop auto-case** on cutover date; offer PD recipe “Create case on escalate” |
| Tenants with embed enabled, no Helpdesk | Already partially supported at embed layer; gain agent workspace at LC1 |
| Tenants without chat | See addon in Marketplace; install starts trial |
| In-flight sessions at cutover | Complete on old case UI for 30 days **or** hard cutover with session-only UI (product decision) |

**Recommended:** 30-day parallel run with deprecated case chat routes returning `410` + link to new session URL.

---

## 10. Testing & observability

| Area | Approach |
|------|----------|
| Unit | Session lifecycle, entitlement, outcome transitions, linkedRecords rules |
| Integration | Embed → agent reply; PD trigger on Message Received |
| E2E | Install addon from Settings hub; SALES-only tenant full flow |
| Smoke | `npm run smoke:live-chat` — sessions, reports, bots, PATCH, enriched GET; **remaining:** embed feedback POST |
| Analytics | PostHog: `addon_installed`, `live_chat_session_started`, `live_chat_session_ended` |
| Security | Transcript permission tests; queue visibility; embed instanceKey isolation |

---

## 11. Open product decisions

| # | Question | Recommendation |
|---|----------|----------------|
| 1 | Grandfather Live Chat for existing Helpdesk subscribers? | **N/A (pre-live)** — hard switch; no parallel migration window |
| 2 | Mailroom relationship | Live Chat **owns** messages; Mailroom optional for unified comms index later — not LC1 |
| 3 | Session ID format | Human-readable `CHAT-{n}` per spec |
| 4 | Concurrent agent licensing | **Per-agent** default (`PER_AGENT` in `addonPricingRegistry`); master-configurable via Settings → Addons → Addon pricing |
| 5 | Bot / AI scope in v1 | **Runtime shipped** (greeting, KB/website FAQ, escalate); PD bot flow recipes + LLM-backed AI deferred |

---

## 12. Dependencies & risks

| Risk | Mitigation |
|------|------------|
| Assignment Engine not generic enough for chat queues | Spike in LC2 week 1; extend rule context with `addonKey: live_chat` |
| Process Designer actions incomplete | Ship LC3 with Notify User + Create Record minimum; expand actions incrementally |
| Customers depend on case-embedded chat | Migration comms + case→session link + parallel period |
| Duplicate notification paths | Remove `notifyCaseChatMessageReceived` from chat path in LC0 |
| Settings hub proliferation | Single Addons hub; Live Chat is first addon template for future addons |

---

## 13. Success criteria (LC1 MVP)

Code-complete per codebase verification (2026-06-22). Formal manual sign-off pending.

- [x] **Addons** appears in Settings below Applications with Automation-style hub
- [x] Tenant can **install / disable** Live Chat without touching Applications
- [x] Embed widget works only when addon is entitled
- [x] Agent can manage conversations in **Live Chat → Sessions** without Helpdesk enabled
- [x] **No** automatic Case creation on inbound chat message
- [x] **No** chat transcript stored on Case activities
- [x] Existing embed URLs continue to work after migration (same publicKey)

---

## 14. Reference files (current implementation)

| Concern | Path |
|---------|------|
| Embed controller | `server/controllers/embedChatController.js` |
| Case chat deprecation | `server/middleware/deprecateCaseChatApiMiddleware.js` |
| Models | `server/models/ChatSession.js`, `ChatMessage.js`, `LiveChatVisitor.js` |
| Bot runtime | `server/services/liveChatBotRuntimeService.js`, `liveChatBotKnowledgeService.js` |
| Session enrichment | `server/services/liveChatSessionEnrichmentService.js` |
| Reporting | `server/services/liveChatReportingService.js` |
| Transcript export | `server/services/liveChatSessionComplianceService.js` |
| Smoke checks | `server/scripts/liveChatSmokeChecks.js` |
| Closed sessions UI | `client/src/views/live-chat/LiveChatClosedSessionsView.vue`, `LiveChatClosedSessionDetailView.vue` |
| Open sessions UI | `client/src/views/live-chat/LiveChatSessionsView.vue`, `LiveChatSessionsList.vue` |
| Session display utils | `client/src/utils/liveChatSessionDisplay.js` |
| Addons hub | `client/src/components/settings/AddonsSettings.vue`, `LiveChatAddonSettings.vue` |
| Automation hub pattern | `client/src/components/settings/AutomationSettings.vue` |
| Subscription / trial | `server/models/OrganizationSubscription.js`, `addonBootstrapService.js` |
| Settings tabs | `client/src/views/Settings.vue`, `settingsTabAccess.ts` |

---

## 15. Final lock statement (from spec)

The Live Chat Addon is an optional, installable communication capability. It owns sessions, visitors, transcripts, queues, bots, and outcomes. It operates independently of Helpdesk while integrating through Process Designer. Business applications own business obligations; Live Chat owns the conversation lifecycle. **Addons are tenant-specific entitlements** installed from **Settings → Addons**, with Live Chat as the first canonical addon implementation.
