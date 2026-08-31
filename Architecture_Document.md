# Arivu Platform — Architecture Reference (LLM Context)

> **Repo:** `Arivu` · **Product:** Arivu · **Pattern:** Platform Core + Multi-App CRM/Helpdesk/Audit/Portal + Commercial + Marketing + Analytics  
> **Purpose:** Single pinned reference for development. Dense facts only; no tutorials.  
> **Refreshed:** 2026-07-16 from live `server/server.js`, `appKeys.js`, `models/`, `client/` (not from older docs).

---

## 1. System Tech Stack Overview

### Runtime & Monorepo Layout

| Layer | Path | Stack |
|-------|------|-------|
| Frontend SPA | `client/` | Vue 3.5, Vite 7, TypeScript 5.9, Vue Router 4, Pinia 2; Node `^20.19 \|\| >=22.12` |
| API + workers | `server/` | Node 20.19+/22.12+, Express 5.1, Mongoose 8.19 |
| Orchestration | `helm/arivu/`, `docker-compose.yml` | K8s per-tenant instances, Railway |
| ATP / tools | `atp/`, `tools/` | Internal test/ops utilities |
| Docs (human) | `docs/architecture/`, domain `*_ARCHITECTURE.md` | Living specs; **this file** is the pinned LLM summary |

### Frontend Core

| Concern | Choice | Location / Notes |
|---------|--------|------------------|
| UI framework | Vue 3 SFC + `<script setup>` / mixed JS-TS | `client/src/components/`, `client/src/views/` |
| Styling | Tailwind CSS 4 (`@tailwindcss/vite`) | `client/src/assets/` |
| State | **Pinia** (7 store modules) | `auth`, `authRegistry`, `appShell`, `notifications`, `notificationPreferences`, `activeImports`, `bulkDeleteProgress` |
| Routing | Static + **dynamic registry routes** | `client/src/router/index.js`, `dynamicRoutes.js`, `audit.routes.js`, `portal.routes.js` |
| HTTP | `apiClient.js` over `fetch` | JWT from auth; dedup + TTL caches; `installFetchApiBase.ts` patches global `fetch` |
| i18n | `vue-i18n` 11 | `client/src/locales/{lang}/*.json` — langs include `en`, `ar`, `de`, `es`, `fr`, `hi`, `it`, `ja`, `ko`, `nl`, `pt`, `ru`, `zh`; keys lowerCamelCase, max 3 segments |
| Rich UI libs | Headless UI, Heroicons, TipTap, FullCalendar, Chart.js, Vue Flow, GridStack, DOMPurify, TanStack Virtual | Per feature area |
| Observability | Sentry (`@sentry/vue`), PostHog (`posthog-js`) | `client/src/config/` |
| Tests / lint | Vitest, oxlint, ESLint, `i18n:check` | `client/src/tests/` |

### Backend Core

| Concern | Choice | Location / Notes |
|---------|--------|------------------|
| HTTP | Express 5 | `server/server.js` — route mount table below |
| ODM | Mongoose 8 | `server/models/` (**221** schema files; ~196 `wrapTenantModel`) |
| Auth | JWT (`jsonwebtoken`) + `protect` | `server/middleware/authMiddleware.js` |
| Jobs | **Bull** + Redis (`redis` package) | `server/worker.js` + queue services |
| Scheduling | `node-cron` | `*Scheduler*` / monitor services |
| Email | Nodemailer, AWS SES, AMDS providers, mailparser | `server/services/email*`, `platform/communication/`, `platform/mailroom/` |
| Payments | Stripe SDK + gateway adapters | `payment-gateways`, public pay links |
| Files | Multer + local/S3 | `server/uploads/`, `uploadRoutes.js` |
| Observability | Sentry Node | `server/lib/sentryNode.js` |

### Data Stores & Tenancy

| Store | Role |
|-------|------|
| **Master MongoDB** | Default `arivu_master` (`MASTER_DB_NAME`). Platform metadata, org registry, definitions, public registries |
| **Per-org tenant DB** | Optional `organization.database.name` + `database.initialized`; `databaseConnectionManager` + `tenantContext` AsyncLocalStorage |
| **Redis** | Bull queues (`REDIS_URL` / `REDIS_HOST`); optional rate-limit store |
| **Browser localStorage** | Auth user/org; API metadata cache keys `arivu:api-cache:*` |

### Third-Party Integrations (Primary)

| Integration | Use |
|-------------|-----|
| MongoDB Atlas / self-hosted | Primary persistence |
| Redis | Queue backend |
| AWS (SES, S3, Route53) | Email, storage, DNS provisioning |
| AMDS | Email credits / outbound delivery (`/api/platform/amds`, internal webhooks) |
| Google APIs | Gmail/calendar connect |
| Kubernetes | Multi-instance provisioning |
| Stripe | Payment gateways / subscription fields |
| Web Push | Browser push |
| Sentry / PostHog | Errors / product analytics |

### Application Keys (`server/constants/appKeys.js`)

`SALES` | `HELPDESK` | `PROJECTS` | `PORTAL` | `AUDIT` | `LMS` | `INVENTORY` | `MARKETING` | `CONTROL_PLANE`  

**Default unresolved API path:** `SALES` (legacy `/api` namespace).

### Addon Keys (`server/constants/addonKeys.js`)

Installable tenant capabilities (not apps): `live_chat` | `email_credits` | `articles` | `blog`  
Catalog: `AddonDefinition` (master) + `TenantAddonConfiguration` + admin `/api/admin/addon-pricing`.

---

## 2. Directory Map

### Repository Root

```
Arivu/
├── client/                 # Vue SPA (desktop + responsive web)
├── mobile/                 # Capacitor mobile-native app (Home, Inbox, Tasks, More)
├── server/                 # Express API + worker
├── docs/                   # Architecture, runbooks, specs
├── helm/arivu/             # K8s charts
├── atp/                    # Automated test platform
├── tools/                  # Dev/ops utilities
├── scripts/                # Ops / archive utilities
├── Architecture_Document.md
├── README.md, GETTING_STARTED.md, TECHNICAL_SPEC.md
└── SECURITY_*.md
```

### Frontend (`client/src/`)

| Path | Responsibility |
|------|----------------|
| `main.ts` | Bootstrap: Pinia, i18n, router, fetch base, color mode; import `stores/auth` before app root |
| `App.vue` | Shell layout, tabs, sidebar slot |
| `router/` | Routes, `appAccessGuards.ts`, dynamic registration |
| `views/` | Pages: Deals, People, GenericModule, Settings, Inbox, Documents, Analytics, Content, ControlPlane, platform/*, admin/* |
| `components/` | Feature UI (deals, cases, settings, record-page, inbox, catalog, live-chat, …) |
| `components/record-page/` | Shared record layout: sections, activity, comments, neighbors |
| `composables/` | `useTabs`, `useRecordContext`, `useNotificationStream`, … |
| `stores/` | Session, shell, notifications, imports, bulk delete |
| `platform/` | Contracts: fields, permissions, filters, forms, modules, organizations, analytics, events |
| `platform/fields/` | `fieldCapabilityEngine.ts`, `globalSystemFields.ts`, per-module `*FieldModel.ts` |
| `utils/` | `apiClient.js`, `buildSidebarForSession.ts`, `buildModuleListFromRegistry.ts` |
| `locales/` | Per-language JSON namespaces |
| `config/` | `apiBase.ts`, PostHog, debug flags |
| `services/` | Audit offline sync, notification realtime helpers |
| `constants/` | Case lifecycle, catalog, app enums |
| `tests/` | Vitest |

**Registry-driven UI pipeline:**

`GET /api/ui/*` → `buildSidebarForSession` / `buildModuleListFromRegistry` / `dynamicRouteLoader` → `GenericModule.vue` or dedicated views.

### Backend (`server/`)

| Path | Responsibility |
|------|----------------|
| `server.js` | Express app, middleware order, `/api/*` mounts (**~126** route modules) |
| `worker.js` | Bull workers (email, inbound, import, analytics, campaign send, …) |
| `routes/` | Route modules → controllers |
| `controllers/` | HTTP handlers |
| `models/` | Mongoose schemas; most `wrapTenantModel` |
| `middleware/` | Auth, org isolation, app context, permissions, uploads, rate limits, CSRF |
| `services/` | Domain logic (commercial, inventory, documents, SLA, marketing, onboarding, …) |
| `services/sla/` | Cross-module SLA policy engine |
| `services/contentStudio/`, `services/contentPlatform/` | Articles/blog/templates/themes |
| `services/marketing/` | Campaigns, audiences, assets |
| `services/analytics/` | Reports, widgets, dashboards, queues |
| `services/provisioning/` | K8s / instance lifecycle |
| `permissions/` | Permission constants (`peoplePermissions`, `analyticsPermissions`, …) |
| `constants/` | `appKeys`, `addonKeys`, `domainEvents`, `caseLifecycle`, … |
| `platform/mailroom/` | Inbound email pipeline |
| `platform/communication/` | Outbound email runtime |
| `utils/` | `tenantModelProxy`, `tenantContext`, `customFieldsExtractor`, validators |
| `lib/` | `mongoConnect.js`, `redisClient.js`, Sentry |
| `scripts/`, `migrations/` | One-offs and smoke checks |
| `tests/` | Node native test runner |

### API Route Prefix Map (`server/server.js`)

| Prefix | Domain |
|--------|--------|
| `/api/auth` | Login, register, token refresh |
| `/api/users`, `/api/roles`, `/api/profiles`, `/api/sharing` | Users, RBAC roles, profiles, sharing rules |
| `/api/organization`, `/api/v2/organization`, `/api/organizations` | Tenant org + SALES org surface |
| `/api/people` | People (contacts/leads) v2 |
| `/api/deals`, `/api/tasks`, `/api/events`, `/api/scheduling` | Sales core + scheduling |
| `/api/appointments` | Appointment booking (staff) |
| `/api/items`, `/api/catalog` | Product catalog v2 |
| `/api/quotes`, `/api/sales-orders`, `/api/invoices` | Commercial documents |
| `/api/payments`, `/api/refunds`, `/api/payment-links`, `/api/customer-statements`, `/api/bank-transfer-instructions` | Collections |
| `/api/payment-gateways`, `/api/payment-gateways/webhooks`, `/api/public/pay` | Gateways + public pay |
| `/api/inventory` | Stock ledger, locations, reservations, fulfillment |
| `/api/forms`, `/api/public/forms` | Audit/survey forms |
| `/api/webforms`, `/api/public/webforms` | Marketing/lead webforms (separate from forms) |
| `/api/helpdesk/cases`, `/api/helpdesk/articles` | Helpdesk |
| `/api/marketing/*` | Campaigns, audiences, segments, dashboard, reports, subscriptions, assets, blog |
| `/api/communications`, `/api/mailboxes`, `/api/inbox` | Email threads + workspace inbox |
| `/api/mailroom`, `/api/public/mailroom` | Inbound processing |
| `/api/live-chat`, `/embed/chat`, `/api/embed/chat` | Live chat addon + embed |
| `/api/modules` | Generic module records + unified record API |
| `/api/ui` | Sidebar, routes, registry, projections |
| `/api/config-registry` | Tenant field/pipeline config |
| `/api/relationships` | Relationship instances + record context |
| `/api/notifications`, `/api/notification-*`, `/api/digest`, `/api/push` | Notifications + digests + web push |
| `/api/data-changes` | Data-change SSE stream |
| `/api/settings`, `/api/business-hours`, `/api/groups`, `/api/user-preferences` | Config surfaces |
| `/api/documents`, `/api/document-folders` | Documents module (OCR + semantic search) |
| `/api/templates`, `/api/content-themes`, `/api/content-assets`, `/api/content-fonts`, `/api/content-studio` | Content Studio |
| `/api/public/content`, `/api/public/v1/content`, `/api/public/marketing` | Headless public content |
| `/api/analytics/*`, `/api/reports` | Analytics platform (+ legacy reports redirect) |
| `/api/targets` | Goals/KPIs |
| `/api/csv`, `/api/imports`, `/api/search`, `/api/geocode`, `/api/notes`, `/api/files`, `/api/activity` | Import / search / attachments |
| `/api/execution`, `/api/automation`, `/api/admin/*`, `/api/approvals` | Automation, processes, business flows, approvals |
| `/api/audit`, `/api/audit/execute`, `/api/audit/assignments` | Audit app |
| `/portal` | Portal app |
| `/api/platform`, `/api/onboarding`, `/api/platform/inbound-parser`, `/api/platform/amds`, `/api/platform/release-notes`, `/api/release-notes` | Platform home, onboarding, parser, AMDS, release notes |
| `/api/instances`, `/api/demo`, `/api/metrics` | Control plane / provisioning |
| `/api/trash`, `/api/upload`, `/api/uploads` | Trash + uploads |
| `/api/webhooks/*`, `/api/hooks/process`, `/api/internal/webhooks/amds` | Inbound webhooks |
| `/health`, `/internal/notifications` | Health |

### Types & Shared Contracts

| Location | Contents |
|----------|----------|
| `client/src/types/` | Command palette, audit, metrics, … |
| `client/src/platform/**/*.ts` | Field editability, permission helpers, filter resolver |
| `server/constants/` | Enums / event keys |
| `server/permissions/` | Server permission keys aligned with `Role.appPermissions` / Profiles |

### Database Access Hooks

| Mechanism | File | Behavior |
|-----------|------|----------|
| `wrapTenantModel(Model)` | `server/utils/tenantModelProxy.js` | Routes queries to tenant connection when `tenantContext` active |
| `enterTenantContext(conn, fn)` | `server/utils/tenantContext.js` | AsyncLocalStorage scope |
| `organizationIsolation` | `server/middleware/organizationMiddleware.js` | Loads org, opens tenant DB, sets `req.organization` |
| `organizationId` on schemas | Tenant models | **Required** filter on every query |
| Master / non-proxied (examples) | No `wrapTenantModel` | `Organization`, `ModuleDefinition`, `AppDefinition`, `Instance`, `InstanceRegistry`, `DemoRequest`, `RelationshipDefinition`, `TenantAppConfiguration`, `TenantModuleConfiguration`, `TenantRelationshipConfiguration`, `TenantAddonConfiguration`, `AddonDefinition`, `AddonPricingDefinition`, `PlatformInboundParserConfig`, `ParserMailboxRegistry`, `ParserInboundEvent`, `WebformPublicRegistry`, `AppointmentBookingPublicRegistry`, `ReleaseNote*`, `UserDirectory`, `EmailThreadRegistry`, `AmdsWebhookEvent`, … |

---

## 3. Core Database Schema & Data Models

### Tenancy & Identity

#### Organization (`organizations`) — **Dual-purpose document**

| `isTenant` | Role | Key fields |
|------------|------|------------|
| `true` | Workspace/tenant | `slug`, `subscription`, `limits`, `enabledApps[]`, `database.name`, `database.initialized`, settings |
| `false` | SALES **account** (company) | SALES fields: types, tiers, status; `organizationId` → tenant |

#### User (`users`) — tenant-scoped via proxy

| Field | Notes |
|-------|-------|
| `organizationId` | Tenant FK (required) |
| `email`, `password` (bcrypt), `firstName`, `lastName` | Identity |
| `roleId` → `Role` | Preferred RBAC |
| `role` | Legacy enum: owner/admin/manager/user/viewer |
| `permissions` | **Legacy CRM-shaped**; synced from role on login — prefer `Role.appPermissions` / Profiles |
| `allowedApps[]` | Per-user app entitlements |
| `businessHourSetId` | Optional business-hours override |

#### Role (`roles`) + Profile (`profiles`) + Sharing

| Concept | Notes |
|---------|-------|
| `Role.appPermissions` | `Map<appKey, { module: { action, scope? } }>` — legacy SoT |
| `Profile` | Reusable module + **field** privilege template; Role may use `privilegeMode: 'profile'` + `profileId` |
| Sharing | `ModuleSharingDefault`, `ModuleSharingRule` via `/api/sharing` — record visibility beyond ownership |
| Legacy `Role.permissions` | CRM module CRUD + `scope: all\|team\|own\|none` still used by older `checkPermission` paths |

#### Instance (`instances`) — master DB

Lifecycle per tenant: `status`, `organizationId` (unique), `demoRequestId`, `isInternal`.

---

### CRM Core (SALES)

#### People (`people`) — **Replaces legacy Contact**

| Group | Fields |
|-------|--------|
| Core | `first_name`, `last_name`, `email`, `phone`, `mobile`, `tags`, `assignedTo`, `createdBy`, `source` |
| Company link | `organization` → SALES Organization (company) |
| App data | `participations.{APP_KEY}.*` — **SALES:** `role` (Lead/Contact), `lead_status`, `contact_status` |
| System | `derivedStatus`, `customFields`, activity/description versions |
| Trash | `deletedAt`, `deletedBy`, `deletionReason` |

#### Deal (`deals`)

| Group | Fields |
|-------|--------|
| Core | `name`, `amount`, `amountMode` (`AUTO`\|`MANUAL`), `linesGrandTotal`, `currency`, `stage`, `probability`, `pipeline` |
| Legacy FK | `contactId` → People, `accountId` → Organization |
| Multi-relation | `dealPeople[]`, `dealOrganizations[]` (role, isPrimary) |
| Commercial lines | **`DealLine`** entity — expected commercial intent |
| Platform-owned | `status` (`Open` \| `Won` \| `Lost`), `derivedStatus`, `lostReason` |

**Deal ↔ Organization:** multiple via `dealOrganizations[]`; role ≠ Organization Type; exactly one Primary when any linked; Primary must be `customer`; legacy `accountId` syncs to primary customer.

**Deal ↔ People:** multiple via `dealPeople[]`; one person once; `role` ≠ Person Type; `isPrimary` independent of role; legacy `contactId` syncs to Primary.

**Deal amount:** `Deal.amount` canonical; `MANUAL` user-owned; `AUTO` from DealLines via `DealPricingService`; Quote generation through **`CommercialConversionService`** (Quote must not read DealLines directly).

**Stage vs Status:** Stage = tenant pipeline; Status = platform execution state (`Open`/`Won`/`Lost`), read-only (`STATUS_WRITE_PROTECTED`); Lost Reason for loss nuance. Reporting keys off Status.

#### Task / Event / Scheduling

- **Task:** `title`, status, priority, `assignedTo`, `relatedTo`, dueDate, trash.
- **Event:** `eventId`, types (Meeting, audits…), status, scheduling, audit execution linkage, geo/beat.
- **Scheduling / Appointments:** `Scheduling` model + public book/manage tokens.

#### Item / Catalog

`items`, `itemvariants`, `catalogcategories`, `catalogpricebooks`, `itemgroups`, bundles, lifecycle, media gallery.

**Settings IA:** Catalog is a top-level Settings tab (categories, price books, item groups). Inventory Settings is ledger/ops only (taxes, charges). Bundle is an item type (composition), not a settings domain.

#### Form + FormResponse vs Webform

| Stack | Use |
|-------|-----|
| `forms` / `formresponses` | Audit / survey; `/api/forms`, `/api/public/forms` |
| `webforms` / `webformsubmissions` | Lead capture; `/api/webforms`, `/api/public/webforms`; public registry on master |

---

### Commercial Platform (SALES)

```
Deal (+ DealLines)
  → CommercialConversionService → Quote (+ lines/sections/approvals/documents)
  → SalesOrderConversionService → SalesOrder (+ lines/sections/fulfillment)
  → InvoiceConversionService → Invoice (+ lines/sections/documents)
  → Payment / Refund / Allocation / Credit / Statements / PaymentLink
```

| Collection family | Purpose |
|-------------------|---------|
| `quotes`, `quotelines`, `quotesections`, `quoteapprovals`, `quotedocuments`, `quoteconversionlinks` | CPQ + acceptance + conversion coverage |
| `salesorders`, `salesorderlines`, `salesordersections`, `salesorderfulfillments`, `salesorderinvoiceallocations` | Order + fulfillment |
| `invoices`, `invoicelines`, `invoicesections`, `invoicedocuments` | Billing |
| `payments`, `paymentallocations`, `refunds`, `refundallocations`, `customercredit*`, `paymentlinks`, `paymentgatewaysessions`, `paymentgatewayevents`, `banktransferinstructions` | Collections |

Public: `/api/public/quotes`, `/api/public/pay`.

---

### Inventory (`INVENTORY` app)

Ledger-centric: `inventorylocations`, `inventoryledgerentries`, `inventorytransactions`, `inventoryreservations`, `inventorytransfers`, `inventoryadjustments`, `inventorycounts`, `inventorylots`, `inventoryserials`, `iteminventory`, `organizationinventorysettings`.  
APIs under `/api/inventory` (ledger + commercial docs: purchase-orders, receipt-notes, purchase-returns, delivery-notes, delivery-returns, sales-returns). Fulfillment ties to Sales Orders.

### Commercial Taxes (shared)

Reusable tax configuration for Sales + Inventory documents (not ledger-owned).  
Models: `taxes`, `taxgroups`, `organizationtaxsettings`, `taxregionalassignments`.  
API: `/api/taxes` (Sales app + items feature; calc via `taxCalculationService`).  
Settings UI: Settings → Inventory → Taxes. Consumer helpers: resolve-defaults, suggest-regional, calculate.

---

### Helpdesk

#### Case (`cases`)

`caseId`, lifecycle enums (`caseLifecycle.js`), requester/assignee/group, `slaCycles[]`, activities.  
Related: `responsetemplates`, mailroom → cases adapter, helpdesk articles routes, assignment rules.

#### SLA (platform + helpdesk)

- Helpdesk clocks: `helpdeskSla*` services.
- Cross-module policy engine: `server/services/sla/` — `SlaPolicy`, `SlaInstance`, `SlaExecutionLog`.

---

### Marketing (`MARKETING` app)

`Campaign`, `CampaignRecipient`, `MarketingAudience`, `MarketingSegment`, `MarketingAsset`, `MarketingSubscriptionPreference`, `EmailSuppression`.  
Queues: `campaignSendQueueService`. Public marketing + headless blog content.

---

### Documents & Content

| Area | Models / notes |
|------|----------------|
| Documents | `Document` (+ versions, folders, favorites, presence, inline comments, signatures, edit drafts); `ocrText` / `ocrStatus`; `searchEmbedding` (hash semantic index — external vector store deferred) |
| Content Studio | `ContentDocument*`, `ContentTemplate*`, `ContentTheme`, `ContentAsset`, `ContentFont`, `ContentSnippet`, `ContentReusableComponent`, `ContentCollection`, render jobs/outputs, article analytics/feedback |
| Headless | Public `/api/public/content` (+ v1); portal KB surfaces |

---

### Analytics Platform

`AnalyticsReport`, `AnalyticsWidget`, `AnalyticsDashboard`, `AnalyticsSchedule`, `AnalyticsSnapshot`, `AnalyticsAlert`, `AnalyticsApiToken`, `AnalyticsEmbedToken`, `AnalyticsFolder`, `AnalyticsFavorite`, `AnalyticsExecution`.  
Queues: `analyticsQueueService`, `analyticsScheduleQueueService`. Embed + public API tokens.

---

### Live Chat (addon `live_chat`)

`ChatSession`, `ChatMessage`, `LiveChatVisitor`, `LiveChatQueue`, `LiveChatBot`, `LiveChatSequence`, agent presence, assignment events, website content pages.
Routes: `/api/live-chat`, `/embed/chat`.
Widget branding: tenant `settings.widget.brandColor` (hex) via `/settings/addons/live_chat/widget`; public embed `/embed/chat/config` exposes it for launcher + iframe chrome.

---

### Cross-Cutting Platform Models

| Collection | Purpose |
|------------|---------|
| `relationshipinstances` / `relationshipdefinitions` | Directed module↔module links |
| `tenantmoduleconfigurations` / `tenantappconfigurations` / `tenantrelationshipconfigurations` | Per-tenant config (master-side) |
| `recordactivities`, `recorddescriptionversions`, `recordpresencesessions` | Activity / presence |
| `notifications` / `notificationrules` / `notificationpreferences` | Rules engine + prefs |
| `automationrules` / `automationexecutions` / `DeferredAutomationAction` | Workflow automation |
| `processes` / `processexecutions` / `processdefinitionversions` | Visual process designer |
| `approvalinstances` | Approval inbox |
| `businessflow` / `businesshoursets` / `holidaycalendars` / `businesshoursdailykpis` | Flows + hours |
| `communications` / `communicationthreadmeta` / `mailboxes` / `communicationevents` / `communicationconfigs` | Email |
| `mailroom*` | Inbound pipeline |
| `import_histories` / `importfieldmappingtemplates` | CSV import |
| `trashsnapshots` | Soft-delete snapshots |
| `reports` | Legacy saved reports (prefer Analytics) |
| `targets` / `targetassignments` / `targetcontributionledgers` / … | Goals/KPIs |
| `auditassignments` / `auditexecutioncontexts` / `audittimelines` | Audit app |
| `pushsubscriptions` | Web push |
| `groups`, `userpreferences`, `usersessions` | Teams / prefs / sessions |
| `releasenotes` / `releasenoteitems` / user release view/snooze | In-product release notes |
| `assignmentrulesets` / playbook schedule jobs | Assignment + playbook scheduling |

### Entity Relationship Summary (ASCII)

```
Tenant Organization (isTenant=true)
  ├── Users, Roles, Profiles, Sharing Rules, Groups
  ├── People ──┬── participations.SALES (lead/contact)
  │            └── organization → SALES Organization (isTenant=false)
  ├── Deals ──── DealLines → Quote → SalesOrder → Invoice → Payment
  ├── Tasks, Events, Items/Catalog, Forms/Webforms, Documents
  ├── Cases (HELPDESK) + SLA
  ├── Inventory ledger (INVENTORY)
  ├── Marketing campaigns/audiences (MARKETING)
  ├── Analytics artifacts
  ├── Live Chat (addon)
  ├── RelationshipInstances (any module ↔ any module)
  └── Tenant*Configuration (fields, stages, pipelines, addons)

Master DB: ModuleDefinition, AppDefinition, Instance*, DemoRequest,
           RelationshipDefinition, AddonDefinition, public registries, parser config
```

---

## 4. Key API Contracts & Data Flow

### Standard Authenticated Request Chain

```
HTTP Request
  → securityHeaders, compression, CORS
  → early public/webhook mounts (arivu inbound, AMDS, payment webhooks, public pay)
  → express.json (10mb)
  → api rate limiter + routeRateLimitMiddleware (/api)
  → csrfProtection (mutating routes)
  → protect (JWT → req.user)
  → resolveAppContext (req.appKey from URL/query)
  → requireAppEntitlement (user.allowedApps + org.enabledApps)
  → organizationIsolation (req.organization + tenant DB context)
  → checkPermission / requirePermission / profile+sharing resolution
  → [lazySalesInitialization | requireSalesApp | requireHelpdeskApp | …]
  → controller → service → Model (tenant proxy)
  → domain event → notificationEngine (async)
```

### Auth Contract

| Endpoint | Method | Response |
|----------|--------|----------|
| `/api/auth/login` | POST | `{ user, organization, token }` — includes legacy `permissions`, `allowedApps` |
| `/api/users/profile` | GET | Refreshes user + org; Pinia + localStorage |

**Client:** `Authorization: Bearer <token>` via `apiClient`. Token on `auth.user.token`.  
**Store access:** Prefer `authRegistry` `useAuthStore` — no static import cycles.

### Session Bootstrap (Client Cold Start)

```
Login → auth store persisted
  → router.beforeEach (requiresAuth)
  → initializeDynamicRoutes():
       GET /api/ui/registry | /api/ui/routes | /api/ui/sidebar
       → register dynamic routes
  → GenericModule / record pages fetch module metadata
```

Caches: in-memory + localStorage TTL (metadata ~5m; people/activity/relationships ~30s).

### People API (v2 — canonical contact/lead)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/people/create` | Resolver: create or attach with `appKey` |
| `POST /api/people/:id/attach` / `detach` | App participation |
| `POST /api/people/:id/convert-lead-to-contact` | SALES lifecycle |
| `GET /api/people/:id/profile` | Composed profile |
| `PUT .../update-core` / `update-app-fields` | Core vs `participations.{appKey}` |
| `GET/POST/PUT/DELETE /api/people` | CRUD (delete → trash) |

### Deals API (representative)

`GET/POST /api/deals`, `GET/PUT/DELETE /api/deals/:id`, `PATCH /api/deals/:id/stage` — permissions `deals.*` + ownership/sharing filters.

### Unified Module Record API

Base: `/api/modules/:moduleKey/records/:recordId/`

| Endpoint | Purpose |
|----------|---------|
| `POST .../batch` | Bulk fetch |
| `GET .../activity` | Merged activity + comments |
| `GET/POST .../comments` | Comment thread |
| `GET .../neighbors` | Prev/next list navigation |

Used by `ModuleRecordPage` for registry modules.

### UI Composition API

| Endpoint | Returns |
|----------|---------|
| `GET /api/ui/apps` | Enabled apps |
| `GET /api/ui/sidebar` | Navigation tree |
| `GET /api/ui/routes` | Dynamic routes |
| `GET /api/ui/apps/:appKey/modules` | Module list |
| `GET /api/ui/projection/:appKey/:moduleKey` | Create-form projection |
| `GET /api/ui/registry` | Full bootstrap payload |

### Config Registry / Relationships / Trash

- Config: `GET/PUT /api/config-registry/*` — pipelines, stages, picklists, lifecycle maps.
- Relationships: `GET /api/relationships/record-context`, `POST /api/relationships/links`.
- Trash: `DELETE` on trashable modules → `deletionService.moveToTrash()`; `/api/trash` list/restore/purge.

### Real-Time Updates (No WebSocket)

| Channel | Transport | Client | Server |
|---------|-----------|--------|--------|
| Notifications | **SSE** | `useNotificationStream` | `notificationSSEHub` / `notificationSSEDeliver` |
| Inbox | **SSE** | `useInboxStream` | `inboxSSEHub` |
| Data changes | **SSE** | data-change consumers | `dataChangeSSEHub` |
| Push (offline) | Web Push | service worker | `pushService` |

**Polling fallback:** notification refresh on focus/route change.

### Async / Background (`server/worker.js`)

| Queue service | Domain |
|---------------|--------|
| `emailQueueService` | Outbound email |
| `inboundEmailQueueService` | Inbound / mailroom |
| `importQueueService` | CSV imports |
| `analyticsQueueService` / `analyticsScheduleQueueService` | Analytics compute + schedules |
| `campaignSendQueueService` | Marketing sends |
| (+ live chat queue helpers) | Live chat routing |

Schedulers (cron): document OCR/semantic, expiry, SLA monitors, onboarding nudges, business-hours KPIs, etc.

### Public (Unauthenticated) Routes

`/api/public/forms`, `/api/public/webforms`, `/api/public/book`, `/api/public/appointments/manage`, `/api/public/quotes`, `/api/public/mailroom`, `/api/public/marketing`, `/api/public/content`, `/api/public/v1/content`, `/api/public/pay`, `/embed/chat` — token/slug scoped; no JWT.

### Audit App Proxy Pattern

`/api/audit/execute/*` proxies execution to SALES event/form engines. Audit stores assignment + timeline; SALES owns state machines.

### Onboarding (maintenance mode)

`/api/onboarding` + `onboardingService` — platform capability only; no parallel frameworks. See `docs/USER_ONBOARDING_ARCHITECTURE.md`.

---

## 5. Architectural Rules & Edge Cases

### Multi-Tenancy

| Rule | Detail |
|------|--------|
| Always filter by `organizationId` | From `req.user.organizationId` or `req.organization._id` |
| Never trust client org id | Unless `DISABLE_SECURITY=true` (dev) |
| Tenant DB | When `organization.database.initialized`, `wrapTenantModel` hits dedicated DB |
| Master org | `Arivu Master` — platform admin only |
| `Organization` model | **Not** tenant-proxied; query with explicit tenant id |

### App & Addon Entitlements

| Check | Location |
|-------|----------|
| Org enabled apps | `organization.enabledApps[].appKey` + `status: ACTIVE` |
| User allowed | `user.allowedApps[]` |
| Middleware | `requireAppEntitlement` after `resolveAppContext` |
| App gates | `requireSalesApp`, `requireHelpdeskApp`, `requireAuditApp`, `requirePortalApp`, … |
| Addons | `TenantAddonConfiguration` + `ADDON_KEYS` (live_chat, email_credits, articles, blog) |
| Client | `buildAppAccessProfile`, `appAccessGuards.ts`, `auth.hasAppAccess(appKey)` |

**URL → appKey (examples):** `/api/helpdesk` → HELPDESK; `/api/audit` → AUDIT; `/api/marketing` → MARKETING; `/api/inventory` → INVENTORY; default `/api` → SALES.

### Permissions

| Layer | Rule |
|-------|------|
| Role / Profile | `Role.appPermissions` and/or Profile privileges + field permissions |
| Sharing | Module sharing defaults/rules widen/narrow record sets |
| Legacy sync | `User.permissions` still checked by older `checkPermission('deals','view')` |
| Owner/admin bypass | `isOwner` / admin role |
| Scope | `all` / `team` / `own` / `none` + ownership filters |
| Platform contract | Client `platform/permissions` is **explanation-only in DEV** — not enforcement |
| People-specific | `PEOPLE_PERMISSIONS`; attach/detach require `appKey` |

### People / Contact Migration Rules

| Rule | Detail |
|------|--------|
| Canonical module key | `people` (not `contacts`) |
| SALES lead/contact | Only in `participations.SALES` |
| Legacy `contactId` on Deal | Supported; prefer `dealPeople` |
| Permission alias | Client may map `people` → `contacts` for legacy checks |
| Do not set `createdBy` after create | Mongoose pre-hook blocks updates |

### System Fields (Never in Create/Edit UI)

Add to **three** places: `moduleController.getBaseFieldsForKey` excluded Set, `globalSystemFields.ts`, `customFieldsExtractor.RESERVED_KEYS`.

Current globals: `deletedAt`, `deletedBy`, `deletionReason`.

### Trash / Deletion

| Trashable modules | people, organizations, deals, tasks, events, items, responses (non-audit, non-submitted) |
| Service | `deletionService.moveToTrash` — may return `{ blocked, dependencies }` |
| Forbidden | Direct `Model.deleteOne` / `findByIdAndDelete` on trashable models in controllers |

### Field & Form Rendering (Client)

| Rule | Detail |
|------|--------|
| Capabilities | `fieldCapabilityEngine.ts` — `canEditField`, `isSystemField` |
| Labels | `useFieldLabel`, i18n `sysField*` keys |
| Custom fields | `customFields` Mixed; server extraction |
| Registry modules | `GenericModule.vue` + server module definition |
| Dedicated views | People, Deals, Events, Documents, Analytics, Inbox, Quotes, … |
| Tabs | `useTabs` — browser-like record tabs |
| Projections | `GET /api/ui/projection/:appKey/:moduleKey` |

### i18n (Required for New UI)

All user-visible strings: `t('namespace.key')`. No module-scope `useI18n` in `.js` composables. Run `npm run i18n:check` in CI.

### Security Edge Cases

| Topic | Rule |
|-------|------|
| `DISABLE_SECURITY` | Opt-in only |
| CSRF | Enabled on `/api` mutating routes |
| Rate limits | `apiLimiter`, `routeRateLimitMiddleware`, bootstrap limiters |
| Uploads | `/api/uploads` org-scoped |
| Idempotency | `apiClient` idempotency key for `POST /communications/email` |

### Settings / Surfaces / Work

| Mode | Purpose | Examples |
|------|---------|----------|
| Settings | Configure modules, fields, automation | `Settings.vue`, `/api/settings` |
| Surfaces | Navigation shells | Sidebar, Platform Home, Inbox |
| Work | Execute on records | Record pages, pipeline, case desk, commercial docs |
| Control plane | Cross-tenant ops | Instances, demo, AMDS infra, inbound parser, addon pricing |

### Domain Events & Notifications

Emit via `server/constants/domainEvents.js` / `domainEventHelpers`; `notificationEngine` delivers in-app/email/SMS/push per rules. SSE publish is fire-and-forget (never throw to caller).

### Naming / Legacy Aliases

| Legacy | Current |
|--------|---------|
| CRM | SALES app |
| Contact | People |
| `enabledModules` | Deprecated → `enabledApps` |
| `/dashboard` | → `/sales/dashboard` |
| `/api/reports` | Prefer `/api/analytics/*` |

### Control Plane vs Tenant

| Concern | Location |
|---------|----------|
| Demo → instance provision | `/api/demo`, `/api/instances`, `Instance`, `DemoRequest` |
| Admin cross-org | `/api/admin/*` + platform-admin / master org checks |
| Metrics | `/api/metrics` |
| AMDS / parser | `/api/platform/amds`, `/api/platform/inbound-parser` |

### AI / Semantic (current)

**Astra v2 is the active AI platform.** Source of truth: `docs/ASTRA_V2_ARCHITECTURE.md`
(Context → Orchestrator → Agents → Tools → Models, with cross-cutting Governance
+ Memory). Product = **Arivu**, Platform = **Astra**. Mounted at `/api/ai/v2`
(`server/services/astra/`, `astraV2Routes`), flags `ASTRA_V2` (default on) /
`ASTRA_V2_SHADOW`.

> **Legacy cutover:** the older AI implementation under `server/services/ai/`
> remains mounted at `/api/ai` and is **deprecated / in cutover** — it will be
> removed once every surface is migrated to v2. Shared primitives it owns
> (`providerRegistry`, `aiSettingsResolver`, `piiRedaction`, `aiCreditService`,
> `aiAuditLogService`, `vector/*`) are **reused** by v2 and must survive
> deletion. See `server/services/astra/compat/{legacyMap,deprecationMap,cutover}.js`.

| Capability | Status |
|------------|--------|
| Astra v2 platform | **Active** — `docs/ASTRA_V2_ARCHITECTURE.md`, `/api/ai/v2` |
| Astra Studio / Living Canvas | **Active** — `docs/ASTRA_STUDIO_ARCHITECTURE.md`, `/api/astra/studio`, WS `/api/astra/studio/ws`, flag `ASTRA_STUDIO` |
| Legacy AI spine (`server/services/ai/`) | **Deprecated — cutover in progress**, still at `/api/ai` |
| Document OCR index | Shipped (`documentOcrIndexService`) |
| Document semantic search | Shipped — **in-app hash embeddings** on `Document.searchEmbedding` |
| Platform Home focus | Rule-based (`platformHomeFocusService`) — **no LLM** |

**Legacy AI roadmap (historical):** `docs/AI_PLATFORM_ARCHITECTURE_AND_ROADMAP.md` — superseded as source of truth by `docs/ASTRA_V2_ARCHITECTURE.md`.

### When Adding Features (Checklist)

1. Model: `organizationId` + `wrapTenantModel` vs master-only  
2. Routes: mount in `server.js`; middleware chain for app/addon  
3. Permissions: `Role`/`Profile` + server `requirePermission`; sharing if records are listable  
4. Client: registry entry if list module; field model in `platform/fields/`  
5. Trashable? → `deletionService` only  
6. System fields? → triple exclusion list  
7. i18n keys + `i18n:check`  
8. Real-time? → SSE hub pattern, not WebSocket  
9. New app/module merge: empty-state classification, module visit tracking, PostHog, Platform Home if applicable  
10. Addon? → `addonKeys` + `AddonDefinition` seed + entitlement checks  

---

## Appendix: Pinia Store Responsibilities

| Store | State / Actions |
|-------|-----------------|
| `auth` | `user`, `organization`, login/logout, `hasPermission`, `hasAppAccess`, profile refresh |
| `authRegistry` | Indirection for `useAuthStore` (avoids circular imports) |
| `appShell` | Active app, sidebar collapse, layout chrome |
| `notifications` | In-app list, unread, SSE merge |
| `notificationPreferences` | Per-channel/module prefs |
| `activeImports` | Import job progress |
| `bulkDeleteProgress` | Mass delete/update progress banner |

---

## Appendix: Key File Index (Quick Lookup)

| Need | File |
|------|------|
| Express mounts | `server/server.js` |
| Auth | `server/middleware/authMiddleware.js` |
| Tenant DB | `server/middleware/organizationMiddleware.js` |
| App / addon keys | `server/constants/appKeys.js`, `addonKeys.js` |
| API client | `client/src/utils/apiClient.js` |
| Dynamic routes | `client/src/router/dynamicRoutes.js` |
| Sidebar | `client/src/utils/buildSidebarForSession.ts` |
| Field policy | `client/src/platform/fields/fieldCapabilityEngine.ts` |
| Soft delete | `server/services/deletionService.js` |
| Notifications | `server/services/notificationEngine.js` |
| Commercial Deal→Quote | `server/services/commercialConversionService.js` |
| Quote→SO | `server/services/salesOrderConversionService.js` |
| Documents OCR/semantic | `server/services/documentOcrIndexService.js`, `documentSemanticIndexService.js` |
| SLA engine | `server/services/sla/slaPolicyEngine.js` |
| Mailroom | `server/platform/mailroom/` |
| Worker | `server/worker.js` |
| Extended docs | `docs/architecture/`, `docs/*_ARCHITECTURE.md` |

---

## Appendix: Scale Snapshot (as of refresh)

| Metric | Count |
|--------|-------|
| Mongoose model files | 221 |
| Tenant-proxied models | ~196 |
| Route modules | ~126 |
| Express `app.use` mounts | ~135 (includes static/middleware) |
| Pinia stores | 7 |
| App keys | 9 |
| Addon keys | 4 |

---

*Pinned LLM context. Update when adding apps, addons, route mounts, or breaking schema/commercial boundaries.*
