# Arivu — Project Structure

> Multi-instance, white-label CRM / Helpdesk / Audit / Forms platform.
> Backend: **Node.js + Express + MongoDB (Mongoose)** · Frontend: **Vue 3 + Pinia + Vite + Tailwind**.
> Infra: **Docker · Kubernetes (Helm) · AWS (S3 / SES / Route 53)**.

This document is a guided tour of the repository so a new contributor can quickly find their way around. Everything below maps to actual folders/files in the repo, not aspirational layout.

---

## 1. Top-Level Layout

```text
Arivu/                         ← workspace root (project codename: Arivu)
├── client/                       Vue 3 SPA (frontend)
├── server/                       Node.js / Express API (backend)
├── helm/                         Helm chart for Kubernetes deployment
├── scripts/                      Repo-wide shell/maintenance scripts
├── docs/                         Long-form developer & ops documentation
├── .github/                      PR templates, CI workflows, security checklist
├── .cursor/                      Cursor IDE rules (e.g. trash-deletion-isolation)
├── Dockerfile.backend            Backend container image
├── Dockerfile.frontend           Frontend container image (Nginx)
├── docker-compose.yml            Local dev stack (Mongo + backend + frontend + Redis)
├── nginx.conf                    Nginx reverse-proxy config
├── start.sh / stop.sh / restart.sh   Local lifecycle helpers
├── deploy-local-build.sh         Local build → deploy helper
├── README.md                     High-level overview & quick start
├── TECHNICAL_SPEC.md             Deep technical specification
├── SECURITY_*.md                 Security guidelines for contributors
└── docs/archive/root-historical/*.md   Historical phase / feature / migration notes (moved from repo root)
```

Most historical design notes (for example `PHASE_0D_*`, `TABS_*`, `SIDEBAR_*`, `AUDIT_*`, `FORMS_*`, `EVENTS_*`) live under `docs/archive/root-historical/`. Canonical entry points remain `README.md`, `TECHNICAL_SPEC.md`, and [`PLATFORM_ARCHITECTURE.md`](./PLATFORM_ARCHITECTURE.md) in this same folder for the deep platform write-up.

---

## 2. High-Level Architecture

```text
                ┌───────────────────────────────┐
                │      Master Control Plane     │
                │  Vue Frontend  ◄──►  Express  │
                │                       Backend │
                │           │                   │
                │           ▼                   │
                │     Master MongoDB            │
                └─────────────┬─────────────────┘
                              │  provisions
                              ▼
                ┌───────────────────────────────┐
                │ Kubernetes Cluster (per tenant)│
                │   ┌──────────────┐             │
                │   │ Tenant A     │  acme.arivu │
                │   │  FE+BE+Mongo │             │
                │   ├──────────────┤             │
                │   │ Tenant B     │  corp.arivu │
                │   │  FE+BE+Mongo │             │
                │   └──────────────┘             │
                └───────────────────────────────┘
```

Key ideas you will see reflected in the code:

- **Multi-tenant + multi-instance** — A single deploy hosts many organizations, and the control plane can also spin up dedicated per-tenant Kubernetes instances (see `server/services/provisioning/`).
- **App platform model** — Functionality is split into *apps*: `SALES` (CRM), `HELPDESK`, `AUDIT`, `PORTAL`, `FORMS`. Each app is gated by entitlements/permissions (see `server/middleware/requireSalesAppMiddleware.js`, `requireHelpdeskAppMiddleware.js`, `requireAuditAppMiddleware.js`, etc.).
- **Dynamic UI composition** — The frontend builds sidebar, dashboards, lists and record pages from a server-driven registry (`client/src/utils/build*FromRegistry.ts`, backed by `server/controllers/uiCompositionController.js`).
- **People / Organization v2** — A unified "People" model replaces legacy contacts; see `server/models/People.js`, `server/models/Organization.js`, and the feature flags documented in `README.md`.

---

## 3. Backend — `server/`

Entry points:

- `server.js` — Main Express app, security, CORS, route mounting, Mongo connect, Sentry, graceful shutdown.
- `worker.js` — Optional Bull/Redis worker that processes the `email-send` queue.
- `server-fresh.js` — Alternate clean bootstrap variant.
- `test-connection.js` — Quick Mongo connectivity sanity check.

```text
server/
├── server.js                   Express app entry
├── worker.js                   Bull queue worker (emails)
├── package.json                Backend deps & npm scripts (start, worker, migrations, tests)
├── railway.json                Railway deploy config
│
├── config/                     Boot-time config
│   ├── validateEnv.js          Asserts required env vars on startup
│   ├── corsConfig.js           CORS allow-list (incl. tenant subdomains)
│   └── awsConfig.js            AWS SDK setup (S3 / SES / Route 53)
│
├── lib/                        Shared infra clients
│   ├── mongoConnect.js         Master DB connect + retry
│   ├── redisClient.js          Shared Redis connection
│   ├── redisHealth.js          Redis health probe
│   └── sentryNode.js           Sentry init / Express error handler
│
├── constants/                  App-wide constants (frozen catalogs)
│   ├── appKeys.js              SALES / HELPDESK / AUDIT / PORTAL / FORMS keys
│   ├── appRegistry.js          App definitions & metadata
│   ├── appRoles.js             Role catalog per app
│   ├── appPricingRegistry.js   Pricing tiers
│   ├── caseLifecycle.js        Helpdesk case states
│   ├── domainEvents.js         Internal event topic names
│   ├── executionCapabilities.js / executionDomains.js / executionFeedbackRegistry.js
│   ├── notificationRules.js / notificationRuleRegistry.js
│   ├── moduleProjections.js    Per-module projection presets
│   ├── instanceLifecycle.js    Tenant instance state machine
│   ├── integrationRegistry.js  3rd-party integration metadata
│   ├── provisioningIntents.js  Provisioning request shapes
│   ├── recordSource.js / reviewActions.js / tenantDefaults.js
│   ├── assignmentRules.js / defaultTaskRelationships.js
│
├── routes/                     Express routers — one file per feature
│   ├── authRoutes.js, userRoutes.js, roleRoutes.js
│   ├── organizationRoutes.js, organizationV2Routes.js, organizationSurfaceRoutes.js
│   ├── peopleRoutes.js, dealRoutes.js, taskRoutes.js, eventRoutes.js
│   ├── caseRoutes.js (helpdesk), auditRoutes.js, auditExecutionRoutes.js, auditReadRoutes.js
│   ├── formRoutes.js, responseRoutes.js
│   ├── moduleRoutes.js, moduleRecordRoutes.js, relationshipRoutes.js, configRegistryRoutes.js
│   ├── automationRuleRoutes.js, automationContextRoutes.js, processRoutes.js
│   ├── businessFlowRoutes.js, businessFlowTemplateRoutes.js, approvalRoutes.js
│   ├── notificationRoutes.js, notificationRuleRoutes.js, notificationPreferenceRoutes.js,
│   │   notificationAnalyticsRoutes.js, notificationHealthRoutes.js, pushRoutes.js, digestRoutes.js
│   ├── inboxRoutes.js, schedulingRoutes.js, executionRoutes.js, searchRoutes.js
│   ├── csvRoutes.js, importHistoryRoutes.js, uploadRoutes.js, filesRoutes.js, notesRoutes.js
│   ├── activityRoutes.js, communicationsRoutes.js, inboundEmailWebhookRoutes.js
│   ├── trashRoutes.js, settingsRoutes.js, userPreferencesRoutes.js, uiCompositionRoutes.js
│   ├── reportRoutes.js, itemRoutes.js, groupRoutes.js
│   ├── portalRoutes.js (App #2)
│   ├── adminRoutes.js, instanceRoutes.js, demoRoutes.js, metricsRoutes.js, healthRoutes.js
│
├── controllers/                Request handlers (paired ~1:1 with routes)
│   ├── authController.js, userController.js, roleController.js, adminController.js
│   ├── peopleController.js, peopleResolverController.js
│   ├── organizationController.js, organizationCreateController.js, organizationV2Controller.js
│   ├── dealController.js, taskController.js, eventController.js, caseController.js
│   ├── auditController.js, auditExecutionController.js, auditReadController.js
│   ├── formController.js, formResponseController.js, responseDetailController.js
│   ├── moduleController.js, moduleRecordController.js, relationshipController.js,
│   │   configRegistryController.js, uiCompositionController.js
│   ├── automationRuleController.js, automationContextController.js, processController.js,
│   │   businessFlowController.js, businessFlowTemplateController.js, approvalController.js,
│   │   executionController.js
│   ├── notificationController.js, notificationRuleController.js, notificationPreferenceController.js,
│   │   notificationAnalyticsController.js, notificationHealthController.js, notificationStreamController.js,
│   │   pushController.js
│   ├── inboxController.js, communicationsController.js, inboundEmailController.js, sesWebhookController.js
│   ├── csvController.js, importHistoryController.js, filesController.js, notesController.js,
│   │   activityController.js, searchController.js, schedulingController.js
│   ├── trashController.js, settingsController.js, userPreferencesController.js
│   ├── helpdeskSettingsController.js, assignmentRulesController.js
│   ├── itemController.js, groupController.js, reportController.js
│   ├── portalController.js, demoController.js, instanceController.js, metricsController.js
│
├── models/                     Mongoose schemas
│   ├── User.js, Role.js, Group.js, UserDirectory.js, UserPreferences.js
│   ├── Organization.js, OrganizationSubscription.js
│   ├── People.js, PersonNote.js, PersonFileAttachment.js
│   ├── Deal.js, DealComment.js, Task.js, TaskComment.js, Event.js, EventOrder.js, EventTracking.js
│   ├── Case.js                 (Helpdesk)
│   ├── Form.js, FormResponse.js, FormKPIs.js, ResponseTemplate.js
│   ├── AuditAssignment.js, AuditExecutionContext.js, AuditTimeline.js, CorrectiveActionEvidence.js
│   ├── ModuleDefinition.js, EntityType.js, RelationshipDefinition.js, RelationshipInstance.js,
│   │   AppDefinition.js, TenantAppConfiguration.js, TenantModuleConfiguration.js,
│   │   TenantRelationshipConfiguration.js, ThreadView.js, Lifecycle.js, LifecycleStatusMap.js
│   ├── AutomationRule.js, AutomationExecution.js, BusinessFlow.js, Process.js, ProcessExecution.js,
│   │   ApprovalInstance.js, AssignmentRuleSet.js, AssignmentExecutionLog.js, AssignmentScheduleJob.js
│   ├── Notification.js, NotificationPreference.js, NotificationRule.js, PushSubscription.js
│   ├── Communication.js, ImportHistory.js, RecordActivity.js, RecordDescriptionVersion.js, Report.js
│   ├── Item.js, Scheduling.js, ExecutionLog.js, TrashSnapshot.js
│   ├── Instance.js, InstanceRegistry.js, DemoRequest.js
│
├── middleware/                 Cross-cutting Express middleware
│   ├── authMiddleware.js                    JWT auth (`protect`)
│   ├── permissionMiddleware.js / requirePermission.js   RBAC checks
│   ├── tenantContextMiddleware.js / databaseMiddleware.js / organizationMiddleware.js
│   ├── resolveAppContextMiddleware.js       Resolves current app context
│   ├── requireSalesAppMiddleware.js / requireHelpdeskAppMiddleware.js /
│   │   requireAuditAppMiddleware.js / requirePortalAppMiddleware.js / requireAppEntitlementMiddleware.js
│   ├── lazySalesInitializationMiddleware.js  On-demand Sales bootstrap
│   ├── appBoundaryGuards.js                  Prevents cross-app leakage
│   ├── rateLimitMiddleware.js / rateLimitRedisStore.js / progressiveAuthThrottleMiddleware.js
│   ├── csrfMiddleware.js, securityHeadersMiddleware.js, securityLoggingMiddleware.js
│   ├── responseCacheMiddleware.js, deprecationMiddleware.js, uploadMiddleware.js
│
├── services/                   Business logic — controllers stay thin and delegate here
│   ├── automationEngine.js, automationActionHandlers.js, automationContextService.js,
│   │   automationLogger.js, automationRegistry.js
│   ├── processExecutor.js, processExecutionContext.js, processNodeHandlers.js, processInvocation.js
│   ├── businessFlowTemplateLoader.js, flowHealthAnalytics.js
│   ├── assignmentRulesEngine.js, assignmentExecutionService.js, assignmentSchedulingService.js,
│   │   assignmentSalesOwnerNotify.js, approvalApproverResolver.js
│   ├── notificationEngine.js, notificationRuleEngine.js, notificationDigestService.js,
│   │   notificationAnalyticsService.js, notificationRecipientResolver.js,
│   │   notificationPreferenceBootstrap.js, notificationSSEHub.js, notificationRuleModuleHelper.js
│   ├── notificationChannels/   emailChannel · inAppChannel · pushChannel · smsChannel · whatsappChannel
│   ├── emailService.js, emailQueueService.js, smsService.js, whatsappService.js, pushService.js
│   ├── helpdeskChannelIngestionService.js, helpdeskSlaService.js, helpdeskSlaMonitorService.js,
│   │   replyToTokenService.js
│   ├── caseExecutionService.js, caseLifecycleService.js
│   ├── auditSyncService.js, auditNotificationService.js, executionGatewayService.js,
│   │   executionEntitlementService.js
│   ├── formProcessingService.js, formScoringService.js,
│   │   blockRenderers/ (block-based PDF renderers + registry)
│   ├── enhancedPdfReportService.js, pdfPageGenerators.js, reportGenerationService.js,
│   │   reportTemplateService.js
│   ├── searchService.js, recordContextService.js, sourceResolver.js, geoValidationService.js,
│   │   commentMentionNotifications.js
│   ├── relationshipResolver.js, relationshipEnforcement.js, dealRelationshipService.js,
│   │   dealRelationshipInstanceSync.js, taskRelationshipInitializer.js, dependencyPolicy.js,
│   │   accessResolutionService.js, configRegistry.js, derivedStatusService.js, systemInvariants.js,
│   │   subscriptionBootstrapService.js, salesAppInitializer.js, tenantProvisioningMetadata.js,
│   │   uiCompositionService.js, deletionService.js, fileStorageService.js, scheduledJobs.js,
│   │   digestScheduler.js, escalationResolver.js, domainEvents.js, domainEventHelpers.js
│   ├── monitoring/             healthChecker.js, metricsCollector.js
│   └── provisioning/           Kubernetes / DB / DNS managers + tenantSeeder
│       ├── instanceProvisioner.js
│       ├── managers/            (k8s / db / dns)
│       └── utils/
│
├── utils/                      Pure helpers (no Express)
│   ├── tenantContext.js, tenantDomain.js, tenantMetadata.js, tenantModelProxy.js,
│   │   databaseConnectionManager.js, getMasterDatabaseUri.js
│   ├── peopleFieldRegistry.js, peopleTypeResolver.js, peopleAppContextResolver.js,
│   │   peopleQuickCreateContextResolver.js, normalizePeopleModuleConfig.js,
│   │   personProfileComposer.js, syncSalesParticipation.js, getSalesParticipationValues.js
│   ├── moduleProjectionResolver.js, appProjectionQuery.js, appProjectionCreateResolver.js,
│   │   relationshipRegistry.js, descriptionVersionHelper.js, recordActivityLogger.js
│   ├── appAccessUtils.js, rolePermissionProjection.js, fieldAccessControl.js, blockVisibility.js,
│   │   defaultFieldValidations.js, dependencyEvaluation.js, customFieldsExtractor.js
│   ├── caseApiValidators.js, caseListQuery.js, caseAnalytics.js
│   ├── executionCapabilityRegistry.js, executionErrorMapper.js, executionFeedbackResolver.js
│   ├── auditLinkedFormAccess.js, automationGuardrails.js, idempotencyGuard.js, detachPolicy.js,
│   │   trashGuard.js, subscriptionUtils.js, activityResolver.js, eventUtils.js,
│   │   filesResolver.js, notesResolver.js, platformMetadata.js, taskRelationshipSettings.js,
│   │   warnDeprecatedPeopleTypeAlias.js, mappers/
│   └── __tests__/              Node `--test` unit tests for the helpers above
│
├── domain/                     Domain-driven helpers (audit, events)
│   ├── audit/
│   └── events/
│
├── permissions/                Permission catalogs
│   └── peoplePermissions.js
│
├── templates/                  Seed / static templates
│   └── business-flows/
│
├── migrations/                 One-off Mongo migrations (run via npm scripts)
│
├── scripts/                    Operational scripts: seed admin, seed demos, backfills, smoke tests, env setup
│
├── tests/                      Higher-level / integration tests
│
├── types/                      Shared type definitions (JS / d.ts)
│
└── uploads/                    Locally-served upload dir (PDF reports, files, etc.)
```

### Backend conventions

- **Routing → Controller → Service → Model**
  Routes mount in `server.js` under `/api/<feature>`, delegate to a controller, which calls services for non-trivial logic and Mongoose models for persistence.
- **App-aware routes** apply `protect` (auth) → `resolveAppContextMiddleware` → `requireXxxAppMiddleware` → `requirePermission` before the controller.
- **Tenancy**: `tenantContextMiddleware` + `databaseConnectionManager` give each request a per-tenant Mongo connection; models are accessed through `tenantModelProxy` where applicable.
- **Soft deletes**: trashable modules (people, organizations, deals, tasks, events, items, non-audit responses) MUST go through `services/deletionService.js` — see `.cursor/rules/trash-deletion-isolation.mdc`.
- **System fields**: `deletedAt`, `deletedBy`, `deletionReason` are excluded everywhere — see `.cursor/rules/system-field-exclusion.mdc`.

### Top-level npm scripts (`server/package.json`)

| Script | What it does |
| --- | --- |
| `npm start` | Boot the API (`node server.js`) |
| `npm run worker` | Boot the Bull email worker (`node worker.js`) |
| `npm run test:role-permissions` / `test:people` / `test:helpdesk` | Targeted Node `--test` suites |
| `npm run smoke:helpdesk` | Helpdesk smoke checks |
| `npm run migrate:*` | One-off data migrations (event labels, helpdesk renames, people legacy, etc.) |
| `npm run backfill:people-org-links` | Backfill People ↔ Organization links |
| `npm run seed:internal-beta` | Seed internal beta data |
| `npm run security:audit` / `security:check` / `security:outdated` | Dependency / vulnerability checks |

---

## 4. Frontend — `client/`

```text
client/
├── index.html                  Vite entry HTML
├── vite.config.ts              Vite + Vue + Tailwind
├── tailwind.config.ts          Tailwind tokens
├── tsconfig*.json              TypeScript projects
├── eslint.config.ts            ESLint (flat config)
├── vitest.config.ts            Vitest config
├── vercel.json                 Vercel deploy hints
├── package.json                Frontend deps & scripts (dev, build, test, lint)
├── public/                     Static assets served as-is
├── docs/                       Frontend-specific docs
└── src/
    ├── main.ts                 Bootstraps the Vue app, Pinia, Router, Sentry
    ├── App.vue                 Root component
    │
    ├── router/                 Vue Router
    │   ├── index.js            Main router, route guards
    │   ├── dynamicRoutes.js    Dynamically generated module routes
    │   ├── audit.routes.js     Audit app routes
    │   └── portal.routes.js    Portal (App #2) routes
    │
    ├── stores/                 Pinia stores
    │   ├── auth.js, authRegistry.js
    │   ├── appShell.js         Sidebar / shell state
    │   ├── notifications.js, notificationPreferences.js
    │
    ├── layouts/                Top-level layouts
    │   ├── PlatformLandingLayout.vue
    │   ├── AuditLayout.vue
    │   └── PortalLayout.vue
    │
    ├── views/                  Page-level views (route targets)
    │   ├── Dashboard.vue, Login.vue, LandingPage.vue, ControlPlane.vue
    │   ├── People.vue / PeopleDetail.vue / PeopleCreate.vue / PeopleQuickCreate.vue / PeopleSurface.vue
    │   ├── Deals.vue / DealDetail.vue, Tasks.vue / TaskDetail.vue, Events.vue / EventDetail.vue
    │   ├── Forms.vue / FormBuilder.vue / FormDetail.vue / FormFill.vue / FormCreate.vue / PublicFormView.vue,
    │   │   FormResponses.vue / FormResponseDetail.vue, Responses.vue / ResponseDetail.vue
    │   ├── Organizations.vue / OrganizationDetail.vue / OrganizationSurface.vue / CreateOrganizationSurface.vue
    │   ├── Approvals (ApprovalInbox.vue, ApprovalDetail.vue), InboxSurface.vue
    │   ├── EventExecutionSurface.vue, GenericModule.vue, ItemDetail.vue / Items.vue,
    │   │   GroupDetail.vue / Groups.vue, Imports.vue / ImportDetail.vue
    │   ├── Settings.vue, Trash.vue, Demo.vue, DemoRequests.vue, InstanceManagement.vue
    │   ├── *.legacy.vue         Legacy variants kept for compatibility
    │   └── admin/, audit/, platform/, portal/, settings/   (sub-app views)
    │
    ├── pages/                  Newer page components (record page model)
    │   ├── ModuleRecordPage.vue
    │   ├── deals/, tasks/
    │
    ├── components/             Reusable components, grouped by feature
    │   ├── PlatformShell.vue, AppSidebar.vue, TabBar.vue, GlobalSearch.vue, Nav.vue,
    │   │   Files.vue, Notes.vue, ActivityTimeline.vue, ExecutionActionBar.vue,
    │   │   NotificationContainer.vue, LoginForm.vue, DemoRequestForm.vue
    │   ├── ui/                 Design-system primitives (cards, badges, headless inputs)
    │   ├── people/             People layers, momentum, participation modals
    │   ├── forms/              Form builder, analytics, report blocks, question types
    │   ├── audit/              Audit-specific UI
    │   ├── automation/         Automation context / badges / app flows
    │   ├── approvals/, dashboard/, deals/, events/, groups/, organizations/,
    │   │   contacts/, tasks/, settings/, communications/, notifications/,
    │   │   record-detail/, record-page/, module-list/, relationships/,
    │   │   import/, global/, common/, activity/, admin/, auth/, icons/
    │
    ├── platform/               Cross-cutting platform helpers
    │   ├── fields/             Global field capability engine, system field keys
    │   ├── filters/, forms/, modules/, organizations/, events/, permissions/
    │
    ├── composables/            Vue composables (`use*`)
    │   ├── useTabs.js, useSidebarState.ts, useActiveSurface.ts, useColorMode.js
    │   ├── useNotifications.js, useNotificationStream.js, useNotificationRules.js,
    │   │   useEventNotifications.js
    │   ├── usePeopleTypes.ts, useDerivedStatus.ts, useDefaultListFilters.ts,
    │   │   useRecordContext.js, useProjectionCreate.js, useBulkActions.js,
    │   │   useSalesDashboardMetrics.js, usePermissionSync.js, useEventOffline.js, useOffline.js
    │
    ├── services/               Browser-side services
    │   ├── auditSyncEngine.js  Offline ↔ online audit sync
    │   ├── offlineDb.js        IndexedDB wrapper
    │   └── offlineQueue.js     Mutation queue for offline mode
    │
    ├── utils/                  Frontend utilities
    │   ├── apiClient.js, portalApiClient.js, httpErrors.js
    │   ├── buildSidebarFromRegistry.ts, buildDashboardFromRegistry.ts,
    │   │   buildModuleListFromRegistry.ts, buildRecordDetailFromRegistry.ts,
    │   │   buildCommandsFromRegistry.ts, buildSidebarForSession.ts,
    │   │   getAppRegistry.ts, validateAppRegistry.ts, appRegistryNetwork.ts,
    │   │   builderCache.ts, dynamicRouteLoader.js, navigationIcons.ts, tabNavigation.js
    │   ├── fieldDisplay.js / .d.ts, fieldValidation.js, getFieldValue.ts, configAwareFields.ts,
    │   │   formEditPermissions.js, formValidation.js, dependencyEvaluation.js,
    │   │   defaultFieldValidations.js
    │   ├── peopleParticipationUi.ts, peopleTypeColors.ts, peopleTypesInvalidate.ts,
    │   │   personCreationUtils.ts, getParticipation.ts, getRoleDisplay.ts, projectionLabels.js,
    │   │   recordDisplay.js, fieldContextFilter.js
    │   ├── tenantSchemaApiCache.js / .d.ts, settingsTabAccess.ts, urlInputValidation.js,
    │   │   phoneInput.js, dateUtils.js, dateFilterOptions.ts, currencyOptions.js,
    │   │   creationContext.ts, eventUtils.ts, orgContactFormPairing.js, blockVisibility.js,
    │   │   notificationRouteMap.js, moduleRecordApiPath.js,
    │   │   verifyDynamicSidebar.js, assertValidSidebarStructure.ts
    │   └── *.sample.json        Reference fixtures for builders (sidebar, dashboard, command, module-list)
    │
    ├── types/                  Shared TS types (sidebar, command, dashboard, record-detail,
    │                            module-list, record-page, permission-snapshot, inbox*, eventSettings,
    │                            personCreation, organizationSurface, salesDashboardMetrics, …)
    │
    ├── commands/, config/, directives/, metadata/   Smaller cross-cutting modules
    ├── assets/                 Images, icons, styles
    └── tests/                  Vitest specs
```

### Frontend conventions

- **Server-driven UI**: sidebar, dashboards, list pages, record pages and command palette are all built from a registry returned by `/api/ui` and `/api/config-registry`. Builders live in `client/src/utils/build*FromRegistry.ts`; sample shapes live alongside as `*.sample.json`.
- **Apps and surfaces**: each "app" (Sales, Helpdesk, Audit, Portal, Forms) has its own routes, layout and views; the shell (`PlatformShell.vue`, `AppSidebar.vue`, `TabBar.vue`) handles the platform chrome.
- **Offline-first audit**: `services/auditSyncEngine.js` + `offlineDb.js` + `offlineQueue.js` allow audit execution offline, then sync when back online.
- **Permissions on the client** mirror the server registry via `composables/usePermissionSync.js` and types under `types/permission-*`.

### Top-level npm scripts (`client/package.json`)

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server (default port 5173) |
| `npm run build` | Type-check + production build |
| `npm run build:chunks` | Build + print chunk sizes |
| `npm run preview` | Preview the prod build locally |
| `npm run type-check` | `vue-tsc --build` |
| `npm test` / `test:watch` | Vitest |
| `npm run lint` | Run `oxlint` then `eslint` (both with `--fix`) |

---

## 5. Infrastructure & DevOps

```text
helm/arivu/                     Helm chart for Kubernetes deploys
├── Chart.yaml
├── values.yaml
└── templates/                  Deployment / Service / Ingress / ConfigMap manifests

Dockerfile.backend              Builds Node.js backend image
Dockerfile.frontend             Builds Nginx-served Vue dist
docker-compose.yml              Local stack: mongo + backend + frontend + redis
nginx.conf                      Reverse-proxy config used by the frontend image / local proxy

scripts/
├── security-check.sh           Repo-wide security check
├── update-backend-oci.sh       Rebuild + push backend image to Oracle Cloud / OCI
└── archive/                    Older one-off scripts

start.sh / stop.sh / restart.sh   Spin local server + client up/down
deploy-local-build.sh             Build images locally and apply to a target environment
cleanup-scripts.sh                Repo housekeeping helper
```

CI/CD lives in `.github/workflows/` and is wired through GitHub Actions; PR hygiene is enforced via `.github/PULL_REQUEST_TEMPLATE.md` and `.github/SECURITY_CHECKLIST.md`.

---

## 6. Documentation

There are two doc surfaces:

1. **Repository root `*.md`** — A small set of entry points (`README.md`, security guides, onboarding summaries, `TECHNICAL_SPEC.md`, tabs/email primers, etc.).
2. **`docs/`** — Evergreen guides: developer setup, environment, deployment, monitoring, scripts, API references, permission components, datatable usage, etc. Subfolders:
   - `docs/architecture/` — architecture diagrams & deep-dives.
   - `docs/design-system/` — design tokens / component guidelines.
   - `docs/archive/` — older docs kept for reference, including `docs/archive/root-historical/` (phase notes and session write-ups moved from the repo root).

If you need to onboard:

1. `README.md` — the high-level path to running locally.
2. `docs/DEVELOPER_SETUP.md` — full onboarding.
3. `TECHNICAL_SPEC.md` + [`PLATFORM_ARCHITECTURE.md`](./PLATFORM_ARCHITECTURE.md) (in this archive folder) — system-level mental model.
4. `SECURITY_GUIDELINES.md` + `.github/SECURITY_CHECKLIST.md` — required reading before submitting code.

---

## 7. Request → Response Walk-Through (Backend)

For example, listing People in the Sales app:

1. **Browser** calls `GET /api/people` with a JWT.
2. `server.js` mounts `peopleRoutes` at `/api/people`.
3. The route applies, in order:
   - `protect` (auth) — `middleware/authMiddleware.js`
   - `tenantContextMiddleware` — picks the right Mongo DB
   - `resolveAppContextMiddleware` — sets `req.appContext = SALES`
   - `requireSalesAppMiddleware` — verifies entitlement
   - `requirePermission('contacts:read')` — RBAC check (note: `people` aliases to `contacts` per `README.md`)
4. `peopleController.js` calls helpers in `utils/peopleFieldRegistry.js` and services like `services/recordContextService.js`.
5. The `People` Mongoose model (under the tenant connection) executes the query.
6. The response is shaped using projection helpers (`utils/moduleProjectionResolver.js`) and sent back.

The same shape applies for Deals, Tasks, Cases (Helpdesk), Audit assignments, Forms, etc. — only the routes/controllers/models change.

---

## 8. Quick "Where do I…?" Map

| I want to… | Look in |
| --- | --- |
| Add an HTTP endpoint | `server/routes/*Routes.js` + matching `controllers/*Controller.js` |
| Add business logic that calls models | `server/services/*Service.js` (or `*Engine.js`) |
| Add / change a Mongoose schema | `server/models/*.js` |
| Add a permission check | `server/middleware/permissionMiddleware.js` + `requirePermission` |
| Add an app-gated route | Wrap with `requireSalesAppMiddleware` / `requireHelpdeskAppMiddleware` / `requireAuditAppMiddleware` |
| Soft-delete a record | `server/services/deletionService.js` (see `.cursor/rules/trash-deletion-isolation.mdc`) |
| Add a system field | Update `globalSystemFields.ts`, `moduleController.js` excluded set, and `customFieldsExtractor.js` (see `.cursor/rules/system-field-exclusion.mdc`) |
| Add a frontend page | `client/src/views/` (or `pages/`) + register in `router/` |
| Add a Vue component | `client/src/components/<feature>/` |
| Add a Pinia store | `client/src/stores/*.js` |
| Build sidebar / dashboard / list / record dynamically | `client/src/utils/build*FromRegistry.ts` |
| Add a notification channel | `server/services/notificationChannels/` + register in `notificationEngine.js` |
| Add a scheduled job | `server/services/scheduledJobs.js` (cron) or `server/worker.js` (queue) |
| Provision a tenant instance | `server/services/provisioning/` |

---

**Source files cited in this document:**

- `README.md`, `TECHNICAL_SPEC.md`, [`PLATFORM_ARCHITECTURE.md`](./PLATFORM_ARCHITECTURE.md)
- `server/server.js`, `server/worker.js`, `server/package.json`
- `client/package.json`, `client/src/main.ts`
- `docker-compose.yml`, `Dockerfile.backend`, `Dockerfile.frontend`
- `.cursor/rules/trash-deletion-isolation.mdc`, `.cursor/rules/system-field-exclusion.mdc`
