# Targets & Quotas — Platform Specification

**Status:** Implemented (MVP + phased extensions)  
**Version:** 1.0  
**Type:** Platform performance engine (client + server)

## Related documents

| Document | Scope |
|----------|--------|
| `EXECUTION_BOUNDARY_RULES.md` | Automation ↔ Process boundaries |
| `PROCESS_FLOW_DESIGNER.md` | Process triggers from target events |

## Lifecycle (locked)

`draft` → `active` → `locked` → `completed` → `closed`

## Core principle

Targets store **aggregates** only. Contribution history is append-only in `TargetContributionLedger`.

## Synthetic events

- `target.lifecycle.activated`
- `target.progress.updated`
- `target.threshold.crossed`
- `target.status.changed`

## MVP contribution adapters

| App | Module | Default filter |
|-----|--------|----------------|
| SALES | deals | stage Won → sum amount |
| HELPDESK | cases | status Resolved → count |
| PLATFORM | tasks | status Completed → count |

## API

See `server/routes/targetRoutes.js` and `server/controllers/targetController.js`.

## Environment

- `ENABLE_TARGET_RECALC_SCHEDULER` — nightly batch recalc (default: enabled)
