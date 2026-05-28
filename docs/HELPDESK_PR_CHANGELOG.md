# Helpdesk PR Changelog (Steps 7-12)

This changelog summarizes the Helpdesk implementation from Assignment Rules through QA/Rollout, organized for reviewer-first scanning.

## Scope

- Step 7: Assignment Rules Engine (7A-7D)
- Step 8: Channel Ingestion Completion
- Step 9: Escalation + Notification Automation
- Step 10: Cases Surface Hardening
- Step 11: Reporting & Analytics
- Step 12: QA + Rollout

---

## Step 7 - Assignment Rules Engine

### 7A Foundation (rules + simulation)

- Added assignment constants and rule schemas:
  - `server/constants/assignmentRules.js`
  - `server/models/AssignmentRuleSet.js`
  - `server/models/AssignmentExecutionLog.js`
  - `server/models/AssignmentScheduleJob.js`
- Added deterministic simulation engine:
  - `server/services/assignmentRulesEngine.js`
- Added assignment rule APIs:
  - `GET /api/settings/automation/assignment-rules`
  - `PUT /api/settings/automation/assignment-rules`
  - `POST /api/settings/automation/assignment-rules/simulate`
  - implemented in `server/controllers/assignmentRulesController.js`
  - routes in `server/routes/settingsRoutes.js`

### 7B Immediate execution

- Added live immediate assignment service:
  - `server/services/assignmentExecutionService.js`
- Wired assignment execution into case orchestration:
  - `server/services/caseExecutionService.js`
- Added idempotency and assignment logs for immediate assignment decisions.

### 7C Delayed + scheduled execution

- Added scheduling service:
  - `server/services/assignmentSchedulingService.js`
- Added delayed/scheduled job enqueue and processor logic.
- Wired minute scheduler tick for assignment jobs:
  - `server/services/scheduledJobs.js`

### 7D Escalation / reassignment / locking

- Added assignment control fields on Case:
  - `server/models/Case.js` (`assignmentControl`)
- Added manual override handling and lock behavior.
- Implemented reassignment revert modes:
  - reapply rules
  - revert previous owner
  - lock current owner
- Added escalation-chain reassignment logic (threshold-based).

### 7E Helpdesk execution settings vs Automation (cleanup)

- Case assignment is **only** driven by **Settings → Automation** and the `AssignmentRuleSet` collection (`/api/settings/automation/assignment-rules`). The runtime engine never consumed the old `assignmentRules` JSON blob under Helpdesk execution settings.
- **Removed** legacy `assignmentRules` from Helpdesk execution settings: dropped from defaults, merge, validation, and save payload in `server/controllers/helpdeskSettingsController.js`, and removed the JSON editor block from `client/src/components/settings/HelpdeskExecutionSettings.vue` (replaced with a pointer to Automation). Existing tenants lose the stale key on the next save of Helpdesk execution settings; until then it is ignored.

---

## Step 8 - Channel Ingestion Completion

- Added Helpdesk channel ingestion service:
  - `server/services/helpdeskChannelIngestionService.js`
- Updated inbound email controller to route/append to Cases:
  - `server/controllers/inboundEmailController.js`
- Added channel-default behavior for case creation:
  - `server/controllers/caseController.js`
  - reads Helpdesk `channelRules` defaults for case type/priority.

---

## Step 9 - Escalation + Notification Automation

- Expanded domain event constants:
  - `CASE_ESCALATED`
  - `CASE_SLA_WARNING`
  - `CASE_SLA_BREACHED`
  - in `server/constants/domainEvents.js`
- Added notification rules for Helpdesk case events:
  - `server/constants/notificationRules.js`
- Added case recipient resolution support:
  - `CASE_OWNER` in `server/services/notificationRecipientResolver.js`
- Added SLA monitor service and scheduler tick:
  - `server/services/helpdeskSlaMonitorService.js`
  - integrated into `server/services/scheduledJobs.js`
- Enhanced scheduled assignment path to emit assign/escalation notifications:
  - `server/services/assignmentSchedulingService.js`

---

## Step 10 - Cases Surface Hardening

- Added robust case API validators:
  - `server/utils/caseApiValidators.js`
  - tests: `server/utils/__tests__/caseApiValidators.test.js`
- Added list-query parser with bounded/safe sorting:
  - `server/utils/caseListQuery.js`
  - tests: `server/utils/__tests__/caseListQuery.test.js`
- Hardened `caseController`:
  - strict id validation for routes
  - stricter payload handling for update paths
  - related item id validation + dedupe
  - text length/trim normalization for notes/resolution summary
  - activity payload trimming in detail responses
  - consistent mutation `meta` response blocks

---

## Step 11 - Reporting & Analytics

- Added analytics utility library:
  - `server/utils/caseAnalytics.js`
  - tests: `server/utils/__tests__/caseAnalytics.test.js`
- Added Helpdesk analytics endpoints:
  - `GET /api/helpdesk/cases/analytics/summary`
  - `GET /api/helpdesk/cases/analytics/trends`
  - `GET /api/helpdesk/cases/analytics/owners`
  - `GET /api/helpdesk/cases/analytics/distribution`
- Endpoint implementation in:
  - `server/controllers/caseController.js`
  - routed in `server/routes/caseRoutes.js`

---

## Step 12 - QA + Rollout

- Added Helpdesk smoke-check script:
  - `server/scripts/helpdeskSmokeChecks.js`
- Added package scripts:
  - `npm run test:helpdesk`
  - `npm run smoke:helpdesk`
  - in `server/package.json`
- Added rollout/QA checklist:
  - `docs/HELPDESK_QA_ROLLOUT_CHECKLIST.md`

---

## Helpdesk realtime alerts (agent workspace)

**Doc:** [HELPDESK_NOTIFICATION_SIMULATION.md](./HELPDESK_NOTIFICATION_SIMULATION.md)

### Delivered

- HELPDESK notification stream, rules, and persistence (`CASE_EMAIL_RECEIVED`, `CASE_CHAT_MESSAGE_RECEIVED`, existing case lifecycle events).
- Client: bell badge, SSE reconnect on `/helpdesk/` routes, toast, Web Audio chime.
- Internal browser tabs (TabBar): stacked title prefixes, amber highlight, icon animation (email wiggle / chat pulse); clear on tab focus.
- Dev simulation: CLI `npm run simulate:helpdesk-notification`, HTTP `POST /api/notifications/dev/simulate`, Vite dev panel.

### Follow-ups (not in this slice)

- Sound toggle in Settings UI; toast click → open case; alerts while on Sales app; list-tab highlighting for `CASE_CREATED`.

---

## Validation Commands Used

From `server/`:

- `npm run test:helpdesk`
- `node --check` on touched controllers/services/utils/scripts
- `npm run smoke:helpdesk` (requires token env setup)

---

## Reviewer Notes

- Existing app-level middleware and entitlement checks are retained for all new Helpdesk routes.
- Assignment and SLA automations are scheduler-driven and non-blocking to core case CRUD paths.
- Notifications remain preference-aware via the existing notification engine and recipient resolver pipeline.
