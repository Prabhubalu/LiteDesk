# Helpdesk QA Rollout Checklist

This checklist is for Step 12 rollout readiness of the Helpdesk app.

## 1) Environment Readiness

- Confirm server is running with latest migrations/seeds applied.
- Confirm `HELPDESK` app is enabled for target tenant users.
- Confirm notification schedulers are enabled in environment:
  - `ENABLE_ASSIGNMENT_SCHEDULER`
  - `ENABLE_HELPDESK_SLA_SCHEDULER`
- Confirm outbound notification channels are configured where required.

## 2) Automated Verification

From `server/` run:

- `npm run test:helpdesk`

Expected:

- All Helpdesk utility tests pass.

## 3) API Smoke Verification

Use a valid bearer token for a Helpdesk-enabled user:

- `export HELPDESK_AUTH_TOKEN="<token>"`
- Optional: `export HELPDESK_BASE_URL="http://localhost:5000"`
- `npm run smoke:helpdesk`

Smoke checks validate:

- Case list endpoint
- Analytics endpoints:
  - `/api/helpdesk/cases/analytics/summary`
  - `/api/helpdesk/cases/analytics/trends`
  - `/api/helpdesk/cases/analytics/owners`
  - `/api/helpdesk/cases/analytics/distribution`
- Helpdesk execution settings endpoint
- Assignment rules endpoint

## 4) Functional QA Flows

- Create case with minimal payload and verify defaults.
- Validate lifecycle path: `New -> Assigned -> In Progress -> On Hold -> In Progress -> Resolved -> Closed`.
- Reopen closed case and confirm a new SLA cycle starts.
- Update priority/caseType/channel and verify SLA target recalculation activity.
- Trigger manual owner override and verify lock/reassignment behavior according to assignment settings.
- Verify delayed/scheduled assignment jobs execute when enabled.
- **SALES assignment automation (Phases 4–5):**
  - Change a People / Deal / Task / CRM Organization record so an **immediate** assignment rule applies; confirm the **new owner receives** the same assignment notification family as a manual assign (`TASK_ASSIGNED`, `PEOPLE_ASSIGNED`, `DEAL_ASSIGNED`, or `ORGANIZATION_ASSIGNED`).
  - Let a **scheduled** assignment job run for the same modules; confirm the assignee is notified after the job applies.
  - If using **user-defined notification rules** for SALES, confirm rules with module `people`, `deals`, `tasks`, or `organizations` and event `ASSIGNED` still match and fire for these automation-driven events (CRM org rules require the record’s `createdBy` user to belong to the tenant).
- Verify SLA warning/breach notifications are emitted once per cycle threshold.
- Verify inbound email routes to case and appends activity under configured duplicate policy.
- **Realtime helpdesk alerts** (bell, toast, sound, internal tab highlight): see [HELPDESK_NOTIFICATION_SIMULATION.md](./HELPDESK_NOTIFICATION_SIMULATION.md).
  - Bell/toast/SSE: `npm run simulate:helpdesk-notification` (optional UI: `VITE_ENABLE_HELPDESK_NOTIFICATION_DEV_PANEL=true` in `client/.env.local`).
  - **Internal tab:** open case tab → switch to another tab → simulate email/chat for that `caseId` → confirm stacked title (`New email · …`), amber tab background, animated icon → click case tab → alert clears.

## 5) Analytics QA

- Check summary KPI values for expected ranges:
  - total/open/closed/reopen counts
  - average first response and resolution metrics
  - SLA compliance percent
- Validate trends date range boundaries and 180-day guardrail.
- Validate owners analytics include compliance and reopen rates.
- Validate distribution analytics by priority/channel/caseType.

## 6) Rollout Guardrails

- Roll out tenant-by-tenant (or pilot cohort first).
- Monitor scheduler logs for assignment and SLA jobs. Assignment ticks may include `skipReasons` (for example `rule_no_longer_matches`, `ruleset_simulation_only`, `record_not_found`) when jobs were skipped.
- Monitor notification volume for `CASE_ASSIGNED`, `CASE_ESCALATED`, `CASE_SLA_WARNING`, `CASE_SLA_BREACHED`.
- Keep rollback ready by disabling Helpdesk schedulers if needed.

## 7) Sign-off

- Engineering sign-off
- QA sign-off
- Support/Operations sign-off
- Product sign-off
