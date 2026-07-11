# Arivu Platform — Architecture Reference (LLM Context)

> **Repo:** `LiteDesk` · **Product:** Arivu · **Pattern:** Platform Core + Multi-App CRM/Helpdesk/Audit/Portal  
> **Purpose:** Single pinned reference for development. Dense facts only; no tutorials.

---

## 1. System Tech Stack Overview

### Runtime & Monorepo Layout

| Layer | Path | Stack |
|-------|------|-------|
| Frontend SPA | `client/` | Vue 3.5, Vite 7, TypeScript 5.9, Vue Router 4, Pinia 2 |
| API + workers | `server/` | Node 20.19+/22.12+, Express 5, Mongoose 8 |
| Orchestration | `helm/arivu/`, `docker-compose.yml` | K8s per-tenant instances, Railway |
| Docs (human) | `docs/architecture/` | Living specs; this file supersedes broad codebase search |

### Frontend Core

| Concern | Choice | Location / Notes |
|---------|--------|------------------|
| UI framework | Vue 3 SFC + `<script setup>` / mixed JS-TS | `client/src/components/`, `client/src/views/` |
| Styling | Tailwind CSS 4 (`@tailwindcss/vite`) | `client/src/assets/` |
| State | **Pinia** (6 stores only) | `client/src/stores/` — `auth`, `appShell`, `notifications`, `notificationPreferences`, `activeImports`, `authRegistry` |
| Routing | Static + **dynamic registry routes** | `client/src/router/index.js`, `dynamicRoutes.js`, `audit.routes.js`, `portal.routes.js` |
| HTTP | `apiClient.js` wrapper over `fetch` | JWT from auth store; dedup + TTL caches; `installFetchApiBase.ts` patches global `fetch` |
| i18n | `vue-i18n` 11 | `client/src/locales/{lang}/*.json`; keys lowerCamelCase, max 3 segments |
| Rich UI libs | Headless UI, Heroicons, TipTap, FullCalendar, Chart.js, Vue Flow, GridStack, DOMPurify | Per feature area |
| Observability | Sentry (`@sentry/vue`), PostHog (`posthog-js`) | `client/src/config/` |
| Tests | Vitest | `client/src/tests/` |

### Backend Core

| Concern | Choice | Location / Notes |
|---------|--------|------------------|
| HTTP | Express 5 | `server/server.js` — route mount table below |
| ODM | Mongoose 8 | `server/models/` (~107 schemas) |
| Auth | JWT (`jsonwebtoken`) + `protect` middleware | `server/middleware/authMiddleware.js` |
| Jobs | **Bull** + Redis | `server/worker.js` — email send, inbound email, imports |
| Scheduling | `node-cron` | Various `server/services/*Scheduler*` |
| Email | Nodemailer, AWS SES SDK, mailparser | `server/services/email*`, `server/platform/mailroom/` |
| Files | Multer + local/S3 uploads | `server/uploads/`, `server/routes/uploadRoutes.js` |
| Observability | Sentry Node | `server/lib/sentryNode.js` |

### Data Stores & Tenancy

| Store | Role |
|-------|------|
| **Master MongoDB** | Default DB name `arivu_master` (`MASTER_DB_NAME`). Platform metadata, org registry, users when no dedicated tenant DB |
| **Per-org tenant DB** | Optional `organization.database.name` + `database.initialized`; connection via `databaseConnectionManager` + `tenantContext` AsyncLocalStorage |
| **Redis** | Bull queues (`REDIS_URL` / `REDIS_HOST`); rate-limit store optional |
| **Browser localStorage** | Auth user/org, API metadata cache keys `arivu:api-cache:*` |

### Third-Party Integrations (Primary)

| Integration | Use |
|-------------|-----|
| MongoDB Atlas / self-hosted | Primary persistence |
| Redis | Queue backend |
| AWS (SES, S3, Route53 via `aws-sdk` / `@aws-sdk/client-ses`) | Email, storage, DNS provisioning |
| Google APIs (`googleapis`) | Gmail/calendar connect flows |
| Kubernetes (`@kubernetes/client-node`) | Multi-instance provisioning |
| Stripe fields on `Organization.subscription` | Billing hooks (customer/subscription IDs) |
| Web Push (`web-push`) | Browser push subscriptions |
| Sentry | Error tracking |
| PostHog | Product analytics (client) |

### Application Keys (`server/constants/appKeys.js`)

`SALES` | `HELPDESK` | `PROJECTS` | `PORTAL` | `AUDIT` | `LMS` | `CONTROL_PLANE`  
**Default unresolved API path:** `SALES` (legacy `/api` namespace).

---

## 2. Directory Map

### Repository Root

```
LiteDesk/
├── client/                 # Vue SPA
├── server/                 # Express API + worker
├── docs/                   # Architecture, runbooks, specs
├── helm/arivu/             # K8s charts
├── scripts/                # Ops / archive utilities
├── Architecture_Document.md
├── README.md, GETTING_STARTED.md, TECHNICAL_SPEC.md
└── SECURITY_*.md           # Security gates for PRs
```

### Frontend (`client/src/`)

| Path | Responsibility |
|------|----------------|
| `main.ts` | App bootstrap: Pinia, i18n, router, fetch base, color mode |
| `App.vue` | Shell layout, tabs, sidebar slot |
| `router/` | Route defs, `appAccessGuards.ts`, dynamic route registration |
| `views/` | Page-level routes (Deals, People, GenericModule, Settings, Inbox, platform/*) |
| `components/` | Feature UI (deals, cases, settings, record-page, inbox, catalog, …) |
| `components/record-page/` | Shared record layout: sections, activity, comments, neighbors |
| `composables/` | Reusable logic (`useTabs`, `useRecordContext`, `useNotificationStream`, …) |
| `stores/` | Pinia: auth session, notifications, app shell |
| `platform/` | **Contracts:** field models, permissions vocabulary, filters, form defs |
| `platform/fields/` | `fieldCapabilityEngine.ts`, `globalSystemFields.ts`, per-module `*FieldModel.ts` |
| `utils/` | `apiClient.js`, `buildSidebarForSession.ts`, `buildModuleListFromRegistry.ts`, registry builders |
| `types/` | TS types (commands, audit, metrics) |
| `locales/` | i18n JSON per language/module |
| `config/` | `apiBase.ts`, PostHog, debug flags |
| `services/` | Audit offline sync, notification realtime helpers |
| `constants/` | Case lifecycle, catalog, app-specific enums |
| `tests/` | Vitest unit/regression |

**Registry-driven UI pipeline (client):**

`GET /api/ui/*` → `buildSidebarForSession` / `buildModuleListFromRegistry` / `dynamicRouteLoader` → `GenericModule.vue` or dedicated views.

### Backend (`server/`)

| Path | Responsibility |
|------|----------------|
| `server.js` | Express app, middleware order, `/api/*` mount |
| `worker.js` | Bull workers (email, inbound, import) |
| `routes/` | 74 route modules → controllers |
| `controllers/` | Request handlers (CRUD, UI composition, mailroom, cases, …) |
| `models/` | Mongoose schemas; most wrapped with `wrapTenantModel` |
| `middleware/` | Auth, org isolation, app context, permissions, uploads, rate limits |
| `services/` | Business logic (notifications, deletion, mailroom, SLA, provisioning, search) |
| `permissions/` | Permission string constants per domain |
| `constants/` | `appKeys`, `domainEvents`, `caseLifecycle`, `instanceLifecycle`, … |
| `utils/` | `tenantModelProxy`, `tenantContext`, `customFieldsExtractor`, validators |
| `lib/` | `mongoConnect.js`, `redisClient.js`, Sentry |
| `config/` | `validateEnv.js`, `corsConfig.js`, `awsConfig.js` |
| `platform/mailroom/` | Inbound email pipeline (policy, threading, cases adapter) |
| `services/provisioning/` | K8s / instance lifecycle |
| `scripts/`, `migrations/` | One-off migrations and smoke checks |
| `tests/` | Node native test runner integration tests |

### API Route Prefix Map (`server/server.js`)

| Prefix | Domain |
|--------|--------|
| `/api/auth` | Login, register, token refresh |
| `/api/users`, `/api/roles` | Users, RBAC roles |
| `/api/organization`, `/api/v2/organization`, `/api/organizations` | Tenant org + SALES org entities |
| `/api/people` | People (contacts/leads) v2 |
| `/api/deals`, `/api/tasks`, `/api/events` | Sales core |
| `/api/items`, `/api/catalog` | Product catalog v2 |
| `/api/forms`, `/api/public/forms` | Form builder + public submit |
| `/api/helpdesk/cases` | Helpdesk cases |
| `/api/quotes`, `/api/public/quotes` | CPQ quotes |
| `/api/communications`, `/api/mailboxes`, `/api/inbox` | Email threads + workspace inbox |
| `/api/mailroom` | Inbound processing API |
| `/api/modules` | Generic module records + unified record API |
| `/api/ui` | Sidebar, routes, registry, projection metadata |
| `/api/config-registry` | Tenant field/pipeline config |
| `/api/relationships` | Relationship instances + record context |
| `/api/notifications`, `/api/notification-*` | In-app notifications + preferences + rules |
| `/api/settings` | Module/field settings |
| `/api/audit`, `/api/audit/execute`, `/api/audit/assignments` | Audit app |
| `/portal` | Portal app routes |
| `/api/admin/*` | Cross-tenant admin, automation, processes, business flows |
| `/api/instances`, `/api/demo`, `/api/metrics` | Control plane / provisioning |
| `/api/platform` | Platform home, inbound parser config |
| `/api/trash` | Soft-delete restore/purge |
| `/api/webhooks/*` | Email, Arivu inbound, process hooks |
| `/health` | Public health |

### Types & Shared Contracts

| Location | Contents |
|----------|----------|
| `client/src/types/` | Command palette, audit schedule, sales metrics |
| `client/src/platform/**/*.ts` | Field editability, permission helpers, filter resolver |
| `server/constants/` | Enums shared with validators |
| `server/permissions/` | Server-side permission keys aligned with `Role.appPermissions` |

### Database Access Hooks

| Mechanism | File | Behavior |
|-----------|------|----------|
| `wrapTenantModel(Model)` | `server/utils/tenantModelProxy.js` | Proxy routes all queries to tenant connection when `tenantContext` active |
| `enterTenantContext(conn, fn)` | `server/utils/tenantContext.js` | AsyncLocalStorage scope for tenant DB |
| `organizationIsolation` | `server/middleware/organizationMiddleware.js` | Loads org, opens tenant DB if configured, sets `req.organization` |
| `organizationId` on schemas | All tenant models | **Required** filter on every query |
| Master-only models | No `wrapTenantModel` | `Organization`, `ModuleDefinition`, `AppDefinition`, `Instance`, `InstanceRegistry`, `DemoRequest`, `RelationshipDefinition`, `TenantAppConfiguration`, platform parser config |

---

## 3. Core Database Schema & Data Models

### Tenancy & Identity

#### Organization (`organizations`) — **Dual-purpose document**

| `isTenant` | Role | Key fields |
|------------|------|------------|
| `true` | Workspace/tenant | `slug`, `subscription`, `limits`, `enabledApps[]`, `database.name`, `database.initialized`, settings |
| `false` | SALES **account** (company) | SALES fields: types, tiers, status; `organizationId` points to tenant |

**Relations:** Parent of all tenant data via `organizationId`. SALES org records link to tenant org via tenant's `organizationId`; People may reference SALES org in field `organization` (ref Organization, not tenant).

#### User (`users`) — tenant-scoped via proxy

| Field | Notes |
|-------|-------|
| `organizationId` | Tenant FK (required) |
| `email`, `password` (bcrypt), `firstName`, `lastName` | Identity |
| `roleId` → `Role` | Preferred RBAC |
| `role` | Legacy enum: owner/admin/manager/user/viewer |
| `permissions` | **Legacy CRM-shaped**; synced from role on login — prefer `Role.appPermissions` |
| `allowedApps[]` | Per-user app entitlements |
| `businessHourSetId` | Optional SLA/business-hours override |

#### Role (`roles`)

| Field | Notes |
|-------|-------|
| `organizationId` | Tenant FK |
| `appPermissions` | `Map<appKey, { module: { action: boolean, scope? } }>` — **source of truth** |
| `permissions` | Legacy CRM module CRUD + `scope: all|team|own|none` |
| `isSystemRole`, `level`, `parentRole` | Hierarchy |

#### Instance (`instances`) — master DB

Lifecycle per tenant: `status` (DEMO→ACTIVE→…), `organizationId` (unique), `demoRequestId`, `isInternal`.

---

### CRM Core (SALES)

#### People (`people`) — **Replaces legacy Contact**

| Group | Fields |
|-------|--------|
| Core | `first_name`, `last_name`, `email`, `phone`, `mobile`, `tags`, `assignedTo`, `createdBy`, `source` |
| Company link | `organization` → SALES Organization (company) |
| SALES-only scalar | `lead_owner`, `lead_score`, `estimated_value`, `role` (contact role enum), `birthday`, … |
| App data | `participations.{APP_KEY}.*` — **SALES:** `role` (Lead/Contact), `lead_status`, `contact_status` (sole source of truth) |
| System | `derivedStatus`, `customFields`, `activityLogs[]`, `descriptionVersions[]` |
| Trash | `deletedAt`, `deletedBy`, `deletionReason` |

**Indexes:** `organizationId` + email, assignedTo, participation paths, `deletedAt`.

#### Deal (`deals`)

| Group | Fields |
|-------|--------|
| Core | `name`, `amount`, `amountMode` (`AUTO`\|`MANUAL`), `linesGrandTotal`, `currency`, `stage`, `stageOrder`, `probability`, `pipeline` |
| Dates | `expectedCloseDate`, `actualCloseDate` |
| Legacy FK | `contactId` → People, `accountId` → Organization |
| Multi-relation | `dealPeople[]`, `dealOrganizations[]` (role, isPrimary) |
| Commercial lines | **`DealLine`** entity (`dealId` FK) — expected commercial intent; not embedded `lineItems` |
| Meta | `assignedTo`, `customFields`, trash fields, activity/description versions |
| Platform-owned | `status` (`Open` \| `Won` \| `Lost`), `derivedStatus`, `lostReason` |

**Deal ↔ Organization relationships (platform doctrine):**

- A Deal may link **multiple** organizations via `dealOrganizations[]` (`organizationId`, `role`, `isPrimary`, `isActive`).
- **`role`** is the **Deal Relationship Role** (how the org is involved in *this* deal). It is **not** Organization Type.
- System roles: `customer`, `partner`, `reseller`, `distributor`, `vendor`, `other`.
- Organization Type answers “What is this organization?” and is used only as a **default** when linking; after creation the stored role is independent.
- **Exactly one** Primary organization is required when any orgs are linked. Primary **must** have `role=customer` (setting Primary on a non-customer coerces role to `customer`).
- Legacy `accountId` syncs to/from the primary customer entry for backward compatibility.

**Deal ↔ People relationships (platform doctrine):**

- A Deal may link **multiple** people via `dealPeople[]` (`personId`, `role`, `isPrimary`, `isActive`).
- **One person appears at most once** on a Deal; changing involvement updates the existing row.
- **`role`** is the **Deal Person Role** (buying/participation role on *this* deal). It is **not** Person Type (Lead/Contact) and is **not** Primary.
- System roles: `decision_maker`, `champion`, `influencer`, `technical_contact`, `partner_contact`, `procurement`, `legal`, `other`.
- **`isPrimary`** identifies the main contact the sales team works with. It is **independent** of `role` (e.g. ⭐ Influencer is valid). Editing Primary never overwrites role; editing role never affects Primary.
- If any people are linked, **exactly one** must be Primary. Defaults: first person → Primary + Decision Maker; subsequent → Influencer (both editable before add).
- Legacy `contactId` syncs to/from the Primary person (`isPrimary=true`) for backward compatibility.

**Deal amount doctrine:**

- **`Deal.amount`** is the single canonical expected value for reports, dashboards, APIs, and workflows.
- **`amountMode=MANUAL`** — user owns `amount`; DealLines are optional intent and do not overwrite amount.
- **`amountMode=AUTO`** — `DealPricingService` writes `amount` from DealLine grand total. Mode transitions are explicit (no `amount` + `AUTO` in the same request).
- DealLines snapshot catalog/pricing fields (`skuSnapshot`, `nameSnapshot`, `expectedUnitPrice`, …) and carry `pricingVersion`.
- Quote generation must go through **`CommercialConversionService`** — Quote must not read DealLines directly.

**Stage vs Status (platform doctrine):**

- **Stage** — tenant-configurable pipeline position (workflow). Settings → Pipelines owns stage labels and stage outcome (`open` / `won` / `lost`).
- **Status** — platform-owned **execution state**, derived from Stage. Not a business field. Canonical values only: `Open`, `Won`, `Lost`.
- Status is **read-only** in normal operation (API + UI). Direct writes are rejected (`STATUS_WRITE_PROTECTED`). Only stage-driven derivation, data migrations, or internal maintenance scripts may set Status.
- **Lost Reason** (`lostReason`) holds business nuance for losses (including former `Abandoned`). Do not reintroduce `Stalled` / `Active` / `Abandoned` as Status values — use health/metrics for stall signals.
- Reporting, dashboards, forecasting, automations, and open-pipeline filters key off Status, not Stage labels.

#### Task (`tasks`)

`title`, `description`, `status`, `priority`, `assignedTo`, `relatedTo.{type,id}` (contact/deal/project/organization), `dueDate`, trash fields.

#### Event (`events`)

`eventId` (UUID), `eventName`, `eventType` (Meeting, Internal Audit, External Audit…), `status` (Planned/Completed/Cancelled), scheduling fields, audit execution linkage, `auditHistory[]`, geo/beat fields for field sales.

#### Item / Catalog (`items`, `itemvariants`, `catalogcategories`, `catalogpricebooks`, …)

Product catalog v2: variants, price books, bundles, lifecycle state, media gallery.

#### Form (`forms`) + FormResponse (`formresponses`)

Form definitions (sections, scoring, KPIs); responses with submission state, audit linkage, numbering per org.

#### Quote (`quotes`, `quotelines`, `quotesections`, `quoteapprovals`, `quotedocuments`)

CPQ with approvals, PDF generation, public share tokens.

---

### Helpdesk

#### Case (`cases`)

| Field | Notes |
|-------|-------|
| `caseId` | Human-readable unique id |
| `title`, `description`, `status`, `priority`, `type`, `channel` | Lifecycle enums in `server/constants/caseLifecycle.js` |
| `requesterId`, `assigneeId`, `groupId` | Ownership |
| `slaCycles[]` | Response/resolution clocks, pause segments |
| `activities[]` | Embedded case activity log |
| Relations | People/org links via relationships + FK fields per controller |

**Related:** `responsetemplates` (canned responses), mailroom messages → case adapter.

---

### Cross-Cutting Platform Models

| Collection | Purpose |
|------------|---------|
| `relationshipinstances` | Directed links: `{relationshipKey, source.{appKey,moduleKey,recordId}, target.*}` |
| `relationshipdefinitions` | Metadata: allowed module pairs (master) |
| `tenantmoduleconfigurations` | Per-tenant field layouts, pipelines, picklists |
| `recordactivities` | Normalized activity feed entries |
| `notifications` / `notificationrules` / `notificationpreferences` | Rules engine + user prefs |
| `automationrules` / `automationexecutions` | Workflow automation |
| `processes` / `processexecutions` | Visual process designer runtime |
| `communications` / `communicationthreadmeta` / `mailboxes` | Email sync threads |
| `mailroomconversations` / `mailroommessages` / `mailroomrawpayloads` | Inbound email pipeline |
| `import_histories` | CSV/import job tracking |
| `trashsnapshots` | Soft-delete snapshots |
| `reports` | Saved report definitions |
| `targets` / `targetassignments` | Goals/KPIs module |
| `businessflow` / `businesshoursets` / `holidaycalendars` | SLA and automation timing |
| `auditassignments` / `auditexecutioncontexts` / `audittimelines` | Audit app workspace |
| `pushsubscriptions` | Web push endpoints |
| `groups` | Team/group membership |
| `userpreferences` | Per-user UI prefs |

### Entity Relationship Summary (ASCII)

```
Tenant Organization (isTenant=true)
  ├── Users, Roles
  ├── People ──┬── participations.SALES (lead/contact)
  │            └── organization → SALES Organization (isTenant=false)
  ├── Deals ──── dealPeople → People, dealOrganizations → SALES Organization
  ├── Tasks, Events, Items, Forms, Quotes
  ├── Cases (HELPDESK)
  ├── RelationshipInstances (any module ↔ any module)
  └── TenantModuleConfiguration (fields, stages, pipelines)

Master DB: ModuleDefinition, AppDefinition, Instance, DemoRequest, InstanceRegistry
```

---

## 4. Key API Contracts & Data Flow

### Standard Authenticated Request Chain

```
HTTP Request
  → securityHeaders, compression, CORS
  → express.json (10mb cap)
  → api rate limiter (/api)
  → csrfProtection (mutating routes)
  → protect (JWT → req.user)
  → resolveAppContext (req.appKey from URL/query)
  → requireAppEntitlement (user.allowedApps + org.enabledApps)
  → organizationIsolation (req.organization + tenant DB context)
  → checkPermission / requirePermission (module/action)
  → [lazySalesInitialization | requireSalesApp | requireHelpdeskApp …]
  → controller → service → Model (tenant proxy)
  → domain event → notificationEngine (async)
```

### Auth Contract

| Endpoint | Method | Response |
|----------|--------|----------|
| `/api/auth/login` | POST | `{ user, organization, token }` — user includes legacy `permissions`, `allowedApps` |
| `/api/users/profile` | GET | Refreshes user + org; client caches in Pinia + localStorage |

**Client:** `Authorization: Bearer <token>` on all `apiClient` calls. Token stored on `auth.user.token`.

### Session Bootstrap (Client Cold Start)

```
Login → auth store persisted
  → router.beforeEach (requiresAuth)
  → initializeDynamicRoutes():
       GET /api/ui/registry | /api/ui/routes | /api/ui/sidebar
       → register dynamic routes
  → GenericModule / record pages fetch module metadata
```

Caches: in-memory + localStorage TTL (5m metadata, 30s people/activity/relationships).

### People API (v2 — canonical contact/lead)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/people/create` | Resolver: create or attach with `appKey` |
| `POST /api/people/:id/attach` | Add app participation |
| `POST /api/people/:id/detach` | Remove app participation |
| `POST /api/people/:id/convert-lead-to-contact` | SALES lifecycle |
| `GET /api/people/:id/profile` | Composed profile (core + participations) |
| `PUT /api/people/:id/update-core` | Core fields only |
| `PUT /api/people/:id/update-app-fields` | `participations.{appKey}` |
| `GET/POST/PUT/DELETE /api/people` | List/create/update/delete (delete → trash via deletionService) |

### Deals API (representative CRUD)

| Endpoint | Permission |
|----------|------------|
| `GET /api/deals` | `deals.view` + ownership filter |
| `POST /api/deals` | `deals.create` |
| `GET/PUT/DELETE /api/deals/:id` | view/edit/delete |
| `PATCH /api/deals/:id/stage` | edit (pipeline drag) |

### Unified Module Record API

Base: `/api/modules/:moduleKey/records/:recordId/`

| Endpoint | Purpose |
|----------|---------|
| `POST .../batch` | Bulk fetch by ids |
| `GET .../activity` | Merged activity + comments |
| `GET/POST .../comments` | Comment thread |
| `GET .../neighbors` | Prev/next list navigation |

Used by `ModuleRecordPage` for **all** registry modules (deals, cases, tasks, …).

### UI Composition API

| Endpoint | Returns |
|----------|---------|
| `GET /api/ui/apps` | Enabled apps for org |
| `GET /api/ui/sidebar` | Navigation tree |
| `GET /api/ui/routes` | Dynamic route definitions |
| `GET /api/ui/apps/:appKey/modules` | Module list for app |
| `GET /api/ui/projection/:appKey/:moduleKey` | Create-form field projection |
| `GET /api/ui/registry` | Full bootstrap payload |

### Config Registry

`GET/PUT /api/config-registry/*` — pipelines, stages, picklists, lifecycle maps (drives `derivedStatus`, deal stages, case statuses).

### Relationships API

`GET /api/relationships/record-context` — related records for record page widgets.  
`POST /api/relationships/links` — create `RelationshipInstance`.

### Trash

`DELETE` on trashable modules → `deletionService.moveToTrash()` (not `Model.deleteOne`).  
`/api/trash` — list, restore, permanent purge.

### Real-Time Updates (No WebSocket)

| Channel | Transport | Client | Server |
|---------|-----------|--------|--------|
| Notifications | **SSE** | `useNotificationStream` / `notificationRealtimeService` | `notificationEngine` → `notificationSSEDeliver` |
| Inbox refresh | **SSE** | `useInboxStream` | `inboxSSEHub` |
| Push (offline) | Web Push | service worker (audit scope) | `pushService` |

**Polling fallback:** notification store refresh on focus/route change.

### Async / Background

| Queue | Worker | Trigger |
|-------|--------|---------|
| `email-send` | `worker.js` | Outbound communications |
| Inbound email | `worker.js` | Webhooks → mailroom pipeline |
| Import jobs | `worker.js` | CSV upload |

### Public (Unauthenticated) Routes

`/api/public/forms`, `/api/public/book`, `/api/public/quotes`, `/api/public/appointments/manage`, `/api/public/mailroom`, `/embed/chat` — token/slug scoped; no JWT.

### Audit App Proxy Pattern

Audit routes (`/api/audit/execute/*`) proxy execution to SALES event/form engines. Audit stores assignment + timeline; SALES owns state machines.

---

## 5. Architectural Rules & Edge Cases

### Multi-Tenancy

| Rule | Detail |
|------|--------|
| Always filter by `organizationId` | From `req.user.organizationId` or `req.organization._id` |
| Never trust client org id | Unless `DISABLE_SECURITY=true` dev bypass (requires token or `organizationId` query) |
| Tenant DB | When `organization.database.initialized`, all `wrapTenantModel` calls hit dedicated DB |
| Master org | `Arivu Master` — platform admin operations only |
| `Organization` model | **Not** tenant-proxied; query with explicit tenant id |

### App Entitlements

| Check | Location |
|-------|----------|
| Org enabled | `organization.enabledApps[].appKey` + `status: ACTIVE` |
| User allowed | `user.allowedApps[]` |
| Middleware | `requireAppEntitlement` after `resolveAppContext` |
| App-specific gates | `requireSalesApp`, `requireHelpdeskApp`, `requireAuditApp`, `requirePortalApp` |
| Client guard | `buildAppAccessProfile`, `appAccessGuards.ts`, `auth.hasAppAccess(appKey)` |

**URL → appKey:** `/api/helpdesk` → HELPDESK; `/api/audit` → AUDIT; `/api` default → SALES.

### Permissions

| Layer | Rule |
|-------|------|
| Source of truth | `Role.appPermissions[appKey][module][action]` |
| Legacy sync | `User.permissions` CRM-shaped — still checked by `checkPermission('deals','view')` |
| Owner/admin bypass | `isOwner` or role admin → allow in middleware + client `hasPermission` |
| Scope | `all` / `team` / `own` / `none` on legacy role permissions — `filterByOwnership` on lists |
| Platform contract | Client `platform/permissions` is **explanation-only in DEV** — not enforcement |
| People-specific | `PEOPLE_PERMISSIONS` constants; attach/detach/lifecycle require `appKey` in body |

### People / Contact Migration Rules

| Rule | Detail |
|------|--------|
| Canonical module key | `people` (not `contacts`) |
| SALES lead/contact | Only in `participations.SALES` |
| Legacy `contactId` on Deal | Still supported; prefer `dealPeople` |
| Permission alias | Client maps `people` → `contacts` for legacy permission checks |
| Do not set `createdBy` after create | Mongoose pre-hook blocks updates |

### System Fields (Never in Create/Edit UI)

Add to **three** places: `moduleController.getBaseFieldsForKey` excluded Set, `globalSystemFields.ts`, `customFieldsExtractor.RESERVED_KEYS`.

Current globals: `deletedAt`, `deletedBy`, `deletionReason`.

### Trash / Deletion

| Trashable modules | people, organizations, deals, tasks, events, items, responses (non-audit) |
| Service | `deletionService.moveToTrash` — dependency blocking returns `{ blocked, dependencies }` |
| Forbidden | Direct `Model.deleteOne` / `findByIdAndDelete` on trashable models in controllers |

### Field & Form Rendering (Client)

| Rule | Detail |
|------|--------|
| Capabilities | `fieldCapabilityEngine.ts` — `canEditField`, `isSystemField` |
| Labels | `useFieldLabel`, `resolveFieldLabel`, i18n `sysField*` keys |
| Custom fields | Stored in `customFields` Mixed; extracted server-side |
| Registry modules | Render via `GenericModule.vue` + server module definition |
| Dedicated views | People, Deals, Events retain specialized list/detail surfaces |
| Tabs | `useTabs` — browser-like record tabs; persist session state |
| Projections | Create drawers use `GET /api/ui/projection/:appKey/:moduleKey` |

### i18n (Required for New UI)

All user-visible strings: `t('namespace.key')`. No module-scope `useI18n` in `.js` composables. Run `npm run i18n:check` in CI.

### Security Edge Cases

| Topic | Rule |
|-------|------|
| `DISABLE_SECURITY` | Opt-in only; do not rely on first-user impersonation |
| CSRF | Enabled on `/api` mutating routes |
| Rate limits | `apiLimiter`, `sessionBootstrapLimiter` on hot paths |
| Uploads | Served from `/api/uploads` with org-scoped paths |
| Idempotency | `apiClient` auto-adds idempotency key for `POST /communications/email` |

### Settings / Surfaces / Work

| Mode | Purpose | Examples |
|------|---------|----------|
| Settings | Configure modules, fields, automation | `client/src/views/Settings.vue`, `/api/settings` |
| Surfaces | Navigation shells | Sidebar, platform home, inbox |
| Work | Execute on records | Record pages, deal pipeline, case desk |

### Domain Events & Notifications

Emit via `server/constants/domainEvents.js` patterns; `notificationEngine` delivers in-app/email/SMS per rules. SSE publish is fire-and-forget (failures logged, never throw to caller).

### Naming / Legacy Aliases

| Legacy | Current |
|--------|---------|
| CRM | SALES app |
| Contact | People |
| `enabledModules` | Deprecated → `enabledApps` |
| `/dashboard` | Redirects → `/sales/dashboard` |

### Control Plane vs Tenant

| Concern | Location |
|---------|----------|
| Demo → instance provision | `/api/demo`, `/api/instances`, `Instance`, `DemoRequest` |
| Admin cross-org | `/api/admin/*` + `isPlatformAdmin` / master org checks |
| Metrics | `/api/metrics` |

### When Adding Features (Checklist)

1. Model: `organizationId` + consider `wrapTenantModel` vs master-only  
2. Routes: mount in `server.js`; apply middleware chain for app  
3. Permissions: extend `Role.appPermissions` + server `requirePermission`  
4. Client: registry entry if list module; field model in `platform/fields/`  
5. Trashable? → `deletionService` only  
6. System fields? → triple exclusion list  
7. i18n keys + `i18n:check`  
8. Real-time? → SSE hub pattern, not WebSocket  

---

## Appendix: Pinia Store Responsibilities

| Store | State / Actions |
|-------|-----------------|
| `auth` | `user`, `organization`, login/logout, `hasPermission`, `hasAppAccess`, profile refresh |
| `appShell` | Active app, sidebar collapse, layout chrome |
| `notifications` | In-app notification list, unread counts, SSE merge |
| `notificationPreferences` | Per-channel/module prefs |
| `activeImports` | Import job progress |

---

## Appendix: Key File Index (Quick Lookup)

| Need | File |
|------|------|
| Express mounts | `server/server.js` |
| Auth | `server/middleware/authMiddleware.js` |
| Tenant DB | `server/middleware/organizationMiddleware.js` |
| API client | `client/src/utils/apiClient.js` |
| Dynamic routes | `client/src/utils/dynamicRouteLoader` (via router) |
| Sidebar | `client/src/utils/buildSidebarForSession.ts` |
| Field policy | `client/src/platform/fields/fieldCapabilityEngine.ts` |
| Soft delete | `server/services/deletionService.js` |
| Notifications | `server/services/notificationEngine.js` |
| App keys | `server/constants/appKeys.js` |
| Architecture (extended) | `docs/architecture/architecture.md` |

---

*Generated for LLM context pinning. Update when adding apps, routes, or breaking schema changes.*
