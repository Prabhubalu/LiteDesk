# Event Status Lifecycle

**Status:** Architecture Lock (World-Class model)  
**Date:** 2026-08

## Model

| Layer | Owner | Mutable? | Purpose |
|---|---|---|---|
| `statusCategory` (`OPEN` \| `DONE` \| `CANCELLED`) | Platform | No | Semantics: filters, complete/cancel, analytics, calendar rules |
| `status` (label) | Tenant (non-audit types) | Labels/order/colors under a category | UX vocabulary |

Every label maps to exactly one category.

## Non-audit types (`Meeting`, `Field Sales Beat`)

- Admin configures labels under each category: **Settings → Events → Status**
- Users may set `status` among active labels for that type (`PATCH /api/events/:id/status` or update payload)
- **Complete** → default `DONE` label; **Cancel** → default `CANCELLED` label
- Cannot remove an in-use label (archive only); ≥1 active value per category

### Meeting system seeds

| Label | Category | Default |
|---|---|---|
| **Scheduled** | OPEN | Yes (create) |
| **Completed** | DONE | Yes (complete action) |
| **Cancelled** | CANCELLED | Yes (cancel action) |
| **No Show** | CANCELLED | No |

Legacy label **Planned** still maps to OPEN (archived alias; not selectable for new values).

### Field Sales Beat / audit seeds

`Planned` / `Completed` / `Cancelled` (Planned = OPEN default).

## Audit types

- System vocabulary only (`Planned` / `Completed` / `Cancelled`)
- No manual status picklist edit; workflow + complete/cancel

## Implementation

- Domain: `server/domain/events/eventStatus.js`
- Model: `server/models/EventTypeStatusConfig.js`, `Event.status` + `Event.statusCategory`
- Service: `server/services/eventStatusService.js`
- Settings API: `GET/PUT /api/settings/core-modules/events/status-lifecycle`
- UI: `client/src/components/settings/EventStatusLifecycleSettings.vue`

## Invariants

1. Categories are never tenant-defined.
2. New events always start in `OPEN` (type default open label).
3. Audit types never use tenant status configs.
4. Unknown legacy labels resolve to `OPEN` with safe fallback; known system labels always map correctly.
